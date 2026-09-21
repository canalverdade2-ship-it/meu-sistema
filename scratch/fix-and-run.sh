python3 - << 'EOF'
import json, subprocess
from pathlib import Path

ROOT = Path('/opt/gsa-tv')
MEDIA = ROOT / 'cache/media/1'
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

def probe(path):
    p = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(path)], capture_output=True, text=True, check=True, timeout=30)
    return float(json.loads(p.stdout)['format']['duration'])

media = query("SELECT id, title, duration_s, drive_path FROM gsa_tv_media_items WHERE id = 'media-ent-desenhos-sabado'")
print('Current media:', media)
drive_path = media[0]['drive_path']
if drive_path.startswith('/media/1/'):
    file_path = MEDIA / drive_path[len('/media/1/'):]
elif not drive_path.startswith('/'):
    file_path = MEDIA / drive_path
else:
    file_path = Path(drive_path)

dur = probe(file_path)
print(f'Probed actual duration: {dur}s, rounded: {round(dur)}')
res = query("UPDATE gsa_tv_media_items SET duration_s = $1 WHERE id = 'media-ent-desenhos-sabado' RETURNING id, duration_s", [round(dur)])
print('Updated duration in DB:', res)
EOF
