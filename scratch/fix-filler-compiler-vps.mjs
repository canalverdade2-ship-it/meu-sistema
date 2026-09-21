import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const patcher = fs.readFileSync(new URL('./patch-filler-compiler.mjs', import.meta.url)).toString('base64');

const result = await runSshScript(`set -Eeuo pipefail
cd /opt/gsa-tv/control-plane
sudo cp src/app.js src/app.js.pre-filler-181
echo '${patcher}' | base64 -d > /tmp/patch-filler-compiler.mjs
sudo node /tmp/patch-filler-compiler.mjs /opt/gsa-tv/control-plane/src/app.js
rm -f /tmp/patch-filler-compiler.mjs
sudo node --check src/app.js
grep -n -A20 -B3 'item.source === SCHEDULE_FILLER_FILE' src/app.js
sudo docker build -t gsa-tv/control-plane:1.8.1 .
sudo sed -i 's#gsa-tv/control-plane:1.8.0#gsa-tv/control-plane:1.8.1#' compose.yml
sudo docker compose config --quiet
sudo docker compose up -d --no-deps control-plane
for i in $(seq 1 60); do
  if sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null | grep -qx healthy; then break; fi
  sleep 1
done
sudo docker inspect gsa-tv-control-plane --format 'image={{.Config.Image}} health={{.State.Health.Status}}'
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' .env)
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','compile_playlist','pending',0,'{}'::jsonb)" >/dev/null
for i in $(seq 1 60); do
  state=$(psql "$DB_URL" -X -Atc "select status from public.gsa_tv_jobs where job_type='compile_playlist' order by created_at desc limit 1")
  [[ "$state" =~ ^(completed|failed|cancelled)$ ]] && break
  sleep 1
done
echo "compile_state=$state"
[[ "$state" == completed ]]
curl -fsS http://127.0.0.1:9210/health; echo
`, 900000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
