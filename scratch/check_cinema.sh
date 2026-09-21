python3 - <<'EOF'
import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

rows = query("select id, title, metadata, approval_state, rights_ok from gsa_tv_media_items where id like 'media-ent-cinema%'")
print("Cinema items:", rows)

blocks = query("select b.id, b.program_id, b.metadata, b.is_reprise, p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where p.name='GSA Cinema' and b.schedule_version_id=(select id from gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date='2026-09-15' and state='published' limit 1)")
print("Cinema block:", blocks)
EOF
