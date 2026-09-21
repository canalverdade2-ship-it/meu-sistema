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

def media_issue(m, block, date):
    if m['state'] != 'ready' or m['approval_state'] != 'approved' or not m['rights_ok']:
        return 'media_not_approved'
    expiry = m.get('rights_expires_at')
    end = dt.datetime.combine(dt.date.fromisoformat(date),dt.time(),TZ) + dt.timedelta(seconds=block['planned_start_offset_s']+block['planned_duration_s'])
    if expiry and dt.datetime.fromisoformat(str(expiry).replace('Z','+00:00')) < end:
        return 'rights_expired_before_end'
    try:
        path = media_path(m['drive_path'])
        if not path.is_file(): return 'missing_file'
        actual = probe(path)
        library = bool(block.get('is_reprise') or (block.get('metadata') or {}).get('content_mode')=='library')
        if actual > block['planned_duration_s']+1 and not library: return 'overlong'
        # Playout compiler automatically pads underfilled slots with Continuidade filler.
        if abs(actual-float(m['duration_s'])) > 2: return 'metadata_duration_mismatch'
    except Exception as e:
        return f'probe_failed: {e}'
    return None

date = '2026-09-15'
versions = query("select id from gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date=$1 and state='published' order by version desc limit 1", [date])
version = versions[0]['id']
blocks = query("select b.id,b.program_id,b.planned_start_offset_s,b.planned_duration_s,b.media_item_id,b.is_reprise,b.metadata,b.block_type,p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=$1 order by b.planned_start_offset_s,b.position", [version])

linked_count = 0
for b in blocks:
    if b['media_item_id'] or not b['program_id']: continue
    library=bool(b.get('is_reprise') or (b.get('metadata') or {}).get('content_mode')=='library')
    rows=query("select * from gsa_tv_media_items where channel_id='ch-main' and state='ready' and approval_state='approved' and rights_ok and (metadata->>'program_id'=$1 or metadata->>'program_slug'=$2 or ($3::boolean and (title ilike ('%' || $5 || '%') or id ilike ('%' || $2 || '%')))) and ($3::boolean or metadata->>'broadcast_date'=$4) order by updated_at desc",[str(b['program_id']),slug(b['name']),library,date,b['name']])
    for m in rows:
        issue = media_issue(m, b, date)
        if issue:
            print(f"Skipping {m['id']} for {b['name']}: {issue}")
            continue
        backup = ROOT / 'backups/production-links' / date / (str(b['id']) + '.json')
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_text(json.dumps(b, default=str, ensure_ascii=False))
        linked = query("update gsa_tv_program_blocks b set media_item_id=$1,updated_at=now() where b.id=$2 and b.schedule_version_id=$3 and b.media_item_id is null and exists(select 1 from gsa_tv_schedule_versions v where v.id=b.schedule_version_id and v.state='published') returning b.id", [m['id'], b['id'], version])
        if linked:
            b['media_item_id'] = m['id']
            linked_count += 1
            print(f"SUCCESS: Linked {m['id']} ({m['title']}) to block {b['name']} ({b['id']})")
        break

print(f"Total blocks newly linked: {linked_count}")
EOF
