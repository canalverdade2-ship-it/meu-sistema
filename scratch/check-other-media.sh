python3 << 'EOF'
import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

rows = query("select id, title, state, approval_state, rights_ok, drive_path, duration_s from gsa_tv_media_items where id in ('media-auto-bc9fc39f-1b90-4d42-9730-90f5226e9d25', 'media-auto-1d1d5d5f-c28e-4a00-acb7-07bcb9adbaa4', 'media-auto-36cb8888-2a58-4450-b4a8-b5715936f390')")
print('OTHER MEDIA ITEMS:', json.dumps(rows, indent=2))
EOF
