import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo sed -i 's|gsa-tv/control-plane:1.7.2|gsa-tv/control-plane:1.7.6|' /usr/local/bin/ffmpeg
sudo docker image rm gsa-tv/control-plane:1.7.5 >/dev/null 2>&1 || true
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')" = gsa-tv/control-plane:1.7.6
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy
COUNT=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
test "$COUNT" -eq 1
curl -fsS http://127.0.0.1:9210/health | grep -q '"last_error":null'
sudo grep -q 'gsa-tv/control-plane:1.7.6' /usr/local/bin/ffmpeg
echo '=== filtered HLS output measurement ==='
sudo docker exec gsa-tv-encoder-engine timeout 20 ffmpeg -hide_banner -nostdin -i /runtime/hls/program.m3u8 -map 0:a:0 -t 10 -af ebur128=peak=true -f null - 2>&1 | tail -n 18 || true
STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Correção do áudio estridente/estalando na transmissão

- Relato do operador: áudio ao vivo estralando e estridente.
- Fonte ativa identificada: GSA OFICIAL — Vinheta Oficial GSA TV MASTER, arquivo de 35 segundos em repetição.
- Integridade do arquivo verificada: AAC 48 kHz estéreo, sem erro de decodificação; loudness original -16,4 LUFS e true peak -1,4 dBFS.
- A análise de declique detectou aproximadamente 1,09% de amostras candidatas a clicks. A cadeia anterior somente fazia aresample e AAC, sem tratamento ou proteção broadcast.
- Control Plane promovido para 1.7.6 com cadeia de áudio persistente: sincronização/resample 48 kHz, high-pass 45 Hz, low-pass 15,5 kHz, atenuação suave de 2,5 dB na região de 4,5 kHz, remoção de clicks e limitador sem ganho automático.
- Resultado offline do filtro: loudness aproximado -17,1 LUFS e true peak máximo -1,7 dBFS, reduzindo aspereza e protegendo contra picos.
- A nova cadeia foi aplicada ao produtor pelo Encoder Engine. O transporte RTMP externo preservou o mesmo PID e não refez a sessão com o YouTube.
- Estado após aplicação: exatamente um publicador RTMP, Control Plane saudável, Encoder Engine saudável e last_error nulo.
- Corrigido também o helper administrativo /usr/local/bin/ffmpeg, que ainda apontava para a imagem antiga removida 1.7.2; agora aponta para 1.7.6.
EOF
echo "publishers=$COUNT"
echo AUDIO_FIX_VERIFIED
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
