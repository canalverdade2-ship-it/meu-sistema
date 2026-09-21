python3 - <<'EOF'
import json, subprocess
import datetime as dt
from zoneinfo import ZoneInfo
from pathlib import Path
import re, unicodedata, math

TZ = ZoneInfo('America/Sao_Paulo')
ROOT = Path('/opt/gsa-tv')
MEDIA = ROOT / 'cache/media/1'

PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

def slug(name):
    name = ''.join(c for c in unicodedata.normalize('NFD', name) if not unicodedata.combining(c)).lower()
    return re.sub('[^a-z0-9]+', '-', name).strip('-')

def probe(path):
    p=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(path)],capture_output=True,text=True,check=True,timeout=30)
    duration=float(json.loads(p.stdout)['format']['duration'])
    if not math.isfinite(duration) or duration <= 0: raise ValueError('Duração inválida')
    return duration

def media_path(value):
    if not value: raise ValueError('Mídia sem caminho')
    value = str(value)
    if value.startswith('/media/1/'):
        path = MEDIA / value[len('/media/1/'):]
    elif not value.startswith('/'):
        path = MEDIA / value
    else:
        path = Path(value)
    path = path.resolve()
    return path

# Let's inspect GSA Agro block and media item
date = '2026-09-15'
versions = query("select id from gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date=$1 and state='published' order by version desc limit 1", [date])
blocks = query("select b.id,b.program_id,b.planned_start_offset_s,b.planned_duration_s,b.media_item_id,b.is_reprise,b.metadata,b.block_type,p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=$1 and p.name='GSA Agro'", [versions[0]['id']])
b = blocks[0]
print("Block:", b)

m_rows = query("select * from gsa_tv_media_items where id='media-master-gsa-agro-2026-09-15-818ad89d-a679-431d-8962-4e16fb769899'")
m = m_rows[0]
print("Media item:", {k: m[k] for k in ['id', 'state', 'approval_state', 'rights_ok', 'drive_path', 'duration_s']})

# Test media_path
try:
    path = media_path(m['drive_path'])
    print("Resolved path:", path, "Exists?", path.is_file())
    actual = probe(path)
    print("Probe actual duration:", actual)
except Exception as e:
    print("Probe/Path exception:", type(e), e)

# Test query filter
library=bool(b.get('is_reprise') or (b.get('metadata') or {}).get('content_mode')=='library')
rows=query("select id, title from gsa_tv_media_items where channel_id='ch-main' and state='ready' and approval_state='approved' and rights_ok and (metadata->>'program_id'=$1 or metadata->>'program_slug'=$2 or ($3::boolean and (title ilike ('%' || $5 || '%') or id ilike ('%' || $2 || '%')))) and ($3::boolean or metadata->>'broadcast_date'=$4) order by updated_at desc",[str(b['program_id']),slug(b['name']),library,date,b['name']])
print("Rows matching query for GSA Agro:", rows)

# Test updating block
if rows:
    linked=query("update gsa_tv_program_blocks b set media_item_id=$1,updated_at=now() where b.id=$2 and b.schedule_version_id=$3 and b.media_item_id is null and exists(select 1 from gsa_tv_schedule_versions v where v.id=b.schedule_version_id and v.state='published') returning b.id",[m['id'],b['id'],versions[0]['id']])
    print("Linked result:", linked)
EOF
