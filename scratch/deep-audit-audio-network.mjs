import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -u
printf '%s\n' '=== HOST LOAD ==='
uptime
free -h
df -h / /opt/gsa-tv/cache/media
printf '%s\n' '=== CONTAINER STATS ==='
sudo docker stats --no-stream --format '{{.Name}}|CPU={{.CPUPerc}}|MEM={{.MemUsage}}|NET={{.NetIO}}|BLOCK={{.BlockIO}}' gsa-tv-encoder-engine gsa-tv-control-plane gsa-tv-watchdog
printf '%s\n' '=== NIC COUNTERS ==='
for nic_path in /sys/class/net/*; do nic_name=$(basename "$nic_path"); printf '%s|' "$nic_name"; paste -sd'|' "$nic_path/statistics/rx_errors" "$nic_path/statistics/rx_dropped" "$nic_path/statistics/tx_errors" "$nic_path/statistics/tx_dropped" 2>/dev/null || true; done
printf '%s\n' '=== TCP EXTENDED ==='
netstat -s 2>/dev/null | grep -Ei 'retransmit|segments retrans|bad segments|packet receive errors|receive errors|send buffer errors' || true
printf '%s\n' '=== RTMP SOCKET ==='
sudo nsenter -t 1 -n ss -tinp | grep -A3 -B1 ':1935' || true
printf '%s\n' '=== ENGINE LOG ERRORS SINCE NEWS TAKE ==='
sudo docker logs --since '2026-09-07T03:08:40Z' gsa-tv-encoder-engine 2>&1 | grep -Ei 'error|warn|corrupt|non-monoton|drop|buffer|timestamp|broken|failed|queue|dts|pts' || true
`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
