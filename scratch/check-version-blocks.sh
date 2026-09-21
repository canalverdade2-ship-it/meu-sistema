python3 - << 'EOF'
import json, subprocess
ROOT = '/opt/gsa-tv'
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""
def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
blocks = query("""
SELECT b.id, b.program_id, b.planned_start_offset_s, b.planned_duration_s, b.media_item_id, p.name 
FROM gsa_tv_program_blocks b 
LEFT JOIN gsa_tv_programs p ON p.id=b.program_id 
WHERE b.schedule_version_id=$1 
ORDER BY b.planned_start_offset_s
""", [version_id])

print(f'Total blocks in version {version_id}: {len(blocks)}')
unlinked = [b for b in blocks if not b['media_item_id']]
print(f'Unlinked blocks: {len(unlinked)}')
for b in unlinked:
    print('Unlinked:', b)

ta = [b for b in blocks if b['id'] == '0f2f9292-a83b-462b-aab7-b09cbff27b8a' or 'rede' in (b['name'] or '').lower()]
print('GSA Ta na Rede blocks:', ta)
EOF
