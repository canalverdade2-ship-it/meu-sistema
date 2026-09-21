#!/usr/bin/env python3
"""Use the installed Control Plane/ffplayout contract, not the removed encoder API."""
import argparse
import datetime as dt
import importlib.util
import json
from pathlib import Path
import subprocess
import time

spec=importlib.util.spec_from_file_location('production',Path(__file__).with_name('night-production.py'))
production=importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)

SNAPSHOT="""(async()=>{const r=await fetch('http://127.0.0.1:9202/automation/snapshot',{headers:{authorization:'Bearer '+process.env.INTERNAL_API_TOKEN},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Snapshot HTTP '+r.status);const x=await r.json();console.log(JSON.stringify({stream:x.stream,channel:x.channel}))})().catch(e=>{console.error(e.message);process.exitCode=1});"""


def snapshot():
    result=subprocess.run(['docker','exec','gsa-tv-control-plane','node','-e',SNAPSHOT],capture_output=True,text=True,check=True,timeout=15)
    return json.loads(result.stdout)


def confirmed(state, mode, now=None):
    now=now or production.now()
    channel=state.get('channel') or {};stream=state.get('stream') or {}
    try:
        last=dt.datetime.fromisoformat(channel['last_heartbeat_at'].replace('Z','+00:00'))
        fresh=0<=(now-last).total_seconds()<180
    except (KeyError,ValueError,TypeError): fresh=False
    return bool(fresh and stream.get('mode')==mode and stream.get('actual')=='sending'
                and channel.get('signal_state')=='sending' and not channel.get('last_error'))


def transition(mode, force=False):
    current=snapshot()
    if not force and confirmed(current,mode):return current
    date=production.now().date()
    for day in [date,date+dt.timedelta(days=1)]:
        production.preserve(production.ROOT/'playlists/1'/(day.isoformat()+'.json'),date.isoformat())
    job_type='stream_start' if mode=='program' else 'stream_standby'
    pending=production.query("select id from gsa_tv_jobs where channel_id='ch-main' and job_type=$1 and status in ('pending','running') order by created_at desc limit 1",[job_type])
    job=(pending or production.query("insert into gsa_tv_jobs(channel_id,job_type,payload) values('ch-main',$1,'{\"source\":\"night-controller\"}'::jsonb) returning id",[job_type]))[0]['id']
    deadline=time.monotonic()+90
    while time.monotonic()<deadline:
        status=production.query('select status from gsa_tv_jobs where id=$1',[job])[0]['status']
        if status in ('failed','cancelled'):raise RuntimeError('Transição recusada; verificar job '+str(job))
        if status=='completed':
            current=snapshot()
            if confirmed(current,mode):return current
        time.sleep(2)
    raise TimeoutError('Sem confirmação de transmissão no modo '+mode)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('mode',choices=['start','stop','signoff','check'])
    args=parser.parse_args()
    date=production.now().date().isoformat()
    if args.mode=='check':
        state=snapshot()
        print(json.dumps({'date':date,'mode':state.get('stream',{}).get('mode'),'program_confirmed':confirmed(state,'program'),'standby_confirmed':confirmed(state,'standby')}))
        return
    result={'date':date,'action':args.mode,'state':'failed'}
    try:
        if args.mode=='start':
            if production.now().hour<6:raise RuntimeError('Retorno à programação permitido a partir das 06h00 Brasília')
            production.compile_ready(date)
            transition('program',force=True)
        elif args.mode=='stop':
            if production.now().hour>=6:raise RuntimeError('Continuidade noturna automática restrita à madrugada')
            transition('standby')
            subprocess.run(['systemctl','start','--no-block','gsa-tv-night-factory.service'],check=True)
        else:
            production.probe(production.MEDIA/'identity/gsa-tv-continuity-1080p30.mp4')
        result['state']='confirmed'
    except Exception as error:
        result['error']=str(error)[:400]
        raise
    finally:
        result['checked_at']=production.now().isoformat()
        production.query("insert into gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values('ch-main','night-controller','automation_report','automation','transmission_transition',$1::jsonb)",[json.dumps(result)])
        print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':main()
