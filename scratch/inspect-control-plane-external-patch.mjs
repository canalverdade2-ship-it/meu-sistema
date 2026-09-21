import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
echo '=== HOST SOURCE MARKERS ==='
sudo grep -nE 'ENCODER_ENGINE_URL|encoderEngineRequest|encoder-client|spawn\("ffmpeg"|async function startRelay|async function terminateRelay' /opt/gsa-tv/control-plane/src/app.js | head -100 || true
echo '=== CONTAINER SOURCE MARKERS ==='
sudo docker exec gsa-tv-control-plane sh -lc "grep -nE 'ENCODER_ENGINE_URL|encoderEngineRequest|encoder-client|spawn\\(\"ffmpeg\"|async function startRelay|async function terminateRelay' /app/src/app.js | head -100" || true
echo '=== COMPOSE ==='
sudo sed -n '1,180p' /opt/gsa-tv/control-plane/compose.yml
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
