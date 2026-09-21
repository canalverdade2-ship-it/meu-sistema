import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== code ==='
sudo sed -n '530,580p;645,680p;4280,4310p;4670,4710p' /opt/gsa-tv/control-plane/src/app.js
echo '=== panel files ==='
sudo find /opt/gsa-tv /home/opc/gsa-ai -type f \\( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.html' \\) -not -path '*/node_modules/*' -not -path '*/audit-archive/*' -print0 2>/dev/null | sudo xargs -0 grep -niE 'SELO AO VIVO|live.badge|live_badge' 2>/dev/null | head -n 300 || true
echo '=== DB ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select table_name,column_name from information_schema.columns where table_schema='public' and (column_name ilike '%badge%' or column_name ilike '%live%') order by 1,2;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo "select table_name from information_schema.tables where table_schema='public' and table_name ilike '%overlay%';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
