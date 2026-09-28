"""Trusted supervisor. Runs only in a disposable Vercel Linux microVM as root.
No submitted code runs as root; no secrets or expected answers enter the VM.
"""
import base64
import ctypes
import json
import math
import os
import pathlib
import pwd
import resource
import signal
import shutil
import subprocess
import sys
import tempfile
import time

OUTPUT_LIMIT = 65536


def execute(job):
    if sys.platform != 'linux' or os.geteuid() != 0:
        raise RuntimeError('Supervisor requires a disposable root Linux sandbox')
    account = pwd.getpwnam('nobody')
    uid, gid = account.pw_uid, account.pw_gid
    root = pathlib.Path(tempfile.mkdtemp(prefix='verdict-', dir='/tmp'))
    root.chmod(0o711)
    work = root / 'work'
    work.mkdir(mode=0o700)
    os.chown(work, uid, gid)
    language = job['language']
    source = work / {54:'main.cpp', 71:'main.py', 63:'main.js'}[language]
    source.write_text(job['source'])
    source.chmod(0o444)
    stdin = root / 'input'
    stdin.write_text(job['input'])
    stdin.chmod(0o600)
    libc = ctypes.CDLL(None, use_errno=True)

    def prepare(cpu, memory, compilation):
        os.setsid()
        # Disallow regaining root via sudo, setuid programs, or file capabilities.
        if libc.prctl(38, 1, 0, 0, 0) != 0:
            raise OSError('PR_SET_NO_NEW_PRIVS failed')
        os.setgroups([])
        os.setgid(gid)
        os.setuid(uid)
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_CPU, (math.ceil(cpu), math.ceil(cpu)+1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (OUTPUT_LIMIT if not compilation else 16777216,)*2)
        resource.setrlimit(resource.RLIMIT_NOFILE, (64,64))
        resource.setrlimit(resource.RLIMIT_NPROC, (32,32))
        # V8 reserves virtual address space far above actual memory usage.
        # Node is limited by aggregate resident-memory monitoring below instead.
        if language != 63 or compilation:
            resource.setrlimit(resource.RLIMIT_AS, (memory*1024,)*2)
        os.umask(0o077)

    def usage():
        total=0
        cpu=0
        for entry in pathlib.Path('/proc').iterdir():
            if not entry.name.isdigit():
                continue
            try:
                if entry.stat().st_uid != uid:
                    continue
                stat=(entry/'stat').read_text().rsplit(')',1)[1].split()
                cpu += sum(int(stat[i]) for i in (11,12,13,14))/os.sysconf('SC_CLK_TCK')
                for line in (entry/'status').read_text().splitlines():
                    if line.startswith('VmRSS:'):
                        total += int(line.split()[1])
            except (OSError, ValueError):
                pass
        return total,cpu

    def kill_all():
        # This microVM contains only this test. Kill even descendants that created
        # a new session, so forked children cannot survive into checker execution.
        for entry in pathlib.Path('/proc').iterdir():
            try:
                if entry.name.isdigit() and entry.stat().st_uid == uid:
                    os.kill(int(entry.name), signal.SIGKILL)
            except (OSError, ValueError):
                pass

    def run(argv, cpu, wall, memory, compilation=False):
        executable=shutil.which(argv[0])
        if not executable:
            raise RuntimeError("Missing compiler/runtime")
        argv=[executable,*argv[1:]]
        started=time.monotonic()
        peak=0
        verdict=3
        with stdin.open('rb') as inf, tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            proc=subprocess.Popen(argv, cwd=work, stdin=inf, stdout=out, stderr=err,
                env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':str(work),'LANG':'C.UTF-8'},
                preexec_fn=lambda:prepare(cpu,memory,compilation))
            try:
                while proc.poll() is None:
                    rss,used_cpu=usage()
                    peak=max(peak,rss)
                    if time.monotonic()-started>wall or used_cpu>cpu:
                        verdict=5
                    elif peak>memory:
                        verdict=15
                    elif os.fstat(out.fileno()).st_size>=OUTPUT_LIMIT or os.fstat(err.fileno()).st_size>=OUTPUT_LIMIT:
                        verdict=16
                    if verdict!=3:
                        kill_all()
                        break
                    time.sleep(0.01)
                proc.wait(timeout=2)
            finally:
                kill_all()
            elapsed=time.monotonic()-started
            # wait4's high-water mark also catches short-lived allocations between polls.
            peak=max(peak,resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss)
            if verdict==3:
                if peak>memory:
                    verdict=15
                elif os.fstat(out.fileno()).st_size>=OUTPUT_LIMIT or os.fstat(err.fileno()).st_size>=OUTPUT_LIMIT or proc.returncode==-signal.SIGXFSZ:
                    verdict=16
                elif proc.returncode in (-signal.SIGXCPU,-signal.SIGKILL):
                    verdict=5
                elif proc.returncode!=0:
                    verdict=11
            out.seek(0)
            return {'id':verdict,'stdout':base64.b64encode(out.read(OUTPUT_LIMIT)).decode(),'time':round(elapsed,4),'memory':peak}

    if language==54:
        compiled=run(['g++','-std=c++17','-O2','-pipe',str(source),'-o',str(work/'main')],10,15,524288,True)
        if compiled['id']!=3:
            return {'id':6,'stdout':'','time':0,'memory':0}
    # Run measurement in a fresh supervisor process: compiler peak RSS must not
    # contaminate the contestant's memory measurement via RUSAGE_CHILDREN.
    if language==54:
        pid=os.fork()
        if pid:
            _,status=os.waitpid(pid,0)
            if status != 0:
                raise RuntimeError('Execution supervisor failed')
            return None
    argv={54:[str(work/'main')],71:['python3','-I','-B',str(source)],63:['node','--jitless',f"--max-old-space-size={max(16,job['memory']//1024-24)}",str(source)]}[language]
    answer=run(argv,job['cpu'],job['wall'],job['memory'])
    if language==54:
        print(json.dumps(answer),flush=True)
        os._exit(0)
    return answer


if __name__=='__main__':
    path=pathlib.Path(sys.argv[1])
    job=json.loads(path.read_text())
    # Remove source/input envelope before the contestant starts.
    path.unlink()
    answer=execute(job)
    if answer is not None:
        print(json.dumps(answer))
