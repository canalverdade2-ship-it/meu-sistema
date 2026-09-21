import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select provider,default_model,image_model,speech_model,video_model,updated_at from public.gsa_tv_ai_provider_secrets where channel_id='ch-main' order by updated_at desc;"
`,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
