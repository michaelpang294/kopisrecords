import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from './app.mjs';
import {hashPassword} from './admin-auth.mjs';

test('record request admin list requires auth, filters all saved requests and excludes internal fields',async t=>{
 const all=Array.from({length:28},(_,i)=>({request_id:`request-${String(i).padStart(2,'0')}`,name:i===0?'Alice':'Michael',email:`customer${i}@example.com`,contact:i===0?'@alice':'',record:i===0?'100% Pure':'Souvlaki',notes:i===0?'Blue vinyl\nBudget $50':'',email_status:i%2?'sent':'failed',created_at:new Date(Date.UTC(2026,10,3,12,0,28-i)).toISOString(),fingerprint:'private',ip_hash:'private',mail_claim:'private'}));
 const calls=[];
 const pool={async execute(sql,p=[]){calls.push({sql,p});assert(sql.includes('record_requests'));let rows=all;let pos=0;if(sql.includes('email_status = ?')){const expected=p[pos++];rows=rows.filter(r=>r.email_status===expected);}if(sql.includes('LIKE ?')){const term=p[pos].slice(1,-1).replace(/!(.)/g,'$1');assert.deepEqual(p.slice(pos,pos+5),Array(5).fill(p[pos]));rows=rows.filter(r=>[r.name,r.email,r.contact,r.record,r.notes].some(v=>v.toLowerCase().includes(term.toLowerCase())));pos+=5;}
 if(sql.startsWith('SELECT COUNT'))return [[{total:rows.length}]];
 assert(sql.endsWith('ORDER BY created_at DESC, request_id DESC LIMIT ? OFFSET ?'));return [rows.slice(p[pos+1],p[pos+1]+p[pos])];}};
 const app=createApp(pool,['http://localhost:5173'],{adminPasswordHash:await hashPassword('admin-test-password'),secureCookies:false});const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/api/admin/record-requests')).status,401);assert.equal(calls.length,0);
 const signed=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Request':'1'},body:JSON.stringify({password:'admin-test-password'})});const cookie=signed.headers.get('set-cookie').split(';')[0];const get=q=>fetch(base+'/api/admin/record-requests'+q,{headers:{Cookie:cookie}});
 const res=await get('');assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/no-store/);const body=await res.json();assert.equal(body.total,28);assert.equal(body.requests.length,25);assert.equal(body.totalPages,2);assert.equal(body.requests[0].name,'Alice');assert.equal(body.requests[0].notes,'Blue vinyl\nBudget $50');assert.equal(body.requests[0].emailStatus,'failed');assert(!JSON.stringify(body).includes('private'));
 const second=await(await get('?page=2')).json();assert.equal(second.requests.length,3);assert.equal(second.page,2);
 const clamped=await(await get('?page=999')).json();assert.equal(clamped.page,2);
 const filtered=await(await get('?emailStatus=failed&q=100%25')).json();assert.equal(filtered.total,1);assert.equal(filtered.requests[0].record,'100% Pure');assert(calls.some(c=>c.p.includes('%100!%%')));
 const search=await(await get('?q=%40alice')).json();assert.equal(search.total,1);
 const empty=await(await get('?q=NotFound')).json();assert.equal(empty.total,0);assert.deepEqual(empty.requests,[]);
 for(const q of ['?page=0','?page=NaN','?page=2.5','?emailStatus=oops'])assert.equal((await get(q)).status,400);
 const injection="' OR 1=1 --";await get('?q='+encodeURIComponent(injection));assert(!calls.at(-1).sql.includes(injection));assert(calls.at(-1).p.includes('%'+injection+'%'));
 await fetch(base+'/api/admin/logout',{method:'POST',headers:{Cookie:cookie,'X-Admin-Request':'1'}});assert.equal((await get('')).status,401);
});
