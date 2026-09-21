import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -c "update public.gsa_tv_media_items set metadata=coalesce(metadata,'{}'::jsonb)||'{\"allow_static_video\":true}'::jsonb,updated_at=now() where id='media-gsa-hub-editorial-ep01';"
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
