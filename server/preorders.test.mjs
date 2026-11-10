import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database} from './testing/fake-database.mjs';
import {createApp} from './app.mjs';
import {hashPassword} from './admin-auth.mjs';
import {transaction} from './checkout.mjs';
import {updatePreorder,createPreorderDispatcher,orderPreorders,assertPreordersReady,validArrival,preorderEmail} from './preorders.mjs';
async function setup(t){
 const pool=database(20),sent=[],mailer={ready:true,send:async m=>sent.push(m)};
 pool.state.productTags=['preorder'];
 const app=createApp(pool,['http://localhost:5173'],{adminPasswordHash:await hashPassword('test-password-123'),orderMailer:{ready:false},preorderMailer:mailer});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{await app.locals.preorderEmails.stop();await app.locals.orderEmails.stop();await new Promise(r=>server.close(r));});
 const base=`http://127.0.0.1:${server.address().port}`;
 async function call(path,body,cookie='',method){const res=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:'http://localhost:5173','X-Admin-Request':'1','Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:res.status,value:await res.json(),headers:res.headers};}
 const login=await call('/api/admin/login',{password:'test-password-123'}),cookie=login.headers.get('set-cookie').split(';')[0];
 async function checkout(fulfilment='collection',items=[{id:1,quantity:1}]){const id=randomUUID();const res=await call('/api/checkout',{requestId:id,items,name:'Customer',email:'customer@example.com',phone:'+65 9123 4567',telegram:'@customer',fulfilment,address:'98 Arab Street',postal:'199794'});assert.equal(res.status,200,JSON.stringify(res));await call(`/api/checkout/${id}/payment-reported`,{});return{id,response:res.value};}
 async function action(id,action,extra={}){return call(`/api/admin/orders/${id}/action`,{action,confirmed:true,paymentVerified:true,...extra},cookie);}
 return{pool,sent,mailer,app,call,cookie,checkout,action};
}
test('preorder controls require admin, validate dates, save once and expose progress without customer data',async t=>{
 const f=await setup(t);assert.equal((await f.call('/api/admin/preorders')).status,401);
 assert.equal((await f.call('/api/admin/preorders/1',{status:'ready',expectedArrival:'',version:0},'', 'PUT')).status,401);
 assert.equal((await f.call('/api/admin/preorders/1',{status:'invalid',expectedArrival:'',version:0},f.cookie,'PUT')).status,409);
 assert.equal((await f.call('/api/admin/preorders/1',{status:'on_the_way',expectedArrival:'2027-02-30',version:0},f.cookie,'PUT')).status,409);
 const {id}=await f.checkout();
 const save=await f.call('/api/admin/preorders/1',{status:'on_the_way',expectedArrival:'2027-03-25',version:0},f.cookie,'PUT');assert.equal(save.status,200);assert.equal(save.value.queued,1);
 await f.app.locals.preorderEmails.flush();assert.equal(f.sent.length,1);assert.match(f.sent[0].text,/25 March 2027/);assert.match(f.sent[0].text,/including any in-stock/);
 assert.match(f.sent[0].text,/order#token=[a-f0-9]{64}/);
 const receipt=await f.call(`/api/checkout/${id}`);assert.equal(receipt.value.preorders[0].status,'on_the_way');assert.equal(receipt.value.email,undefined);
 const same=await f.call('/api/admin/preorders/1',{status:'on_the_way',expectedArrival:'2027-03-25',version:1},f.cookie,'PUT');assert.equal(same.value.queued,0);await f.app.locals.preorderEmails.flush();assert.equal(f.sent.length,1);
 const stale=await f.call('/api/admin/preorders/1',{status:'ready',expectedArrival:'2027-03-25',version:0},f.cookie,'PUT');assert.equal(stale.status,409);
 const date=await f.call('/api/admin/preorders/1',{status:'on_the_way',expectedArrival:'2027-04-01',version:1},f.cookie,'PUT');assert.equal(date.status,200);await f.app.locals.preorderEmails.flush();assert.equal(f.sent.length,2);assert.match(f.sent[1].text,/25 March 2027 to 1 April 2027/);
});
test('mixed collection and delivery orders cannot leave until every preorder is ready',async t=>{
 const f=await setup(t);for(const id of [1,2,3])f.pool.state.products.set(id,{id,title:'Record '+id,artist:'Artist',price:'40.00',stock:20,tags:id===3?[]:['preorder'],medium:'Vinyl'});
 const collection=await f.checkout('collection',[{id:1,quantity:1},{id:2,quantity:1},{id:3,quantity:1}]);
 const delivery=await f.checkout('delivery',[{id:1,quantity:1},{id:2,quantity:1},{id:3,quantity:1}]);
 for(const order of [collection,delivery])assert.equal((await f.action(order.id,'paid')).status,200);
 const saved=JSON.parse(f.pool.state.orders.get(collection.id).details);assert.deepEqual(saved.items.map(i=>i.preorder),[true,true,false]);
 assert.equal((await f.action(collection.id,'ready_for_collection',{collectionNumber:67})).status,409);assert.equal((await f.action(delivery.id,'dispatched')).status,409);
 await transaction(f.pool,db=>updatePreorder(db,1,{status:'ready',expectedArrival:'',version:0}));assert.equal((await f.action(collection.id,'ready_for_collection',{collectionNumber:67})).status,409);
 await transaction(f.pool,db=>updatePreorder(db,2,{status:'ready',expectedArrival:'',version:0}));
 assert.equal((await f.action(collection.id,'ready_for_collection',{collectionNumber:67})).status,200);assert.equal((await f.action(delivery.id,'dispatched')).status,200);
 assert.equal(f.pool.state.fulfilment.get(collection.id),'ready_for_collection');assert.equal(f.pool.state.fulfilment.get(delivery.id),'dispatched');
});
test('date updates exclude cancelled, expired and fulfilled orders; no-op and concurrent saves do not duplicate notices',async t=>{
 const f=await setup(t);const keep=await f.checkout();const cancelled=await f.checkout();await f.action(cancelled.id,'cancel');
 const expired=await f.checkout();f.pool.state.orders.get(expired.id).status='expired';
 const done=await f.checkout();await f.action(done.id,'paid');f.pool.state.fulfilment.set(done.id,'completed');
 const results=await Promise.allSettled([transaction(f.pool,db=>updatePreorder(db,1,{status:'on_the_way',expectedArrival:'2027-04-01',version:0})),transaction(f.pool,db=>updatePreorder(db,1,{status:'on_the_way',expectedArrival:'2027-04-02',version:0}))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.pool.state.preorderEmails.size,1);assert.equal([...f.pool.state.preorderEmails.values()][0].order_id,keep.id);
 await f.app.locals.preorderEmails.flush();assert.equal(f.sent.length,1);
});
test('failed preorder SMTP retries without changing payment or stock; workers claim once and suppress obsolete versions',async t=>{
 const f=await setup(t);const {id}=await f.checkout();
 f.mailer.send=async()=>{throw Object.assign(Error('SMTP'),{code:'TEST_SMTP_FAILED'})};
 await transaction(f.pool,db=>updatePreorder(db,1,{status:'on_the_way',expectedArrival:'2027-04-01',version:0}));await f.app.locals.preorderEmails.flush();
 const first=[...f.pool.state.preorderEmails.values()][0];assert.equal(first.status,'failed');assert.equal(f.pool.state.orders.get(id).status,'payment_reported');assert.equal(f.pool.state.stock,20);
 f.mailer.send=async m=>f.sent.push(m);first.next_attempt_at=new Date(0);
 const other=createPreorderDispatcher(f.pool,{mailer:f.mailer,siteUrl:'https://kopisrecords.shop',issueLink:async()=> 'a'.repeat(64)});
 await Promise.all([f.app.locals.preorderEmails.flush(),other.flush()]);assert.equal(f.sent.length,1);assert.equal(first.status,'sent');await other.stop();
 f.mailer.ready=false;await transaction(f.pool,db=>updatePreorder(db,1,{status:'on_the_way',expectedArrival:'2027-04-02',version:1}));await transaction(f.pool,db=>updatePreorder(db,1,{status:'ready',expectedArrival:'2027-04-02',version:2}));
 f.mailer.ready=true;await f.app.locals.preorderEmails.flush();assert.equal(f.sent.length,2);assert.equal([...f.pool.state.preorderEmails.values()][1].status,'skipped');
});
test('queue failure rolls back product progress; invalid dates and HTML content are handled safely',async t=>{
 const f=await setup(t);await f.checkout();const original=f.pool.getConnection;
 f.pool.getConnection=async()=>{const db=await original();return{...db,execute:async(sql,args)=>{if(sql.startsWith('INSERT IGNORE INTO preorder_emails'))throw Object.assign(Error('queue'),{code:'TEST_QUEUE_FAILED'});return db.execute(sql,args)}}};
 await assert.rejects(transaction(f.pool,db=>updatePreorder(db,1,{status:'ready',expectedArrival:'2027-04-01',version:0})),/queue/);assert.equal(f.pool.state.preorders.get(1).status,'awaiting_release');assert.equal(f.pool.state.preorderEmails.size,0);
 assert.ok(validArrival('2028-02-29'));assert.ok(!validArrival('2027-02-29'));
 const mail=preorderEmail({name:'<script>',email:'x@example.com',reference:'KR'}, {title:'<img>',artist:'Artist',status:'ready',expectedArrival:null}, 'https://example.com');assert.ok(!mail.html.includes('<script>'));assert.match(mail.html,/&lt;img&gt;/);assert.match(mail.text,/separately/);
});
test('tracked preorder can still be marked ready after its catalogue listing is removed',async t=>{
 const f=await setup(t);const {id}=await f.checkout();
 f.pool.state.productPresent=false;
 const result=await transaction(f.pool,db=>updatePreorder(db,1,{status:'ready',expectedArrival:'2027-04-01',version:0}));
 assert.equal(result.queued,1);assert.equal((await orderPreorders(f.pool,id))[0].status,'ready');await assert.doesNotReject(assertPreordersReady(f.pool,id));
});
