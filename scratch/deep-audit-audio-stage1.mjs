import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -u
printf '%s\n' '=== ENGINE STATUS ==='
engine_token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' /opt/gsa-tv/control-plane/.env)
curl -fsS -H "Authorization: Bearer $engine_token" http://127.0.0.1:9210/v1/status; echo
printf '%s\n' '=== PROCESSES ==='
sudo docker top gsa-tv-encoder-engine -eo pid,ppid,etimes,%cpu,%mem,args
printf '%s\n' '=== ENGINE SOURCE AUDIO/FFMPEG ==='
sudo grep -nEi 'ffmpeg|audio|aresample|async|alimiter|aac|sample_rate|sample_fmt|fifo|thread_queue|copyts|vsync|fps_mode|reconnect|flv|rtmp|pipe' /opt/gsa-tv/encoder-engine/src/app.js | head -n 500
printf '%s\n' '=== CONTROL PLANE PRODUCER SOURCE ==='
sudo grep -nEi 'ffmpeg|audio|aresample|async|alimiter|aac|sample_rate|sample_fmt|fifo|thread_queue|media_take|producer' /opt/gsa-tv/control-plane/src/app.js | head -n 500
printf '%s\n' '=== LOGS ENGINE 90M ==='
sudo docker logs --since 90m gsa-tv-encoder-engine 2>&1 | tail -n 600
printf '%s\n' '=== LOGS CONTROL 90M ==='
sudo docker logs --since 90m gsa-tv-control-plane 2>&1 | tail -n 500
`,120000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
