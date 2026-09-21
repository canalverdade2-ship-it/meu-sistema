import { runSshScript } from './ssh2-run.mjs';

const sh = `python3 - <<'PY'
import json,re
from pathlib import Path
p=Path('/home/opc/gsa-ai/qc/fish-voices/candidate-catalog-2026-09-05.json')
items=json.loads(p.read_text(encoding='utf-8'))
bad=re.compile(r'lula|bolsonaro|neymar|cristiano|ronaldo|goku|naruto|sukuna|gojo|michael jackson|jarvis|todo mundo odeia|brainrot|anime|personagem|presidente|cipriano|pastor miranda|silvio santos|galv[aã]o|morgan freeman|wagner moura|dublador de|voz de |clone|loli|hentai|sexo|sedut|sensual',re.I)
def tags(x): return ' '.join([x.get('title',''),x.get('description',''),' '.join(x.get('tags',[]))]).lower()
def rank(gender, wants, avoids=()):
  out=[]
  for x in items:
    h=tags(x); tt=set(t.lower() for t in x.get('tags',[]))
    if bad.search(h): continue
    if gender not in tt: continue
    if 'pt' not in x.get('languages',[]): continue
    score=sum(7 for w in wants if w in h)-sum(9 for a in avoids if a in h)
    score+=min(x.get('like_count',0),500)/500+min(x.get('task_count',0),50000)/50000
    if score>1: out.append((score,x))
  out.sort(key=lambda z:z[0],reverse=True)
  return [{'score':round(s,2),'id':x['id'],'title':x['title'],'description':x['description'][:180],'tags':x['tags'],'sample':(x.get('samples')or [{}])[0].get('audio','')} for s,x in out[:12]]
profiles={
'male_authoritative':('male',['professional','authoritative','clear','confident','serious'],['character','raspy','villain']),
'female_authoritative':('female',['professional','authoritative','clear','confident','serious'],['character','seductive']),
'male_warm_spiritual':('male',['warm','calm','deep','empathetic','narration','storytelling'],['advertisement','villain','energetic']),
'female_warm_spiritual':('female',['warm','calm','soft','empathetic','narration','storytelling'],['advertisement','seductive']),
'male_young_energy':('male',['young','energetic','dynamic','friendly','enthusiastic','clear'],['character','anime','raspy']),
'female_young_energy':('female',['young','energetic','dynamic','friendly','enthusiastic','clear'],['character','anime','seductive']),
'male_documentary':('male',['documentary','narration','storytelling','calm','deep','professional'],['advertisement','character']),
'female_documentary':('female',['documentary','narration','storytelling','calm','warm','professional'],['advertisement','character']),
'male_conversational':('male',['conversational','friendly','natural','warm','clear','professional'],['character','advertisement']),
'female_conversational':('female',['conversational','friendly','natural','warm','clear','professional'],['character','seductive']),
'female_culinary':('female',['warm','friendly','professional','conversational','energetic','clear'],['character','seductive']),
'female_children':('female',['cheerful','playful','friendly','bright','storytelling','clear'],['seductive','anime']),
}
out={k:rank(*v) for k,v in profiles.items()}
Path('/home/opc/gsa-ai/qc/fish-voices/shortlist-2026-09-05.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
PY
`;
const result=await runSshScript(sh,60000);
process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
