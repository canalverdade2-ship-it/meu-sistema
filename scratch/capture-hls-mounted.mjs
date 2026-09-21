import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -eu
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -loglevel error -y -t 20 -i /runtime/hls/program.m3u8 -map 0:a:0 -c:a pcm_s24le -ar 48000 -ac 2 /runtime/audit-hls-current-20s.wav
for i in $(seq 1 10); do test -s /opt/gsa-tv/runtime/audit-hls-current-20s.wav && break; sleep 1; done
sudo chown opc:opc /opt/gsa-tv/runtime/audit-hls-current-20s.wav
ls -lh /opt/gsa-tv/runtime/audit-hls-current-20s.wav`,40000);process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
