import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.mjs";
import { hashPassword } from "./admin-auth.mjs";
import { database } from "./testing/fake-database.mjs";
import { ensureProductImages, validateProductImages } from "./product-images.mjs";
test("gallery migration adds only its nullable column, is repeatable and tolerates concurrent startup", async () => {
  const queries=[];await ensureProductImages({execute:async sql=>{queries.push(sql);return [[]];}});
  assert.deepEqual(queries,["SHOW COLUMNS FROM stock LIKE 'images'","ALTER TABLE stock ADD COLUMN images JSON NULL"]);
  const ready=[];await ensureProductImages({execute:async sql=>{ready.push(sql);return [[{Field:'images'}]];}});assert.equal(ready.length,1);
  await ensureProductImages({execute:async sql=>{if(sql.startsWith('ALTER'))throw Object.assign(Error(),{code:'ER_DUP_FIELDNAME'});return [[]];}});
  await assert.rejects(ensureProductImages({execute:async sql=>{if(sql.startsWith('ALTER'))throw Object.assign(Error(),{code:'ER_TABLEACCESS_DENIED_ERROR'});return [[]];}}),{code:'ER_TABLEACCESS_DENIED_ERROR'});
});
test("photo URLs reject unsafe data and deduplicate while retaining order",()=>{
  assert.deepEqual(validateProductImages('["https://example.com/front.jpg","/api/covers/back.jpg","https://example.com/front.jpg"]'),['https://example.com/front.jpg','/api/covers/back.jpg']);
  for(const value of [null,'not json',[null],['javascript:alert(1)'],['data:image/svg+xml,bad'],['//other.example/cover.jpg'],['https://user:password@example.com/a.jpg'],['C:\\photos\\a.jpg'],Array(21).fill('https://example.com/a.jpg')])assert.throws(()=>validateProductImages(value));
});
test("$4 zine gallery persists, omitted gallery updates retain photos, and checkout deducts real zine stock",async t=>{
 const pool=database(0),execute=pool.execute;let next=100;
 pool.execute=async(sql,args=[])=>{
  if(sql.startsWith('INSERT INTO stock (')){const keys=sql.slice(0,sql.indexOf('VALUES')).match(/`([^`]+)`/g).map(k=>k.slice(1,-1)),id=next++;pool.state.products.set(id,{id,...Object.fromEntries(keys.map((k,i)=>[k,args[i]]))});return [{insertId:id}];}
  if(sql.startsWith('UPDATE stock SET `')){const keys=[...sql.matchAll(/`([^`]+)` = \?/g)].map(m=>m[1]);const row=pool.state.products.get(args.at(-1));if(!row)return [{affectedRows:0}];keys.forEach((k,i)=>row[k]=args[i]);return [{affectedRows:1}];}
  if(sql==='SELECT * FROM stock ORDER BY id DESC')return [[...pool.state.products.values()].map(v=>structuredClone(v))];
  return execute(sql,args);
 };
 const app=createApp(pool,['http://localhost:5173'],{adminPasswordHash:await hashPassword('gallery-test-password'),secureCookies:false,publicApiUrl:'https://kopisrecords.shop/api',orderMailer:{ready:false}});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;let cookie='';
 async function call(path,body,method){const r=await fetch(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{'Content-Type':'application/json','X-Admin-Request':'1',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,value:await r.json(),response:r};}
 const login=await call('/api/admin/login',{password:'gallery-test-password'});cookie=login.response.headers.get('set-cookie').split(';')[0];
 const photos=Array.from({length:9},(_,i)=>`/api/covers/zine${i+1}.jpg`);
 const form={title:'Your Top 100 Albums',artist:'Kopi’s Records',price:4,medium:'Zine',stock:3,cover_image:photos[0],images:photos.slice(1),barcode:'KOPIS-ZINE-TOP100',tags:['new_arrival','local']};
 const added=await call('/api/stock',form);assert.equal(added.status,201,JSON.stringify(added.value));assert.equal(added.value.price,4);assert.equal(added.value.medium,'Zine');assert.equal(added.value.images.length,8);
 assert(added.value.tags.includes('local'));
 const id=added.value.id;
 for (let photo=1;photo<=9;photo++) { const response=await fetch(base+`/api/covers/zine${photo}.jpg`);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^image\/jpeg/);assert((await response.arrayBuffer()).byteLength>0); }
 let found=await call(`/api/stock/${id}`);assert(found.value.tags.includes('local'));assert.equal(found.value.images[7],'https://kopisrecords.shop/api/covers/zine9.jpg');assert.equal(found.value.cover_image,'https://kopisrecords.shop/api/covers/zine1.jpg');
 const legacy={...form,title:'Updated title'};delete legacy.images;
 assert.equal((await call(`/api/stock/${id}`,legacy,'PUT')).status,200);assert.equal((await call(`/api/stock/${id}`)).value.images.length,8);
 assert.equal((await call(`/api/stock/${id}`,{...form,images:['https://example.com/insert.jpg']},'PUT')).status,200);assert.deepEqual((await call(`/api/stock/${id}`)).value.images,['https://example.com/insert.jpg']);
 assert.equal((await call('/api/stock',{...form,images:['javascript:alert(1)']})).status,400);
 const orderId=randomUUID();const checkout=await call('/api/checkout',{requestId:orderId,name:'Customer',email:'customer@example.com',phone:'91234567',telegram:'@customer',fulfilment:'collection',items:[{id,quantity:2}]});assert.equal(checkout.status,200,JSON.stringify(checkout.value));assert.equal(checkout.value.total,800);assert.equal(checkout.value.items[0].medium,'Zine');
 assert.equal((await call(`/api/checkout/${orderId}/payment-reported`,{})).status,200);
 const confirmed=await call(`/api/admin/orders/${orderId}/action`,{action:'paid',confirmed:true,paymentVerified:true});assert.equal(confirmed.status,200,JSON.stringify(confirmed.value));assert.equal(pool.state.products.get(id).stock,1);
});
