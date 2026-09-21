import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== badge verification ==='
sudo docker logs --since 15m gsa-tv-control-plane 2>&1 | grep 'stream_ensured_by_encoder_engine' | tail -n 5
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
VALUE=$(echo "select enabled from public.gsa_tv_graphics where id='70faed0c-f6b5-4b01-b80f-493bdbda6708';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL")
test "$VALUE" = t
test "$(cat /opt/gsa-tv/runtime/gsa-tv-live-badge.txt)" = 'AO VIVO'
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')" = gsa-tv/control-plane:1.7.9
test "$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)" -eq 1
echo "badge_db=$VALUE control=1.7.9 rtmp=1"
STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Correção do selo AO VIVO, refresh silencioso e auditoria de incompatibilidades

- Relato: painel mostrava “SELO AO VIVO: DESLIGADO” enquanto o selo aparecia na transmissão.
- Causa: após a migração para Encoder Engine, applyGraphicsRuntime ainda verificava streamProcess local do Control Plane. Como o Control Plane não possui mais o FFmpeg, a aplicação ZMQ era ignorada.
- Segunda falha encontrada: quando não existiam cards dashboard ativos, applyGraphicsRuntime retornava antes de enviar os comandos pendentes do selo.
- Control Plane promovido para 1.7.9: estado do produtor agora é consultado em /v1/status do Encoder Engine; o selo é sincronizado após cada ensure/troca de produtor; comandos do selo são enviados mesmo quando cards=0.
- Estado preservado conforme a transmissão: selo habilitado no banco, arquivo runtime “AO VIVO” e filtro ZMQ ativado. O painel passa a refletir ligado no próximo polling.
- Interface local corrigida: onChanged da Central Master agora usa load(true), atualização silenciosa sem tela global de carregamento. A callback load deixou de depender de data.channel.id, evitando recriação do efeito e recargas adicionais. Build Vite de produção aprovado.
- Auditoria profunda da migração encontrou pendências ainda não corrigidas nesta etapa:
  1. Control Plane mantém código morto de streamProcess/terminateRelay e locks stub.
  2. Endpoint/status ainda devolve process_pid nulo em vez dos PIDs do Engine.
  3. Heartbeat usa streamState em memória e não reconcilia continuamente outer_running/producer_running/last_error.
  4. serviceHealth do Control Plane monitora somente ffplayout e omite Encoder Engine.
  5. Watchdog monitora HLS antigo do ffplayout, não o HLS final nem a saúde do Encoder Engine.
  6. Health do Engine considera apenas o transporte externo; precisa exigir também produtor quando desired=running.
  7. /v1/ensure e /v1/stop do Engine não possuem fila/mutex próprio contra requisições concorrentes.
  8. ENCODER_UDP_PORT e UDP_PORT permanecem como configuração/código morto embora o transporte já seja pipe.
  9. Jobs que ficaram running durante crash não possuem recuperação automática; existe collect_editorial_sources preso desde 2026-09-04.
  10. Hot reload é completo apenas para filtros previamente instanciados; ativar nova camada/logo estrutural pode exigir troca do produtor, embora o RTMP permaneça.
- Esta seção registra diagnóstico; as dez pendências acima aguardam uma etapa de correção controlada.
EOF
echo AUDIT_RECORDED
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
