import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
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
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
LOCKED=$(echo "select pg_try_advisory_lock(hashtext('gsa-tv-encoder:ch-main'));" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL")
test "$LOCKED" = f
echo "competing_db_lock=$LOCKED"
test -z "$(sudo find /opt/gsa-tv/control-plane -type f -perm /111 -print0 | sudo xargs -0 grep -IlE 'encoder-client\\.js|a\\.rtmp\\.youtube' 2>/dev/null || true)"
echo "executable_legacy_sources=0"
test -z "$(sudo docker ps -a --format '{{.Names}}|{{.Image}}' | grep -E 'control-plane:1\\.7\\.[0-4]' || true)"
echo "legacy_containers=0"
sudo docker image rm gsa-tv/control-plane:1.7.4-canonical-check >/dev/null 2>&1 || true
echo "control_images=$(sudo docker image ls gsa-tv/control-plane --format '{{.Tag}}' | tr '\\n' ',')"
test "$(systemctl is-active gsa-rtmp-single-owner-guard.timer)" = active
sudo systemctl start gsa-rtmp-single-owner-guard.service
test "$(systemctl show gsa-rtmp-single-owner-guard.service -p Result --value)" = success
echo "guard=active/success"
curl -fsS http://127.0.0.1:9210/health | grep -q '"last_error":null'
echo "engine_health=pass"
STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Segunda auditoria profunda e endurecimento final do RTMP

- Varredura adicional abrangendo processos, containers, políticas de restart, imagens Docker, fontes executáveis, arquivos compose, systemd, timers, cron, watchdog, serviços auxiliares e mecanismos de restauração.
- Foram encontrados riscos residuais de regressão, embora inativos: imagens antigas 1.7.0 a 1.7.3, containers de backup e cópias antigas dentro do contexto de build. As imagens e containers vulneráveis foram removidos; fontes históricas foram isoladas em diretório restrito fora do build.
- Control Plane limpo promovido para 1.7.5, reconstruído sem cache. A imagem ativa não contém encoder-client nem o caminho antigo de publicação direta.
- Guardião ampliado para inspecionar todos os processos em /proc e bloquear RTMP/RTMPS para qualquer hostname de ingestão rtmp.youtube.com, independentemente de o processo se chamar FFmpeg.
- Teste adversarial isolado aprovado usando processo não-FFmpeg, RTMPS, porta 443 e hostname alternativo; o intruso foi encerrado automaticamente.
- O transporte RTMP oficial preservou o mesmo PID durante a promoção e em três reinicializações adicionais do Control Plane.
- Provas finais: publicadores=1; processos encoder-client=0; containers legados=0; fontes legadas executáveis=0; advisory lock concorrente recusado; timer ativo; guard com resultado success; Encoder Engine sem last_error.
- Observação de engenharia: não existe garantia matemática contra todo tipo de falha futura de hardware, provedor ou credencial, mas o defeito específico de dois publicadores pela mesma chave foi removido em todas as camadas conhecidas e protegido por fiscalização independente.
EOF
echo DEEP_AUDIT_PASS
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
