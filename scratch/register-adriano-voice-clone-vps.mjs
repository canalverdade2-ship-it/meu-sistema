import { runSshScript } from './ssh2-run.mjs';

const entry = `

## 2026-09-06 — Voz institucional de Adriano clonada

- O titular Adriano Farias forneceu e autorizou expressamente o uso de sua própria gravação para clonagem de voz destinada ao seu avatar institucional e aos comerciais da GSA TV.
- Fonte recebida: \`voz-adriano-original.m4a\`, com aproximadamente 5min05s, AAC mono, 44,1 kHz.
- O arquivo original foi preservado. Para treinamento foi criada uma cópia PCM WAV mono de 60 segundos, com controle de picos e normalização, sem alteração intencional de timbre.
- Modelo privado criado e treinado com sucesso na Fish Audio: \`75de8b72edf6470d87795be3f083ffe6\`.
- Visibilidade do modelo: \`private\`. Uso autorizado: apresentações institucionais e comerciais da própria GSA TV.
- Amostra de controle gerada em: \`/home/opc/gsa-ai/qc/adriano-avatar/adriano-farias-voice-qc-v1.mp3\`.
- Cópia local para aprovação: \`assets/gsa-tv/avatars/adriano-farias/voice/adriano-farias-voice-qc-v1.mp3\`.
- A voz ainda depende de aprovação auditiva do titular antes de ser marcada como voz oficial e usada em produção.
`;
const payload=Buffer.from(entry,'utf8').toString('base64');
const result=await runSshScript(`set -eu
printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 14 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`,120000);
process.stdout.write(result.stdout);
