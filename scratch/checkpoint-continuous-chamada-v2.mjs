import { runSshScript } from './ssh2-run.mjs';
const entry=`

## 2026-09-06 — Continuidade ininterrupta autorizada para a chamada V2

- O responsável determinou continuidade até a conclusão, sem abandono de etapas.
- A retomada automática vinculada à tarefa foi reduzida de 30 para 10 minutos e atualizada para priorizar o Google Vids.
- O shot 001 permanece inserido e salvo no projeto novo da V2.
- Gerações seguintes receberam bloqueios preventivos do Vids mesmo após simplificações legítimas; a produção continuará com comandos neutros e intervalos controlados, sem contornar os filtros e sem reutilizar a chamada rejeitada.
- Nenhuma mudança foi feita no encoder, RTMP, playout ou sinal ao vivo.
`;
const data=Buffer.from(entry).toString('base64');const r=await runSshScript(`printf '%s' '${data}'|base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,60000);process.stdout.write('CHANGELOG_OK\n');
