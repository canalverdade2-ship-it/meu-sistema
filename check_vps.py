import json, subprocess

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

# block id: 0f2f9292-a83b-462b-aab7-b09cbff27b8a
# 1. find the block
blocks = query("select * from gsa_tv_program_blocks where id='0f2f9292-a83b-462b-aab7-b09cbff27b8a'")
print("BLOCK:")
print(json.dumps(blocks, indent=2))

# 2. find the media item
if blocks and blocks[0].get('media_item_id'):
    media = query("select * from gsa_tv_media_items where id=%s", [blocks[0]['media_item_id']])
    print("MEDIA (by id):")
    print(json.dumps(media, indent=2))

# 3. query for candidates
print("CANDIDATES:")
rows = query("select id, state, approval_state, rights_ok, rights_expires_at, drive_path, duration_s from gsa_tv_media_items where metadata->>'target_block_id'='0f2f9292-a83b-462b-aab7-b09cbff27b8a'")
print(json.dumps(rows, indent=2))

