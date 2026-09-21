import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== UDP kernel limits ==='
sysctl net.core.rmem_max net.core.rmem_default net.core.netdev_max_backlog 2>/dev/null || true
echo '=== UDP counters ==='
netstat -su 2>/dev/null || cat /proc/net/snmp | grep '^Udp:' || true
echo '=== UDP socket buffers/process ==='
sudo ss -u -a -n -m -p | grep -A3 -B2 '12345' || true
echo '=== outer fd/socket ==='
OUTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
echo "outer=$OUTER"
sudo cat /proc/$OUTER/status | grep -E 'voluntary_ctxt|nonvoluntary_ctxt|VmRSS|Threads'
echo '=== softnet drops ==='
awk '{d+=strtonum("0x"$2); t+=strtonum("0x"$3)} END{print "dropped="d,"time_squeeze="t}' /proc/net/softnet_stat 2>/dev/null || true
echo '=== interface errors ==='
ip -s link show lo
echo '=== cgroup pressure ==='
cat /proc/pressure/cpu; cat /proc/pressure/io; cat /proc/pressure/memory
echo '=== state transport args ==='
sudo python3 - <<'PY'
import json
a=json.load(open('/opt/gsa-tv/runtime/encoder-state.json'))['args']
for x in a:
    if 'udp://' in str(x) or 'fifo_size' in str(x) or 'buffer_size' in str(x) or x in ('-thread_queue_size','-muxdelay','-muxpreload'):
        print(x)
PY
echo '=== active engine node resource ==='
sudo docker stats --no-stream gsa-tv-encoder-engine gsa-tv-control-plane --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}} net={{.NetIO}} block={{.BlockIO}} pids={{.PIDs}}'
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
