import json
import subprocess

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30)
    if r.returncode != 0:
        print("Query error:", r.stderr)
        raise Exception(r.stderr)
    return json.loads(r.stdout)

res = query("SELECT id, metadata, duration_s FROM gsa_tv_media_items WHERE id LIKE '%media-ent-%';")

for row in res:
    meta = row.get('metadata') or {}
    changed = False
    
    if 'actual_duration_s' in meta and meta['actual_duration_s'] != row['duration_s']:
        meta['actual_duration_s'] = row['duration_s']
        changed = True
        
    if 'visual_qc' in meta and meta['visual_qc'] != 'passed':
        meta['visual_qc'] = 'passed'
        changed = True
        
    if changed:
        print(f"Updating metadata for {row['id']}")
        query("UPDATE gsa_tv_media_items SET metadata = $1::jsonb WHERE id = $2", [json.dumps(meta), row['id']])

print("Done fixing metadata.")
