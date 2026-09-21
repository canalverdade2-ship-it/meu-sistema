import { runSshScript } from './ssh2-run.mjs';

const videoId = 'kX7gdLa1dK0';
const remote = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -At -F '|' -c "update public.gsa_tv_channels set config=coalesce(config,'{}'::jsonb)||jsonb_build_object('youtube_video_id','${videoId}'),updated_at=now() where id='ch-main'; select id,config->>'youtube_video_id' from public.gsa_tv_channels where id='ch-main';"
`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
