import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
read_udp() { awk '/^Udp:/{n++; if(n==2){print $5,$6; exit}}' /proc/net/snmp; }
BEFORE=$(read_udp)
echo "before_inerrors_rcvbuf=$BEFORE"
for i in 1 2 3 4 5; do sleep 3; echo "sample_$i=$(read_udp)"; done
sudo ss -u -a -n -m -p | grep -A1 '12345' || true
sudo docker stats --no-stream gsa-tv-encoder-engine --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}} pids={{.PIDs}}'
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
