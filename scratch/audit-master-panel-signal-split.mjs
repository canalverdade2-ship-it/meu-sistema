import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -u
printf '%s\n' '=== FRONTEND/PREVIEW REFERENCES ==='
sudo grep -RniE 'program\.m3u8|preview|hls|9202|8787|9210|rtmp|video' /opt/gsa-tv/control-plane/public /opt/gsa-tv/control-plane/src 2>/dev/null | grep -Ei 'preview|program\.m3u8|monitor|serve|proxy' | head -n 400
printf '%s\n' '=== HLS READERS/SOCKETS ==='
sudo lsof /opt/gsa-tv/runtime/hls/program.m3u8 /opt/gsa-tv/runtime/hls/program_*.ts 2>/dev/null | head -n 100 || true
sudo nsenter -t 1 -n ss -tnp | grep -E ':9202|:9210|:8787|:1935' | head -n 200 || true
printf '%s\n' '=== FFPLAYOUT STATUS/PROCESSES ==='
sudo docker top gsa-tv-ffplayout -eo pid,ppid,etimes,%cpu,%mem,args 2>/dev/null || true
printf '%s\n' '=== ALL FFMPEG PUBLISHERS/RELAYS ==='
sudo ps -eo pid,ppid,etimes,%cpu,%mem,args | grep -E '[f]fmpeg|[f]fplayout' | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g'
`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
