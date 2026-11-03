import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApp } from "./app.mjs";
import { database } from "./testing/fake-database.mjs";
import { sendOptinEmails } from "./restock-optin.mjs";
async function setup(t) {
  const pool=database(0),sent=[];let failed=false;
  const mailer={ready:true,send:async(mail)=>{if(failed)throw Object.assign(Error('SMTP failed'),{code:'TEST_SMTP_FAILED'});sent.push(mail);}};
  const app=createApp(pool,['https://kopisrecords.shop'],{restockMailer:mailer,restockRequireConfirmation:true,orderMailer:{ready:false},orderSiteUrl:'https://kopisrecords.shop'});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await app.locals.restockAlerts.stop();await new Promise(r=>server.close(r));});
  async function call(path,body,token) {
    const r=await fetch(`http://127.0.0.1:${server.address().port}`+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{})});
    return{status:r.status,value:await r.json()};
  }
  return{pool,sent,mailer,app,call,signup:()=>call('/api/restock-alerts',{productId:1,email:'customer@example.com'}),fail:(value)=>{failed=value;}};
}
const tokenFrom=f=>f.sent.findLast(m=>m.messageId.includes('.optin@')).text.match(/#token=([a-f0-9]{64})/)[1];
test('production restock signup confirms the email before sending any availability alert',async t=>{
 const f=await setup(t);const response=await f.signup();assert.equal(response.status,202);assert.equal(response.value.confirmationRequired,true);
 await f.app.locals.restockAlerts.flush();assert.equal(f.sent.length,1);assert.match(f.sent[0].subject,/Confirm your stock alert/);
 const token=tokenFrom(f),proof=[...f.pool.state.optins.values()][0];
 assert.equal(proof.token_hash,createHash('sha256').update(token).digest('hex'));assert(!JSON.stringify([...f.pool.state.optins.values()]).includes(token));
 assert.equal([...f.pool.state.alerts.values()][0].status,'unconfirmed');
 await f.signup();await f.app.locals.restockAlerts.flush();assert.equal(f.sent.length,1);
 f.pool.state.stock=1;await f.app.locals.restockAlerts.flush();assert.equal(f.sent.length,1);
 const results=await Promise.all([f.call('/api/restock-alerts/confirm',{},token),f.call('/api/restock-alerts/confirm',{},token)]);
 assert(results.every(r=>r.status===200));await f.app.locals.restockAlerts.flush();assert.equal(f.sent.length,2);
 assert.match(f.sent[1].subject,/Back in stock/);assert(proof.confirmed_at);
 await f.app.locals.restockAlerts.flush();assert.equal(f.sent.length,2);
});
test('expired confirmation links can be replaced; previous signup cycles keep their opt-in evidence',async t=>{
 const f=await setup(t);await f.signup();await f.app.locals.restockAlerts.flush();const old=tokenFrom(f),check=[...f.pool.state.optins.values()][0];
 check.expires_at=new Date(0).toISOString();assert.equal((await f.call('/api/restock-alerts/confirm',{},old)).status,410);
 assert.equal((await f.call('/api/restock-alerts/confirm',{},'bad')).status,404);
 await f.signup();await f.app.locals.restockAlerts.flush();const token=tokenFrom(f);assert.notEqual(token,old);assert.equal(f.pool.state.optins.size,2);
 assert.equal((await f.call('/api/restock-alerts/confirm',{},old)).status,404);
 assert.equal((await f.call('/api/restock-alerts/confirm',{},token)).status,200);await f.app.locals.restockAlerts.flush();
 const current=[...f.pool.state.optins.values()].find(v=>v.confirmed_at);assert(current);
 f.pool.state.stock=1;await f.app.locals.restockAlerts.flush();f.pool.state.stock=0;
 await f.signup();await f.app.locals.restockAlerts.flush();assert.equal(f.pool.state.optins.size,3);assert(current.confirmed_at);
});
test('verification SMTP failures retry and simultaneous verification workers send once',async t=>{
 const f=await setup(t);f.fail(true);await f.signup();await f.app.locals.restockAlerts.flush();const v=[...f.pool.state.optins.values()][0];assert.equal(v.status,'failed');assert.equal(f.sent.length,0);
 f.fail(false);v.next_attempt_at=new Date(0).toISOString();
 await Promise.all([sendOptinEmails(f.pool,f.mailer,'https://kopisrecords.shop'),sendOptinEmails(f.pool,f.mailer,'https://kopisrecords.shop')]);
 assert.equal(f.sent.length,1);assert.equal(v.status,'sent');assert.equal([...f.pool.state.alerts.values()][0].status,'unconfirmed');
});
