#!/usr/bin/env bash
set -e

python3 - <<'EOF'
import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error('SQL ERROR:',e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30)
    return json.loads(r.stdout)

res = query("select pg_get_functiondef(oid) as def from pg_proc where proname = 'gsa_tv_materialize_fixed_schedule'")
if res:
    print(res[0]['def'])
else:
    print("Function not found")
EOF
