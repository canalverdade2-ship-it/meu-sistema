import { runSshScript } from './ssh2-run.mjs';

const py = String.raw`from pathlib import Path
p=Path('/home/opc/gsa-ai/docs/GSA_TV_CASTING_MASTER_2026-09-04.md')
s=p.read_text(encoding='utf-8')
anchor='- Cada apresentador terá avatar exclusivo, voz própria e cenário-base fixo.'
rules='''- A identidade do apresentador deve nascer da personalidade editorial do programa; não será usado um avatar genérico apenas para preencher a tela.
- Avatar, idade percebida, expressão, postura, voz, ritmo, vocabulário e figurino-base devem ser coerentes entre si e com o tema do programa.
- Exemplos obrigatórios de direção: GSA Em Fé pede presença pastoral, acolhedora, serena e espiritualmente confiável; GSA Tech pede presença jovem, atual, dinâmica e familiarizada com tecnologia.
- Caracterização temática deve transmitir função profissional sem imitar pessoa real, criar credenciais falsas ou recorrer a caricaturas e estereótipos ofensivos.
- Cada candidato será avaliado por adequação editorial e continuidade visual antes de se tornar oficial.'''
if rules not in s:
    s=s.replace(anchor,anchor+'\n'+rules)
p.write_text(s,encoding='utf-8')

p2=Path('/home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md')
s2=p2.read_text(encoding='utf-8')
anchor2='- Programas com apresentação têm avatar, voz, figurino-base e cenário fixos por identidade aprovada.'
rule2='- O apresentador deve incorporar a personalidade editorial específica do programa; avatar genérico ou incompatível com o tema é proibido.'
if rule2 not in s2:
    s2=s2.replace(anchor2,anchor2+'\n'+rule2)
p2.write_text(s2,encoding='utf-8')
`;

const note = String.raw`

## 2026-09-04 — Regra de personalidade editorial dos apresentadores

- Determinação expressa do responsável: cada avatar deve possuir a personalidade própria do programa que apresenta; não basta trocar o rosto ou a voz.
- A seleção passa a considerar em conjunto: idade percebida, expressão, postura, voz, ritmo, vocabulário, figurino-base, função editorial e cenário.
- Exemplo oficial de direção: GSA Em Fé deve ter apresentador com presença de pastor — acolhedora, serena, espiritualmente confiável e compatível com conteúdo religioso.
- Exemplo oficial de direção: GSA Tech deve ter apresentador jovem, atual, dinâmico e visualmente ligado ao universo de tecnologia.
- A mesma lógica será aplicada individualmente aos demais programas, respeitando sua área e seu público.
- Não serão usados avatares genéricos, caricaturas, estereótipos ofensivos, imitação de pessoa real ou credenciais profissionais falsas.
- A personalidade aprovada será permanente junto com avatar, voz, figurino-base e cenário, garantindo continuidade entre episódios.
- Regras incorporadas ao cadastro mestre de elenco e ao inventário canônico de identidades.
- Nenhuma alteração foi feita no encoder ou no sinal ao vivo nesta atualização documental.
`;

const p64=Buffer.from(py,'utf8').toString('base64');
const n64=Buffer.from(note,'utf8').toString('base64');
const sh=`printf '%s' '${p64}'|base64 -d >/tmp/gsa-presenter-personality.py\npython3 /tmp/gsa-presenter-personality.py\nrm -f /tmp/gsa-presenter-personality.py\nprintf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 15 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const result=await runSshScript(sh,60000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
