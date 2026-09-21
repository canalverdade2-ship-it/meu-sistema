import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== engine logs ==='
sudo docker logs --since 10m gsa-tv-encoder-engine 2>&1 | tail -n 240 | sed -E 's#(rtmps?://)[^ ]+#\\1[REDACTED]#g; s#(live2|rtmp)/[^ ]+#\\1/[REDACTED]#g'
echo '=== engine status ==='; curl -fsS http://127.0.0.1:9210/health; echo
echo '=== ffplayout status ==='
curl -sS -o /tmp/ff-root -w 'root=%{http_code}\n' http://127.0.0.1:8787/ || true
cat /tmp/ff-root | head -c 500; echo
echo '=== playlist/HLS legacy ==='
curl -sS -o /tmp/legacy-hls -w 'legacy_hls=%{http_code}\n' http://127.0.0.1:8787/public/1/live/stream.m3u8 || true
head -n 20 /tmp/legacy-hls 2>/dev/null || true
echo '=== control status ==='
TOKEN=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="INTERNAL_API_TOKEN"{sub(/^INTERNAL_API_TOKEN=/,"");print;exit}')
curl -fsS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9202/status | head -c 6000; echo
echo '=== ffplayout recent logs ==='
sudo docker logs --since 15m gsa-tv-ffplayout 2>&1 | tail -n 200
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
