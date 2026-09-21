import fs from 'node:fs';
import {runSshScript} from './ssh2-run.mjs';
const archive=fs.readFileSync(new URL('./gsa-news-2026-09-01.tar.gz',import.meta.url)).toString('base64');
const script=fs.readFileSync(new URL('./gsa-news-ai-generate.js',import.meta.url)).toString('base64');
const remote=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01
sudo install -d -m 0775 -o 989 -g 986 "$root/work" "$root/images" "$root/audio" "$root/video"
printf '%s' '${archive}' | base64 -d | sudo tar -xzf - -C "$root/work"
printf '%s' '${script}' | base64 -d | sudo docker exec -i gsa-tv-control-plane node -
`;
const r=await runSshScript(remote,2700000);
process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
