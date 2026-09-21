import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
curl -fsS http://127.0.0.1:9210/health; echo
sudo python3 - <<'PY'
import json
d=json.load(open('/opt/gsa-tv/runtime/encoder-state.json'))
print('restored_in_state=',any('audio-restored.mp4' in str(x) for x in d.get('args',[])))
PY
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select drive_path,metadata->>'audio_restored' from public.gsa_tv_media_items where id='media-836c5fe7-e994-455c-bfa4-76b5a803d94c';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL"
echo "rtmp=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)"
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
