import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    for c in gsa-tv-encoder-engine gsa-tv-ffplayout gsa-tv-control-plane gsa-tv-watchdog gsa-ai-browser gsa-shopee-browser; do
      full_id=$(sudo docker inspect --format '{{.Id}}' $c 2>/dev/null)
      if [ -n "$full_id" ]; then
        dir="/sys/fs/cgroup/system.slice/docker-\${full_id}.scope"
        cpuset_cpus=$(cat $dir/cpuset.cpus 2>/dev/null || echo "n/a")
        cpuset_effective=$(cat $dir/cpuset.cpus.effective 2>/dev/null || echo "n/a")
        cpu_max=$(cat $dir/cpu.max 2>/dev/null || echo "n/a")
        cpu_weight=$(cat $dir/cpu.weight 2>/dev/null || echo "n/a")
        mem_low=$(cat $dir/memory.low 2>/dev/null || echo "n/a")
        mem_max=$(cat $dir/memory.max 2>/dev/null || echo "n/a")
        echo "=== $c ==="
        echo "  cpuset.cpus: $cpuset_cpus (effective: $cpuset_effective)"
        echo "  cpu.max: $cpu_max, cpu.weight: $cpu_weight"
        echo "  memory.low: $mem_low, memory.max: $mem_max"
      fi
    done
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
