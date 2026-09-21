import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(String.raw`set -e
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01
sudo find "$root" -maxdepth 2 -type f -printf '%P|%s\n' 2>/dev/null | sort || true
sudo docker ps --filter name=gsa-tv-control-plane --format '{{.Names}}|{{.Status}}'
`,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
