import { runSshScript } from './ssh2-run.mjs';
const entry = `

## 2026-09-07 03:01Z — Verificação externa do retorno público do YouTube / divergência de evento identificada
- Verificação realizada em modo somente leitura, sem alterar encoder, RTMP, playout, mídia, grade, playlist, mosca ou selo AO VIVO.
- O evento público efetivamente em reprodução é \`soeRG2L70ys\`, título \`GSA TV - AO VIVO\`; o player público confirmou estado AO VIVO, carregamento completo e recepção contínua de segmentos de mídia do CDN do YouTube.
- O Control Plane/banco ainda registra \`youtube_video_id=RqX4IJXdbGQ\`; consulta pública informa que esse identificador está indisponível. Portanto existe divergência entre o evento monitorado internamente e o evento público real.
- Essa divergência explica a falha do monitor anterior ao tentar validar o retorno do YouTube e deve ser corrigida no monitoramento/configuração, sem reiniciar o encoder.
- Estado da VPS às 03:01Z: canal \`online/running/sending\`, playout na chamada BROADCAST SAFE V2; Control Plane, Watchdog e Encoder Engine em \`running/healthy\`.
- Processo do Encoder Engine: exatamente 1 publicador RTMP encontrado; não há evidência de duplicidade de encoder.
- O navegador externo recebeu continuamente respostas \`videoplayback\` do YouTube para o evento \`soeRG2L70ys\`, confirmando que ingestão, transcodificação e distribuição pública estão operacionais.
- A captura PCM automatizada do áudio devolvido pelo YouTube não foi concluída nesta passagem: o player atual utiliza transporte SABR/UMP e a URL adaptativa bruta exige transformação do cliente. Não declarar ainda que o áudio de retorno está livre de estalos apenas com base na continuidade dos segmentos.
- Próxima correção recomendada: alinhar o \`youtube_video_id\` canônico/monitor com \`soeRG2L70ys\` e então repetir captura técnica do áudio público no evento correto.
`;
const encoded = Buffer.from(entry).toString('base64');
const result=await runSshScript(`set -eu
printf '%s' '${encoded}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
tail -n 16 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
