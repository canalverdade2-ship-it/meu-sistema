python3 - << 'EOF'
import subprocess, json

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

b = query("select id, program_id, planned_start_offset_s, planned_duration_s, media_item_id, is_reprise, metadata, block_type from gsa_tv_program_blocks where id='a782f8bb-1585-4eca-93e2-673ffa8211a0'")[0]
print("Block details:")
print(json.dumps(b, indent=2, default=str))

EOF
