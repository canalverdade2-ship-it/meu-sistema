python3 - << 'EOF'
import subprocess, json

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

versions = query("select id, version from gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date='2026-09-15' and state='published' order by version desc limit 1")
print('Schedule version:', versions)
v_id = versions[0]['id']
blocks = query("select b.id, b.position, b.program_id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, b.is_reprise, b.metadata, b.block_type, p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=$1 order by b.planned_start_offset_s,b.position", [v_id])
print(f"Total blocks: {len(blocks)}")
for i, b in enumerate(blocks):
    h = b['planned_start_offset_s'] // 3600
    m = (b['planned_start_offset_s'] % 3600) // 60
    dur = b['planned_duration_s']
    print(f"{i+1:02d}. [{h:02d}:{m:02d} - {dur}s ({dur//60}m)] {b['name']} (reprise={b['is_reprise']}, media_item={b['media_item_id']}) - block_id={b['id']}")

EOF
