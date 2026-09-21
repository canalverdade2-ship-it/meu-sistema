import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== runtime badge file ==='
sudo ls -l /opt/gsa-tv/runtime/gsa-tv-live-badge.txt 2>/dev/null || true
sudo xxd -g1 /opt/gsa-tv/runtime/gsa-tv-live-badge.txt 2>/dev/null || true
echo '=== control source badge refs ==='
sudo grep -RniE 'selo ao vivo|live.badge|live_badge|badge.*live|ao vivo.*badge' /opt/gsa-tv/control-plane/src /opt/gsa-tv/control-plane/public 2>/dev/null | head -n 250
echo '=== frontend refs ==='
sudo find /opt/gsa-tv /home/opc/gsa-ai -type f \\( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.html' \\) -not -path '*/node_modules/*' -not -path '*/audit-archive/*' -print0 2>/dev/null | sudo xargs -0 grep -niE 'SELO AO VIVO|live.badge|live_badge' 2>/dev/null | head -n 300 || true
echo '=== API health/status ==='
curl -fsS http://127.0.0.1:9202/health; echo
echo '=== DB candidate columns ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select table_name,column_name from information_schema.columns where table_schema='public' and (column_name ilike '%badge%' or column_name ilike '%live%') order by 1,2;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL" | head -n 200
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
