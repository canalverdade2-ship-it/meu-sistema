import { runSshScript } from './ssh2-run.mjs';
const sh=`python3 - <<'PY'
import json,re
from pathlib import Path
x=json.loads(Path('/home/opc/gsa-ai/qc/fish-voices/candidate-catalog-2026-09-05.json').read_text())
for label,gender,rx in [('tempo','female',r'tempo|clima|meteor'),('motor','female',r'motor|autom|carro'),('cidadania','female',r'cidad|direito|serviço|social'),('misterios','female',r'mistério|suspense|enigma|sombria'),('natureza','female',r'natureza|document|planeta|ambient')]:
 print('\\n###',label)
 n=0
 for a in x:
  h=' '.join([a.get('title',''),a.get('description',''),' '.join(a.get('tags',[]))])
  if gender in [str(t).lower() for t in a.get('tags',[])] and re.search(rx,h,re.I) and 'pt' in a.get('languages',[]):
   if re.search(r'google|sexy|sedut|personagem|anime|tiktok|ator|atriz|lula|bolsonaro|narradora de documentário$',h,re.I):continue
   print(json.dumps({'id':a['id'],'title':a['title'],'description':a['description'][:150],'tags':a['tags'],'sample':(a.get('samples')or [{}])[0].get('audio','')},ensure_ascii=False));n+=1
   if n>=10:break
PY`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
