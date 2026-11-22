import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { createApp } from "./app.mjs";
import { runJobs } from "./worker.mjs";
import { hashPassword } from "./admin-auth.mjs";
import { database } from "./testing/fake-database.mjs";
import { createInvoiceDispatcher, invoiceEmail, ensureInvoices } from "./invoices.mjs";
import { validateInvoiceDraft, invoiceTotals, invoiceCover } from "./invoice-rules.mjs";
const draft = (fulfilment="collection") => ({
  items: [
    {key:randomUUID(),title:"Starboy",artist:"The Weeknd",unitPrice:"56.10",quantity:2,medium:"Vinyl",variant:"2LP, translucent red",cover_image:"https://example.com/starboy.jpg"},
    {key:randomUUID(),title:"Starboy",artist:"The Weeknd",unitPrice:"18.20",quantity:1,medium:"CD",variant:"Japan pressing",cover_image:"https://example.com/starboy-cd.jpg"},
  ],fulfilment,deliveryFee:fulfilment==="delivery"?"4.50":"0.00",expiryDays:7,
  customerName:"Michael",email:"Customer@Example.com",notes:"Your reserved records.",platform:"Carousell",externalReference:"DEAL-123",internalNotes:"Private cost: 20; do not send this.",
});
const contact = {name:"Actual Buyer",phone:"+65 9123 4567",telegram:"@customer",address:"98 Arab Street, Level 2",postal:"199794"};
async function setup(t) {
  const pool=database(10),sent=[],mail=[];let fail=false;
  const invoiceMailer={ready:true,async send(message){if(fail)throw Object.assign(Error("private SMTP diagnostic"),{code:"SMTP_TEST_FAILED"});sent.push(message);}};
  const orderMailer={ready:false,async send(message){mail.push(message);}};
  const app=createApp(pool,["http://localhost:5173"],{adminPasswordHash:await hashPassword("correct-password-123"),secureCookies:false,invoiceMailer,orderMailer,orderSiteUrl:"http://localhost:5173"});
  const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
  t.after(async()=>{await app.locals.invoiceEmails.stop();await app.locals.orderEmails.stop();await new Promise(r=>server.close(r));});
  const base=`http://127.0.0.1:${server.address().port}`;
  async function call(path,data,options={}) {
    const response=await fetch(base+path,{method:options.method||(data===undefined?"GET":"POST"),headers:{"Content-Type":"application/json","X-Admin-Request":"1",...(options.token?{Authorization:`Bearer ${options.token}`}:{Cookie:options.cookie??cookie??""}),...options.headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
    return {status:response.status,value:await response.json(),response};
  }
  let cookie="";const login=await call('/api/admin/login',{password:'correct-password-123'});cookie=login.response.headers.get('set-cookie').split(';')[0];
  async function create(d=draft()) {const id=randomUUID();const r=await call('/api/admin/invoices',{id,draft:d});assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
  async function issue(d=draft()) {const invoice=await create(d),r=await call(`/api/admin/invoices/${invoice.id}/send`,{version:invoice.version});assert.equal(r.status,200,JSON.stringify(r.value));await app.locals.invoiceEmails.flush();const message=sent.find(m=>m.messageId.includes(invoice.id));const token=message?.text.match(/\/invoice#token=([a-f0-9]{64})/)[1];return {...invoice,token};}
  const action=(id,action,extra={})=>call(`/api/admin/orders/${id}/action`,{action,confirmed:true,paymentVerified:true,...extra});
  return {pool,app,call,create,issue,action,sent,mail,invoiceMailer,orderMailer,setFail:value=>{fail=value;}};
}
test("invoice amounts are exact cents; rows, contacts, expiry and cover URLs are validated",()=>{
  const d=validateInvoiceDraft(draft('delivery'));
  assert.deepEqual(invoiceTotals(d),{subtotal:13040,delivery:450,total:13490,count:3});
  assert.equal(d.email,'customer@example.com');
  for(const changes of [{items:[]},{items:[{...d.items[0],unitPrice:'-1'}]},{items:[{...d.items[0],unitPrice:'1.001'}]},{items:[{...d.items[0],quantity:1.5}]},{items:[{...d.items[0],title:''}]},{items:[{...d.items[0],medium:''}]},{items:[{...d.items[0],cover_image:'javascript:alert(1)'}]},{items:[d.items[0],d.items[0]]},{email:'bad\r\nBcc:evil@example.com'},{expiryDays:0},{deliveryFee:'NaN'},{items:[{...d.items[0],unitPrice:'0'}],deliveryFee:'0'}])assert.throws(()=>validateInvoiceDraft({...d,...changes}));
  assert.equal(invoiceCover('/api/covers/a.jpg','https://kopisrecords.shop'),'https://kopisrecords.shop/api/covers/a.jpg');
  assert.throws(()=>invoiceCover('http://localhost:3001/private.jpg','https://kopisrecords.shop'));
});
test("invoice admin routes require authentication and CSRF protection; preview creates no order or delivery",async t=>{
  const f=await setup(t);await ensureInvoices(f.pool);
  assert.equal((await f.call('/api/admin/invoices',undefined,{cookie:''})).status,401);
  assert.equal((await f.call('/api/admin/invoices',{id:randomUUID(),draft:draft()},{headers:{'X-Admin-Request':''}})).status,403);
  const i=await f.create();
  assert.equal((await f.call(`/api/admin/invoices/${i.id}/preview?version=${i.version}`)).status,200);
  assert.equal(f.sent.length,0);assert.equal(f.pool.state.orders.size,0);assert.equal(f.pool.state.holds.length,0);
  const list=await f.call('/api/admin/invoices?q=Carousell&status=draft');assert.equal(list.value.total,1);
  assert.equal(list.value.invoices[0].draft.internalNotes,draft().internalNotes);
  const preview=(await f.call(`/api/admin/invoices/${i.id}/preview?version=${i.version}`)).value;
  assert.match(preview.html,/Vinyl/);assert.match(preview.html,/Japan pressing/);assert.match(preview.html,/starboy.jpg/);assert.match(preview.text,/Subtotal \(3 items\): S\$130.40/);
  assert(!preview.html.includes('Private cost'));assert(!preview.html.includes('DEAL-123'));assert(!preview.html.includes('Carousell'));
});
test("drafts persist, stale edits/previews are rejected, and sent invoices are immutable",async t=>{
  const f=await setup(t),i=await f.create();
  const updated=await f.call(`/api/admin/invoices/${i.id}`,{version:i.version,draft:{...i.draft,notes:'Updated by me'}},{method:'PUT'});assert.equal(updated.status,200);assert.equal(updated.value.version,2);
  assert.equal((await f.call(`/api/admin/invoices/${i.id}`,{version:1,draft:i.draft},{method:'PUT'})).status,409);
  assert.equal((await f.call(`/api/admin/invoices/${i.id}/preview?version=1`)).status,409);
  assert.equal((await f.call(`/api/admin/invoices/${i.id}/send`,{version:1})).status,409);
  assert.equal((await f.call(`/api/admin/invoices/${i.id}/send`,{version:2})).status,200);
  assert.equal((await f.call(`/api/admin/invoices/${i.id}`,{version:3,draft:i.draft},{method:'PUT'})).status,409);
  assert.equal((await f.call(`/api/admin/invoices/${i.id}/preview?version=3`)).status,409);
});
test("double send creates one immutable order, sends one bill, and never reserves or changes catalogue stock",async t=>{
  const f=await setup(t),i=await f.create();
  const r=await Promise.all([f.call(`/api/admin/invoices/${i.id}/send`,{version:1}),f.call(`/api/admin/invoices/${i.id}/send`,{version:1})]);
  assert(r.every(v=>v.status===200));await f.app.locals.invoiceEmails.flush();
  assert.equal(f.pool.state.orders.size,1);assert.equal(f.pool.state.holds.length,0);assert.equal(f.pool.state.stock,10);assert.equal(f.pool.state.emails.size,0);assert.equal(f.sent.length,1);
  const details=JSON.parse(f.pool.state.orders.get(i.id).details);
  assert.equal(details.source,'invoice');assert.equal(details.items[0].id,-1);assert.equal(details.items[1].medium,'CD');assert.equal(details.items[1].variant,'Japan pressing');assert.equal(details.total,13040);
  assert(!JSON.stringify(details).includes('Private cost'));assert(!JSON.stringify(details).includes('Carousell'));
  const token=f.sent[0].text.match(/\/invoice#token=([a-f0-9]{64})/)[1];
  assert(f.pool.state.access.has(createHash('sha256').update(token).digest('hex')));assert(!f.pool.state.access.has(token));
  const read=await f.call('/api/order-recovery',undefined,{token});assert.equal(read.status,200);assert.equal(read.value.qr,null);
  for(const key of ['email','phone','telegram','name','address','postal'])assert.equal(read.value[key],undefined);
});
test("invoice customer must confirm contacts before QR/report, and cannot alter prices or recipient",async t=>{
  const f=await setup(t),i=await f.issue(draft('delivery'));
  assert.equal((await f.call('/api/order-recovery',undefined,{token:randomBytes(32).toString('hex')})).status,404);
  assert.equal((await f.call(`/api/checkout/${i.id}/payment-reported`,{})).status,409);
  assert.equal((await f.call('/api/order-recovery/payment-reported',{},{token:i.token})).status,409);
  for(const bad of [{phone:'abc'},{telegram:''},{name:''},{address:''},{postal:'123'}])assert.equal((await f.call('/api/order-recovery/invoice-details',{...contact,...bad},{token:i.token})).status,400);
  const r=await f.call('/api/order-recovery/invoice-details',{...contact,total:1,items:[],email:'hijack@example.com',fulfilment:'collection'},{token:i.token});
  assert.equal(r.status,200,JSON.stringify(r.value));assert.match(r.value.qr,/^data:image\/png/);assert.equal(r.value.total,13490);assert.equal(r.value.items.length,2);assert.equal(r.value.fulfilment,'delivery');
  const details=JSON.parse(f.pool.state.orders.get(i.id).details);assert.equal(details.name,contact.name);assert.equal(details.email,'customer@example.com');assert.equal(details.postal,'199794');
});
async function reported(f,fulfilment='collection') {
  const i=await f.issue(draft(fulfilment));
  assert.equal((await f.call('/api/order-recovery/invoice-details',contact,{token:i.token})).status,200);
  const responses=await Promise.all([f.call('/api/order-recovery/payment-reported',{},{token:i.token}),f.call(`/api/checkout/${i.id}/payment-reported`,{})]);assert(responses.every(r=>r.status===200));
  f.orderMailer.ready=true;await f.app.locals.orderEmails.flush();
  assert.equal(f.mail.length,2);assert.equal(f.pool.state.stock,10);
  return i;
}
test("custom collection invoice follows payment review, bank confirmation, bag number and completion emails once",async t=>{
  const f=await setup(t),i=await reported(f);
  const report=f.mail.find(m=>typeof m.to==='object');assert.equal(report.to.address,'customer@example.com');assert.match(report.text,/Japan pressing/);assert.match(report.html,/starboy.jpg/);assert(!report.text.includes('Product ID: -'));
  const shop=f.mail.find(m=>typeof m.to==='string');assert.match(shop.text,/@customer/);assert.match(shop.text,/Vinyl/);assert.equal(shop.to,'kopisrecords@gmail.com');
  assert.equal((await f.action(i.id,'paid')).status,200);await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.stock,10);assert.equal(f.mail.length,3);
  assert.equal((await f.action(i.id,'ready_for_collection',{collectionNumber:67})).status,200);await f.app.locals.orderEmails.flush();
  const ready=f.mail.find(m=>m.messageId.includes('customer_ready_for_collection'));assert.match(ready.text,/67/);assert.match(ready.text,/Rocks Cafe/);
  for(let j=0;j<2;j++)assert.equal((await f.action(i.id,'completed')).status,200);
  await f.app.locals.orderEmails.flush();assert.equal(f.mail.filter(m=>m.messageId.includes('customer_order_completed')).length,1);assert.equal(f.pool.state.stock,10);
  const receipt=await f.call('/api/order-recovery',undefined,{token:i.token});assert.equal(receipt.value.status,'completed');assert.equal(receipt.value.qr,null);
  const row=await f.call(`/api/admin/orders/${i.id}`);assert.equal(row.value.source,'invoice');assert.equal(row.value.items[1].medium,'CD');assert.equal(row.value.collectionNumber,67);
  assert.equal((await f.call(`/api/admin/invoices/${i.id}`)).value.orderStatus,'completed');
});
test("delivery invoices use dispatch and completed flow with delivery-specific confirmation",async t=>{
  const f=await setup(t),i=await reported(f,'delivery');
  assert.equal((await f.action(i.id,'paid')).status,200);await f.app.locals.orderEmails.flush();
  const paid=f.mail.find(m=>m.messageId.includes('customer_payment_confirmed'));assert.match(paid.text,/mailed out/);assert(!paid.text.includes('Rocks Cafe'));
  assert.equal((await f.action(i.id,'ready_for_collection',{collectionNumber:67})).status,409);
  assert.equal((await f.action(i.id,'dispatched')).status,200);await f.app.locals.orderEmails.flush();
  assert.match(f.mail.find(m=>m.messageId.includes('customer_order_dispatched')).text,/2–3 days/);
  assert.equal((await f.action(i.id,'completed')).status,200);await f.app.locals.orderEmails.flush();
  assert.match(f.mail.find(m=>m.messageId.includes('customer_order_completed')).text,/Enjoy your records/);assert.equal(f.pool.state.stock,10);
});
test("expired or void invoices cannot be paid; reported and paid invoices cannot be voided",async t=>{
  const f=await setup(t),i=await f.issue();
  f.pool.state.invoices.get(i.id).expires_at=new Date(Date.now()-1000);
  const row=f.pool.state.orders.get(i.id),details=JSON.parse(row.details);details.expiresAt=new Date(Date.now()-1000).toISOString();row.details=JSON.stringify(details);
  const expired=await f.call(`/api/admin/invoices/${i.id}`);assert.equal(expired.value.orderStatus,'expired');
  assert.equal((await f.call('/api/order-recovery/invoice-details',contact,{token:i.token})).status,409);
  assert.equal((await f.call('/api/order-recovery/payment-reported',{},{token:i.token})).status,409);
  const v=await f.issue();assert.equal((await f.call(`/api/admin/invoices/${v.id}/void`,{version:2,confirmed:true})).status,200);
  assert.equal((await f.call('/api/order-recovery',undefined,{token:v.token})).value.status,'cancelled');
  assert.equal((await f.call('/api/order-recovery/invoice-details',contact,{token:v.token})).status,409);
  const p=await reported(f);
  assert.equal((await f.call(`/api/admin/invoices/${p.id}/void`,{version:2,confirmed:true})).status,409);
  assert.equal((await f.action(p.id,'paid')).status,200);
  assert.equal((await f.call(`/api/admin/invoices/${p.id}/void`,{version:2,confirmed:true})).status,409);
});
test("failed invitation is durable and retry does not duplicate order; separate workers claim once",async t=>{
  const f=await setup(t);f.setFail(true);const i=await f.issue();assert.equal(f.sent.length,0);assert.equal(f.pool.state.orders.size,1);
  const failed=f.pool.state.invoices.get(i.id);assert.equal(failed.email_status,'failed');assert.equal(failed.email_error,'SMTP_TEST_FAILED');
  f.setFail(false);assert.equal((await f.call(`/api/admin/invoices/${i.id}/email/retry`,{})).status,200);await f.app.locals.invoiceEmails.flush();
  assert.equal(f.sent.length,1);assert.equal(failed.email_status,'sent');assert.equal(f.pool.state.orders.size,1);
  f.invoiceMailer.ready=false;const j=await f.create();f.invoiceMailer.ready=true;
  // Hold this app's kick while two independent queue workers race.
  f.app.locals.invoiceEmails.kick=()=>{};
  assert.equal((await f.call(`/api/admin/invoices/${j.id}/send`,{version:1})).status,200);
  const worker=()=>createInvoiceDispatcher(f.pool,{mailer:f.invoiceMailer,siteUrl:'http://localhost:5173'});
  await Promise.all([worker().flush(),worker().flush()]);assert.equal(f.sent.filter(m=>m.messageId.includes(j.id)).length,1);
});
test("invoice send rolls back on queue failure; unconfigured email blocks issue and safe content is escaped",async t=>{
  const f=await setup(t),i=await f.create();f.invoiceMailer.ready=false;
  assert.equal((await f.call(`/api/admin/invoices/${i.id}/send`,{version:1})).status,503);assert.equal(f.pool.state.orders.size,0);
  f.invoiceMailer.ready=true;const getConnection=f.pool.getConnection;
  f.pool.getConnection=async()=>{const db=await getConnection();return {...db,execute:async(sql,p)=>{if(sql.startsWith("UPDATE custom_invoices SET status='sent'"))throw Object.assign(Error('failed'),{code:'TEST_DB_FAILURE'});return db.execute(sql,p);}};};
  assert.equal((await f.call(`/api/admin/invoices/${i.id}/send`,{version:1})).status,500);assert.equal(f.pool.state.orders.size,0);assert.equal(f.pool.state.invoices.get(i.id).status,'draft');assert.equal(f.sent.length,0);
  const d=draft();d.customerName='<script>alert(1)</script>';d.items[0].title='<img onerror=bad>';
  const m=invoiceEmail(i.id,validateInvoiceDraft(d),'https://kopisrecords.shop/invoice#preview',null,'https://kopisrecords.shop');assert(!m.html.includes('<script>'));assert(!m.html.includes('<img onerror'));assert.match(m.html,/&lt;script&gt;/);assert.equal(m.disableFileAccess,true);assert.equal(m.disableUrlAccess,true);
});
test("website checkout cannot forge an invoice to bypass catalogue stock deduction",async t=>{
  const f=await setup(t),id=randomUUID(),token=randomBytes(32).toString('hex');
  const r=await f.call('/api/checkout',{requestId:id,recoveryToken:token,...contact,email:'customer@example.com',items:[{id:1,quantity:1}],fulfilment:'collection',source:'invoice',invoiceId:id,invoiceDetailsConfirmed:true});assert.equal(r.status,200);assert.equal(r.value.source,undefined);
  assert.equal((await f.call(`/api/checkout/${id}/payment-reported`,{})).status,200);assert.equal((await f.action(id,'paid')).status,200);assert.equal(f.pool.state.stock,9);
});

test("cron sends custom invoice invitations and skips stale invoices without needing a web request",async t=>{
  const f=await setup(t); f.app.locals.invoiceEmails.kick=()=>{};
  const first=await f.create();assert.equal((await f.call(`/api/admin/invoices/${first.id}/send`,{version:1})).status,200);
  const stale=await f.create();assert.equal((await f.call(`/api/admin/invoices/${stale.id}/send`,{version:1})).status,200);
  assert.equal((await f.call(`/api/admin/invoices/${stale.id}/void`,{version:2,confirmed:true})).status,200);
  const original=f.pool.getConnection,execute=f.pool.execute;
  f.pool.getConnection=async()=>{const db=await original();return{...db,execute:async(sql,args)=>sql.startsWith('SELECT GET_LOCK')?[[{acquired:1}]]:sql.startsWith('SELECT RELEASE_LOCK')?[[]]:db.execute(sql,args)};};
  f.pool.execute=async(sql,args)=>sql.startsWith('DELETE FROM admin_sessions')?[{}]:execute(sql,args);
  await runJobs(f.pool,{databaseName:'test-invoices',siteUrl:'http://localhost:5173',orderMailer:{ready:false},restockMailer:{ready:false},preorderMailer:{ready:false},invoiceMailer:f.invoiceMailer});
  assert.equal(f.sent.length,1);assert(f.sent[0].messageId.includes(first.id));assert.equal(f.pool.state.invoices.get(first.id).email_status,'sent');assert.equal(f.pool.state.stock,10);
});
