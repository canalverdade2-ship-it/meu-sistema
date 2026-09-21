import fs from 'node:fs';import {runSshScript} from './ssh2-run.mjs';
const worker=fs.readFileSync(new URL('./gsa-news-v2-generate.js',import.meta.url)).toString('base64');
const remote=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2
sudo install -d -m 0775 -o 989 -g 986 "$root/work" "$root/images" "$root/audio" "$root/video"
printf '%s' '${worker}' | base64 -d | sudo tee "$root/work/generate.js" >/dev/null
sudo chown 989:986 "$root/work/generate.js"
sudo docker exec -e NODE_PATH=/app/node_modules -e SKIP_IMAGES=1 gsa-tv-control-plane node /media/1/news/gsa-news-2026-09-01-v2/work/generate.js
`;
const r=await runSshScript(remote,3600000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
