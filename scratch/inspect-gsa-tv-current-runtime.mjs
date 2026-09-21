import {runSshScript} from './ssh2-run.mjs';
const remote=String.raw`set -euo pipefail
echo 'PARENT'; sudo ps -fp 3647953 || true
echo 'PORTS'; sudo docker port gsa-tv-control-plane || true
echo 'ENV_PORT'; sudo docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' gsa-tv-control-plane | grep -E '^(PORT|HOST)=' || true
dburl=$(sudo docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' gsa-tv-control-plane | sed -n 's/^DATABASE_URL=//p')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select id,status,desired_state,playout_state,signal_state,coalesce(current_media_id,''),coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'; select id,action,coalesce(payload::text,'{}'),created_at from public.gsa_tv_command_audit where channel_id='ch-main' order by created_at desc limit 15;" 2>/dev/null || true
`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
