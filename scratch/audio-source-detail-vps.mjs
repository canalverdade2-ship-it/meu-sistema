import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
FILE=/media/1/normalized/media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30.mp4
echo '=== decode integrity ==='
sudo docker exec gsa-tv-encoder-engine ffmpeg -v error -xerror -i "$FILE" -map 0:a:0 -f null - 2>&1 || true
echo '=== loudness ==='
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -i "$FILE" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | tail -n 30
echo '=== DB schema and record ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select column_name from information_schema.columns where table_schema='public' and table_name='gsa_tv_live_sources' order by ordinal_position;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo "select row_to_json(t) from public.gsa_tv_live_sources t where id='836c5fe7-e994-455c-bfa4-76b5a803d94c';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL" | sed -E 's#(rtmps?://[^/]+/live2/)[^" ]+#\\1[REDACTED]#g' | head -c 6000
echo
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
