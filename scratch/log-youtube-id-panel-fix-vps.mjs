import { runSshScript } from './ssh2-run.mjs';

const note = `
## 2026-09-07 05:00Z — Correção do falso “YouTube não confirmado” no painel Master

- Captura do operador mostrou “Relay enviando — YouTube não confirmado” e selo “NO AR”, embora o relay estivesse enviando.
- Auditoria confirmou canal DB online/running/sending, producer ativo, outer RTMP persistente e exatamente 1 publicador.
- Socket RTMP estava ESTABLISHED com retrans=0 no instante da coleta.
- Causa do falso estado localizada: config do canal ainda apontava para o vídeo antigo e indisponível RqX4IJXdbGQ.
- Evento público atual verificado externamente: soeRG2L70ys, live_status=is_live, título GSA TV - AO VIVO 2026-09-07 01:59.
- config.youtube_video_id do canal ch-main corrigido para soeRG2L70ys sem reiniciar ou modificar encoder/transporte.
- O HTML público do evento atual contém isLive:true, marcador reconhecido pelo verificador do Control Plane. O navegador autenticado deve atualizar o indicador após expiração do cache/“Atualizar Dados”.
- A API interna recusou consulta anônima com HTTP 401, comportamento de segurança esperado; não indica falha do painel autenticado.
- Esta correção é de monitoramento/estado visual e não altera a investigação separada dos estalos de áudio.
`;
const payload = Buffer.from(note).toString('base64');
const result = await runSshScript(`printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 16 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 30000);
process.stdout.write(result.stdout || '');
