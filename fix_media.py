import json
import subprocess
import os

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30)
    if r.returncode != 0:
        print("Query error:", r.stderr)
        raise Exception(r.stderr)
    return json.loads(r.stdout)

res = query("SELECT id, title, drive_path, duration_s FROM gsa_tv_media_items WHERE title LIKE '%Cinema%' OR title LIKE '%Desenhos%' OR title LIKE '%Pipoca%' OR id LIKE '%2026-09-15%';")

real_videos = {
    'Cinema': '/media/1/entertainment/cinema/his-girl-friday-1940-1080p.mp4',
    'Desenhos': '/media/1/entertainment/desenhos/popeye-ali-baba-1937-1080p.mp4',
    'Pipoca': '/media/1/entertainment/pipoca/sessao-pipoca-nostalgia-aventura-1080p.mp4',
}

for row in res:
    title = row['title']
    path = '/opt/gsa-tv/cache' + row['drive_path']
    if not path.startswith('/opt/gsa-tv/cache/media'):
        path = '/opt/gsa-tv/cache/media/1/' + row['drive_path']
    
    size = os.path.getsize(path) if os.path.exists(path) else 0
    
    if size < 50 * 1024 * 1024:
        if "GSA Tá na Rede" in title:
            print(f"Deleting broken GSA Tá na Rede entry: {row['id']}")
            query("DELETE FROM gsa_tv_media_items WHERE id = $1", [row['id']])
            continue
            
        for k, real_path in real_videos.items():
            if k in title:
                print(f"-> Fixing {title} with {real_path}")
                real_full_path = '/opt/gsa-tv/cache' + real_path
                probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', real_full_path], capture_output=True, text=True)
                dur = int(float(probe.stdout.strip())) if probe.returncode == 0 else 7200
                print(f"-> New duration: {dur}")
                query("UPDATE gsa_tv_media_items SET drive_path = $1, duration_s = $2 WHERE id = $3", [real_path, dur, row['id']])

print("Done fixing db.")
