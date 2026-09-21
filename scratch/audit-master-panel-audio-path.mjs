import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== REFERENCES TO LIVE HLS ==='
sudo grep -RniE 'program\\.m3u8|runtime/hls|/hls/' /opt/gsa-tv/control-plane/public /opt/gsa-tv/control-plane/src 2>/dev/null | head -n 80 || true
echo '=== VIDEO/AUDIO PLAYER FLAGS ==='
sudo grep -RniE '<video|muted|volume|audio|play\\(' /opt/gsa-tv/control-plane/public /opt/gsa-tv/control-plane/src 2>/dev/null | grep -Ei 'monitor|program|preview|video|muted|volume' | head -n 120 || true
echo '=== ACTIVE MEDIA PROCESSES ==='
sudo ps -eo pid,ppid,etimes,%cpu,args | grep -E '[f]fmpeg|[f]fplayout' | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g' | head -n 30
echo '=== HLS PLAYLIST HEADERS ==='
sudo sed -n '1,15p' /opt/gsa-tv/runtime/hls/program.m3u8 2>/dev/null || true
`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
