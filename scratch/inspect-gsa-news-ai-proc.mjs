import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(String.raw`set -e
sudo docker top gsa-tv-control-plane -eo pid,etimes,cmd | grep -E 'node -$|PID' || true
sudo find /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01/video -maxdepth 1 -type f -printf '%f|%s\n' 2>/dev/null || true
`,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
