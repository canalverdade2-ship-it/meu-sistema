import { runSshScript } from './ssh2-run.mjs';
const sh=`python3 - <<'PY'
from pathlib import Path
import unicodedata,re
root=Path('/home/opc/gsa-ai/docs/programas')
mappings={
'GSA Mercado':('casting-board-01-news-business-tech-2026-09-04.png','linha superior, posição 1'),'GSA Tempo':('casting-board-01-news-business-tech-2026-09-04.png','linha superior, posição 2'),'GSA Cidadania':('casting-board-01-news-business-tech-2026-09-04.png','linha superior, posição 3'),'GSA Business':('casting-board-01-news-business-tech-2026-09-04.png','linha superior, posição 4'),'GSA Tech':('casting-board-01-news-business-tech-2026-09-04.png','linha inferior, posição 1'),'GSA Motor':('casting-board-01-news-business-tech-2026-09-04.png','linha inferior, posição 2'),'GSA Agro':('casting-board-01-news-business-tech-2026-09-04.png','linha inferior, posição 3'),'GSA Mundo':('casting-board-01-news-business-tech-2026-09-04.png','linha inferior, posição 4'),
'GSA Destinos':('casting-board-02-lifestyle-faith-sports-2026-09-04.png','linha superior, posição 1'),'GSA Bem Viver':('casting-board-02-lifestyle-faith-sports-2026-09-04.png','linha superior, posição 2'),'GSA Sabor':('casting-board-02-lifestyle-faith-sports-2026-09-04.png','linha superior, posição 3'),'GSA Em Fé':('casting-board-02-lifestyle-faith-sports-2026-09-04.png','linha superior, posição 4'),'GSA Hora da Palavra':('casting-board-02-lifestyle-faith-sports-2026-09-04.png','linha inferior, posição 1'),'GSA Tá na Rede':('casting-board-02-lifestyle-faith-sports-2026-09-04.png','linha inferior, posição 2'),'GSA Esportes':('casting-board-02-lifestyle-faith-sports-2026-09-04.png','linha inferior, posição 3'),'GSA Mistérios':('casting-board-02-lifestyle-faith-sports-2026-09-04.png','linha inferior, posição 4'),
'GSA Music':('casting-board-03-entertainment-narrators-2026-09-04.png','linha superior, posição 1'),'GSA Cinema':('casting-board-03-entertainment-narrators-2026-09-04.png','linha superior, posição 2'),'GSA Sessão Pipoca':('casting-board-03-entertainment-narrators-2026-09-04.png','linha superior, posição 3'),'GSA Planeta Terra':('casting-board-03-entertainment-narrators-2026-09-04.png','linha inferior, posição 1'),'GSA Histórias da Bíblia':('casting-board-03-entertainment-narrators-2026-09-04.png','linha inferior, posição 2'),'GSA Desenhos':('casting-board-03-entertainment-narrators-2026-09-04.png','linha inferior, posição 3')}
files=list(root.glob('*_FICHA.md'))
updated=0
for program,(board,pos) in mappings.items():
    target=None
    for p in files:
        first=p.read_text(encoding='utf-8').splitlines()[0] if p.exists() else ''
        if first.strip()==f'# Ficha Oficial — {program}': target=p; break
    if not target: print('NOT_FOUND',program); continue
    s=target.read_text(encoding='utf-8')
    line=f'- Avatar: APROVADO em 04/09/2026 — referência {board}, {pos}.'
    if line not in s: s+='\\n## Avatar aprovado\\n\\n'+line+'\\n'
    target.write_text(s,encoding='utf-8'); updated+=1
for program in ['GSA Manhã News','GSA Meio Dia News','GSA News Noite']:
    for p in files:
        first=p.read_text(encoding='utf-8').splitlines()[0]
        if first.strip()==f'# Ficha Oficial — {program}':
            s=p.read_text(encoding='utf-8'); line='- Avatares: APROVADOS — dois âncoras fixos existentes no Google Vids; vozes Holt e Nyla.'
            if line not in s:s+='\\n## Avatares aprovados\\n\\n'+line+'\\n'
            p.write_text(s,encoding='utf-8'); updated+=1
print('UPDATED',updated)
print('APPROVED_FILES',sum(1 for p in files if 'APROVADO' in p.read_text(encoding='utf-8')))
PY
`;
const result=await runSshScript(sh,60000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
