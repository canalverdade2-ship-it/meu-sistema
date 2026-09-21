import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const oldBlock = `    else if (layer.layer_type === "ticker")
      filters.push(
        \`[\${current}]drawbox=x=0:y=ih-64:w=iw:h=64:color=black@0.72:t=fill,drawtext=fontfile=\${font}:textfile=\${file}:reload=1:fontcolor=white:fontsize=28:x=w-mod(t*120\\,w+text_w):y=h-47[\${out}]\`,
      );`;
const newBlock = `    else if (layer.layer_type === "ticker") {
      const height = Math.max(38, Math.min(80, Number(layer.config?.height || 52)));
      const bottom = Math.max(0, Math.min(220, Number(layer.config?.bottom_offset || 0)));
      const fontSize = Math.max(18, Math.min(34, Number(layer.config?.font_size || 24)));
      const speed = Math.max(45, Math.min(240, Number(layer.config?.speed || 105)));
      const background = String(layer.config?.background || "black@0.78").replace(/[^#a-zA-Z0-9.@]/g, "");
      filters.push(
        \`[\${current}]drawbox=x=0:y=ih-\${height + bottom}:w=iw:h=\${height}:color=\${background}:t=fill,drawtext=fontfile=\${font}:textfile=\${file}:reload=1:fontcolor=white:fontsize=\${fontSize}:x=w-mod(t*\${speed}\\\\,w+text_w):y=h-\${bottom + Math.round((height + fontSize) / 2)}[\${out}]\`,
      );
    }`;
const b64 = (value) => Buffer.from(value).toString('base64');
const updater = fs.readFileSync(new URL('../infrastructure/gsa-tv/scripts/update-live-news-ticker.sh', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../infrastructure/gsa-tv/systemd/gsa-tv-news-ticker.service', import.meta.url), 'utf8');
const timer = fs.readFileSync(new URL('../infrastructure/gsa-tv/systemd/gsa-tv-news-ticker.timer', import.meta.url), 'utf8');

const script = String.raw`set -euo pipefail
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')" = 'gsa-tv/control-plane:1.6.30'
sudo cp /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/control-plane/src/app.js.bak-1631
printf '%s' '${b64(oldBlock)}' | base64 -d >/tmp/ticker-old.txt
printf '%s' '${b64(newBlock)}' | base64 -d >/tmp/ticker-new.txt
sudo node - <<'NODE'
const fs=require('fs');
const p='/opt/gsa-tv/control-plane/src/app.js';
const old=fs.readFileSync('/tmp/ticker-old.txt','utf8');
const neu=fs.readFileSync('/tmp/ticker-new.txt','utf8');
const src=fs.readFileSync(p,'utf8');
if(src.includes(old)) fs.writeFileSync(p,src.replace(old,neu));
else if(!src.includes(neu)) throw new Error('ticker block not found');
NODE
sudo node --check /opt/gsa-tv/control-plane/src/app.js

printf '%s' '${b64(updater)}' | base64 -d >/tmp/update-live-news-ticker.sh
printf '%s' '${b64(service)}' | base64 -d >/tmp/gsa-tv-news-ticker.service
printf '%s' '${b64(timer)}' | base64 -d >/tmp/gsa-tv-news-ticker.timer
sudo install -m 0755 -o root -g root /tmp/update-live-news-ticker.sh /opt/gsa-tv/bin/update-live-news-ticker.sh
sudo install -m 0644 -o root -g root /tmp/gsa-tv-news-ticker.service /etc/systemd/system/gsa-tv-news-ticker.service
sudo install -m 0644 -o root -g root /tmp/gsa-tv-news-ticker.timer /etc/systemd/system/gsa-tv-news-ticker.timer

dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -c "update public.gsa_tv_channels set quality_profile='1080p30',updated_at=now() where id='ch-main';"

sudo /opt/gsa-tv/bin/update-live-news-ticker.sh
sudo docker build -t gsa-tv/control-plane:1.6.31 /opt/gsa-tv/control-plane
sudo sed -i 's#gsa-tv/control-plane:1\.6\.30#gsa-tv/control-plane:1.6.31#' /opt/gsa-tv/control-plane/compose.yml
sudo systemctl daemon-reload
sudo systemctl enable --now gsa-tv-news-ticker.timer
sudo docker compose -p control-plane --project-directory /opt/gsa-tv/control-plane -f /opt/gsa-tv/control-plane/compose.yml up -d --force-recreate
for i in $(seq 1 45); do curl -fsS http://127.0.0.1:9202/health >/tmp/health-1631.json 2>/dev/null && break; sleep 2; done
cat /tmp/health-1631.json; echo

# Força a reconstrução do relay com os quatro feeds e o novo perfil.
job_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','graphics_reload','pending',0,'{\"source\":\"four_live_feeds_1080p\"}'::jsonb) returning id;")
for i in $(seq 1 45); do row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id';"); case "$row" in completed'|'*) break;; failed'|'*) echo "$row"; exit 1;; esac; sleep 1; done
echo "graphics_reload|$job_id|$row"
sleep 10
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select 'channel',quality_profile,status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'; select 'feed',name,enabled,left(text_content,180),config from public.gsa_tv_graphics where id in ('9f1d56ce-68f6-4f9c-8b91-c17c5f49d302','cbb0f824-87ba-45f7-a8b5-8f3d65268f3c','7bc9f31c-e50b-421c-896d-545a9cf3aa42','3b1cc764-fbaa-428a-b398-7cdf61c34120') order by config->>'bottom_offset';"
sudo docker top gsa-tv-control-plane -eo pid,args | grep -E -- '-s 1920x1080|-b:v 6000k|gsa-tv-.*txt' | head -5 || true
sudo systemctl is-active gsa-tv-news-ticker.timer
sudo systemctl is-enabled gsa-tv-news-ticker.timer
sudo docker inspect gsa-tv-control-plane --format 'container={{.State.Status}}|health={{.State.Health.Status}}|image={{.Config.Image}}'
`;
const result = await runSshScript(script, 240000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
