import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
for i in $(seq 1 30); do
  state=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -c "select status from public.gsa_tv_jobs where id='a81d2bdc-7032-4afa-ad7b-f26833cce795'")
  case "$state" in completed|failed) break;; esac
  sleep 2
done
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select id,status,coalesce(error_message,''),coalesce(result::text,'{}') from public.gsa_tv_jobs where id='a81d2bdc-7032-4afa-ad7b-f26833cce795'; select id,name,jsonb_array_length(items),is_active from public.gsa_tv_playlists where id in ('playlist-2026-09-01','playlist-2026-09-02') order by id;"
for f in /opt/gsa-tv/playlists/1/2026-09-01.json /opt/gsa-tv/playlists/1/2026-09-02.json; do
  sudo test -s "$f"
  sudo python3 -c 'import json,sys; j=json.load(open(sys.argv[1])); print("playlist_file|%s|items=%s|seconds=%s"%(sys.argv[1],len(j["program"]),sum(float(x.get("duration",0)) for x in j["program"])))' "$f"
done
curl -fsS http://127.0.0.1:9204/metrics | grep -E '^gsa_tv_(up|hls_up|black_detected|silence_detected|freeze_detected|signal_expected) '
`;

const result = await runSshScript(remote, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
