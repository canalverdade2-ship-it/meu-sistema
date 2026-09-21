import { runSshScript } from './ssh2-run.mjs';
const entry = `

## 2026-09-06 — Exclusão definitiva da voz robótica v1 de Adriano Farias

- Exclusão solicitada expressamente pelo titular após aprovação da versão natural v2.
- O modelo privado Fish Audio v1 \`75de8b72edf6470d87795be3f083ffe6\` foi excluído com sucesso pela API (HTTP 204).
- A amostra de audição v1, o WAV de treinamento v1 e o manifesto v1 foram removidos da VPS.
- As cópias locais da amostra e do treinamento v1 também foram excluídas.
- A gravação original fornecida pelo titular foi preservada, assim como os materiais e o modelo oficial v2 aprovado.
- Única versão autorizada para produção: modelo privado v2 \`f9b0947fc7c74ed0b33bd6350873fe09\`.
`;
const payload=Buffer.from(entry,'utf8').toString('base64');
const result=await runSshScript(`printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 11 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,120000);
process.stdout.write(result.stdout);
