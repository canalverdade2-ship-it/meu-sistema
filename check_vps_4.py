import json, subprocess

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

print("LINKING MEDIA ITEM:")
res = query("update gsa_tv_program_blocks set media_item_id='media-auto-ac56ae82-85dd-4ea2-98ef-6751bd3a9daf' where id='0f2f9292-a83b-462b-aab7-b09cbff27b8a' returning id, media_item_id")
print(json.dumps(res, indent=2))
