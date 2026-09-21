import { runSshScript } from './ssh2-run.mjs';

const sh = `python3 - <<'PY'
import json,re
from pathlib import Path
items=json.loads(Path('/home/opc/gsa-ai/qc/fish-voices/candidate-catalog-2026-09-05.json').read_text(encoding='utf-8'))
bad=re.compile(r'lula|bolsonaro|neymar|cristiano|ronaldo|goku|naruto|sukuna|gojo|michael|jackson|jarvis|todo mundo|brainrot|anime|personagem|presidente|cipriano|silvio|galv[aã]o|morgan|freeman|wagner|clone|loli|hentai|putinha|sexo|sexy|sedut|pinkie|twilight|mlp|haaland|mortal kombat|jjk|cid moreira|tiktok|kasane|dublador|ator|atriz|político|politico',re.I)
roles=[
('GSA Mercado','Eduardo Salles','male',['professional','clear','confident','authoritative','measured'],['econom','mercado','financ']),
('GSA Tempo','Clara Venturi','female',['clear','friendly','professional','calm','conversational'],['tempo','meteorolog','clima']),
('GSA Cidadania','Patrícia Silva','female',['empathetic','clear','professional','warm','authoritative'],['cidad','serviço','direito','social']),
('GSA Business','Ricardo Brandão','male',['professional','confident','authoritative','clear','measured'],['business','negócio','executiv','empreend']),
('GSA Tech','Caio Nex','male',['young','energetic','dynamic','clear','friendly'],['tech','tecnolog','digital','jovem']),
('GSA Motor','Bruna Ventura','female',['confident','dynamic','energetic','professional','clear'],['motor','autom','carro']),
('GSA Agro','Daniel Campos','male',['warm','professional','clear','calm','authoritative'],['agro','rural','campo']),
('GSA Mundo','Olívia Valverde','female',['professional','clear','authoritative','measured','calm'],['mundo','internacional','document','jornal']),
('GSA Destinos','Marina Horizonte','female',['warm','friendly','energetic','conversational','clear'],['viagem','destino','turismo']),
('GSA Bem Viver','Lucas Sereno','male',['warm','calm','friendly','empathetic','conversational'],['bem-estar','saúde','viver','conselh']),
('GSA Sabor','Chef Lorena Prado','female',['warm','friendly','energetic','clear','conversational'],['culin','chef','receita','gastronom']),
('GSA Em Fé','Pastor Samuel Veredas','male',['warm','deep','calm','authoritative','inspirational'],['espiritual','pregador','pastor','fé']),
('GSA Hora da Palavra','Elisa Monteiro','female',['warm','calm','empathetic','clear','storytelling'],['espiritual','bíblia','palavra','reflex']),
('GSA Tá na Rede','Nina Conecta','female',['young','energetic','dynamic','friendly','conversational'],['rede','social','internet','jovem']),
('GSA Esportes','André Linhares','male',['energetic','dynamic','confident','clear','announcer'],['esport','futebol','narrador']),
('GSA Mistérios','Aurora Alencar','female',['deep','calm','serious','storytelling','expressive'],['mistério','suspense','enigm']),
('GSA Music','Mauro Beat','male',['young','energetic','dynamic','friendly','enthusiastic'],['music','rádio','radio','dj']),
('GSA Cinema','Thea Lumière','female',['professional','warm','storytelling','clear','expressive'],['cinema','filme','crítica']),
('GSA Sessão Pipoca','Beto Pipoca','male',['friendly','energetic','playful','conversational','clear'],['cinema','pipoca','filme','entretenimento']),
('GSA Planeta Terra','Gaia Monteverde','female',['calm','warm','professional','storytelling','documentary'],['natureza','document','planeta','ambient']),
('GSA Histórias da Bíblia','Salomão Oliveira','male',['deep','warm','calm','storytelling','authoritative'],['bíblia','bíblico','história','narrador']),
('GSA Desenhos','Luna Alegria','female',['cheerful','playful','friendly','bright','storytelling'],['infantil','criança','desenho','alegre']),
]
used=set(); assigned=[]
for program,presenter,gender,wants,topics in roles:
  cand=[]
  for x in items:
    title=x.get('title',''); desc=x.get('description',''); tg=[str(t).lower() for t in x.get('tags',[])]; h=' '.join([title,desc,' '.join(tg)]).lower()
    if x['id'] in used or bad.search(h) or 'pt' not in x.get('languages',[]) or gender not in tg: continue
    score=sum(5 for w in wants if w.lower() in h)+sum(10 for w in topics if w.lower() in h)
    score+=min(x.get('like_count',0),300)/300+min(x.get('task_count',0),30000)/30000
    if ('character-voice' in tg): score-=12
    if ('advertisement' in tg and program not in ['GSA Music','GSA Esportes']): score-=3
    if score>8:cand.append((score,x))
  cand.sort(key=lambda a:a[0],reverse=True)
  if not cand: print('NO_CANDIDATE',program);continue
  score,x=cand[0];used.add(x['id'])
  assigned.append({'program':program,'presenter':presenter,'voice_id':x['id'],'catalog_title':x['title'],'description':x['description'],'tags':x['tags'],'sample':(x.get('samples')or [{}])[0].get('audio',''),'score':round(score,2)})
Path('/home/opc/gsa-ai/qc/fish-voices/provisional-assignment-2026-09-05.json').write_text(json.dumps(assigned,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(assigned,ensure_ascii=False,indent=2))
PY
`;
const result=await runSshScript(sh,60000);
process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
