import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../api/index.mjs';
const secret='test-secret-'.repeat(4);
function setup() {
 const records=new Map(); const tasks=[]; let processed=0;
 const store={set:async(k,v)=>records.set(k,v),mget:async(...keys)=>keys.map(k=>records.get(k)),eval:async()=>1,ping:async()=> 'PONG'};
 const handler=createHandler({getStore:()=>store,background:p=>tasks.push(p),process:async()=>{processed++},env:{JUDGE_API_SECRET:secret,JUDGE_SANDBOX_SNAPSHOT_ID:'snap_test'}});
 async function request(method,url,body,token=secret) {
  let output; const res={setHeader(){},end(raw){output={status:this.statusCode,body:JSON.parse(raw)}}};
  await handler({method,url,body,headers:{'x-auth-token':token}},res); return output;
 }
 return {request,records,tasks,processed:()=>processed};
}
const run={source_code:Buffer.from('print(1)').toString('base64'),stdin:'',language_id:71,enable_network:false};
test('unauthenticated requests cannot schedule work or read results',async()=>{
 const s=setup(); assert.equal((await s.request('POST','/submissions?base64_encoded=true',run,'bad')).status,401); assert.equal(s.processed(),0);
});
test('batch returns durable tokens and polling preserves order',async()=>{
 const s=setup(); const response=await s.request('POST','/submissions/batch?base64_encoded=true',{submissions:[run,run]});
 assert.equal(response.status,201); assert.equal(response.body.length,2); assert.equal(s.records.size,2);
 const tokens=response.body.map(x=>x.token);
 const poll=await s.request('GET',`/submissions/batch?tokens=${tokens.join(',')}`);
 assert.deepEqual(poll.body.submissions.map(x=>x.token),tokens); assert.equal(poll.body.submissions[0].status.id,1);
 assert.equal(s.processed(),1);
});
test('custom checker single-execution endpoint returns the same token shape',async()=>{
 const s=setup(); const response=await s.request('POST','/submissions?base64_encoded=true',run);
 assert.equal(response.status,201); assert.match(response.body.token,/^[0-9a-f-]{36}$/);
});
test('invalid batches are rejected in full before scheduling',async()=>{
 const s=setup();
 for(const submissions of [[],Array(31).fill(run),[run,{...run,enable_network:true}]]) assert.equal((await s.request('POST','/submissions/batch?base64_encoded=true',{submissions})).status,400);
 assert.equal(s.processed(),0); assert.equal(s.records.size,0);
 assert.equal((await s.request('POST','/submissions','{')).status,400);
});
