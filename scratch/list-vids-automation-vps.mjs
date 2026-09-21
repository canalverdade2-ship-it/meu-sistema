import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
find /home/opc/gsa-ai -maxdepth 2 -type f -name '*.js' -printf '%p\n' | grep -Ei 'vids|narr|voice|scene' | sort
echo '=== NEWS 09-02 FINAL ==='
find /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-02 -maxdepth 3 -type f -printf '%p %s\n' | tail -n 80
echo '=== CHANNEL DB STATE ==='
DBURL=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "SELECT id,status,desired_state,signal_state,playout_state,last_error,updated_at FROM gsa_tv_channels WHERE id=1;" | sudo docker run --rm -i --network host postgres:15-alpine psql "$DBURL"
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
