import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -e
database_url=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
old=$(sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -qAt -c "select config->>'youtube_video_id' from public.gsa_tv_channels where id='ch-main'")
echo "old_video_id=$old"
sudo docker run --rm --network host postgres:15-alpine psql "$database_url" -X -v ON_ERROR_STOP=1 -qAt -c "update public.gsa_tv_channels set config=jsonb_set(coalesce(config,'{}'::jsonb),'{youtube_video_id}',to_jsonb('soeRG2L70ys'::text),true),updated_at=now() where id='ch-main' returning config->>'youtube_video_id'"
sleep 35
echo '=== PANEL API YOUTUBE STATE ==='
curl -fsS http://127.0.0.1:9202/api/channel/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps({"youtube":d.get("youtube"),"channel":{k:(d.get("channel") or {}).get(k) for k in ("status","desired_state","playout_state","signal_state")}},ensure_ascii=False))' || true
echo '=== RTMP STILL SINGLE ==='
sudo docker top gsa-tv-encoder-engine -eo pid,args | grep -c '[a]\.rtmp\.youtube\.com/live2' || true
`, 60000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
