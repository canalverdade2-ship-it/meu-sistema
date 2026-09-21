import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo '=== 1. STAGED VS CONTROL-PLANE SRC ==='
ls -la /home/opc/gsa-ai/work/night-factory-20260910/ 2>/dev/null || echo 'staged dir not found'
diff -u /home/opc/gsa-ai/work/night-factory-20260910/editorial-production.js /opt/gsa-tv/control-plane/src/editorial-production.js || true
diff -u /home/opc/gsa-ai/work/night-factory-20260910/app.js /opt/gsa-tv/control-plane/src/app.js || true

echo '=== 2. CONTAINER STATUS & MOUNTS ==='
sudo docker ps --filter name=control-plane
CONTAINER_ID=$(sudo docker ps -q --filter name=control-plane)
if [ -n "$CONTAINER_ID" ]; then
  sudo docker inspect "$CONTAINER_ID" --format '{{json .Mounts}}'
  echo 'Inside container editorial-production.js head:'
  sudo docker exec "$CONTAINER_ID" grep -n "time <" /app/src/editorial-production.js || true
  echo 'Inside container app.js 1080p:'
  sudo docker exec "$CONTAINER_ID" grep -n "1920" /app/src/app.js || true
fi

echo '=== 3. DISPATCHER SCRIPT ==='
ls -la /opt/gsa-tv/bin/gsa-tv-night-factory.sh
cat /opt/gsa-tv/bin/gsa-tv-night-factory.sh
`;

try {
  const res = await runSshScript(cmd, 60000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
