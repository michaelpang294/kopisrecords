import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from './app.mjs';
import {requestEmail, createRequestMailer} from './request-email.mjs';

function database(){
 const rows=new Map();
 return {rows, async execute(sql,p=[]){
  if(sql.startsWith('SELECT * FROM record_requests')) return [[rows.get(p[0])].filter(Boolean)];
  if(sql.startsWith('SELECT COUNT(*)'))return [[{total:rows.size,customer:[...rows.values()].filter(r=>r.email===p[0]||r.ip_hash===p[1]).length}]];
  if(sql.startsWith('INSERT IGNORE INTO record_requests')){
   if(!rows.has(p[0])) rows.set(p[0],{request_id:p[0],fingerprint:p[1],name:p[2],email:p[3],contact:p[4],record:p[5],notes:p[6],ip_hash:p[7],email_status:'pending'});
   return [{affectedRows:1}];
  }
  if(sql.includes("email_status = 'sending'")){
   const r=rows.get(p[1]);if(!['pending','failed'].includes(r.email_status))return [{affectedRows:0}];
   r.email_status='sending';r.mail_claim=p[0];return [{affectedRows:1}];
  }
  if(sql.startsWith('UPDATE record_requests')){
   const r=rows.get(p[0]);assert.equal(r.mail_claim,p[1]);r.email_status=sql.includes("'sent'")?'sent':'failed';return [{affectedRows:1}];
  }
  throw new Error(sql);
 }};
}
const body={requestId:'12345678-1234-4234-8234-123456789abc',name:'Michael',email:'customer@example.com',contact:'',record:'Slowdive — Souvlaki',notes:'Blue pressing'};
async function fixture(t,mailer){const pool=database();const server=createApp(pool,['http://localhost:5173'],{requestMailer:mailer}).listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));return {pool,post:async(b=body,headers={})=>fetch(`http://127.0.0.1:${server.address().port}/api/record-requests`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(b)})};}

test('record request validates and saves before SMTP; duplicate submission sends once',async t=>{
 let sent=0;let pool;
 const f=await fixture(t,{ready:true,send:async value=>{assert.equal(pool.rows.get(value.requestId).email_status,'sending');sent++;}});pool=f.pool;
 const res=await f.post();assert.equal(res.status,201);assert.deepEqual(await res.json(),{received:true,emailStatus:'sent'});
 assert.equal((await f.post()).status,200);assert.equal(sent,1);assert.equal(pool.rows.size,1);
 assert.equal((await f.post({...body,record:'Another title'})).status,409);assert.equal(sent,1);
 assert.equal((await f.post({...body,email:'x@example.com\r\nBcc:evil@example.com'})).status,400);
 assert.equal((await f.post({...body,notes:'a'.repeat(1501)})).status,400);
 assert.equal((await f.post({...body,email:''})).status,400);
 assert.equal((await f.post(body,{Origin:'https://foreign.example'})).status,403);
});

test('concurrent same-request claims only one email',async t=>{
 let finish,started;const waiting=new Promise(r=>started=r);let sends=0;
 const f=await fixture(t,{ready:true,send:async()=>{sends++;started();await new Promise(r=>finish=r);}});
 const first=f.post();await waiting;
 const second=await f.post();assert.equal(second.status,202);assert.equal((await second.json()).emailStatus,'sending');finish();assert.equal((await first).status,201);assert.equal(sends,1);
});

test('SMTP failure preserves request and explicit retry does not insert another row',async t=>{
 let fail=true,sends=0;
 const f=await fixture(t,{ready:true,send:async()=>{sends++;if(fail)throw Object.assign(new Error('SECRET PROVIDER ERROR'),{code:'TEST_MAIL_ERROR'});}});
 const res=await f.post();assert.equal(res.status,202);const value=await res.json();assert.equal(value.received,true);assert.equal(value.emailStatus,'failed');assert(!JSON.stringify(value).includes('SECRET'));
 assert.equal(f.pool.rows.size,1);fail=false;assert.equal((await f.post()).status,201);assert.equal(f.pool.rows.size,1);assert.equal(sends,2);
});

test('missing credentials fail clearly without storing an unsent request; persistent request limits apply',async t=>{
 const missing=await fixture(t,{ready:false,send:()=>assert.fail('no real email')});assert.equal((await missing.post()).status,503);assert.equal(missing.pool.rows.size,0);
 const f=await fixture(t,{ready:true,send:async()=>{}});
 for(let i=1;i<=3;i++) assert.equal((await f.post({...body,requestId:`12345678-1234-4234-8234-${String(i).padStart(12,'0')}`})).status,201);
 assert.equal((await f.post({...body,requestId:'12345678-1234-4234-8234-000000000004'})).status,429);
});

test('confirmation has a fixed Gmail sender, shop copy, reply address and escaped user text',()=>{
 const mail=requestEmail({...body,name:'<img src=x onerror=evil()>',record:'<script>evil</script>',notes:'<b>notes</b>'});
 assert.equal(mail.from.address,'kopisrecords@gmail.com');assert.equal(mail.to.address,body.email);assert.equal(mail.bcc,'kopisrecords@gmail.com');assert.equal(mail.replyTo,'kopisrecords@gmail.com');
 assert(mail.text.includes('<script>evil</script>'));assert(!mail.html.includes('<script>'));assert(mail.html.includes('&lt;script&gt;'));assert(mail.html.includes('&lt;img'));
 assert.equal(createRequestMailer({}).ready,false);
});
