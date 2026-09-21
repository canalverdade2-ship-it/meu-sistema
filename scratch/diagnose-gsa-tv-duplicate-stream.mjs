import {runSshScript} from './ssh2-run.mjs';
const remote=String.raw`set -euo pipefail
echo 'CONTAINERS'; sudo docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}'
echo 'FFMPEG_PROCESSES'; sudo ps -eo pid,ppid,lstart,cmd | grep -E '[f]fmpeg|[f]fplayout'
echo 'SYSTEMD'; sudo systemctl --no-pager --type=service --state=running | grep -Ei 'gsa|playout|ffmpeg|relay' || true
echo 'CONTROL_HEALTH'; curl -fsS http://127.0.0.1:8088/health || true
echo; echo 'RECENT_LOGS'; sudo docker logs --since 15m --tail 240 gsa-tv-control-plane 2>&1 | tail -240
`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
