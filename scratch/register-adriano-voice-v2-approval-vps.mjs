import { runSshScript } from './ssh2-run.mjs';

const entry = `

## 2026-09-06 — Voz institucional de Adriano Farias aprovada oficialmente

- Adriano Farias ouviu e aprovou expressamente a versão natural v2 como perfeita.
- Modelo Fish Audio privado oficial: \`f9b0947fc7c74ed0b33bd6350873fe09\`.
- A versão v1, considerada robótica, fica reprovada e proibida para produção.
- A versão v2 passa a ser a voz oficial do avatar de Adriano Farias para apresentações institucionais e comerciais autorizados da GSA TV.
- Arquivo de referência aprovado: \`assets/gsa-tv/avatars/adriano-farias/voice/adriano-farias-voice-qc-v2-natural.mp3\`.
- Para preservar a naturalidade aprovada: usar processamento mínimo, não aplicar normalização agressiva nem aprimoramento automático e manter ritmo, pausas e expressão naturais.
`;
const payload = Buffer.from(entry, 'utf8').toString('base64');
const result = await runSshScript(`set -eu
printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 12 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 120000);
process.stdout.write(result.stdout);
