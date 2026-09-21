import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo cp -a /opt/gsa-tv/encoder-engine/Dockerfile /opt/gsa-tv/audit-archive/encoder-engine-Dockerfile.pre-1.1.0-$(date +%Y%m%d%H%M%S)
sudo sed -i 's|^FROM gsa-tv/control-plane:1.6.39|FROM gsa-tv/control-plane:1.7.6|' /opt/gsa-tv/encoder-engine/Dockerfile
sudo docker build --no-cache -q -t gsa-tv/encoder-engine:1.1.0 /opt/gsa-tv/encoder-engine >/dev/null
sudo docker run --rm --entrypoint node gsa-tv/encoder-engine:1.1.0 --check /app/src/app.js
echo ENGINE_PIPE_BUILD_PASS
sudo grep -nE 'wireProducer|pipe:0|pipe:1' /opt/gsa-tv/encoder-engine/src/app.js
`,360000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
