import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== current producer exact AF ==='
sudo docker exec gsa-tv-encoder-engine sh -lc 'for f in /proc/[0-9]*/cmdline; do c=$(tr "\\0" " " <"$f" 2>/dev/null); case "$c" in ffmpeg*"adeclick"*) echo "$c";; esac; done' | sed -n 's/.* -af \\([^ ]*\\) .*/\\1/p'
echo '=== HLS full cycle ebur ==='
sudo docker exec gsa-tv-encoder-engine timeout 50 ffmpeg -hide_banner -nostdin -i /runtime/hls/program.m3u8 -map 0:a:0 -t 38 -af ebur128=peak=true -f null - 2>&1 | tail -n 22 || true
echo '=== HLS astats ==='
sudo docker exec gsa-tv-encoder-engine timeout 50 ffmpeg -hide_banner -nostdin -i /runtime/hls/program.m3u8 -map 0:a:0 -t 38 -af astats=metadata=0:reset=0 -f null - 2>&1 | grep -E 'Peak level dB|RMS level dB|Number of samples' | tail -n 12 || true
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
