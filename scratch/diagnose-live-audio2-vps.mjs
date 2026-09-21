import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== host ffmpeg command ==='
type -a ffmpeg || true
command -v ffmpeg | xargs -r sudo sed -n '1,120p' || true
echo '=== engine ffmpeg processes ==='
sudo docker exec gsa-tv-encoder-engine sh -lc 'for f in /proc/[0-9]*/cmdline; do c=$(tr "\\0" " " <"$f"); case "$c" in *ffmpeg*) echo "$f $c";; esac; done' | sed -E 's#(live2/)[^ ]+#\\1[REDACTED]#g'
echo '=== locate media id ==='
sudo grep -RIl 'media-836c5fe7-e994-455c-bfa4-76b5a803d94c' /opt/gsa-tv/runtime /opt/gsa-tv/playlists 2>/dev/null | head -n 50
echo '=== state args inputs only ==='
sudo python3 - <<'PY'
import json
p='/opt/gsa-tv/runtime/encoder-state.json'
d=json.load(open(p))
a=d.get('args',[])
for i,x in enumerate(a):
    if x in ('-i','-af','-filter_complex','-ar','-ac','-b:a','-c:a','-f') and i+1<len(a):
        y=a[i+1]
        if 'rtmp' in str(y): y='[RTMP REDACTED]'
        print(x, y)
PY
echo '=== direct engine audio stats 15s ==='
sudo docker exec gsa-tv-encoder-engine timeout 20 ffmpeg -hide_banner -nostdin -loglevel info -i 'udp://127.0.0.1:12345?fifo_size=1000000&overrun_nonfatal=1&reuse=1' -map 0:a:0 -t 15 -af 'astats=metadata=0:reset=0' -f null - 2>&1 | tail -n 100 || true
echo '=== current media files recent ==='
sudo find /opt/gsa-tv/cache/media -type f -mmin -180 -printf '%TY-%Tm-%Td %TH:%TM:%TS %s %p\\n' 2>/dev/null | sort -r | head -n 40
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
