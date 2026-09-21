import { runSshScript } from './ssh2-run.mjs';
const oldBackdrop=`[\${current}]drawbox=x=0:y=0:w=iw:h=ih:color=#06111f@0.97:t=fill,drawbox=x=0:y=0:w=iw:h=112:color=#0b2038@1:t=fill,drawbox=x=0:y=108:w=iw:h=4:color=#d2a744@1:t=fill,drawtext=fontfile=\${font}:text='GSA AGORA':fontcolor=white:fontsize=48:x=68:y=27,drawtext=fontfile=\${font}:text='INFORMACAO EM TEMPO REAL':fontcolor=#d2a744:fontsize=22:x=68:y=78,drawtext=fontfile=\${font}:text='%{localtime\\\\:%H\\\\:%M}':fontcolor=white:fontsize=38:x=w-text_w-72:y=38[\${out}]`;
const newBackdrop=`[\${current}]drawbox=x=0:y=0:w=iw:h=ih:color=#06111f@0.97:t=fill,drawbox=x='mod(t*95\\\\,w+520)-520':y=112:w=520:h=ih-112:color=#1f70a8@0.07:t=fill,drawbox=x=0:y=0:w=iw:h=112:color=#0b2038@1:t=fill,drawbox=x='mod(t*280\\\\,w+240)-240':y=108:w=240:h=4:color=#f1c761@1:t=fill,drawtext=fontfile=\${font}:text='GSA AGORA':fontcolor=white:fontsize=48:x=68:y=27,drawtext=fontfile=\${font}:text='INFORMACAO EM TEMPO REAL':fontcolor=#d2a744:fontsize=22:x=68:y=78,drawbox=x=w-360:y=28:w=118:h=52:color=#b91c1c@0.96:t=fill:enable='lt(mod(t\\\\,2)\\\\,1.3)',drawtext=fontfile=\${font}:text='AO VIVO':fontcolor=white:fontsize=24:x=w-344:y=42:enable='lt(mod(t\\\\,2)\\\\,1.3)',drawtext=fontfile=\${font}:text='%{localtime\\\\:%H\\\\:%M\\\\:%S}':fontcolor=white:fontsize=34:x=w-text_w-54:y=39[\${out}]`;
const oldCard=`[\${current}]drawbox=x=\${x}:y=\${y}:w=\${width}:h=\${height}:color=#0d2239@0.98:t=fill,drawbox=x=\${x}:y=\${y}:w=8:h=\${height}:color=\${accent}@1:t=fill,drawbox=x=\${x + 8}:y=\${y}:w=\${width - 8}:h=64:color=#132f4d@1:t=fill,drawtext=fontfile=\${font}:text='\${heading}':fontcolor=\${accent}:fontsize=26:x=\${x + 30}:y=\${y + 18},drawtext=fontfile=\${font}:textfile=\${file}:reload=1:expansion=none:fontcolor=white:fontsize=\${fontSize}:line_spacing=14:x=\${x + 30}:y=\${y + 86}[\${out}]`;
const newCard=`[\${current}]drawbox=x=\${x}:y=\${y}:w=\${width}:h=\${height}:color=#0d2239@0.98:t=fill,drawbox=x='\${x}+mod(t*72\\\\,\${width + 150})-150':y=\${y}:w=150:h=\${height}:color=\${accent}@0.055:t=fill,drawbox=x=\${x}:y=\${y}:w=8:h=\${height}:color=\${accent}@1:t=fill,drawbox=x=\${x + 8}:y=\${y}:w=\${width - 8}:h=64:color=#132f4d@1:t=fill,drawtext=fontfile=\${font}:text='\${heading}':fontcolor=\${accent}:fontsize=26:x=\${x + 30}:y=\${y + 18},drawtext=fontfile=\${font}:text='ATUALIZADO':fontcolor=white:fontsize=15:alpha='0.45+0.55*abs(sin(PI*t))':x=\${x + width - 120}:y=\${y + 25},drawtext=fontfile=\${font}:textfile=\${file}:reload=1:expansion=none:fontcolor=white:fontsize=\${fontSize}:line_spacing=14:x=\${x + 30}:y=\${y + 86}[\${out}]`;
const b64=v=>Buffer.from(v).toString('base64');
const updater=await import('node:fs').then(({default:fs})=>fs.readFileSync(new URL('../infrastructure/gsa-tv/scripts/update-live-news-ticker.sh',import.meta.url),'utf8'));
const script=String.raw`set -euo pipefail
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')" = 'gsa-tv/control-plane:1.6.35'
sudo cp /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/control-plane/src/app.js.bak-1636
sudo node - <<'NODE'
const fs=require('fs');const p='/opt/gsa-tv/control-plane/src/app.js';let s=fs.readFileSync(p,'utf8');const a=Buffer.from('${b64(oldBackdrop)}','base64').toString(),b=Buffer.from('${b64(newBackdrop)}','base64').toString(),c=Buffer.from('${b64(oldCard)}','base64').toString(),d=Buffer.from('${b64(newCard)}','base64').toString();if(!s.includes(a)||!s.includes(c))throw new Error('motion insertion point missing');s=s.replace(a,b).replace(c,d);fs.writeFileSync(p,s);
NODE
sudo node --check /opt/gsa-tv/control-plane/src/app.js
printf '%s' '${b64(updater)}'|base64 -d >/tmp/update-live-news-ticker.sh
sudo install -m 0755 -o root -g root /tmp/update-live-news-ticker.sh /opt/gsa-tv/bin/update-live-news-ticker.sh
sudo /opt/gsa-tv/bin/update-live-news-ticker.sh
sudo docker build -t gsa-tv/control-plane:1.6.36 /opt/gsa-tv/control-plane >/tmp/build-1636.log
sudo sed -i 's#gsa-tv/control-plane:1\.6\.35#gsa-tv/control-plane:1.6.36#' /opt/gsa-tv/control-plane/compose.yml
sudo docker compose -p control-plane --project-directory /opt/gsa-tv/control-plane -f /opt/gsa-tv/control-plane/compose.yml up -d --force-recreate
for i in $(seq 1 45);do curl -fsS http://127.0.0.1:9202/health >/tmp/health-1636.json 2>/dev/null&&break;sleep 2;done
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}'|awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
job=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)values('ch-main','graphics_reload','pending',0,'{\"source\":\"dashboard_motion\"}'::jsonb)returning id;")
for i in $(seq 1 40);do row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select status,coalesce(error_message,'') from public.gsa_tv_jobs where id='$job';");case "$row" in completed'|'*)break;;failed'|'*)echo "$row";exit 1;;esac;sleep 1;done
sleep 8
cmd=$(sudo docker top gsa-tv-control-plane -eo pid,args|grep -F 'rtmp://a.rtmp.youtube.com'|head -1)
printf '%s' "$cmd"|grep -F "ATUALIZADO" >/dev/null
printf '%s' "$cmd"|grep -F "mod(t*95" >/dev/null
logo=$(printf '%s' "$cmd"|awk '{print index($0,"overlay=W-w-24:24:format=auto")}');card=$(printf '%s' "$cmd"|awk '{print index($0,"MERCADOS")}');test "$logo" -gt "$card"
echo "motion=confirmed|logo_topmost=confirmed"
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select quality_profile,status,playout_state,signal_state,coalesce(last_error,'')from public.gsa_tv_channels where id='ch-main';"
sudo docker inspect gsa-tv-control-plane --format 'container={{.State.Status}}|health={{.State.Health.Status}}|image={{.Config.Image}}'
`;
const result=await runSshScript(script,160000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
