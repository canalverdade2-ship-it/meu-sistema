import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "================================================================"
echo "1. ENCODER ENGINE STATUS (http://127.0.0.1:9210/v1/status)"
echo "================================================================"
curl -s -H "Authorization: Bearer 222d718911511702a4c813c427fdbab3e70c908d39f5c550c9594f8d3938cd9e" http://127.0.0.1:9210/v1/status | jq .

echo "================================================================"
echo "2. RTMP CONNECTION TO YOUTUBE"
echo "================================================================"
ss -tnp | grep 1935

echo "================================================================"
echo "3. CONTAINER CGROUPS EFFECTIVE AFFINITY"
echo "================================================================"
for c in gsa-tv-encoder-engine gsa-tv-ffplayout gsa-tv-control-plane gsa-tv-watchdog gsa-ai-browser gsa-shopee-browser; do
  cid=$(sudo docker inspect --format '{{.Id}}' $c)
  cgpath=$(find /sys/fs/cgroup -name "*$cid*" | head -n 1)
  eff=$(cat $cgpath/cpuset.cpus.effective 2>/dev/null || echo "N/A")
  weight=$(cat $cgpath/cpu.weight 2>/dev/null || echo "N/A")
  max=$(cat $cgpath/cpu.max 2>/dev/null || echo "N/A")
  echo "Container: $c -> effective_cpus: $eff | cpu.weight: $weight | cpu.max: $max"
done

echo "================================================================"
echo "4. DOCKER STATS SNAPSHOT"
echo "================================================================"
sudo docker stats --no-stream

echo "================================================================"
echo "5. SYSTEMD GUARDIAN TIMER STATUS"
echo "================================================================"
sudo systemctl status gsa-process-guardian.timer --no-pager

echo "================================================================"
echo "6. PROCESS GUARDIAN LOGS (LAST 10 ENTRIES)"
echo "================================================================"
tail -n 10 /var/log/gsa-process-guardian.log

echo "================================================================"
echo "7. CDP BROWSER TABS STATUS (PORT 9228)"
echo "================================================================"
curl -s http://127.0.0.1:9228/json/list | jq -r '.[] | "\\(.id) \\(.type) \\(.url)"'
`;

const res = await runSshScript(script);
console.log(res.stdout);
