import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
BEFORE=$(pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1)
sudo docker restart gsa-tv-control-plane >/dev/null
sleep 8
AFTER=$(pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1)
COUNT=$( { pgrep -af 'rtmp://a.rtmp.youtube.com/live2/' || true; } | wc -l )
LEGACY=$( { pgrep -af 'encoder-client.js' || true; } | wc -l )
test "$BEFORE" = "$AFTER"
test "$COUNT" -eq 1
test "$LEGACY" -eq 0
ENGINE=$(curl -fsS http://127.0.0.1:9210/health)
echo "BEFORE=$BEFORE AFTER=$AFTER COUNT=$COUNT LEGACY=$LEGACY"
echo "$ENGINE"
sudo docker logs --tail 20 gsa-tv-control-plane 2>&1
cat >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md <<EOF

## 2026-09-05 — Correção definitiva da duplicidade RTMP entre Control Plane e Encoder Engine
- Durante o preflight do GSA News Noite foram identificados dois publicadores simultâneos apontando para a mesma chave do YouTube: o relay permanente do Encoder Engine e o encoder-client legado restaurado pelo Control Plane.
- Causa raiz: a versão 1.7.2 possuía integração parcial com o Encoder Engine, mas startStreamUnlocked ainda iniciava /app/bin/encoder-client.js localmente. O mecanismo restoreRuntime recuperou esse caminho legado após reinicialização.
- Foi construída e implantada a versão gsa-tv/control-plane:1.7.3.
- Na 1.7.3, toda chamada de início, troca de mídia, retorno à grade ou restauração envia os argumentos para POST /v1/ensure do Encoder Engine. O Control Plane não cria mais publicador RTMP próprio.
- O processo legado encoder-client.js foi eliminado. A versão 1.7.2 ficou parada e renomeada como gsa-tv-control-plane-backup-1.7.2 para rollback controlado.
- Validação após implantação e após reinício adicional do Control Plane: exatamente 1 publicador RTMP, 0 encoder-client legado e relay externo com o mesmo PID $BEFORE antes e $AFTER depois.
- O Encoder Engine permaneceu healthy, producer e outer ativos, sem erro e sem reiniciar o transporte externo.
- Regra arquitetural definitiva: somente gsa-tv-encoder-engine pode possuir a conexão RTMP com o YouTube. O Control Plane apenas solicita mudanças de produtor ao endpoint interno autenticado do Encoder Engine.
- A correção preservou o programa em exibição e não interrompeu deliberadamente o relay permanente.
EOF
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
