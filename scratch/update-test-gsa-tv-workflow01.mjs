import { runSshScript } from './ssh2-run.mjs';
const script=`set -euo pipefail
# Refresh only workflow 01 payload in the container
sudo docker cp /opt/gsa-tv/n8n/workflows/gsa-tv-01-media-ingest.json n8n:/tmp/gsa-tv-workflow01.json
docker exec n8n n8n import:workflow --input=/tmp/gsa-tv-workflow01.json
docker exec n8n n8n publish:workflow --id=gsaTvMediaReadiness01
docker restart n8n >/dev/null
sleep 8
echo '=== count/name ==='
docker exec n8n n8n list:workflow 2>/dev/null | grep 'GSA TV 01' | wc -l
echo '=== execute ==='
set +e
out=$(docker exec -e N8N_RUNNERS_BROKER_PORT=5689 n8n n8n execute --id=gsaTvMediaReadiness01 --rawOutput 2>&1)
rc=$?
set -e
echo "$out" | tail -c 5000
echo
printf 'execute_exit=%s\n' "$rc"
exit "$rc"
`;
const r=await runSshScript(script,180000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
