import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo '=== open incidents ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select severity,message,created_at from public.gsa_tv_incidents where channel_id='ch-main' and not resolved order by created_at desc;"
echo '=== silence >=3s in master ==='
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.8 ffmpeg -hide_banner -nostdin -i /media/1/editorial/gsa-hub-editorial-ep01.mp4 -vn -af silencedetect=n=-50dB:d=3 -f null - 2>&1 | grep -E 'silence_(start|end|duration)' || true
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
