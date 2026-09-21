import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== GSA-AI DIR ==="
ls -la /home/opc/gsa-ai/

echo "=== GSA-AI DOCKERFILE OR SCRIPTS ==="
cat /home/opc/gsa-ai/Dockerfile 2>/dev/null || true
cat /home/opc/gsa-ai/entrypoint.sh 2>/dev/null || true
cat /home/opc/gsa-ai/start.sh 2>/dev/null || true

echo "=== ENCODER STATUS CHECK ==="
TOKEN=$(sudo grep -oP 'ENCODER_ENGINE_AUTH_TOKEN=\\K.*' /opt/gsa-tv/control-plane/.env || sudo grep -oP 'AUTH_TOKEN=\\K.*' /opt/gsa-tv/control-plane/.env || true)
if [ -n "$TOKEN" ]; then
  curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9210/v1/status | jq . || curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9210/v1/status
else
  curl -s http://127.0.0.1:9210/v1/status
fi

echo "=== CDP BROWSER TABS (PORT 9228) ==="
curl -s http://127.0.0.1:9228/json/list | jq . || curl -s http://127.0.0.1:9228/json/list

echo "=== DOCKER CGROUP PATHS ==="
for c in gsa-tv-encoder-engine gsa-tv-ffplayout gsa-ai-browser gsa-shopee-browser; do
  echo "--- $c ---"
  cid=$(sudo docker inspect --format '{{.Id}}' $c 2>/dev/null)
  echo "CID: $cid"
  if [ -n "$cid" ]; then
    cgpath=$(find /sys/fs/cgroup -name "*$cid*" | head -n 1)
    echo "Path: $cgpath"
    if [ -n "$cgpath" ] && [ -f "$cgpath/cpuset.cpus" ]; then
      echo "cpuset.cpus: $(cat $cgpath/cpuset.cpus)"
      echo "cpuset.cpus.effective: $(cat $cgpath/cpuset.cpus.effective 2>/dev/null)"
    fi
  fi
done
`;

const res = await runSshScript(script);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
