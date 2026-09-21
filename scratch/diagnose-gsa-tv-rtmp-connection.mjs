import {runSshScript} from './ssh2-run.mjs';const remote=String.raw`set -euo pipefail
echo 'SOCKETS'; sudo ss -tpn | grep -E 'ffmpeg|1935|443' | tail -30 || true
echo 'STREAM_PROC'; sudo ps -eo pid,stat,etimes,%cpu,cmd | grep -E '[f]fmpeg .*rtmp://a\.rtmp\.youtube\.com/live2/'
echo 'LOGS'; sudo docker logs --since 5m --tail 160 gsa-tv-control-plane 2>&1
`;const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
