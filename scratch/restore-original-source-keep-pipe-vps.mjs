import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
RESTORED=/media/1/normalized/media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30-audio-restored.mp4
ORIGINAL=/media/1/normalized/media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30.mp4
OUTER_BEFORE=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "update public.gsa_tv_media_items set drive_path='$ORIGINAL', metadata=(coalesce(metadata,'{}'::jsonb)-'audio_restored'), updated_at=now() where id='media-836c5fe7-e994-455c-bfa4-76b5a803d94c';" | sudo docker run --rm -i --network host postgres:15-alpine psql -v ON_ERROR_STOP=1 "$DBURL" >/dev/null
TOKEN=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="ENCODER_ENGINE_TOKEN"{sub(/^ENCODER_ENGINE_TOKEN=/,"");print;exit}')
sudo python3 - <<PY >/tmp/gsa-original-ensure.json
import json
d=json.load(open('/opt/gsa-tv/runtime/encoder-state.json'))
d['args']=['$ORIGINAL' if x=='$RESTORED' else x for x in d['args']]
print(json.dumps({'args':d['args'],'mode':d.get('mode','program')}))
PY
curl -fsS -X POST http://127.0.0.1:9210/v1/ensure -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data-binary @/tmp/gsa-original-ensure.json >/dev/null
rm -f /tmp/gsa-original-ensure.json
sleep 6
OUTER_AFTER=$(ps -eo pid=,args= | grep '[f]fmpeg' | grep 'rtmp://a.rtmp.youtube.com/live2/' | awk 'NR==1{print $1}')
test "$OUTER_BEFORE" = "$OUTER_AFTER"
test "$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)" -eq 1
curl -fsS http://127.0.0.1:9210/health | grep -q '"last_error":null'
echo "outer_pid_preserved=$OUTER_AFTER"
echo "source=original"
echo ORIGINAL_SOURCE_WITH_PIPE_LIVE
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
