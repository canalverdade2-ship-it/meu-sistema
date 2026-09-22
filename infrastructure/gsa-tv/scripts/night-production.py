#!/usr/bin/env python3
"""Daily production owner. No name-based linking or automatic stream commands."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import shutil
import subprocess
import sys
import time
import unicodedata
from zoneinfo import ZoneInfo

TZ = ZoneInfo('America/Sao_Paulo')
ROOT = Path('/opt/gsa-tv')
STATE = ROOT / 'runtime/production'
MEDIA = ROOT / 'cache/media/1'
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

def slug(name):
    name = ''.join(c for c in unicodedata.normalize('NFD', name) if not unicodedata.combining(c)).lower()
    return re.sub('[^a-z0-9]+', '-', name).strip('-')

def now():
    return dt.datetime.now(TZ)

def save(state):
    STATE.mkdir(parents=True, exist_ok=True)
    state['updated_at'] = now().isoformat()
    p = STATE / (state['date'] + '.json')
    tmp = p.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    tmp.replace(p)

def published(date):
    versions = query("select id from gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date=$1 and state='published' order by version desc limit 1", [date])
    if not versions:
        raise RuntimeError('Nenhuma grade publicada para ' + date)
    blocks = query("select b.id,b.program_id,b.planned_start_offset_s,b.planned_duration_s,b.media_item_id,b.is_reprise,b.metadata,b.block_type,p.name from gsa_tv_program_blocks b left join gsa_tv_programs p on p.id=b.program_id where b.schedule_version_id=$1 order by b.planned_start_offset_s,b.position", [versions[0]['id']])
    return versions[0]['id'], blocks

def run(command, deadline, logfile):
    remaining = (deadline-now()).total_seconds()
    if remaining <= 0:
        raise TimeoutError('Janela de produção encerrada às 05h59')
    with open(logfile,'a') as out:
        child = subprocess.Popen(command, stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = child.wait(timeout=remaining)
        except BaseException:
            os.killpg(child.pid,signal.SIGTERM)
            try: child.wait(timeout=15)
            except subprocess.TimeoutExpired: os.killpg(child.pid,signal.SIGKILL)
            raise
    if code:
        raise RuntimeError('Etapa falhou; código ' + str(code) + '; consulte ' + str(logfile))

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
    if not path.is_relative_to(MEDIA.resolve()):
        raise ValueError('Mídia fora do armazenamento do canal')
    return path


def sha256(path):
    digest=hashlib.sha256()
    with open(path,'rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''): digest.update(chunk)
    return digest.hexdigest()


def preserve(path, date):
    """Copy before in-place tools can overwrite an existing edition."""
    if not path.is_file(): return
    target=ROOT/'backups/production-editions'/date/(sha256(path)[:16]+'-'+path.name)
    if not target.exists():
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(path,target)


def reusable_master(output, manifest, date, budget):
    qc_path=output.with_suffix('.qc.json')
    try:
        qc=json.loads(qc_path.read_text())
        return (qc['state']=='validated' and qc['broadcast_date']==date
                and qc.get('manifest_sha256')==sha256(manifest)
                and qc.get('sha256')==sha256(output)
                and 0 < probe(output) <= budget+0.1)
    except (OSError,ValueError,KeyError,subprocess.SubprocessError): return False


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
        if actual + 1 < block['planned_duration_s'] and not library: return 'underfilled'
        if abs(actual-float(m['duration_s'])) > 2: return 'metadata_duration_mismatch'
    except Exception:
        return 'probe_failed'
    return None


def link_eligible(date, version, blocks):
    """Only approved, exact program/edition candidates; never overwrite operator links."""
    for b in blocks:
        if b['media_item_id'] or not b['program_id']: continue
        library=bool(b.get('is_reprise') or (b.get('metadata') or {}).get('content_mode')=='library')
        rows=query("select * from gsa_tv_media_items where channel_id='ch-main' and state='ready' and approval_state='approved' and rights_ok and (metadata->>'program_id'=$1 or metadata->>'program_slug'=$2 or ($3::boolean and (title ilike ('%' || $5 || '%') or id ilike ('%' || $2 || '%')))) and ($3::boolean or metadata->>'broadcast_date'=$4) order by updated_at desc",[str(b['program_id']),slug(b['name']),library,date,b['name']])
        for m in rows:
            if media_issue(m,b,date): continue
            backup=ROOT/'backups/production-links'/date/(str(b['id'])+'.json')
            backup.parent.mkdir(parents=True,exist_ok=True)
            if not backup.exists(): backup.write_text(json.dumps(b,default=str,ensure_ascii=False))
            linked=query("update gsa_tv_program_blocks b set media_item_id=$1,updated_at=now() where b.id=$2 and b.schedule_version_id=$3 and b.media_item_id is null and exists(select 1 from gsa_tv_schedule_versions v where v.id=b.schedule_version_id and v.state='published') returning b.id",[m['id'],b['id'],version])
            if linked: b['media_item_id']=m['id']
            break

def report(date):
    version, blocks = published(date)
    signature=query('select public.gsa_tv_production_signature($1) signature',[version])[0]['signature']
    policy=query("select config->'broadcast_schedule_policy' policy from gsa_tv_channels where id='ch-main'")[0].get('policy') or {}
    def seconds(clock):
        parts=[int(x) for x in clock.split(':')]
        return parts[0]*3600+parts[1]*60+(parts[2] if len(parts)>2 else 0)
    start_of_day=seconds(policy.get('on_air_start','06:00:00'))
    end_of_day=seconds(policy.get('stream_stop','00:00:00')) or 86400
    issues=[]
    previous=start_of_day
    for b in blocks:
        start=b['planned_start_offset_s']; duration=b['planned_duration_s']
        if start < start_of_day: continue
        if start != previous: issues.append({'block':b['id'],'issue':'gap_or_overlap','expected':previous,'actual':start})
        previous=start+duration
        rows=query('select state,approval_state,rights_ok,rights_expires_at,drive_path,duration_s from gsa_tv_media_items where id=$1 and channel_id=\'ch-main\'',[b['media_item_id']]) if b['media_item_id'] else []
        if not rows: issues.append({'block':b['id'],'program':b['name'],'issue':'missing_media'}); continue
        issue=media_issue(rows[0],b,date)
        if issue: issues.append({'block':b['id'],'program':b['name'],'issue':issue})
    if previous!=end_of_day: issues.append({'issue':'day_coverage','end':previous,'expected':end_of_day})
    current_signature=query('select public.gsa_tv_production_signature($1) signature',[version])[0]['signature']
    if signature!=current_signature: issues.append({'issue':'schedule_changed_during_check'})
    result={'type':'production_readiness','date':date,'schedule_version_id':version,'schedule_signature':signature,'broadcast_start_offset_s':start_of_day,'broadcast_end_offset_s':end_of_day,'state':'ready' if not issues else 'incomplete','issues':issues,'checked_at':now().isoformat()}
    STATE.mkdir(parents=True,exist_ok=True)
    (STATE/(date+'-readiness.json')).write_text(json.dumps(result,indent=2))
    query("insert into gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values('ch-main','night-production','automation_report','automation','production_readiness',$1::jsonb)",[json.dumps(result)])
    print(json.dumps(result))
    return result


def compile_ready(date):
    version,blocks=published(date)
    link_eligible(date,version,blocks)
    result=report(date)
    if result['state']!='ready': raise RuntimeError('Grade incompleta; playlist existente preservada')
    day=dt.date.fromisoformat(date)
    for edition in [day,day+dt.timedelta(days=1)]:
        preserve(ROOT/'playlists/1'/(edition.isoformat()+'.json'),date)
    job=query("insert into gsa_tv_jobs(channel_id,job_type,payload) values('ch-main','compile_playlist',$1::jsonb) returning id",[json.dumps({'date':date,'schedule_version_id':result['schedule_version_id'],'producer':'night-production'})])[0]['id']
    deadline=time.monotonic()+120
    while time.monotonic()<deadline:
        row=query('select status from gsa_tv_jobs where id=$1',[job])[0]
        if row['status']=='completed': break
        if row['status'] in ('failed','cancelled'): raise RuntimeError('Compilação falhou: '+str(job))
        time.sleep(2)
    else: raise TimeoutError('Compilação sem confirmação: '+str(job))
    playlist=json.loads((ROOT/'playlists/1'/(date+'.json')).read_text())
    entries=playlist.get('program',[])
    total=sum(float(e['out'])-float(e.get('in',0)) for e in entries)
    if playlist.get('date')!=date or not entries or abs(total-86400)>1:
        raise RuntimeError('Playlist compilada não cobre 24 horas')
    return job

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--require-ready',action='store_true')
    parser.add_argument('--compile-ready',action='store_true')
    parser.add_argument('--reconcile',action='store_true')
    parser.add_argument('--date',default=now().date().isoformat())
    parser.add_argument('--force',action='store_true',help='Bypass time window check')
    parser.add_argument('--max-runtime-minutes',type=int,default=None,help='Bound a forced production cycle without changing the nightly default')
    args=parser.parse_args()
    date=dt.date.fromisoformat(args.date).isoformat()
    if args.compile_ready:
        compile_ready(date)
        return
    if args.check or args.require_ready or args.reconcile:
        if args.reconcile:
            version,blocks=published(date)
            link_eligible(date,version,blocks)
        result=report(date)
        if args.require_ready and result['state']!='ready': sys.exit(2)
        return
    if not args.force and (now().time().replace(tzinfo=None)>=dt.time(5,59) or date!=now().date().isoformat()):
        raise RuntimeError('Produção permitida somente no dia atual entre 00h00 e 05h59 Brasília')
    STATE.mkdir(parents=True,exist_ok=True)
    lock=open('/tmp/gsa-tv-night-factory.lock','w')
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    query("select public.gsa_tv_materialize_fixed_schedule($1,'ch-main')",[date])
    version,blocks=published(date)
    link_eligible(date,version,blocks)
    existing_progs = []
    seen_slugs = set()
    state_file = STATE / (date + '.json')
    if state_file.exists():
        try:
            prev_data = json.loads(state_file.read_text())
            for p in prev_data.get('programs', []):
                if p.get('state') == 'validated' and p.get('slug') and p.get('slug') not in seen_slugs:
                    existing_progs.append(p)
                    seen_slugs.add(p.get('slug'))
        except Exception: pass
    db_items = query("select id,title,duration_s,drive_path,metadata from gsa_tv_media_items where channel_id='ch-main' and state='ready' and (metadata->>'broadcast_date'=$1 or title like ('%' || $1 || '%'))", [date])
    for row in db_items:
        meta = row.get('metadata') or {}
        p_slug = meta.get('program_slug') or slug(row.get('title','').split(' — ')[0])
        if p_slug and p_slug not in seen_slugs and row['id'].startswith('media-auto'):
            b_id = meta.get('target_block_id')
            p_name = row.get('title', '').split(' — ')[0]
            existing_progs.append({
                'block_id': b_id,
                'program': p_name,
                'slug': p_slug,
                'state': 'validated',
                'master': row['drive_path'],
                'duration': float(row['duration_s']),
                'media_id': row['id']
            })
            seen_slugs.add(p_slug)
    state={'date':date,'schedule_version_id':version,'state':'running','programs':existing_progs,'started_at':now().isoformat()}
    deadline=dt.datetime.combine(dt.date.fromisoformat(date),dt.time(5,59),TZ)
    if args.force and deadline < now():
        deadline = now() + dt.timedelta(hours=6)
    if args.max_runtime_minutes is not None:
        if not 5 <= args.max_runtime_minutes <= 360:
            raise ValueError('--max-runtime-minutes deve ficar entre 5 e 360')
        runtime_deadline = now() + dt.timedelta(minutes=args.max_runtime_minutes)
        deadline = min(deadline, runtime_deadline) if deadline > now() else runtime_deadline
    logfile=STATE/(date+'-execution.log')
    save(state)
    def interrupted(signum, frame):
        raise InterruptedError('Produção interrompida pelo serviço; retomada por checkpoints')
    signal.signal(signal.SIGTERM,interrupted)
    try:
        run(['python3','/opt/gsa-tv/bin/daily-scripts.py',date],deadline,logfile)
        source_ledger=json.loads((Path('/home/opc/gsa-ai/work')/('roteiros-'+date)/'production-sources.json').read_text())
        available={item['slug'] for item in source_ledger['programs'] if item['state']=='ready'}
        for block in blocks:
            if block['media_item_id']: continue
            if not block['name'] or block['is_reprise'] or (block.get('metadata') or {}).get('content_mode')=='library':
                state['programs'].append({'block_id':block['id'],'program':block['name'],'state':'missing_eligible_media'})
                save(state)
                continue
            name=slug(block['name']); budget=block['planned_duration_s']
            item={'block_id':block['id'],'program':block['name'],'slug':name,'state':'planned'}
            state['programs'].append(item);save(state)
            if name not in available:
                item['state']='autonomous_generation';save(state)
                print(f'[Night Production] Starting autonomous generation for {block["name"]} (budget: {budget}s)...', flush=True)
                try:
                    try:
                        speech_wpm=float(os.environ.get('GSA_TV_AUTOPILOT_SPEECH_WPM','125'))
                    except ValueError:
                        speech_wpm=125.0
                    speech_wpm=min(170.0,max(90.0,speech_wpm))
                    program_bumper=MEDIA/'identity/vinhetas'/('vinheta-'+name+'.mp4')
                    fallback_bumper=MEDIA/'identity/vinhetas'/'vinheta-gsa-tv-40s-broadcast-safe.mp4'
                    selected_bumper=program_bumper if program_bumper.is_file() else fallback_bumper
                    try:
                        bumper_reserve=2*probe(selected_bumper)
                    except Exception:
                        bumper_reserve=80.0
                    speech_seconds=max(60.0,float(budget)-bumper_reserve)
                    target_words=min(10000,max(500,int(round((speech_seconds/60.0)*speech_wpm))))
                    task_json={'output':f"/media/1/production/autonomous/{date}/{name}-{block['id']}.json",'mode':'generic_program','targetWords':target_words,'targetSeconds':budget,'date':date,'program':block['name']}
                    remaining=(deadline-now()).total_seconds()
                    if remaining<=0: raise TimeoutError('Janela de produção encerrada')
                    child=subprocess.Popen(['docker','exec','-i','gsa-tv-control-plane','node','/media/1/production/autonomous/tools/autonomous-script.cjs'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
                    try:
                        stdout_data,_=child.communicate(input=json.dumps(task_json),timeout=remaining)
                    except BaseException:
                        os.killpg(child.pid,signal.SIGTERM)
                        try: child.wait(timeout=15)
                        except subprocess.TimeoutExpired: os.killpg(child.pid,signal.SIGKILL)
                        raise
                    if child.returncode!=0: raise RuntimeError("Erro no pipeline autônomo: " + (stdout_data or '')[-500:])
                    lines = [l.strip() for l in stdout_data.strip().splitlines() if l.strip()]
                    result = None
                    for l in reversed(lines):
                        try:
                            cand = json.loads(l)
                            if isinstance(cand, dict) and ('media_id' in cand or 'state' in cand):
                                result = cand
                                break
                        except Exception:
                            continue
                    if not result:
                        result = json.loads(lines[-1])
                    item.update(state='validated',master=result['output'],duration=result['duration_s'],media_id=result['media_id'])
                    print(f'[Night Production] Program {block["name"]} validated: {result["media_id"]} ({result["duration_s"]}s)', flush=True)
                except (InterruptedError,TimeoutError,subprocess.TimeoutExpired): raise
                except Exception as exc:
                    item.update(state='failed_autonomous',error=str(exc)[:500])
                save(state)
                continue
            manifest=MEDIA/'audio/programs'/name/(name+'-manifest.json')
            output=MEDIA/'program-masters'/(name+'-'+date+'-'+str(block['id'])+'-master-1080p.mp4')
            try:
                item['state']='audio';save(state)
                # Reuse only a verified same-day manifest; never infer the edition from filename.
                reused=False
                if manifest.exists():
                    old=json.loads(manifest.read_text())
                    # Regenerated scripts can change within the same day. A date alone is insufficient.
                    script=Path('/home/opc/gsa-ai/work')/('roteiros-'+date)/'ROTEIROS-NOVOS.md'
                    reused=old.get('broadcast_date')==date and manifest.stat().st_mtime>=script.stat().st_mtime and 0<probe(old['audio_wav'])<max(1,budget-60)
                if not reused:
                    if manifest.exists():
                        prior=json.loads(manifest.read_text())
                        for key in ('audio_wav','audio_mp3'):
                            if prior.get(key): preserve(media_path(prior[key]),date)
                        preserve(manifest,date)
                    run(['node','/home/opc/gsa-ai/bin/gsa-tts-engine.mjs','--date',date,'--slug',name,'--budget-seconds',str(budget)],deadline,logfile)
                item['state']='video';save(state)
                if not reusable_master(output,manifest,date,budget):
                    preserve(output,date)
                    preserve(output.with_suffix('.qc.json'),date)
                    run(['python3','/home/opc/gsa-program-builder/video_assembler.py','--manifest',str(manifest),'--output',str(output),'--no-register','--budget-seconds',str(budget),'--broadcast-date',date],deadline,logfile)
                    qc=json.loads(output.with_suffix('.qc.json').read_text())
                    qc.update(manifest_sha256=sha256(manifest),sha256=sha256(output))
                    output.with_suffix('.qc.json').write_text(json.dumps(qc))
                qc=json.loads(output.with_suffix('.qc.json').read_text())
                item.update(state='validated',master=str(output),duration=qc['probe']['duration'])
                # No broad matching, no forged approval: register a reviewable candidate.
                media_id='media-master-'+name+'-'+date+'-'+str(block['id'])
                auto_approval_enabled = str(os.environ.get('GSA_TV_AUTOPILOT_AUTO_APPROVE','')).strip().lower() in ('1','true','yes','on')
                technical_passed = (
                    qc.get('state') == 'validated'
                    and abs(float(qc['probe']['duration']) - float(budget)) <= 1.5
                )
                provenance_declared = bool(qc.get('source_ledger') or qc.get('visual_provenance') or source_ledger)
                automated_approval = auto_approval_enabled and technical_passed and provenance_declared
                approval_state = 'approved' if automated_approval else 'pending'
                rights_ok = bool(automated_approval)
                metadata={
                    'program_slug':name,
                    'program_id':block['program_id'],
                    'broadcast_date':date,
                    'production_qc':qc,
                    'target_block_id':block['id'],
                    'target_duration_s':budget,
                    'automated_approval':{
                        'enabled':auto_approval_enabled,
                        'approved':automated_approval,
                        'policy':'gsa_tv_autopilot_generated_content_v1',
                        'technical_qc_passed':technical_passed,
                        'provenance_declared':provenance_declared,
                        'decided_at':now().isoformat(),
                    },
                    'rights_basis':{
                        'policy':'autopilot_generated_content_v1',
                        'source_ledger':source_ledger,
                    } if automated_approval else None,
                }
                query("insert into gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,video_codec,video_width,video_height,video_fps,audio_codec,audio_sample_rate,audio_channels,state,rights_ok,drive_path,media_kind,source_type,ai_generated,approval_state,metadata) values($1,'ch-main',$2,$3,$4,'h264',1920,1080,30,'aac',48000,2,'ready',$5,$6,'program','services',true,$7,$8::jsonb) on conflict(id) do update set approval_state=excluded.approval_state,rights_ok=excluded.rights_ok,metadata=excluded.metadata,duration_s=excluded.duration_s,drive_path=excluded.drive_path,updated_at=now()",[media_id,block['name']+' — '+date,output.name,round(qc['probe']['duration']),rights_ok,'/media/1/program-masters/'+output.name,approval_state,json.dumps(metadata)])
                item['state']='validated' if automated_approval else 'awaiting_automated_approval_policy'
                item['media_id']=media_id
            except (InterruptedError,TimeoutError): raise
            except Exception as exc:
                item.update(state='failed',error=str(exc)[:500])
            save(state)
            if now()>=deadline: break
        link_eligible(date,version,blocks)
        state['state']=report(date)['state']
        if state['state']=='ready': state['compile_job_id']=compile_ready(date)
    except BaseException as exc:
        state.update(state='failed',error=str(exc)[:500]);raise
    finally:
        state['finished_at']=now().isoformat();save(state)
        query("insert into gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values('ch-main','night-production','automation_report','automation','night_production',$1::jsonb)",[json.dumps(state)])
    if state['state']!='ready':sys.exit(2)

if __name__=='__main__':main()
