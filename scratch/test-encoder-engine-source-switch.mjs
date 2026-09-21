import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
token=$(openssl rand -hex 32)
cleanup(){ sudo docker rm -f gsa-encoder-test gsa-rtmp-sink >/dev/null 2>&1 || true; rm -f /tmp/encoder-test-*.json; }
trap cleanup EXIT
sudo docker rm -f gsa-encoder-test gsa-rtmp-sink >/dev/null 2>&1 || true
sudo install -d -o 989 -g 989 -m 0750 /opt/gsa-tv/runtime-test
sudo rm -f /opt/gsa-tv/runtime-test/encoder-state.json /opt/gsa-tv/runtime-test/encoder-state.json.tmp
sudo docker run -d --rm --name gsa-rtmp-sink --network host --entrypoint ffmpeg gsa-tv/control-plane:1.6.39 \
  -hide_banner -nostdin -loglevel warning -listen 1 -i rtmp://127.0.0.1:19350/live/test -map 0 -c copy -f null - >/dev/null
sudo docker run -d --rm --name gsa-encoder-test --network host --env-file /opt/gsa-tv/control-plane/.env \
  -e ENCODER_ENGINE_TOKEN="$token" -e ENCODER_ENGINE_PORT=9211 -e ENCODER_UDP_PORT=12346 -e ENCODER_LOCK_DISABLED=true \
  -v /opt/gsa-tv/runtime-test:/runtime -v /opt/gsa-tv/fallback:/fallback:ro \
  gsa-tv/encoder-engine:1.0.0 >/dev/null
sleep 2
python3 - <<'PY'
import json
base=['-hide_banner','-nostdin','-loglevel','warning','-re','-f','lavfi','-i','color=c=red:s=640x360:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-r','30','-g','60','-b:v','900k','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-ar','48000','-ac','2','-shortest','-f','flv','rtmp://127.0.0.1:19350/live/test']
json.dump({'mode':'test:red','args':base},open('/tmp/encoder-test-red.json','w'))
base[base.index('color=c=red:s=640x360:r=30')]='color=c=blue:s=640x360:r=30'
json.dump({'mode':'test:blue','args':base},open('/tmp/encoder-test-blue.json','w'))
PY
curl -fsS -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data-binary @/tmp/encoder-test-red.json http://127.0.0.1:9211/v1/ensure >/tmp/encoder-test-first.json
sleep 5
first_outer=$(python3 -c "import json;print(json.load(open('/tmp/encoder-test-first.json'))['outer_pid'])")
first_producer=$(python3 -c "import json;print(json.load(open('/tmp/encoder-test-first.json'))['producer_pid'])")
curl -fsS -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data-binary @/tmp/encoder-test-blue.json http://127.0.0.1:9211/v1/ensure >/tmp/encoder-test-second.json
sleep 5
curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9211/v1/status >/tmp/encoder-test-status.json
python3 - "$first_outer" "$first_producer" <<'PY'
import json,sys
s=json.load(open('/tmp/encoder-test-status.json'))
print('first_outer|'+sys.argv[1])
print('current_outer|'+str(s['outer_pid']))
print('outer_same|'+str(str(s['outer_pid'])==sys.argv[1]).lower())
print('producer_changed|'+str(str(s['producer_pid'])!=sys.argv[2]).lower())
print('outer_running|'+str(s['outer_running']).lower())
print('producer_running|'+str(s['producer_running']).lower())
print('last_error|'+str(s['last_error']))
if str(s['outer_pid'])!=sys.argv[1] or str(s['producer_pid'])==sys.argv[2] or not s['outer_running'] or not s['producer_running']:
    raise SystemExit(1)
PY
current_producer=$(python3 -c "import json;print(json.load(open('/tmp/encoder-test-status.json'))['producer_pid'])")
sudo docker exec gsa-encoder-test sh -c "kill -9 $current_producer"
sleep 4
curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9211/v1/status >/tmp/encoder-test-fallback.json
python3 - <<'PY'
import json
s=json.load(open('/tmp/encoder-test-fallback.json'))
print('fallback_running|'+str(s['producer_running']).lower())
print('using_fallback|'+str(s['using_fallback']).lower())
PY
echo sink_status'|'$(sudo docker inspect gsa-rtmp-sink --format '{{.State.Status}}')
sudo docker logs --tail 20 gsa-encoder-test 2>&1 | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g'
grep -q '"producer_running":true' /tmp/encoder-test-fallback.json
grep -q '"using_fallback":true' /tmp/encoder-test-fallback.json
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
