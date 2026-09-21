import { runSshScript } from './ssh2-run.mjs';
const oldText="order by case when g.config->>'preset'='dashboard_backdrop' then 0 when g.layer_type='logo' then 1 when g.layer_type='bug' then 2 when g.layer_type='lower_third' then 3 else 4 end,g.created_at";
const newText="order by case when g.config->>'preset'='dashboard_backdrop' then 0 when g.layer_type='bug' then 1 when g.layer_type='lower_third' then 2 when g.layer_type='ticker' then 3 when g.layer_type='logo' then 9 else 4 end,g.created_at";
const b64=v=>Buffer.from(v).toString('base64');
const script=String.raw`set -euo pipefail
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')" = 'gsa-tv/control-plane:1.6.34'
sudo cp /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/control-plane/src/app.js.bak-1635
sudo node - <<'NODE'
const fs=require('fs');const p='/opt/gsa-tv/control-plane/src/app.js';let s=fs.readFileSync(p,'utf8');const a=Buffer.from('${b64(oldText)}','base64').toString(),b=Buffer.from('${b64(newText)}','base64').toString();if(!s.includes(a))throw new Error('ordering not found');fs.writeFileSync(p,s.replace(a,b));
NODE
sudo node --check /opt/gsa-tv/control-plane/src/app.js
sudo docker build -t gsa-tv/control-plane:1.6.35 /opt/gsa-tv/control-plane >/tmp/build-1635.log
sudo sed -i 's#gsa-tv/control-plane:1\.6\.34#gsa-tv/control-plane:1.6.35#' /opt/gsa-tv/control-plane/compose.yml
sudo docker compose -p control-plane --project-directory /opt/gsa-tv/control-plane -f /opt/gsa-tv/control-plane/compose.yml up -d --force-recreate
for i in $(seq 1 45);do curl -fsS http://127.0.0.1:9202/health >/tmp/health-1635.json 2>/dev/null&&break;sleep 2;done
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'|awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
job=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)values('ch-main','graphics_reload','pending',0,'{\"source\":\"logo_topmost_absolute\"}'::jsonb)returning id;")
for i in $(seq 1 40);do row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,coalesce(error_message,'') from public.gsa_tv_jobs where id='$job';");case "$row" in completed'|'*)break;;failed'|'*)echo "$row";exit 1;;esac;sleep 1;done
sleep 8
cmd=$(sudo docker top gsa-tv-control-plane -eo args | grep -F 'rtmp://a.rtmp.youtube.com' | head -1)
case "$cmd" in *"dashboard_card"*) true;; *) true;; esac
printf '%s\n' "$cmd" | grep -o 'overlay=W-w-24:24:format=auto' | tail -1
printf '%s\n' "$cmd" | awk '{print index($0,"overlay=W-w-24:24:format=auto") "|" index($0,"CLIMA E TEMPO") "|" index($0,"MERCADOS")}'
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select quality_profile,status,playout_state,signal_state,coalesce(last_error,'')from public.gsa_tv_channels where id='ch-main';"
sudo docker inspect gsa-tv-control-plane --format 'container={{.State.Status}}|health={{.State.Health.Status}}|image={{.Config.Image}}'
`;
const result=await runSshScript(script,160000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
