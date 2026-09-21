import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -u
sudo docker exec gsa-tv-encoder-engine ls -lh /tmp/gsa-news-live-audio-30s.wav 2>&1 || true
sudo docker exec gsa-tv-encoder-engine ffprobe -v error -show_entries format=duration,size -of default=nw=1 /tmp/gsa-news-live-audio-30s.wav 2>&1 || true
cat /tmp/gsa-news-live-capture.log 2>/dev/null || true
`,20000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
