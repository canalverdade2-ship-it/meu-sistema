#!/usr/bin/env bash
set -e

python3 - <<'EOF'
import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error('SQL ERROR:',e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30)
    return json.loads(r.stdout)

rows = query("""
    select id, title, duration_s, state, approval_state, rights_ok, drive_path, metadata->>'broadcast_date' as bdate, metadata->>'program_slug' as slug
    from gsa_tv_media_items
    where channel_id='ch-main' and state='ready'
    order by updated_at desc
    limit 40
""")

print(f"Total ready media items returned: {len(rows)}")
for r in rows:
    print(f"[{r['id']}] {r['title']} | dur: {r['duration_s']}s | app: {r['approval_state']} | rights: {r['rights_ok']} | slug: {r['slug']} | bdate: {r['bdate']}")
EOF
