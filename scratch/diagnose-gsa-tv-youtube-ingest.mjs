import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
echo CONTROL_LOG
sudo docker logs --since 10m gsa-tv-control-plane 2>&1 | tail -120 | sed -E 's#(live2/)[^ ]+#\1[PROTECTED]#g'
echo PROCESSES
ps -eo pid,etimes,%cpu,%mem,args | grep -E '[f]fmpeg.*(youtube|live/stream)' | sed -E 's#(live2/)[^ ]+#\1[PROTECTED]#g'
echo HLS
curl -fsS http://127.0.0.1:9204/metrics | grep '^gsa_tv_'
echo RESOURCES
sudo docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}' gsa-tv-control-plane gsa-tv-ffplayout gsa-tv-watchdog
echo NETWORK
sudo ss -tinp | grep -A2 ':1935' || true
echo HLS_READ_15S
timeout 15 sudo docker run --rm --network host gsa-tv/control-plane:1.6.7 ffmpeg -hide_banner -loglevel error -stats -i http://127.0.0.1:8787/public/1/live/stream.m3u8 -map 0:v:0 -map 0:a:0? -f null - 2>&1 || true
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
