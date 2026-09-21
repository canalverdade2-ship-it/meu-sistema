import json
import subprocess
import os

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

# Query media items for today's blocks (or just generally check all media items that might be used today)
# Actually, the media items used today might be found in gsa_tv_schedule_blocks or similar?
# Let's just list the ones for 2026-09-15 or with 'placeholder' or small sizes.
# Let's check gsa_tv_media_items table schema.
try:
    print("Columns:", query("SELECT column_name FROM information_schema.columns WHERE table_name = 'gsa_tv_media_items';"))
    
    # Query all media items updated or inserted recently, or matching our programs.
    res = query("SELECT id, title, duration_s, drive_path FROM gsa_tv_media_items WHERE id LIKE '%2026-09-15%' OR title LIKE '%Desenhos%' OR title LIKE '%Pipoca%' OR title LIKE '%Cinema%';")
    for row in res:
        path = '/opt/gsa-tv/cache' + row['drive_path']
        size = -1
        if os.path.exists(path):
            size = os.path.getsize(path)
        print(f"ID: {row['id']}, Title: {row['title']}, Path: {row['drive_path']}, Size: {size/1024/1024:.2f} MB if exists")
except Exception as e:
    print("Error:", e)
