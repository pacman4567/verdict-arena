import { randomUUID } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { authorized, validate, result, publicResult } from '../lib/protocol.mjs';
import { redis, reserve, put, key } from '../lib/store.mjs';
import { processJobs } from '../lib/execute.mjs';
export function createHandler({getStore=redis,background=waitUntil,process=processJobs,env=globalThis.process.env}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json');
    const send=(status,data)=>{ res.statusCode=status; res.end(JSON.stringify(data)); };
    if(!authorized(req.headers['x-auth-token'],env.JUDGE_API_SECRET)) return send(401,{error:'Unauthorized'});
    const url=new URL(req.url,'https://judge.invalid');
    const batch=url.pathname.endsWith('/batch');
    if(!['GET','POST'].includes(req.method)) return send(405,{error:'Method not allowed'});
    try {
      const client=getStore();
      if(req.method==='GET' && url.pathname==='/health') {
        await client.ping();
        return send(env.JUDGE_SANDBOX_SNAPSHOT_ID?200:503,{configured:!!env.JUDGE_SANDBOX_SNAPSHOT_ID});
      }
      if(!['/submissions','/submissions/batch'].includes(url.pathname)) return send(404,{error:'Not found'});
      if(req.method==='GET') {
        const tokens=(url.searchParams.get('tokens') || '').split(',');
        if(!batch || tokens.length>30 || tokens.some(t=>!/^[0-9a-f-]{36}$/.test(t))) return send(400,{error:'Invalid tokens'});
        const records=await client.mget(...tokens.map(key));
        return send(200,{submissions:tokens.map((token,i)=>publicResult(records[i],token))});
      }
      if(!env.JUDGE_SANDBOX_SNAPSHOT_ID) return send(503,{error:'Judge snapshot is not configured'});
      if(url.searchParams.get('base64_encoded')!=='true') return send(400,{error:'base64_encoded=true is required'});
      let raw=req.body;
      if(raw===undefined) {
        let size=0; const chunks=[];
        for await(const chunk of req) { size+=chunk.length; if(size>4000000) return send(413,{error:'Request too large'}); chunks.push(chunk); }
        raw=Buffer.concat(chunks).toString('utf8');
      }
      if(Buffer.isBuffer(raw)) raw=raw.toString('utf8');
      if(typeof raw==='string') { if(Buffer.byteLength(raw)>4000000) return send(413,{error:'Request too large'}); raw=JSON.parse(raw); }
      if(Buffer.byteLength(JSON.stringify(raw) ?? '')>4000000) return send(413,{error:'Request too large'});
      const inputs=batch?raw?.submissions:[raw];
      if(!Array.isArray(inputs)||!inputs.length||inputs.length>30) return send(400,{error:'Provide 1–30 executions'});
      let jobs;
      try { jobs=inputs.map(input=>({token:randomUUID(),createdAt:Date.now(),job:validate(input)})); }
      catch { return send(400,{error:'Invalid source, input, language, or resource limits'}); }
      if(!await reserve(client,jobs.length)) return send(429,{error:'Daily judge budget exhausted'});
      await Promise.all(jobs.map(j=>put(client,j.token,{createdAt:j.createdAt,result:result(1)})));
      background(process(client,jobs));
      const tokens=jobs.map(({token})=>({token}));
      return send(201,batch?tokens:tokens[0]);
    } catch(error) {
      console.error('Judge request failed',error instanceof Error ? error.name : 'Error');
      return send(error instanceof SyntaxError?400:503,{error:'Judge unavailable or invalid request'});
    }
  };
}
export default createHandler();
