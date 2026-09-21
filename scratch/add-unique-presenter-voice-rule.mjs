import {runSshScript} from './ssh2-run.mjs';
const py=String.raw`from pathlib import Path
p=Path('/home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md')
s=p.read_text(encoding='utf-8')
anchor='- Avatares e cenários fixos são ativos permanentes de identidade e não entram no descarte semanal dos episódios.'
extra='''- Cada apresentador deve possuir voz própria e exclusiva; é proibido repetir automaticamente uma única voz masculina ou feminina em toda a grade.
- O cadastro de elenco deve vincular: programa, apresentador, função editorial, avatar, voz, figurino-base e cenário.
- GSA News mantém especificamente Holt/Nyla no Vids; os demais elencos terão vozes distintas selecionadas e aprovadas individualmente.'''
if extra not in s:s=s.replace(anchor,anchor+'\n'+extra)
p.write_text(s,encoding='utf-8')
`;
const note=String.raw`

## 2026-09-04 — Regra global de voz exclusiva por apresentador

- Determinação expressa do responsável: cada apresentador de cada programa deve possuir uma voz própria e diferente.
- É proibido usar apenas uma voz masculina padrão e uma voz feminina padrão para toda a grade.
- O cadastro permanente de elenco deverá vincular programa, função editorial, avatar, voz oficial, figurino-base e cenário fixo.
- GSA News permanece com Holt e Nyla, nativos do Vids.
- Nos demais programas, as vozes serão escolhidas individualmente no Vids ou na Fish Audio conforme disponibilidade, adequação e aprovação auditiva.
- Uma voz não poderá ser tratada como oficial de um apresentador sem teste de pronúncia, naturalidade, emoção e inteligibilidade.
- A regra foi incorporada ao inventário canônico; nenhuma alteração ocorreu no sinal ao vivo.
`;
const p64=Buffer.from(py).toString('base64'),n64=Buffer.from(note).toString('base64');const sh=String.raw`printf '%s' '${p64}'|base64 -d >/tmp/unique-presenter-voice.py
python3 /tmp/unique-presenter-voice.py
rm -f /tmp/unique-presenter-voice.py
printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 15 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
