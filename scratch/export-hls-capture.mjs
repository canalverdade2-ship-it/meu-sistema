import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`sudo docker cp gsa-tv-encoder-engine:/tmp/hls-current-30s.wav /tmp/hls-current-30s.wav >/dev/null && sudo chown opc:opc /tmp/hls-current-30s.wav && ls -lh /tmp/hls-current-30s.wav`,20000);process.stdout.write(result.stdout||'');
