import { runSshScript } from './ssh2-run.mjs';

const note = `

## 2026-09-04 — Entrega da prancha corrigida de 32 logos para revisão

- A pendência dos logos foi priorizada a pedido do responsável.
- Prancha candidata conferida visualmente: 32 identidades, todas iniciadas por GSA.
- GSA Entrevista não aparece.
- A prancha contempla os nomes atuais do inventário canônico, incluindo GSA Mercado, GSA Tempo, GSA Cidadania, GSA Destinos do Mundo, GSA Em Fé Reflexão, GSA Histórias da Bíblia, GSA Noite de Louvor, GSA Tá na Rede Web, GSA Documentário Especial, GSA Planeta Terra, GSA Mistérios e GSA Motivação.
- Arquivo na VPS mantido em /home/opc/gsa-ai/assets/brand/gsa-program-logos-board-32-candidate-2026-09-04.png.
- Cópia de revisão disponibilizada no workspace como assets/gsa-tv/brand/gsa-program-logos-board-32-review-2026-09-04.png.
- Estado: entregue para revisão visual do responsável; ainda não promovida automaticamente como identidade oficial aprovada.
- Nenhuma alteração foi feita no encoder ou no sinal ao vivo.
`;
const b64 = Buffer.from(note, 'utf8').toString('base64');
const result = await runSshScript(`printf '%s' '${b64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 13 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
