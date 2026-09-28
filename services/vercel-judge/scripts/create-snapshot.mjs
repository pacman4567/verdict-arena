import { Sandbox } from '@vercel/sandbox';
import { credentials } from '../lib/execute.mjs';
const sandbox=await Sandbox.create({...credentials(),runtime:'node24',timeout:300000,persistent:false});
try {
  const setup=await sandbox.runCommand({cmd:'dnf',args:['install','-y','gcc-c++','python3'],sudo:true});
  if(setup.exitCode!==0) throw new Error('Could not install judge toolchain');
  for(const [cmd,args] of [['g++',['--version']],['python3',['--version']],['node',['--version']]]) {
    const check=await sandbox.runCommand(cmd,args);
    if(check.exitCode!==0) throw new Error(`Missing ${cmd}`);
    console.log((await check.stdout()).split('\n')[0]);
  }
  await sandbox.updateNetworkPolicy('deny-all');
  const snapshot=await sandbox.snapshot();
  console.log(`JUDGE_SANDBOX_SNAPSHOT_ID=${snapshot.snapshotId}`);
} finally { await sandbox.stop(); }
