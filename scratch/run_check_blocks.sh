python3 - <<'EOF'
import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

versions = query("select id from gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date=$1 and state='published' order by version desc limit 1", ['2026-09-15'])
print("Schedule version:", versions)
if versions:
    blocks = query("select b.id,b.program_id,b.planned_start_offset_s,b.planned_duration_s,b.media_item_id,b.is_reprise,b.metadata,b.block_type,p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=$1 order by b.planned_start_offset_s,b.position", [versions[0]['id']])
    print(f"Total blocks: {len(blocks)}")
    for b in blocks:
        print(f"Start: {b['planned_start_offset_s']:5d} | Dur: {b['planned_duration_s']:5d} | Media: {str(b['media_item_id']):45s} | Prog: {b['name']}")
EOF
