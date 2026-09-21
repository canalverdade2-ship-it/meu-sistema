import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select id,severity,message,created_at,resolved from public.gsa_tv_incidents where channel_id='ch-main' and not resolved order by created_at desc; select id,title,metadata from public.gsa_tv_media_items where id='media-gsa-hub-editorial-ep01';"
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
