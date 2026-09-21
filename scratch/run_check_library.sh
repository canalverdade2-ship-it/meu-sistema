python3 - <<'EOF'
import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

rows = query("""select id, title, duration_s, approval_state, rights_ok, metadata->>'program_slug' as slug, drive_path from gsa_tv_media_items where id in ('media-ent-desenhos-sabado','media-ent-desenhos-sexta','media-ent-pipoca-sabado','media-ent-pipoca-sexta','media-ent-cinema-sabado','media-ent-cinema-sexta','media-gsa-em-fe-15h-10min','media-gsa-tv-continuity-600') order by id""")
print(f"Total library items found: {len(rows)}")
for r in rows:
    print(r)
EOF
