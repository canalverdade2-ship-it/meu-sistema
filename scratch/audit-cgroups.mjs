import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    echo "=== DOCKER INSPECT CGROUP CONFIGS ==="
    for c in gsa-tv-encoder-engine gsa-tv-ffplayout gsa-tv-control-plane gsa-tv-watchdog gsa-ai-browser gsa-shopee-browser; do
      echo -n "$c: "
      sudo docker inspect --format 'CpusetCpus={{.HostConfig.CpusetCpus}} CpuShares={{.HostConfig.CpuShares}} NanoCpus={{.HostConfig.NanoCpus}} Memory={{.HostConfig.Memory}} MemoryReservation={{.HostConfig.MemoryReservation}} CgroupParent={{.HostConfig.CgroupParent}}' $c
    done

    echo ""
    echo "=== CGROUP MOUNTS ==="
    mount | grep cgroup

    echo ""
    echo "=== FINDING CGROUP DIR FOR ENCODER ==="
    cid=$(sudo docker ps -qf "name=^/gsa-tv-encoder-engine$")
    full_id=$(sudo docker inspect --format '{{.Id}}' gsa-tv-encoder-engine)
    find /sys/fs/cgroup -name "*$cid*" -o -name "*$full_id*" 2>/dev/null | head -n 20
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
