#!/usr/bin/env python3
"""Build edition scripts from verified, reusable sources and the real daily clock."""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import re
import sys

spec=importlib.util.spec_from_file_location('production',Path(__file__).with_name('night-production.py'))
production=importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)


def clean(value):
    return re.sub(r'\s+',' ',re.sub(r'<[^>]*>','',str(value or ''))).strip()


def bounded_story(title, summary, words):
    """Keep complete sentences; do not accelerate narration or cut it mid-sentence."""
    result=[]
    for sentence in re.split(r'(?<=[.!?])\s+',clean(title)+'. '+clean(summary)):
        if len((' '.join(result+[sentence])).split())>words: break
        result.append(sentence)
    return ' '.join(result)


def build(date):
    version,blocks=production.published(date)
    programs={}
    for b in blocks:
        if not b['name'] or (b.get('metadata') or {}).get('content_mode')=='library' or b['is_reprise']: continue
        old=programs.get(b['program_id'])
        if not old or b['planned_duration_s']<old['planned_duration_s']: programs[b['program_id']]=b
    lines=['# GSA TV — roteiros '+date,'']
    ledger={'date':date,'schedule_version_id':version,'programs':[]}
    for index,b in enumerate(programs.values(),1):
        # reference_only cannot be copied into automatic narration as licensed material.
        stories=production.query("""select i.id,i.source_id,i.title,i.summary,i.canonical_url,i.rights_classification,
                                      s.name source_name,s.provider,s.attribution
                                 from gsa_tv_editorial_items i
                                 join gsa_tv_editorial_sources s on s.id=i.source_id
                                where i.program_id=$1
                                  and i.validation_state='verified'
                                  and i.rights_classification in ('open_data','public_domain','licensed')
                                  and i.published_at >= $2::date - interval '2 days'
                                  and i.published_at < $2::date + interval '1 day'
                                order by i.published_at desc,i.id
                                limit 12""",[b['program_id'],date])
        word_budget=max(0,int((b['planned_duration_s']-60)*1.5)-80)
        paragraphs=[];used=[];source_items=[]
        for story in stories:
            text=bounded_story(story['title'],story['summary'],word_budget)
            if not text: continue
            paragraphs.append(text);used.append(story['id']);word_budget-=len(text.split())
            source_items.append({
                'id':str(story['id']),
                'source_id':story.get('source_id'),
                'source_name':clean(story.get('source_name')),
                'provider':clean(story.get('provider')),
                'attribution':clean(story.get('attribution')),
                'title':clean(story.get('title')),
                'summary':clean(story.get('summary')),
                'canonical_url':story.get('canonical_url'),
                'rights_classification':story.get('rights_classification')
            })
        item={
            'program_id':b['program_id'],
            'slug':production.slug(b['name']),
            'content_mode':(b.get('metadata') or {}).get('content_mode'),
            'source_ids':used,
            'source_items':source_items,
            'source_word_count':sum(len((x.get('title','')+' '+x.get('summary','')).split()) for x in source_items),
            'state':'ready' if paragraphs else 'missing_verified_sources',
            'budget_seconds':b['planned_duration_s']
        }
        ledger['programs'].append(item)
        if not paragraphs: continue
        start=b['planned_start_offset_s'];end=start+b['planned_duration_s']
        clock=lambda value:f'{value//3600:02d}h{value%3600//60:02d}'
        lines += [f"## {index:02d} — {clock(start)}–{clock(end)} | {b['name']}",'',f'**Episódio:** Edição de {date}.','','### Locução','',f"Você acompanha o {b['name']}, na GSA TV.",'',*sum(([p,''] for p in paragraphs),[]),'Continue acompanhando a programação da GSA TV.','',f"**GC:** “{b['name']}”.",'']
    directory=Path('/home/opc/gsa-ai/work')/('roteiros-'+date)
    directory.mkdir(parents=True,exist_ok=True)
    for name,content in [('ROTEIROS-NOVOS.md','\n'.join(lines)),('production-sources.json',json.dumps(ledger,ensure_ascii=False,indent=2))]:
        target=directory/name
        if not target.exists() or target.read_text()!=content:
            production.preserve(target,date)
            temporary=target.with_suffix('.tmp')
            temporary.write_text(content);temporary.replace(target)
    print(json.dumps({'programs':len(ledger['programs']),'with_sources':sum(x['state']=='ready' for x in ledger['programs'])}))


if __name__=='__main__': build(dt.date.fromisoformat(sys.argv[1]).isoformat())
