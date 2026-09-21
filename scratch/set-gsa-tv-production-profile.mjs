import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -At -F '|' -c "update public.gsa_tv_channels set quality_profile='720p30',updated_at=now() where id='ch-main'; select id,quality_profile,status,desired_state,signal_state from public.gsa_tv_channels where id='ch-main';"
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
