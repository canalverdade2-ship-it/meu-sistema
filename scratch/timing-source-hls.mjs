import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`date -u +'%Y-%m-%dT%H:%M:%S.%NZ'; stat -c 'hls_capture_end=%y' /opt/gsa-tv/runtime/audit-hls-current-20s.wav; ps -p 3980429 -o lstart=,etimes=`,20000);process.stdout.write(result.stdout||'');
