import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -eu
sudo docker exec gsa-tv-encoder-engine rm -f /tmp/hls-current-30s.wav
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -loglevel error -y -t 30 -i /runtime/hls/program.m3u8 -map 0:a:0 -c:a pcm_s24le -ar 48000 -ac 2 /tmp/hls-current-30s.wav
sudo docker cp gsa-tv-encoder-engine:/tmp/hls-current-30s.wav /tmp/hls-current-30s.wav >/dev/null
sudo chown opc:opc /tmp/hls-current-30s.wav
ls -lh /tmp/hls-current-30s.wav`,50000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
