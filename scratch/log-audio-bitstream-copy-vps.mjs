import { runSshScript } from './ssh2-run.mjs';

const note = `
## 2026-09-07 03:42Z — Teste definitivo de isolamento: áudio AAC em passagem direta

- Operador confirmou que o áudio continuou estalando após retirada de async=1; essa hipótese foi descartada.
- Compatibilidade do arquivo GSA News confirmada antes da mudança: AAC-LC, 48 kHz, estéreo, cerca de 194 kb/s, time_base 1/48000 e pacotes regulares de 21,333 ms.
- Control Plane promovido de 1.8.3 para 1.8.4.
- O produtor ativo deixou de decodificar, filtrar, resamplear, limitar ou recodificar o áudio. Configuração atual: map do áudio original seguido de -c:a copy.
- O vídeo continua sendo composto/codificado com logo, selo e gráficos; somente o áudio atravessa por bitstream passthrough.
- O GSA News foi reaplicado pelo job 9a58c6ed-1fb0-4da9-a43b-ad1e71d60841, concluído.
- Prova em execução: linha ativa do produtor contém -c:a copy e não contém -af, aresample, alimiter, -ar ou -ac.
- Continuidade preservada: transportador RTMP outer permaneceu PID 18; novo producer PID 54177; exatamente um publisher; canal online/running/sending; HLS fresco; zero erros recentes relevantes.
- Este teste elimina integralmente o processamento de áudio do produtor como fonte de novos estalos. Pendente confirmação auditiva após a latência do YouTube.
`;
const payload = Buffer.from(note).toString('base64');
const result = await runSshScript(`printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 20 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 30000);
process.stdout.write(result.stdout || '');
