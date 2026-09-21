import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(String.raw`set -euo pipefail
sudo docker run --rm --network gsa-tv-net -v /tmp:/capture gsa-tv/control-plane:1.6.7 ffmpeg -hide_banner -loglevel error -y -i http://gsa-tv-ffplayout:8787/public/1/live/stream.m3u8 -frames:v 1 /capture/gsa-tv-editorial-live.jpg
sudo base64 -w0 /tmp/gsa-tv-editorial-live.jpg
sudo rm -f /tmp/gsa-tv-editorial-live.jpg
`, 120000);
fs.writeFileSync(new URL('./gsa-tv-editorial-live.jpg', import.meta.url), Buffer.from(result.stdout.trim(), 'base64'));
console.log('Frame ao vivo capturado.');
