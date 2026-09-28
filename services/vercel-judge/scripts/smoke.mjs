import assert from 'node:assert/strict';
const url=process.env.JUDGE_URL?.replace(/\/$/,'');
if(!url||!process.env.JUDGE_API_SECRET) throw new Error('Set JUDGE_URL and JUDGE_API_SECRET');
async function api(path,body) {
 const response=await fetch(url+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Auth-Token':process.env.JUDGE_API_SECRET},body:body?JSON.stringify(body):undefined});
 if(!response.ok) throw new Error(`Judge request failed: ${response.status}`);
 return response.json();
}
const enc=s=>Buffer.from(s).toString('base64');
const cases=[
 {name:'Python',source:'print(sum(map(int,input().split())))',language:71,id:3,out:'8\n'},
 {name:'C++17',source:'#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}',language:54,id:3,out:'8\n'},
 {name:'JavaScript',source:'console.log(8)',language:63,id:3,out:'8\n'},
 {name:'wrong output reaches checker',source:'print(9)',language:71,id:3,out:'9\n'},
 {name:'timeout',source:'while True: pass',language:71,id:5},
 {name:'runtime error',source:'raise Exception()',language:71,id:11},
 {name:'compilation error',source:'invalid c++',language:54,id:6},
 {name:'output limit',source:'print("x"*1000000)',language:71,id:16},
 {name:'custom checker',source:'import json,sys\nx=json.load(sys.stdin)\nprint("AC" if x["actual"].strip()==x["expected"].strip() else "WA")',language:71,id:3,out:'AC\n',input:JSON.stringify({input:'3 5',expected:'8',actual:'8\n'})},
 {name:'network isolation',source:'import socket\ntry:\n socket.create_connection(("1.1.1.1",443),timeout=.5)\n print("CONNECTED")\nexcept OSError:\n print("BLOCKED")',language:71,id:3,out:'BLOCKED\n'}
];
await api('/health');
assert.deepEqual((await api('/languages')).map(l=>l.id),[54,71,63]);
const tokens=await api('/submissions/batch?base64_encoded=true',{submissions:cases.map(c=>({source_code:enc(c.source),stdin:enc(c.input??'3 5\n'),language_id:c.language,cpu_time_limit:1,wall_time_limit:3,memory_limit:262144,enable_network:false}))});
const deadline=Date.now()+300000;
let results;
while(Date.now()<deadline) {
 results=(await api('/submissions/batch?tokens='+tokens.map(t=>t.token).join(','))).submissions;
 if(results.every(r=>r.status.id>2)) break;
 await new Promise(resolve=>setTimeout(resolve,1500));
}
for(let i=0;i<cases.length;i++) {
 const c=cases[i],r=results[i]; assert.equal(r.status.id,c.id,c.name);
 if(c.out) assert.equal(Buffer.from(r.stdout,'base64').toString(),c.out,c.name);
 console.log(`PASS ${c.name}`);
}
