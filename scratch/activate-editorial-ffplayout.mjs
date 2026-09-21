import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
sudo node <<'NODE'
const fs=require('node:fs');
(async()=>{
 const password=fs.readFileSync('/opt/gsa-tv/control-plane/secrets/ffplayout-admin-password','utf8').trim();
 const login=await fetch('http://127.0.0.1:8787/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password})});
 const auth=await login.json(); if(!login.ok||!auth.access) throw new Error('ffplayout login failed '+login.status);
 const r=await fetch('http://127.0.0.1:8787/api/control/1/process',{method:'POST',headers:{authorization:'Bearer '+auth.access,'content-type':'application/json'},body:JSON.stringify({command:'restart'})});
 const body=await r.text(); if(!r.ok) throw new Error('ffplayout restart failed '+r.status+' '+body.slice(0,200));
 console.log('FFPLAYOUT_RESTART_ACCEPTED');
})().catch(e=>{console.error(e.message);process.exit(1)});
NODE
sleep 25
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo '=== verify ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,''),last_signal_at from public.gsa_tv_channels where id='ch-main'; select 'watchdog',created_at,current_title,control_plane_ok,ffplayout_ok,hls_ok,black_detected,silence_detected,freeze_detected from public.gsa_tv_watchdog_samples where channel_id='ch-main' order by created_at desc limit 4; select 'asrun',title,source,outcome,started_at,coalesce(ended_at::text,'') from public.gsa_tv_execution_log where channel_id='ch-main' order by started_at desc limit 4;"
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
