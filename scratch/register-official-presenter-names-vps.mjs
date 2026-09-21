import { runSshScript } from './ssh2-run.mjs';

const sh = `python3 - <<'PY'
from pathlib import Path
import re

root = Path('/home/opc/gsa-ai/docs/programas')
names = {
    'GSA Manhã News': 'Marcelo Valença e Lívia Fontes',
    'GSA Meio Dia News': 'Marcelo Valença e Lívia Fontes',
    'GSA Meio-Dia News': 'Marcelo Valença e Lívia Fontes',
    'GSA News Noite': 'Marcelo Valença e Lívia Fontes',
    'GSA Mercado': 'Eduardo Salles',
    'GSA Tempo': 'Clara Venturi',
    'GSA Cidadania': 'Patrícia Silva',
    'GSA Business': 'Ricardo Brandão',
    'GSA Tech': 'Caio Nex',
    'GSA Motor': 'Bruna Ventura',
    'GSA Agro': 'Daniel Campos',
    'GSA Mundo': 'Olívia Valverde',
    'GSA Destinos': 'Marina Horizonte',
    'GSA Bem Viver': 'Lucas Sereno',
    'GSA Sabor': 'Chef Lorena Prado',
    'GSA Em Fé': 'Pastor Samuel Veredas',
    'GSA Hora da Palavra': 'Elisa Monteiro',
    'GSA Tá na Rede': 'Nina Conecta',
    'GSA Esportes': 'André Linhares',
    'GSA Mistérios': 'Aurora Alencar',
    'GSA Music': 'Mauro Beat',
    'GSA Cinema': 'Thea Lumière',
    'GSA Sessão Pipoca': 'Beto Pipoca',
    'GSA Planeta Terra': 'Gaia Monteverde',
    'GSA Histórias da Bíblia': 'Salomão Oliveira',
    'GSA Desenhos': 'Luna Alegria',
}

files = list(root.glob('*_FICHA.md'))
updated = []
missing = []
for p in files:
    s = p.read_text(encoding='utf-8')
    first = s.splitlines()[0].strip() if s.splitlines() else ''
    if not first.startswith('# Ficha Oficial — '):
        continue
    program = first.removeprefix('# Ficha Oficial — ').strip()
    presenter = names.get(program)
    if not presenter:
        missing.append(program)
        continue
    section = f'## Identidade do apresentador\\n\\n- Nome artístico oficial: **{presenter}**\\n'
    pattern = r'\\n## Identidade do apresentador\\n.*?(?=\\n## |\\Z)'
    if re.search(pattern, s, flags=re.S):
        s = re.sub(pattern, '\\n' + section.rstrip() + '\\n', s, flags=re.S)
    else:
        s = s.rstrip() + '\\n\\n' + section
    p.write_text(s, encoding='utf-8')
    updated.append((program, presenter))

log = Path('/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md')
ls = log.read_text(encoding='utf-8')
marker = '#### 2026-09-05 — NOMES ARTÍSTICOS OFICIAIS DOS APRESENTADORES'
rows = '\\n'.join(f'- **{a}:** {b}' for a,b in updated)
entry = f'''\\n\\n{marker}\\n\\n- Lista consolidada revisada visualmente contra as três pranchas de avatares aprovadas.\\n- Corrigidas incompatibilidades entre nomes e os avatares masculinos/femininos.\\n- O GSA Histórias da Bíblia mantém o avatar masculino aprovado, com o nome oficial **Salomão Oliveira**.\\n- As três edições do GSA News compartilham a dupla fixa Marcelo Valença e Lívia Fontes.\\n- Nomes registrados nas fichas oficiais:\\n{rows}\\n'''
if marker not in ls:
    log.write_text(ls.rstrip() + entry + '\\n', encoding='utf-8')

print('UPDATED', len(updated))
print('MISSING', missing)
for program,presenter in updated:
    print(program, '=>', presenter)
PY
`;

const result = await runSshScript(sh, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
