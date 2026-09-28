"""Run with sudo on an ephemeral Linux test runner, never on a shared server."""
import base64
import json
import os
import pathlib
import subprocess
import tempfile
import unittest

RUNNER=pathlib.Path(__file__).resolve().parents[1]/'lib'/'runner.py'

@unittest.skipUnless(os.environ.get('VERDICT_EPHEMERAL_TEST')=='1' and os.geteuid()==0,'requires an explicitly designated disposable Linux runner')
class SupervisorTests(unittest.TestCase):
    def run_code(self,source,language=71,**limits):
        job={'source':source,'input':'3 5\n','language':language,'cpu':1,'wall':3,'memory':262144,**limits}
        with tempfile.NamedTemporaryFile(mode='w',delete=False) as file:
            json.dump(job,file)
        try:
            process=subprocess.run(['python3',str(RUNNER),file.name],capture_output=True,text=True,timeout=30,check=True)
            return json.loads(process.stdout)
        finally:
            pathlib.Path(file.name).unlink(missing_ok=True)
    def test_python(self):
        r=self.run_code('print(sum(map(int,input().split())))')
        self.assertEqual(r['id'],3); self.assertEqual(base64.b64decode(r['stdout']),b'8\n')
    def test_cpp(self):
        r=self.run_code('#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}',54)
        self.assertEqual(r['id'],3); self.assertEqual(base64.b64decode(r['stdout']),b'8\n')
    def test_javascript(self):
        r=self.run_code('console.log(require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number).reduce((a,b)=>a+b))',63)
        self.assertEqual(r['id'],3); self.assertEqual(base64.b64decode(r['stdout']),b'8\n')
    def test_compile_error(self): self.assertEqual(self.run_code('not c++',54)['id'],6)
    def test_runtime_error(self): self.assertEqual(self.run_code('raise RuntimeError("oops")')['id'],11)
    def test_timeout(self): self.assertEqual(self.run_code('while True: pass')['id'],5)
    def test_output_limit(self): self.assertEqual(self.run_code('print("x"*1000000)')['id'],16)
    def test_custom_checker(self):
        r=self.run_code('import json,sys\nx=json.load(sys.stdin)\nprint("AC" if int(x["actual"])==int(x["expected"]) else "WA")',input='{"input":"3 5","expected":"8","actual":"8"}')
        self.assertEqual(base64.b64decode(r['stdout']),b'AC\n')
    def test_unprivileged(self):
        r=self.run_code('import os\nprint(os.getuid())\nprint(open("/proc/self/status").read().split("NoNewPrivs:")[1].split()[0])')
        output=base64.b64decode(r['stdout']).decode().splitlines()
        self.assertNotEqual(output[0],'0'); self.assertEqual(output[1],'1')

if __name__=='__main__': unittest.main()
