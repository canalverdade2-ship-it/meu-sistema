import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "update public.gsa_tv_graphics set enabled=true,updated_at=now() where id='70faed0c-f6b5-4b01-b80f-493bdbda6708';" | sudo docker run --rm -i --network host postgres:15-alpine psql -v ON_ERROR_STOP=1 "$DBURL" >/dev/null
printf 'AO VIVO' | sudo tee /opt/gsa-tv/runtime/gsa-tv-live-badge.txt >/dev/null
sudo docker exec -i gsa-tv-control-plane python3 - <<'PY'
import zmq
ctx=zmq.Context(); s=ctx.socket(zmq.REQ); s.setsockopt(zmq.LINGER,0)
s.setsockopt(zmq.SNDTIMEO,1500); s.setsockopt(zmq.RCVTIMEO,1500)
s.connect('tcp://127.0.0.1:5577')
commands=('drawbox@live_badge_box color 0xb91c1c@0.96','drawbox@live_badge_box x 1718','drawbox@live_badge_box y 268','drawbox@live_badge_box width 116','drawbox@live_badge_box height 34')
for c in commands:
    s.send_string(c); reply=s.recv_string()
    if not reply.startswith('0 '): raise SystemExit(reply)
PY
VALUE=$(echo "select enabled from public.gsa_tv_graphics where id='70faed0c-f6b5-4b01-b80f-493bdbda6708';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL")
test "$VALUE" = t
test "$(cat /opt/gsa-tv/runtime/gsa-tv-live-badge.txt)" = 'AO VIVO'
COUNT=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
test "$COUNT" -eq 1
echo "db_enabled=$VALUE"
echo "rtmp_publishers=$COUNT"
echo BADGE_ACTIVE_SYNCED
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
