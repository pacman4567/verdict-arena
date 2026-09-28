import { timingSafeEqual } from 'node:crypto';
export const TTL = 86400;
export const STALE_MS = 300000;
export const descriptions = {1:'In Queue',2:'Processing',3:'Executed',5:'Time Limit Exceeded',6:'Compilation Error',11:'Runtime Error',13:'Judge Error',15:'Memory Limit Exceeded',16:'Output Limit Exceeded'};
export function result(id, values = {}) {
  return {status:{id,description:descriptions[id]},stdout:null,time:'0',memory:0,...values};
}
export function authorized(value, secret) {
  if (typeof secret !== 'string' || secret.length < 32 || typeof value !== 'string') return false;
  const a=Buffer.from(value), b=Buffer.from(secret);
  return a.length===b.length && timingSafeEqual(a,b);
}
function decoded(value, limit) {
  if (typeof value!=='string' || value.length>Math.ceil(limit/3)*4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Invalid base64 input');
  const b=Buffer.from(value,'base64');
  if(b.length>limit) throw new Error('Input too large');
  return b.toString('utf8');
}
export function validate(raw) {
  if(!raw || ![54,71,63].includes(raw.language_id)) throw new Error('Unsupported language');
  const source=decoded(raw.source_code,120000), input=decoded(raw.stdin ?? '',120000);
  const cpu=raw.cpu_time_limit ?? 2, wall=raw.wall_time_limit ?? 9, memory=raw.memory_limit ?? 262144;
  if(!source.trim() || !Number.isFinite(cpu) || cpu<0.1 || cpu>10 || !Number.isFinite(wall) || wall<cpu || wall>30 || !Number.isInteger(memory) || memory<32768 || memory>524288 || raw.enable_network!==false) throw new Error('Invalid execution limits');
  // Never pass arbitrary commands, options, environment variables, or URLs to the VM.
  return {source,input,language:raw.language_id,cpu,wall,memory};
}
export function publicResult(record, token, now=Date.now()) {
  if(!record) return {token,...result(13)};
  if(record.result.status.id<=2 && now-record.createdAt>STALE_MS) return {token,...result(13)};
  return {token,...record.result};
}
