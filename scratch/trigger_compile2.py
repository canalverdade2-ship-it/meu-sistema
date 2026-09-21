import subprocess
import json

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    proc = subprocess.run(['docker', 'exec', '-i', '-e', 'DATABASE_URL=postgresql://postgres:password@evo-postgres:5432/gsatv', '-w', '/usr/src/app', 'gsa-tv-control-plane', 'node', '-e', PG], input=json.dumps({'sql':sql, 'params':params or []}).encode('utf-8'), capture_output=True)
    if proc.returncode != 0: raise RuntimeError(proc.stderr.decode('utf-8'))
    return json.loads(proc.stdout.decode('utf-8'))

versions = query("select id from gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date='2026-09-15' and state='published' order by version desc limit 1")
vid = versions[0]['id']

job = query("insert into gsa_tv_jobs(channel_id,job_type,payload) values('ch-main','compile_playlist',$1::jsonb) returning id", [json.dumps({'date':'2026-09-15', 'schedule_version_id': vid, 'producer':'rescue'})])[0]['id']
print('Job inserted:', job)
