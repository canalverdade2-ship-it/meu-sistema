import { runSshScript } from './ssh2-run.mjs';

const script = `
set -e
echo "=== 1. APPLYING DOCKER UPDATE ONLINE (ZERO DOWNTIME) ==="

sudo docker update --cpuset-cpus="0,1,2" --cpu-shares=2048 --memory-reservation=1g gsa-tv-encoder-engine
sudo docker update --cpuset-cpus="0,1" --cpu-shares=1024 --memory-reservation=1g gsa-tv-ffplayout
sudo docker update --cpuset-cpus="0,1,2" --cpu-shares=512 --memory-reservation=256m gsa-tv-control-plane
sudo docker update --cpuset-cpus="0,1,2" --cpu-shares=512 --memory-reservation=256m gsa-tv-watchdog
sudo docker update --cpuset-cpus="3" --cpus=1.0 --cpu-shares=128 gsa-ai-browser
sudo docker update --cpuset-cpus="3" --cpus=0.8 --cpu-shares=128 gsa-shopee-browser

echo "=== 2. VERIFYING CGROUPS CONFIGURATION ==="
for c in gsa-tv-encoder-engine gsa-tv-ffplayout gsa-tv-control-plane gsa-tv-watchdog gsa-ai-browser gsa-shopee-browser; do
  echo "--- Container: $c ---"
  cid=$(sudo docker inspect --format '{{.Id}}' $c)
  cgpath=$(find /sys/fs/cgroup -name "*$cid*" | head -n 1)
  echo "Path: $cgpath"
  if [ -n "$cgpath" ] && [ -f "$cgpath/cpuset.cpus" ]; then
    echo "  cpuset.cpus:           $(cat $cgpath/cpuset.cpus)"
    echo "  cpuset.cpus.effective: $(cat $cgpath/cpuset.cpus.effective 2>/dev/null || true)"
  fi
  if [ -n "$cgpath" ] && [ -f "$cgpath/cpu.weight" ]; then
    echo "  cpu.weight:            $(cat $cgpath/cpu.weight)"
  fi
  if [ -n "$cgpath" ] && [ -f "$cgpath/cpu.max" ]; then
    echo "  cpu.max:               $(cat $cgpath/cpu.max)"
  fi
  if [ -n "$cgpath" ] && [ -f "$cgpath/memory.min" ]; then
    echo "  memory.min:            $(cat $cgpath/memory.min)"
    echo "  memory.low:            $(cat $cgpath/memory.low)"
  fi
done

echo "=== 3. APPLYING OOM SCORE ADJ ==="
for pid in $(sudo docker top gsa-tv-encoder-engine -o pid | tail -n +2); do
  echo -1000 | sudo tee /proc/$pid/oom_score_adj >/dev/null || true
done
for pid in $(sudo docker top gsa-tv-ffplayout -o pid | tail -n +2); do
  echo -900 | sudo tee /proc/$pid/oom_score_adj >/dev/null || true
done
for pid in $(sudo docker top gsa-ai-browser -o pid | tail -n +2); do
  echo 500 | sudo tee /proc/$pid/oom_score_adj >/dev/null || true
done
for pid in $(sudo docker top gsa-shopee-browser -o pid | tail -n +2); do
  echo 500 | sudo tee /proc/$pid/oom_score_adj >/dev/null || true
done

echo "OOM score adjustment applied."
`;

const res = await runSshScript(script);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
