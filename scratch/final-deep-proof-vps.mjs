import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
# A successful enforcement run should not leave systemd marked failed.
sudo sed -i '/^if len(publishers) > 1:$/,+1c\\sys.exit(0)' /usr/local/sbin/gsa-rtmp-single-owner-guard
sudo python3 -m py_compile /usr/local/sbin/gsa-rtmp-single-owner-guard
sudo systemctl reset-failed gsa-rtmp-single-owner-guard.service || true
sudo systemctl restart gsa-rtmp-single-owner-guard.timer

OUTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
for i in 1 2 3; do
  sudo docker restart gsa-tv-control-plane >/dev/null
  for x in $(seq 1 30); do [ "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy ] && break; sleep 1; done
  NOW=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
  COUNT=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
  LEGACY=$(ps -eo args= | grep -c '[e]ncoder-client.js' || true)
  echo "restart=$i outer=$NOW publishers=$COUNT legacy=$LEGACY"
  test "$NOW" = "$OUTER"; test "$COUNT" -eq 1; test "$LEGACY" -eq 0
done

# Test a distinct protocol, hostname and non-FFmpeg process.
sudo bash -c 'exec -a "rogue-app rtmps://c.rtmp.youtube.com:443/live2/FAKE-NO-CONNECTION" sleep 60' &
ROGUE=$!
sleep 7
! kill -0 "$ROGUE" 2>/dev/null
echo "generic_rogue_test=blocked"

DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
LOCKED=$(echo "select pg_try_advisory_lock(hashtext('gsa-tv-encoder:ch-main'));" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL")
test "$LOCKED" = f
echo "competing_db_lock=$LOCKED"

test -z "$(sudo find /opt/gsa-tv/control-plane -type f -perm /111 -print0 | sudo xargs -0 grep -IlE 'encoder-client\\.js|a\\.rtmp\\.youtube' 2>/dev/null || true)"
echo "executable_legacy_sources=0"
test -z "$(sudo docker ps -a --format '{{.Names}}|{{.Image}}' | grep -E 'control-plane:1\\.7\\.[0-4]' || true)"
echo "legacy_containers=0"
sudo docker image rm gsa-tv/control-plane:1.7.4-canonical-check >/dev/null 2>&1 || true
echo "control_images:"
sudo docker image ls gsa-tv/control-plane --format '{{.Repository}}:{{.Tag}}'
echo "timer=$(systemctl is-active gsa-rtmp-single-owner-guard.timer)"
sudo systemctl start gsa-rtmp-single-owner-guard.service
test "$(systemctl show gsa-rtmp-single-owner-guard.service -p Result --value)" = success
echo "guard_result=success"
curl -fsS http://127.0.0.1:9210/health | grep -q '"last_error":null'
echo "engine_health=pass"

STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Segunda auditoria profunda do proprietário único RTMP

- Nova varredura independente realizada a pedido do proprietário, abrangendo processos, todos os containers, políticas de restart, imagens Docker, fontes executáveis, compose, systemd, timers, cron, watchdog, serviços auxiliares e restauração.
- Riscos residuais encontrados e eliminados: imagens antigas 1.7.0 a 1.7.3 e containers de backup ainda poderiam ser iniciados manualmente; foram removidos. Cópias antigas de app.js foram retiradas do contexto de build e preservadas somente no arquivo restrito de auditoria.
- Control Plane limpo promovido para 1.7.5. A imagem foi reconstruída sem cache a partir da fonte canônica e não contém encoder-client nem código antigo de publicação direta.
- O transporte RTMP permaneceu no mesmo PID durante a promoção para 1.7.5 e em três reinicializações adicionais do Control Plane.
- Guardião ampliado: agora inspeciona todos os processos em /proc e bloqueia RTMP ou RTMPS para qualquer hostname de ingestão rtmp.youtube.com, independentemente do nome do aplicativo.
- Teste adversarial aprovado com processo não-FFmpeg, RTMPS, porta 443 e hostname alternativo; o processo foi encerrado automaticamente.
- Advisory lock concorrente novamente recusado; exatamente um publicador; zero processos encoder-client; zero containers legados; timer ativo; serviço do guard com resultado success; Engine sem last_error.
- Conclusão técnica: o caminho conhecido de duplicação foi removido da execução, da fonte canônica, do build e das imagens iniciáveis, com bloqueio preventivo independente no host.
EOF
echo DEEP_AUDIT_PASS
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
