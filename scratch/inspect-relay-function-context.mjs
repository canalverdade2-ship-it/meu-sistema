import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
sudo sed -n '1010,1065p' /opt/gsa-tv/control-plane/src/app.js
echo '=== TERMINATE ==='
sudo sed -n '400,445p' /opt/gsa-tv/control-plane/src/app.js
echo '=== CLIENT IN CONTAINER ==='
sudo docker exec gsa-tv-control-plane sha256sum /app/bin/encoder-client.js
sudo sha256sum /opt/gsa-tv/control-plane/bin/encoder-client.js
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
