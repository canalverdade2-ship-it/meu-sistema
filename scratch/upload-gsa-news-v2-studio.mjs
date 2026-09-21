import fs from 'node:fs';import {runSshScript} from './ssh2-run.mjs';
const data=fs.readFileSync(new URL('./gsa-news-v2-studio.png',import.meta.url)).toString('base64');
const remote=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2
printf '%s' '${data}' | base64 -d | sudo tee "$root/images/studio.png" >/dev/null
sudo chown 989:986 "$root/images/studio.png"; sudo chmod 0644 "$root/images/studio.png"
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.6.12 ffprobe -v error -show_entries stream=width,height,pix_fmt -of default=nw=1 /media/1/news/gsa-news-2026-09-01-v2/images/studio.png
`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
