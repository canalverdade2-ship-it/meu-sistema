import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
echo '=== ENCODER STATE ==='
cat /opt/gsa-tv/runtime/encoder-state.json 2>/dev/null || true
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo '=== CHANNEL ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -P pager=off -c "select * from public.gsa_tv_channels where id='ch-main';" || true
echo '=== MEDIA SCHEMA ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -c "select column_name from information_schema.columns where table_schema='public' and table_name='gsa_tv_media_items' order by ordinal_position;"
echo '=== ACTIVE MEDIA ROW ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -P pager=off -c "select * from public.gsa_tv_media_items where id='media-gsa-em-fe-15h-10min';" || true
echo '=== MATCHING FILES ==='
find /opt/gsa-tv/cache/media/1 -type f \( -iname '*em-fe*.mp4' -o -iname '*em_fe*.mp4' -o -iname '*fe-*.mp4' \) -printf '%s|%TY-%Tm-%Td %TH:%TM:%TS|%p\n' 2>/dev/null | sort -nr | head -30
`;
const r=await runSshScript(sh,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
