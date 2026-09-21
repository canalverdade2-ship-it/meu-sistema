python3 << 'EOF'
import json
import subprocess

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

media = query("select id, title, state, approval_state, rights_ok, duration_s, drive_path, metadata from gsa_tv_media_items where id='media-auto-ac56ae82-85dd-4ea2-98ef-6751bd3a9daf'")
print('MEDIA ITEM:', json.dumps(media, indent=2))

qc_files = subprocess.run(['ls', '-la', '/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede*'], capture_output=True, text=True, shell=True)
print('TA NA REDE FILES:\n', qc_files.stdout)
EOF
