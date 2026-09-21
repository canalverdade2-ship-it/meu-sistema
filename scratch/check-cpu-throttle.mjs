import { runSshScript } from './ssh2-run.mjs';

const script = `
for c in gsa-tv-encoder-engine gsa-tv-ffplayout; do
  echo "=== $c ==="
  cid=$(sudo docker inspect --format '{{.Id}}' $c)
  cgpath=$(find /sys/fs/cgroup -name "*$cid*" | head -n 1)
  cat $cgpath/cpu.max 2>/dev/null || true
  cat $cgpath/cpuset.cpus.effective 2>/dev/null || true
  cat $cgpath/cpu.stat 2>/dev/null || true
done
`;

const res = await runSshScript(script);
console.log(res.stdout);
