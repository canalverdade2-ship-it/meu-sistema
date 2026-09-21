import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== states ==='
sudo docker inspect gsa-tv-control-plane --format 'control={{.Config.Image}} health={{.State.Health.Status}}'
sudo docker inspect gsa-tv-encoder-engine --format 'engine={{.Config.Image}} health={{.State.Health.Status}}'
curl -fsS http://127.0.0.1:9210/health; echo
echo '=== invariants ==='
COUNT=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
echo "rtmp_publishers=$COUNT"; test "$COUNT" -eq 1
! sudo ss -u -a -n -p | grep -q ':12345'
echo "udp_12345=absent"
sudo python3 - <<'PY'
import json
a=json.load(open('/opt/gsa-tv/runtime/encoder-state.json'))['args']
print('original_source=',any(x.endswith('media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30.mp4') for x in a if isinstance(x,str)))
for k in ('-af','-b:a'):
 i=a.index(k); print(k,a[i+1])
PY
echo '=== 40-second output decode ==='
sudo docker exec gsa-tv-encoder-engine timeout 52 ffmpeg -v error -xerror -i /runtime/hls/program.m3u8 -map 0:a:0 -t 40 -f null - 2>&1
echo "output_decode=clean"
echo '=== recent engine errors ==='
sudo docker logs --since 10m gsa-tv-encoder-engine 2>&1 | grep -Ei 'error|invalid|non.monoton|corrupt|broken|overflow' | tail -n 50 || true
echo FINAL_AUDIO_PIPE_PASS
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
