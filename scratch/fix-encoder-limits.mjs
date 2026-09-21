import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    echo "Updating gsa-tv-encoder-engine online memory limit with swap..."
    sudo docker update --memory="3g" --memory-swap="3g" gsa-tv-encoder-engine

    echo "Checking updated inspect config..."
    sudo docker inspect --format 'CpusetCpus={{.HostConfig.CpusetCpus}} CpuShares={{.HostConfig.CpuShares}} NanoCpus={{.HostConfig.NanoCpus}} Memory={{.HostConfig.Memory}} MemoryReservation={{.HostConfig.MemoryReservation}} MemorySwap={{.HostConfig.MemorySwap}}' gsa-tv-encoder-engine

    full_id=$(sudo docker inspect --format '{{.Id}}' gsa-tv-encoder-engine)
    dir="/sys/fs/cgroup/system.slice/docker-\${full_id}.scope"
    echo "Cgroups v2 effective settings:"
    echo "  cpu.max: $(cat $dir/cpu.max 2>/dev/null || echo 'n/a')"
    echo "  memory.max: $(cat $dir/memory.max 2>/dev/null || echo 'n/a')"
    echo "  memory.low: $(cat $dir/memory.low 2>/dev/null || echo 'n/a')"

    echo "Verifying stream health after update:"
    curl -s -H "Authorization: Bearer 222d718911511702a4c813c427fdbab3e70c908d39f5c550c9594f8d3938cd9e" http://127.0.0.1:9210/v1/status
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
