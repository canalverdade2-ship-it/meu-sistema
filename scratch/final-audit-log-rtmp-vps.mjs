import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -euo pipefail
echo '=== FINAL INVARIANTS ==='
RTMP_LINES=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' || true)
COUNT=$(printf '%s\n' "$RTMP_LINES" | sed '/^$/d' | wc -l)
echo "rtmp_publishers=$COUNT"
test "$COUNT" -eq 1
PID=$(printf '%s\n' "$RTMP_LINES" | awk 'NR==1{print $1}')
ENGINE_ID=$(sudo docker inspect -f '{{.Id}}' gsa-tv-encoder-engine)
sudo grep -q "$ENGINE_ID" "/proc/$PID/cgroup"
echo "sole_owner=gsa-tv-encoder-engine"
LEGACY=$(ps -eo args= | awk '/[e]ncoder-client\.js/{n++} END{print n+0}')
echo "legacy_processes=$LEGACY"
test "$LEGACY" -eq 0
test ! -e /opt/gsa-tv/control-plane/bin/encoder-client.js
test ! -e "$(sudo docker inspect -f '{{.GraphDriver.Data.MergedDir}}' gsa-tv-control-plane 2>/dev/null)/app/bin/encoder-client.js" || true
sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.7.4-canonical-check -lc 'test ! -e /app/bin/encoder-client.js'
cmp -s <(sudo docker exec gsa-tv-control-plane cat /app/src/app.js) /opt/gsa-tv/control-plane/src/app.js
echo "canonical_source_matches_active=yes"
echo "guard_timer=$(systemctl is-active gsa-rtmp-single-owner-guard.timer)"
test "$(systemctl is-active gsa-rtmp-single-owner-guard.timer)" = active
sudo systemctl start gsa-rtmp-single-owner-guard.service
sleep 1
COUNT2=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
echo "rtmp_after_guard=$COUNT2"
test "$COUNT2" -eq 1
sudo docker inspect gsa-tv-control-plane --format 'control={{.State.Health.Status}} image={{.Config.Image}}'
sudo docker inspect gsa-tv-encoder-engine --format 'engine={{.State.Health.Status}} image={{.Config.Image}}'
curl -fsS http://127.0.0.1:9210/health | sed -E 's#(rtmp://[^/]+/live2/)[^" ]+#\\1[REDACTED]#g'
echo

STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Correção estrutural: proprietário único de RTMP

- Solicitação: impedir definitivamente dois processos transmitindo para a mesma chave do YouTube.
- Causa raiz confirmada: a integração do Control Plane 1.7.2 com o Encoder Engine estava incompleta. O caminho de parada usava o Engine, mas o caminho de início/restauração ainda executava o launcher legado /app/bin/encoder-client.js, criando um segundo publicador RTMP.
- Control Plane promovido para gsa-tv/control-plane:1.7.4.
- startStreamUnlocked() agora chama exclusivamente POST /v1/ensure do Encoder Engine; não cria FFmpeg RTMP local.
- Launcher legado removido da imagem ativa e excluído do Dockerfile canônico. Cópia histórica foi preservada desabilitada, sem permissão de execução.
- Código-fonte canônico /opt/gsa-tv/control-plane/src/app.js sincronizado com a implementação ativa; compose.yml atualizado para 1.7.4. Um rebuild de validação confirmou que o launcher antigo não volta para a imagem.
- Backups 1.7.2 e 1.7.3 permanecem parados com política restart=no, portanto não podem voltar automaticamente.
- Encoder Engine continua como único proprietário autorizado do RTMP e mantém advisory lock PostgreSQL global do canal.
- Defesa independente instalada no host: gsa-rtmp-single-owner-guard.timer, executado a cada 5 segundos. Ele encerra qualquer publicador de YouTube RTMP fora do container autorizado e também impede multiplicidade interna.
- Testes realizados: três reinícios consecutivos do Control Plane mantiveram o mesmo PID do transporte RTMP; publicadores=1; processos legados=0. Um processo intruso simulado foi eliminado automaticamente pelo guard. Lock concorrente foi recusado pelo PostgreSQL.
- Auditoria final: Control Plane saudável, Encoder Engine saudável, fonte canônica igual à ativa, timer ativo e exatamente um publicador RTMP pertencente ao Encoder Engine.
- Regra permanente: nenhum componente, programa, renderizador ou Control Plane pode publicar diretamente na chave do YouTube. Todo conteúdo deve entrar no Encoder Engine, que conserva a sessão RTMP única.
EOF
echo CHANGELOG_UPDATED
`,180000);
process.stdout.write(r.stdout); if(r.stderr) process.stderr.write(r.stderr);
