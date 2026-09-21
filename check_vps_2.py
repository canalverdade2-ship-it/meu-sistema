import json, subprocess

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

print("ALL GSA TA NA REDE MEDIA:")
rows = query("select id, state, approval_state, rights_ok, rights_expires_at, drive_path, duration_s, title from gsa_tv_media_items where channel_id='ch-main' and metadata->>'program_slug'='gsa-ta-na-rede' and metadata->>'broadcast_date'='2026-09-15'")
print(json.dumps(rows, indent=2))
