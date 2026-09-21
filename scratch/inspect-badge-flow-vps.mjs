import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
grep -n 'applyGraphicsRuntime' /opt/gsa-tv/control-plane/src/app.js
sed -n '1025,1075p' /opt/gsa-tv/control-plane/src/app.js
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select id,name,enabled,updated_at from public.gsa_tv_graphics where id='70faed0c-f6b5-4b01-b80f-493bdbda6708';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo '=== producer zmq listen ==='
sudo ss -ltnp | grep ':5577' || true
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
