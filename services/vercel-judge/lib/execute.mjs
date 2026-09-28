import { Sandbox } from '@vercel/sandbox';
import { readFile } from 'node:fs/promises';
import { acquire, put } from './store.mjs';
import { result } from './protocol.mjs';
export function credentials() {
  if(process.env.VERCEL_TOKEN) return {token:process.env.VERCEL_TOKEN,teamId:process.env.VERCEL_TEAM_ID,projectId:process.env.VERCEL_PROJECT_ID};
  return {};
}
export async function execute(job) {
  const snapshotId=process.env.JUDGE_SANDBOX_SNAPSHOT_ID;
  if(!snapshotId) throw new Error('Judge snapshot is not configured');
  const sandbox=await Sandbox.create({...credentials(),source:{type:'snapshot',snapshotId},persistent:false,networkPolicy:'deny-all',timeout:60000,resources:{vcpus:1}});
  try {
    // This sandbox contains one input only. Expected output, service secrets and
    // other participants' source never enter it.
    await sandbox.writeFiles([
      {path:'/vercel/sandbox/runner.py',content:await readFile(new URL('./runner.py',import.meta.url))},
      {path:'/vercel/sandbox/job.json',content:Buffer.from(JSON.stringify(job))}
    ]);
    const command=await sandbox.runCommand({cmd:'python3',args:['/vercel/sandbox/runner.py','/vercel/sandbox/job.json'],sudo:true});
    if(command.exitCode!==0) throw new Error('Sandbox supervisor failed');
    const value=JSON.parse(await command.stdout());
    if(![3,5,6,11,13,15,16].includes(value.id)||typeof value.stdout!=='string'||value.stdout.length>90000) throw new Error('Invalid sandbox result');
    return result(value.id,{stdout:value.stdout,time:String(value.time),memory:value.memory});
  } finally { await sandbox.stop(); }
}
export async function processJobs(client,jobs,run=execute) {
  const deadline=Date.now()+240000;
  let index=0;
  async function worker() {
    while(index<jobs.length) {
      const item=jobs[index++];
      let held=false, value=result(13);
      try {
        while(Date.now()<deadline) {
          if(await acquire(client,item.token)) { held=true; break; }
          await new Promise(resolve=>setTimeout(resolve,500));
        }
        if(held) {
          await put(client,item.token,{createdAt:item.createdAt,result:result(2)});
          value=await run(item.job);
        }
      } catch(error) { console.error('Judge execution failed',error instanceof Error ? error.name : 'Error'); }
      finally {
        // A durable terminal record is written even for infrastructure failures.
        // If the function is forcibly killed, polling marks stale records as errors.
        try { await put(client,item.token,{createdAt:item.createdAt,result:value}); }
        finally { if(held) await client.zrem('verdict:active',item.token); }
      }
    }
  }
  await Promise.allSettled(Array.from({length:Math.min(4,jobs.length)},()=>worker()));
}
