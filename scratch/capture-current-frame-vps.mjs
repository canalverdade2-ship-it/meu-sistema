import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -eu
ffmpeg -hide_banner -loglevel error -y -i /opt/gsa-tv/runtime/hls/program.m3u8 -frames:v 1 -q:v 5 /tmp/gsa-current.jpg
stat -c 'SIZE=%s' /tmp/gsa-current.jpg
base64 -w0 /tmp/gsa-current.jpg
`, 120000);
process.stdout.write(result.stdout);
