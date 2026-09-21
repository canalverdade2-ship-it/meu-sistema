import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

media_id = 'media-master-gsa-ta-na-rede-2026-09-15-0f2f9292-a83b-462b-aab7-b09cbff27b8a'
path = '/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.mp4'

query("""
INSERT INTO gsa_tv_media_items(
  id, channel_id, title, original_filename, duration_s, 
  video_codec, video_width, video_height, video_fps, 
  audio_codec, audio_sample_rate, audio_channels, 
  state, rights_ok, drive_path, media_kind, source_type, 
  ai_generated, approval_state, metadata
) VALUES(
  $1, 'ch-main', 'GSA Tá na Rede — 2026-09-15', 'gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.mp4', 597,
  'h264', 1920, 1080, 30, 'aac', 48000, 2, 'ready', true, $2, 'program', 'services', true, 'approved', '{}'::jsonb
) ON CONFLICT(id) DO UPDATE SET 
  approval_state='approved', rights_ok=true, duration_s=597, drive_path=$2, updated_at=now()
""", [media_id, path])

print("Inserted media item")

query("""
UPDATE gsa_tv_program_blocks
SET media_item_id = $1
WHERE id = '0f2f9292-a83b-462b-aab7-b09cbff27b8a'
""", [media_id])

print("Updated block")
