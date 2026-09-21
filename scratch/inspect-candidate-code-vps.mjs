import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== engine 1.2 critical functions ==='
sudo grep -nE 'operation|mutex|queue|async function ensure|async function stopAll|health|restore|lock|HLS|STATE_FILE|PIPE|UDP|createServer' /opt/gsa-tv/encoder-engine/src/app.js | head -n 300
sudo sed -n '1,330p' /opt/gsa-tv/encoder-engine/src/app.js
echo '=== watchdog 1.3 candidate source location/hash ==='
sudo docker run --rm --entrypoint sh gsa-tv/watchdog:1.3.0 -lc "sha256sum /app/src/app.js 2>/dev/null || sha256sum /app/app.js; grep -nE 'ENGINE|FINAL_HLS|HLS_URL|health|recover|execution|setInterval' /app/src/app.js /app/app.js 2>/dev/null | head -n 260"
echo '=== CP 1.8 candidate critical functions ==='
sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.8.0 -lc "sha256sum /app/src/app.js 2>/dev/null || sha256sum /app/app.js; grep -nE 'media_take|approval_state|lease|restoreRuntime|retry|abandoned|encoderEngine|live_badge|serviceHealth' /app/src/app.js /app/app.js 2>/dev/null | head -n 340"
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
