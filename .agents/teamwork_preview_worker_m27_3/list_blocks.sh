#!/usr/bin/env bash
set -e

python3 - <<'EOF'
import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error('SQL ERROR:',e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30)
    if r.returncode != 0:
        print("STDOUT:", r.stdout)
        print("STDERR:", r.stderr)
        raise RuntimeError("Query failed")
    return json.loads(r.stdout)

version = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
blocks = query("""
    select b.id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, b.is_reprise, b.metadata, b.block_type, p.name
    from gsa_tv_program_blocks b
    left join gsa_tv_programs p on p.id = b.program_id
    where b.schedule_version_id = $1
    order by b.planned_start_offset_s, b.position
""", [version])

print(f"Total blocks in schedule version {version}: {len(blocks)}")
linked = [b for b in blocks if b['media_item_id']]
unlinked = [b for b in blocks if not b['media_item_id']]
print(f"Linked: {len(linked)}, Unlinked: {len(unlinked)}\n")

print("=== UNLINKED BLOCKS ===")
for b in unlinked:
    start_h = b['planned_start_offset_s'] // 3600
    start_m = (b['planned_start_offset_s'] % 3600) // 60
    print(f"Time: {start_h:02d}:{start_m:02d} ({b['planned_start_offset_s']}s) | Dur: {b['planned_duration_s']}s | Name: {b['name']} | Block ID: {b['id']} | Metadata: {b['metadata']}")

print("\n=== LINKED BLOCKS ===")
for b in linked:
    start_h = b['planned_start_offset_s'] // 3600
    start_m = (b['planned_start_offset_s'] % 3600) // 60
    print(f"Time: {start_h:02d}:{start_m:02d} | Dur: {b['planned_duration_s']}s | Name: {b['name']} | Media: {b['media_item_id']}")

EOF
