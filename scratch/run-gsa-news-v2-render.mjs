import fs from 'node:fs';import {runSshScript} from './ssh2-run.mjs';
const worker=fs.readFileSync(new URL('./gsa-news-v2-render.js',import.meta.url)).toString('base64');
const remote=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2
sudo install -d -m 0775 -o 989 -g 986 "$root/rendered"
printf '%s' '${worker}' | base64 -d | sudo tee "$root/work/render.js" >/dev/null
sudo chown 989:986 "$root/work/render.js"
sudo docker run --rm --name gsa-news-v2-render --cpus=0.75 --memory=3g --user 989:986 -e NODE_PATH=/app/node_modules -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.13 node /media/1/news/gsa-news-2026-09-01-v2/work/render.js
`;
const r=await runSshScript(remote,3600000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
