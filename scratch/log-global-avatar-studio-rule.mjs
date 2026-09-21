import {runSshScript} from './ssh2-run.mjs';
const py=String.raw`from pathlib import Path
p=Path('/home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md')
s=p.read_text(encoding='utf-8')
anchor='- Nenhum teste existente pode ser promovido ou exibido como identidade oficial.'
extra='''- Programas com apresentação devem possuir elenco fixo: um avatar permanente e exclusivo para cada apresentador aprovado.
- Cada programa deve possuir cenário-base fixo, sem troca diária; podem variar apenas telas de apoio, pauta, B-rolls e elementos editoriais do episódio.
- Avatares e cenários fixos são ativos permanentes de identidade e não entram no descarte semanal dos episódios.'''
if extra not in s:s=s.replace(anchor,anchor+'\n'+extra)
p.write_text(s,encoding='utf-8')
`;
const note=String.raw`

## 2026-09-04 — Regra global de avatares e cenários fixos

- Determinação expressa do responsável, aplicável a todos os programas da grade.
- Todo programa que possuir apresentadores deverá manter um avatar fixo e exclusivo para cada apresentador aprovado.
- Cada programa deverá manter um cenário-base fixo e reconhecível, sem troca diária.
- Podem variar entre episódios: pauta, texto, telas de apoio, mapas, gráficos, vídeos de reportagem, B-rolls e elementos editoriais temporários.
- Não podem variar sem nova aprovação de identidade: rosto/avatar, função do apresentador, voz oficial, figurino-base, bancada, composição do cenário, paleta e iluminação-base.
- Avatares e cenários são ativos permanentes de identidade; a regra de descarte semanal aplica-se aos episódios e mídias editoriais temporárias, não a esses ativos fixos.
- A regra foi incorporada ao documento /home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md.
- Nenhuma alteração foi feita no sinal ao vivo.
`;
const p64=Buffer.from(py).toString('base64'),n64=Buffer.from(note).toString('base64');const sh=String.raw`printf '%s' '${p64}'|base64 -d >/tmp/global-avatar-rule.py
python3 /tmp/global-avatar-rule.py
rm -f /tmp/global-avatar-rule.py
printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 16 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
