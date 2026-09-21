import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    echo "=== DOCKER PS ==="
    sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

    echo ""
    echo "=== CGROUPS CPUSET.CPUS.EFFECTIVE ==="
    for c in gsa-tv-encoder-engine gsa-tv-ffplayout gsa-tv-control-plane gsa-tv-watchdog gsa-ai-browser gsa-shopee-browser; do
      cid=$(sudo docker ps -qf "name=^/\${c}$")
      if [ -n "$cid" ]; then
        cpuset=$(cat /sys/fs/cgroup/system.slice/docker-\${cid}.scope/cpuset.cpus.effective 2>/dev/null || cat /sys/fs/cgroup/cpuset/docker/\${cid}/cpuset.cpus 2>/dev/null || echo "not found")
        cpu_max=$(cat /sys/fs/cgroup/system.slice/docker-\${cid}.scope/cpu.max 2>/dev/null || echo "n/a")
        cpu_weight=$(cat /sys/fs/cgroup/system.slice/docker-\${cid}.scope/cpu.weight 2>/dev/null || echo "n/a")
        oom_score=$(cat /proc/$(sudo docker inspect --format '{{.State.Pid}}' \${c} 2>/dev/null)/oom_score_adj 2>/dev/null || echo "n/a")
        echo "\${c} (cid \${cid}): cpuset=\${cpuset}, cpu.max=\${cpu_max}, cpu.weight=\${cpu_weight}, oom_score_adj=\${oom_score}"
      else
        echo "\${c}: NOT RUNNING"
      fi
    done

    echo ""
    echo "=== DOCKER STATS (CURRENT LOAD) ==="
    sudo docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

    echo ""
    echo "=== ENCODER STATUS API ==="
    curl -s -H "Authorization: Bearer 222d718911511702a4c813c427fdbab3e70c908d39f5c550c9594f8d3938cd9e" http://127.0.0.1:9210/v1/status

    echo ""
    echo "=== RTMP ESTABLISHED CONNECTIONS ==="
    ss -tn | grep 1935 || echo "No 1935 connection"

    echo ""
    echo "=== CDP TABS LIST ==="
    curl -s http://127.0.0.1:9228/json/list || echo "CDP unreachable"
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
