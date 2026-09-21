import { runSshScript } from './ssh2-run.mjs';

const oldBlock = `  const filters = [];
  let current = "0:v";`;
const newBlock = `  const filters = [
    \`[0:v]scale=\${profile.width}:\${profile.height}:force_original_aspect_ratio=decrease,pad=\${profile.width}:\${profile.height}:(ow-iw)/2:(oh-ih)/2:black[v0]\`,
  ];
  let current = "v0";`;
const b64=(v)=>Buffer.from(v).toString('base64');
const script=String.raw`set -euo pipefail
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')" = 'gsa-tv/control-plane:1.6.31'
sudo cp /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/control-plane/src/app.js.bak-1632
printf '%s' '${b64(oldBlock)}' | base64 -d >/tmp/scale-old.txt
printf '%s' '${b64(newBlock)}' | base64 -d >/tmp/scale-new.txt
sudo node - <<'NODE'
const fs=require('fs');const p='/opt/gsa-tv/control-plane/src/app.js';const old=fs.readFileSync('/tmp/scale-old.txt','utf8');const neu=fs.readFileSync('/tmp/scale-new.txt','utf8');const src=fs.readFileSync(p,'utf8');if(!src.includes(old))throw new Error('scale insertion point not found');fs.writeFileSync(p,src.replace(old,neu));
NODE
sudo node --check /opt/gsa-tv/control-plane/src/app.js
sudo docker build -t gsa-tv/control-plane:1.6.32 /opt/gsa-tv/control-plane
sudo sed -i 's#gsa-tv/control-plane:1\.6\.31#gsa-tv/control-plane:1.6.32#' /opt/gsa-tv/control-plane/compose.yml
sudo docker compose -p control-plane --project-directory /opt/gsa-tv/control-plane -f /opt/gsa-tv/control-plane/compose.yml up -d --force-recreate
for i in $(seq 1 45); do curl -fsS http://127.0.0.1:9202/health >/tmp/health-1632.json 2>/dev/null && break;sleep 2;done
cat /tmp/health-1632.json;echo
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'|awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
job_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','graphics_reload','pending',0,'{\"source\":\"true_1080p_activation\"}'::jsonb) returning id;")
for i in $(seq 1 45);do row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id';");case "$row" in completed'|'*)break;;failed'|'*)echo "$row";exit 1;;esac;sleep 1;done
sleep 8
sudo docker top gsa-tv-control-plane -eo pid,args | grep -F 'scale=1920:1080' | head -1
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select quality_profile,status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';"
sudo docker inspect gsa-tv-control-plane --format 'container={{.State.Status}}|health={{.State.Health.Status}}|image={{.Config.Image}}'
`;
const result=await runSshScript(script,180000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
