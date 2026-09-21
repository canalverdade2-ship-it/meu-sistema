import {runSshScript} from './ssh2-run.mjs';
const py=String.raw`from pathlib import Path
programs=[
('gsa-manha-news','GSA Manhã News'),('gsa-meio-dia-news','GSA Meio Dia News'),('gsa-news-noite','GSA News Noite'),('gsa-news-especial','GSA News Especial'),('gsa-mercado','GSA Mercado'),('gsa-tempo','GSA Tempo'),('gsa-cidadania','GSA Cidadania'),('gsa-business','GSA Business'),
('gsa-tech','GSA Tech'),('gsa-motor','GSA Motor'),('gsa-agro','GSA Agro'),('gsa-mundo','GSA Mundo'),('gsa-destinos','GSA Destinos'),('gsa-destinos-do-mundo','GSA Destinos do Mundo'),('gsa-bem-viver','GSA Bem Viver'),('gsa-sabor','GSA Sabor'),
('gsa-em-fe','GSA Em Fé'),('gsa-em-fe-reflexao','GSA Em Fé Reflexão'),('gsa-historias-da-biblia','GSA Histórias da Bíblia'),('gsa-noite-de-louvor','GSA Noite de Louvor'),('gsa-music','GSA Music'),('gsa-ta-na-rede','GSA Tá na Rede'),('gsa-ta-na-rede-web','GSA Tá na Rede Web'),('gsa-esportes','GSA Esportes'),
('gsa-cinema','GSA Cinema'),('gsa-sessao-pipoca','GSA Sessão Pipoca'),('gsa-desenhos-classicos','GSA Desenhos Clássicos'),('gsa-doc','GSA Doc'),('gsa-documentario-especial','GSA Documentário Especial'),('gsa-planeta-terra','GSA Planeta Terra'),('gsa-misterios','GSA Mistérios'),('gsa-motivacao','GSA Motivação')]
existing=list(Path('/opt/gsa-tv/cache/media/1/identity/vinhetas').glob('*.mp4'))
aliases={'gsa-manha-news':['manha-news'],'gsa-news-noite':['gsa-news'],'gsa-mercado':['boletim-financeiro'],'gsa-ta-na-rede':['ta-na-rede']}
lines=['# GSA TV — Inventário Canônico de Identidades dos Programas','', 'Data-base: 04/09/2026', '', 'Fonte canônica: grade semanal habilitada do Painel Master, consolidada em 32 identidades de marca.', '', '## Regras', '', '- Todo nome começa por **GSA**.','- **GSA Entrevista** está removido e não pode reaparecer.','- Quadros horários de GSA Em Fé não são logos independentes.','- Faixa 1 e Faixa 2 são variações de GSA Music, não programas distintos.','- Cada programa requer abertura MASTER Full HD e fechamento MASTER Full HD próprios.','- Estado “candidato existente” exige QC antes de aprovação.','', '## Inventário', '', '| Programa | Abertura | Fechamento | Observação |','|---|---|---|---|']
for slug,name in programs:
 pats=aliases.get(slug,[slug.replace('gsa-','')])
 cand=[str(p) for p in existing if any(x in p.name.lower() for x in pats)]
 op='CANDIDATO EXISTENTE' if cand else 'AUSENTE'
 note='; '.join(cand) if cand else 'Produzir no Flow/Vids e submeter a QC'
 lines.append(f'| {name} | {op} | AUSENTE | {note} |')
lines += ['', '## Totais', '', f'- Identidades canônicas: {len(programs)}', '- Masters necessários: 64 (32 aberturas + 32 fechamentos)', f'- Aberturas candidatas localizadas automaticamente: {sum(any(any(x in p.name.lower() for x in aliases.get(s,[s.replace("gsa-","")])) for p in existing) for s,_ in programs)}', '- Fechamentos nomeados localizados: 0', '- Nenhum candidato é considerado aprovado sem inspeção visual, ffprobe, loudness e teste de inserção.', '']
Path('/home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md').write_text('\n'.join(lines),encoding='utf-8')
print('\n'.join(lines))
`;
const enc=Buffer.from(py).toString('base64');const remote=String.raw`printf '%s' '${enc}'|base64 -d >/tmp/make-id-inventory.py
python3 /tmp/make-id-inventory.py
rm -f /tmp/make-id-inventory.py`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
