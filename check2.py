import json
import subprocess
import os

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30)
    if r.returncode != 0:
        print("Query error:", r.stderr)
        raise Exception(r.stderr)
    return json.loads(r.stdout)

res = query("SELECT id, title, drive_path, duration_s, metadata FROM gsa_tv_media_items WHERE id LIKE '%media-ent-%' OR id LIKE '%media-auto-%' OR id LIKE '%2026-09-15%';")

print(json.dumps(res, indent=2))
