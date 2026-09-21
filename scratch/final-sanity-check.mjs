import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    echo "=== 1. ENCODER API STATUS ==="
    curl -s -H "Authorization: Bearer 222d718911511702a4c813c427fdbab3e70c908d39f5c550c9594f8d3938cd9e" http://127.0.0.1:9210/v1/status

    echo "\n=== 2. RTMP SOCKET CONNECTION ==="
    ss -tn | grep 1935 || echo "No RTMP connection!"

    echo "\n=== 3. PROCESS GUARDIAN TIMER ==="
    systemctl is-active gsa-process-guardian.timer

    echo "\n=== 4. LATEST 5 GUARDIAN LOG ENTRIES ==="
    tail -n 5 /var/log/gsa-process-guardian.log

    echo "\n=== 5. DOCKER STATS ==="
    sudo docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
