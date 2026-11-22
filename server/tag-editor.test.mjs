import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { tagEditorRoutes } from './tag-editor.mjs';
test('bulk tags: auth, preserve other fields, conflicts, preorder guard and rollback', async t => {
 const app=express();app.use(express.json());let rows=[{id:1,tags:['new_arrival','local'],stock:4,price:15},{id:2,tags:['new_arrival','recommended'],stock:2,price:42},{id:3,tags:['preorder'],stock:3,price:40}];let fail=false;
 const transaction=async(_pool,fn)=>{const draft=structuredClone(rows);const result=await fn({execute:async(sql,args)=>{if(sql.startsWith('SELECT'))return [draft.filter(row=>args.includes(row.id))];if(fail&&args[1]===2)throw Error('simulated failure');draft.find(row=>row.id===args[1]).tags=JSON.parse(args[0]);return [{affectedRows:1}];}});rows=draft;return result;};
 tagEditorRoutes(app,{},(req,res,next)=>req.get('x-test-admin')==='yes'?next():res.sendStatus(401),{transaction,allowedTags:new Set(['new_arrival','local','recommended','preorder','sale'])});app.use((err,_req,res,_next)=>res.status(err.status||500).json({error:err.message}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));const url=`http://127.0.0.1:${server.address().port}/api/admin/tags`;
 const body=(ids,add=[],remove=[])=>({records:rows.filter(row=>ids.includes(row.id)).map(row=>({id:row.id,expectedTags:row.tags})),add,remove});const call=(data,auth=true)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{'x-test-admin':'yes'}:{})},body:JSON.stringify(data)});
 assert.equal((await call(body([1],[],['new_arrival']),false)).status,401);assert.equal((await call(body([1,2],[],['new_arrival']))).status,200);assert.deepEqual(rows[0].tags,['local']);assert.deepEqual(rows[1].tags,['recommended']);assert.equal(rows[0].stock,4);assert.equal(rows[1].price,42);
 const stale=body([1,2],['sale']);stale.records[1].expectedTags=[];assert.equal((await call(stale)).status,409);assert(!rows[0].tags.includes('sale'));assert.equal((await call(body([1,3],['new_arrival']))).status,400);assert.deepEqual(rows[0].tags,['local']);assert.equal((await call(body([1],['preorder']))).status,400);assert.equal((await call(body([1],['unknown']))).status,400);
 const missing=body([1],['sale']);missing.records.push({id:99,expectedTags:[]});assert.equal((await call(missing)).status,409);fail=true;assert.equal((await call(body([1,2],['sale']))).status,500);assert(!rows[0].tags.includes('sale'));fail=false;assert.equal((await call(body([1,2],['sale']))).status,200);assert.deepEqual(rows[0].tags,['local','sale']);assert.deepEqual(rows[1].tags,['recommended','sale']);
});
