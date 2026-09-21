import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const b64=(v)=>Buffer.from(v).toString('base64');
const oldGraphics=`    if (layer.layer_type === "lower_third" && layer.config?.preset === "breaking")
      filters.push(
        \`[\${current}]drawbox=x=0:y=ih-190:w=iw:h=130:color=#b91c1c@0.96:t=fill,drawbox=x=0:y=ih-190:w=220:h=130:color=#7f1d1d@1:t=fill,drawtext=fontfile=\${font}:text='PLANTAO':fontcolor=white:fontsize=31:x=34:y=h-142,drawtext=fontfile=\${font}:textfile=\${file}:reload=1:fontcolor=white:fontsize=36:x=250:y=h-145[\${out}]\`,
      );
    else if (layer.layer_type === "lower_third")
      filters.push(
        \`[\${current}]drawbox=x=30:y=ih-180:w=iw-60:h=120:color=black@0.66:t=fill,drawtext=fontfile=\${font}:textfile=\${file}:reload=1:fontcolor=white:fontsize=36:x=55:y=h-145[\${out}]\`,
      );
    else if (layer.layer_type === "ticker") {
      const height = Math.max(38, Math.min(80, Number(layer.config?.height || 52)));
      const bottom = Math.max(0, Math.min(220, Number(layer.config?.bottom_offset || 0)));
      const fontSize = Math.max(18, Math.min(34, Number(layer.config?.font_size || 24)));
      const speed = Math.max(45, Math.min(240, Number(layer.config?.speed || 105)));
      const background = String(layer.config?.background || "black@0.78").replace(/[^#a-zA-Z0-9.@]/g, "");
      filters.push(
        \`[\${current}]drawbox=x=0:y=ih-\${height + bottom}:w=iw:h=\${height}:color=\${background}:t=fill,drawtext=fontfile=\${font}:textfile=\${file}:reload=1:fontcolor=white:fontsize=\${fontSize}:x=w-mod(t*\${speed}\\\\,w+text_w):y=h-\${bottom + Math.round((height + fontSize) / 2)}[\${out}]\`,
      );
    }`;
const newGraphics=`    if (layer.layer_type === "lower_third" && layer.config?.preset === "dashboard_backdrop")
      filters.push(
        \`[\${current}]drawbox=x=0:y=0:w=iw:h=ih:color=#06111f@0.97:t=fill,drawbox=x=0:y=0:w=iw:h=112:color=#0b2038@1:t=fill,drawbox=x=0:y=108:w=iw:h=4:color=#d2a744@1:t=fill,drawtext=fontfile=\${font}:text='GSA AGORA':fontcolor=white:fontsize=48:x=68:y=27,drawtext=fontfile=\${font}:text='INFORMACAO EM TEMPO REAL':fontcolor=#d2a744:fontsize=22:x=68:y=78,drawtext=fontfile=\${font}:text='%{localtime\\\\:%H\\\\:%M}':fontcolor=white:fontsize=38:x=w-text_w-72:y=38[\${out}]\`,
      );
    else if (layer.layer_type === "lower_third" && layer.config?.preset === "breaking")
      filters.push(
        \`[\${current}]drawbox=x=0:y=ih-190:w=iw:h=130:color=#b91c1c@0.96:t=fill,drawbox=x=0:y=ih-190:w=220:h=130:color=#7f1d1d@1:t=fill,drawtext=fontfile=\${font}:text='PLANTAO':fontcolor=white:fontsize=31:x=34:y=h-142,drawtext=fontfile=\${font}:textfile=\${file}:reload=1:fontcolor=white:fontsize=36:x=250:y=h-145[\${out}]\`,
      );
    else if (layer.layer_type === "lower_third")
      filters.push(
        \`[\${current}]drawbox=x=30:y=ih-180:w=iw-60:h=120:color=black@0.66:t=fill,drawtext=fontfile=\${font}:textfile=\${file}:reload=1:fontcolor=white:fontsize=36:x=55:y=h-145[\${out}]\`,
      );
    else if (layer.layer_type === "ticker" && layer.config?.preset === "dashboard_card") {
      const x = Math.max(0, Number(layer.config?.x || 60));
      const y = Math.max(0, Number(layer.config?.y || 160));
      const width = Math.max(300, Number(layer.config?.width || 800));
      const height = Math.max(150, Number(layer.config?.height || 400));
      const fontSize = Math.max(18, Math.min(34, Number(layer.config?.font_size || 28)));
      const accent = String(layer.config?.accent || "#d2a744").replace(/[^#a-zA-Z0-9]/g, "");
      const heading = String(layer.config?.heading || layer.name || "GSA TV").replace(/[^A-Za-z0-9 À-ÿ·—-]/g, "").slice(0, 48);
      filters.push(
        \`[\${current}]drawbox=x=\${x}:y=\${y}:w=\${width}:h=\${height}:color=#0d2239@0.98:t=fill,drawbox=x=\${x}:y=\${y}:w=8:h=\${height}:color=\${accent}@1:t=fill,drawbox=x=\${x + 8}:y=\${y}:w=\${width - 8}:h=64:color=#132f4d@1:t=fill,drawtext=fontfile=\${font}:text='\${heading}':fontcolor=\${accent}:fontsize=26:x=\${x + 30}:y=\${y + 18},drawtext=fontfile=\${font}:textfile=\${file}:reload=1:expansion=none:fontcolor=white:fontsize=\${fontSize}:line_spacing=14:x=\${x + 30}:y=\${y + 86}[\${out}]\`,
      );
    }
    else if (layer.layer_type === "ticker") {
      const height = Math.max(38, Math.min(80, Number(layer.config?.height || 52)));
      const bottom = Math.max(0, Math.min(220, Number(layer.config?.bottom_offset || 0)));
      const fontSize = Math.max(18, Math.min(34, Number(layer.config?.font_size || 24)));
      const speed = Math.max(45, Math.min(240, Number(layer.config?.speed || 105)));
      const background = String(layer.config?.background || "black@0.78").replace(/[^#a-zA-Z0-9.@]/g, "");
      filters.push(
        \`[\${current}]drawbox=x=0:y=ih-\${height + bottom}:w=iw:h=\${height}:color=\${background}:t=fill,drawtext=fontfile=\${font}:textfile=\${file}:reload=1:expansion=none:fontcolor=white:fontsize=\${fontSize}:x=w-mod(t*\${speed}\\\\,w+text_w):y=h-\${bottom + Math.round((height + fontSize) / 2)}[\${out}]\`,
      );
    }`;
