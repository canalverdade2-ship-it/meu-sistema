import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const sql = fs.readFileSync(new URL('../supabase/migrations/20260903224000_gsa_tv_no_embedded_channel_bug_policy.sql', import.meta.url), 'utf8');
const encoded = Buffer.from(sql).toString('base64');
const script = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
printf '%s' '${encoded}' | base64 -d | sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -c "select config->'content_creation_policy' from public.gsa_tv_channels where id='ch-main';"
`;
const result = await runSshScript(script, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
