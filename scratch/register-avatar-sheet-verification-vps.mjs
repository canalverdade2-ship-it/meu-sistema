import { runSshScript } from './ssh2-run.mjs';

const sh = `python3 - <<'PY'
from pathlib import Path

p = Path('/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md')
s = p.read_text(encoding='utf-8')
entry = '''

#### 2026-09-04 — CORREÇÃO DA VINCULAÇÃO DA APROVAÇÃO DOS AVATARES NAS FICHAS

- A aprovação mestre dos avatares já estava registrada corretamente, mas a primeira verificação automática não localizou as fichas individuais por divergência no critério técnico de correspondência dos nomes dos arquivos.
- A vinculação foi refeita usando o título oficial existente dentro de cada ficha, sem alterar nomes de programas, grade, logos ou transmissão.
- Resultado verificado: **25/25 fichas oficiais** possuem agora a marcação de avatar aprovado.
- Foram vinculadas as 22 novas identidades visuais aprovadas nos três painéis de casting.
- As três edições do GSA News mantêm os dois apresentadores fixos já criados no Google Vids, com as vozes nativas Holt e Nyla.
- Nenhuma intervenção foi realizada no encoder, no RTMP ou na programação no ar durante esta correção documental.
'''
marker = '#### 2026-09-04 — CORREÇÃO DA VINCULAÇÃO DA APROVAÇÃO DOS AVATARES NAS FICHAS'
if marker not in s:
    p.write_text(s.rstrip() + entry + '\\n', encoding='utf-8')
print('CHANGELOG_OK', marker in p.read_text(encoding='utf-8'))
PY
`;

const result = await runSshScript(sh, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