const updater=fs.readFileSync(new URL('../infrastructure/gsa-tv/scripts/update-live-news-ticker.sh',import.meta.url),'utf8');
const script=String.raw`set -euo pipefail
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')" = 'gsa-tv/control-plane:1.6.32'
sudo cp /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/control-plane/src/app.js.bak-1633
printf '%s' '${b64(oldGraphics)}'|base64 -d >/tmp/gfx-old.txt
printf '%s' '${b64(newGraphics)}'|base64 -d >/tmp/gfx-new.txt
sudo node - <<'NODE'
const fs=require('fs');const p='/opt/gsa-tv/control-plane/src/app.js';let s=fs.readFileSync(p,'utf8');const a=fs.readFileSync('/tmp/gfx-old.txt','utf8'),b=fs.readFileSync('/tmp/gfx-new.txt','utf8');if(!s.includes(a))throw new Error('graphics block not found');s=s.replace(a,b);const lo='filters.push(\`[\${inputIndex}:v]scale=160:-1[\${scaled}]\`);';const ln='const logoWidth = Math.round(160 * (profile.height / 720));\n      filters.push(\`[\${inputIndex}:v]scale=\${logoWidth}:-1[\${scaled}]\`);';if(!s.includes(lo))throw new Error('logo scale not found');s=s.replace(lo,ln);fs.writeFileSync(p,s);
NODE
sudo node --check /opt/gsa-tv/control-plane/src/app.js
printf '%s' '${b64(updater)}'|base64 -d >/tmp/update-live-news-ticker.sh
sudo install -m 0755 -o root -g root /tmp/update-live-news-ticker.sh /opt/gsa-tv/bin/update-live-news-ticker.sh
sudo /opt/gsa-tv/bin/update-live-news-ticker.sh
sudo docker build -t gsa-tv/control-plane:1.6.33 /opt/gsa-tv/control-plane
sudo sed -i 's#gsa-tv/control-plane:1\.6\.32#gsa-tv/control-plane:1.6.33#' /opt/gsa-tv/control-plane/compose.yml
sudo docker compose -p control-plane --project-directory /opt/gsa-tv/control-plane -f /opt/gsa-tv/control-plane/compose.yml up -d --force-recreate
for i in $(seq 1 45);do curl -fsS http://127.0.0.1:9202/health >/tmp/health-1633.json 2>/dev/null&&break;sleep 2;done
cat /tmp/health-1633.json;echo
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'|awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
job_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','graphics_reload','pending',0,'{\"source\":\"gsa_info_wall_1080p\"}'::jsonb) returning id;")
for i in $(seq 1 45);do row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,coalesce(error_message,'') from public.gsa_tv_jobs where id='$job_id';");case "$row" in completed'|'*)break;;failed'|'*)echo "$row";exit 1;;esac;sleep 1;done
sleep 8
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select quality_profile,status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';select layer_type,name,enabled,config->>'preset' from public.gsa_tv_graphics where id in ('d8d61b70-c5a6-45e2-9cd9-f7bf81db217e','9f1d56ce-68f6-4f9c-8b91-c17c5f49d302','cbb0f824-87ba-45f7-a8b5-8f3d65268f3c','7bc9f31c-e50b-421c-896d-545a9cf3aa42','3b1cc764-fbaa-428a-b398-7cdf61c34120') order by layer_type,name;"
sudo docker top gsa-tv-control-plane -eo pid,args | grep -F 'scale=240:-1' | head -1
sudo docker inspect gsa-tv-control-plane --format 'container={{.State.Status}}|health={{.State.Health.Status}}|image={{.Config.Image}}'
`;
const result=await runSshScript(script,180000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
