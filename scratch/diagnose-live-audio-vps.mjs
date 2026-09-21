import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== engine health ==='
curl -fsS http://127.0.0.1:9210/health | sed -E 's#(live2/)[^" ]+#\\1[REDACTED]#g'; echo
echo '=== producer and outer commands ==='
for p in $(sudo docker exec gsa-tv-encoder-engine sh -lc "pgrep -x ffmpeg"); do
  sudo docker exec gsa-tv-encoder-engine sh -lc "tr '\\0' ' ' </proc/$p/cmdline; echo" | sed -E 's#(live2/)[^ ]+#\\1[REDACTED]#g'
done
echo '=== recent engine logs ==='
sudo docker logs --since 30m gsa-tv-encoder-engine 2>&1 | tail -n 300 | sed -E 's#(live2/)[^ ]+#\\1[REDACTED]#g'
echo '=== source media probe ==='
MODE=$(curl -fsS http://127.0.0.1:9210/health | python3 -c 'import sys,json; print(json.load(sys.stdin).get("mode",""))')
echo "mode=$MODE"
echo '=== UDP audio measurement 20s ==='
timeout 25 ffmpeg -hide_banner -nostdin -loglevel info -i 'udp://127.0.0.1:12345?fifo_size=1000000&overrun_nonfatal=1' -map 0:a:0 -t 20 -af astats=metadata=1:reset=1,aresample=async=1:first_pts=0 -f null - 2>&1 | tail -n 120 || true
echo '=== ffplayout logs/audio errors ==='
sudo docker logs --since 30m gsa-tv-ffplayout 2>&1 | grep -Ei 'audio|timestamp|non-monoton|queue|overflow|underflow|error|invalid|drop' | tail -n 200 || true
echo '=== kernel/resource snapshot ==='
vmstat 1 5
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
