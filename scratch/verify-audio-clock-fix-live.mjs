import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== CURRENT PRODUCER AUDIO FILTER ==='
sudo docker top gsa-tv-encoder-engine -eo pid,ppid,etimes,%cpu,args | grep '[f]fmpeg' | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g'
echo '=== ENGINE STATUS ==='
token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' /opt/gsa-tv/control-plane/.env)
curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print({k:d.get(k) for k in ("status","outer_pid","producer_pid","rtmp_publishers","signal_state","last_error")})'
echo '=== HLS FRESHNESS ==='
sudo stat -c '%y %s %n' /opt/gsa-tv/runtime/hls/program.m3u8
echo '=== RECENT ERRORS ==='
sudo docker logs --since 5m gsa-tv-encoder-engine 2>&1 | grep -Ei 'error|corrupt|non-monoton|timestamp|queue|drop|failed' | tail -n 40 || true
`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
