"""Run the built Next server and synthetic integration suite in one limited cgroup."""
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

out = Path('.vercel/review/pdf24-research')
out.mkdir(parents=True, exist_ok=True)
def read(name):
    file = Path('/sys/fs/cgroup')/name
    return file.read_text().strip() if file.exists() else None
def health():
    try:
        with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=5) as response:
            return response.status == 200
    except Exception:
        return False

summary = {'memoryLimit':read('memory.max'),'cpuLimit':read('cpu.max'),
           'eventsBefore':read('memory.events'),'samples':[], 'passed':False}
serverlog = (out/'linux-server.txt').open('w')
testlog = (out/'linux-integration.txt').open('w')
server = subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1'],stdout=serverlog,stderr=subprocess.STDOUT)
job = None
start = time.monotonic()
try:
    while not health():
        if server.poll() is not None or time.monotonic()-start>120:
            raise RuntimeError('Next health check did not become ready')
        time.sleep(1)
    summary['idleBytes']=read('memory.current')
    job = subprocess.Popen(['node','node_modules/tsx/dist/cli.mjs','scripts/test-native-engines.ts'],stdout=testlog,stderr=subprocess.STDOUT)
    while job.poll() is None:
        summary['samples'].append({'seconds':round(time.monotonic()-start,1),'bytes':read('memory.current')})
        if server.poll() is not None:
            raise RuntimeError('Next server stopped during processing')
        if time.monotonic()-start>1400:
            raise RuntimeError('Container validation timed out')
        time.sleep(.5)
    summary['exitCode']=job.returncode
    summary['healthAfter']=health()
    summary['passed']=job.returncode==0 and summary['healthAfter']
finally:
    summary['seconds']=round(time.monotonic()-start,2)
    summary['peakBytes']=read('memory.peak')
    summary['eventsAfter']=read('memory.events')
    summary['cpuStats']=read('cpu.stat')
    if job and job.poll() is None:
        job.kill()
        job.wait()
    server.terminate()
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
    serverlog.close()
    testlog.close()
    (out/'linux-resources.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps({k:v for k,v in summary.items() if k!='samples'},indent=2))
if not summary['passed']:
    raise SystemExit(1)
