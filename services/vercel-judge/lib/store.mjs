import { Redis } from '@upstash/redis';
import { TTL } from './protocol.mjs';
export const key = token => `verdict:run:${token}`;
export function redis() {
  return new Redis({url:process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN});
}
export async function reserve(client,count,now=Date.now()) {
  const limit=Number(process.env.JUDGE_DAILY_RUN_LIMIT || 1000);
  if(!Number.isInteger(limit)||limit<1||limit>100000) throw new Error('Invalid daily run budget');
  const day=new Date(now).toISOString().slice(0,10);
  return Number(await client.eval(`
    local n=tonumber(redis.call('GET',KEYS[1]) or '0')
    if n+tonumber(ARGV[1])>tonumber(ARGV[2]) then return 0 end
    redis.call('INCRBY',KEYS[1],ARGV[1]); redis.call('EXPIRE',KEYS[1],172800); return 1
  `,[`verdict:budget:${day}`],[count,limit]))===1;
}
export async function acquire(client,token) {
  return Number(await client.eval(`
    redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1])
    if redis.call('ZCARD',KEYS[1])>=8 then return 0 end
    redis.call('ZADD',KEYS[1],ARGV[2],ARGV[3]); redis.call('EXPIRE',KEYS[1],600); return 1
  `,['verdict:active'],[Date.now(),Date.now()+90000,token]))===1;
}
export async function put(client,token,record) { await client.set(key(token),record,{ex:TTL}); }
