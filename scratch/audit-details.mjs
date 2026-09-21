import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo '=== 1. DIFF STAGED VS /opt/gsa-tv/control-plane/src/ ==='
echo '--- diff editorial-production.js ---'
diff -u /home/opc/gsa-ai/work/night-factory-20260910/editorial-production.js /opt/gsa-tv/control-plane/src/editorial-production.js || true
echo '--- diff app.js ---'
diff -u /home/opc/gsa-ai/work/night-factory-20260910/app.js /opt/gsa-tv/control-plane/src/app.js || true

echo '=== 2. CONTAINER MOUNTS & FILES ==='
CONTAINER_ID=$(sudo docker ps -q --filter name=control-plane)
echo "Container ID: $CONTAINER_ID"
sudo docker inspect "$CONTAINER_ID" --format '{{json .HostConfig.Binds}}'
sudo docker exec "$CONTAINER_ID" grep -n "time <" /app/src/editorial-production.js || true
sudo docker exec "$CONTAINER_ID" grep -n -C 3 "1920" /app/src/app.js || true

echo '=== 3. WHAT IS RUNNING ON PORT 8770? ==='
sudo ss -tulpn | grep 8770 || true
sudo systemctl list-units | grep -i -E "builder|program|8770" || true
ps aux | grep 8770 | grep -v grep || true

echo '=== 4. EXPLORE PORT 8770 ENDPOINTS & CODE ==='
curl -s http://127.0.0.1:8770/ || true
echo ""
curl -s http://127.0.0.1:8770/help || true
echo ""
curl -s http://127.0.0.1:8770/status || true
echo ""
# Find files belonging to port 8770 service
systemctl status gsa-program-builder 2>/dev/null || systemctl status *builder* 2>/dev/null || true

echo '=== 5. CHECK /opt/gsa-tv/cache/media/1/program-masters ==='
ls -la /opt/gsa-tv/cache/media/1/program-masters/
`;

try {
  const res = await runSshScript(cmd, 60000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
