import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select table_name from information_schema.tables where table_schema='public' and table_name like '%media%' order by 1;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
for t in $(echo "select table_name from information_schema.tables where table_schema='public' and table_name like '%media%' order by 1;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"); do
  echo "---$t"
  echo "select row_to_json(x) from public.\\\"$t\\\" x where row_to_json(x)::text like '%836c5fe7-e994-455c-bfa4-76b5a803d94c%' limit 3;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL" || true
done
echo '=== source file filesystem ==='
sudo find /opt/gsa-tv/cache/media -name '*836c5fe7-e994-455c-bfa4-76b5a803d94c*' -ls
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
