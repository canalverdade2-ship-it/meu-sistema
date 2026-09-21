import { runSshScript } from './ssh2-run.mjs';

const py = String.raw`from pathlib import Path
p=Path('/home/opc/gsa-ai/docs/GSA_TV_CASTING_MASTER_2026-09-04.md')
s=p.read_text(encoding='utf-8')
anchor='- Cada candidato será avaliado por adequação editorial e continuidade visual antes de se tornar oficial.'
rules='''- A interpretação deve ser o mais natural possível: linguagem oral brasileira, entonação humana, pausas, respiração, ênfases e emoção coerentes com a pauta.
- Texto de locução deve ser escrito para ser falado, com frases fluidas e vocabulário compatível com o apresentador e o público, evitando aparência de artigo lido.
- Expressões faciais, movimentos de cabeça, olhar, gestos e sincronização labial devem acompanhar o sentido da fala sem repetição mecânica ou exagero.
- É proibido publicar material com voz robótica, cadência monótona, pronúncia defeituosa, emoção inadequada, gestos artificiais, olhar congelado ou dessincronização perceptível.
- O QC final deve assistir e ouvir a peça completa em velocidade normal; aprovação apenas quando a interpretação for crível e consistente do início ao fim.'''
if rules not in s:
    s=s.replace(anchor,anchor+'\n'+rules)
p.write_text(s,encoding='utf-8')
`;

const note = String.raw`

## 2026-09-04 — Naturalidade obrigatória de fala e interpretação

- Determinação expressa do responsável: linguagem, expressão e forma de falar devem alcançar o máximo de naturalidade possível.
- O roteiro deve ser escrito para linguagem oral brasileira, e não como texto técnico ou artigo simplesmente lido.
- A interpretação deve conter entonação humana, pausas, respiração, ênfases e emoção compatíveis com o tema e com a personalidade do apresentador.
- Expressões faciais, olhar, movimentos de cabeça, gestos e sincronização labial devem acompanhar o conteúdo sem repetição mecânica ou exagero.
- Critérios automáticos de reprovação: voz robótica, cadência monótona, pronúncia ruim, emoção incompatível, olhar congelado, gestos artificiais ou dessincronização perceptível.
- O controle de qualidade deverá assistir e ouvir o programa completo em velocidade normal antes da publicação.
- A exigência foi incorporada ao cadastro mestre de elenco, vozes e cenários.
- Nenhuma alteração foi feita no encoder ou no sinal ao vivo nesta atualização documental.
`;

const p64=Buffer.from(py,'utf8').toString('base64');
const n64=Buffer.from(note,'utf8').toString('base64');
const sh=`printf '%s' '${p64}'|base64 -d >/tmp/gsa-natural-performance.py\npython3 /tmp/gsa-natural-performance.py\nrm -f /tmp/gsa-natural-performance.py\nprintf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 14 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const result=await runSshScript(sh,60000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
