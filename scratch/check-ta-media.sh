python3 - << 'EOF'
import json, subprocess
ROOT = '/opt/gsa-tv'
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""
def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

media = query("SELECT * FROM gsa_tv_media_items WHERE id = 'media-auto-49c65b0a-efee-449f-bd71-28bdb7bc97a6'")
print('Media item:', media)

p = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json','/opt/gsa-tv/cache/media/1/' + media[0]['drive_path'].replace('/media/1/','')], capture_output=True, text=True)
print('ffprobe:', p.stdout)
EOF
