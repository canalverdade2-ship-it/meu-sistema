import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -euo pipefail
STAMP=$(date +%Y%m%d%H%M%S)
WORK=$(mktemp -d /tmp/gsa-canonical.XXXXXX)
trap 'rm -rf "$WORK"' EXIT
sudo cp -a /opt/gsa-tv/control-plane/src/app.js "/opt/gsa-tv/control-plane/src/app.js.pre-single-owner-$STAMP"
sudo cp -a /opt/gsa-tv/control-plane/Dockerfile "/opt/gsa-tv/control-plane/Dockerfile.pre-single-owner-$STAMP"
sudo cp -a /opt/gsa-tv/control-plane/compose.yml "/opt/gsa-tv/control-plane/compose.yml.pre-single-owner-$STAMP"
sudo docker cp gsa-tv-control-plane:/app/src/app.js "$WORK/app.js"
sudo install -o root -g root -m 0644 "$WORK/app.js" /opt/gsa-tv/control-plane/src/app.js
if [ -f /opt/gsa-tv/control-plane/bin/encoder-client.js ]; then
  sudo mv /opt/gsa-tv/control-plane/bin/encoder-client.js "/opt/gsa-tv/control-plane/bin/encoder-client.js.disabled-legacy-$STAMP"
  sudo chmod 0600 "/opt/gsa-tv/control-plane/bin/encoder-client.js.disabled-legacy-$STAMP"
fi
sudo sed -i 's|^COPY bin/ ./bin/|# Legacy direct RTMP publisher intentionally excluded; Encoder Engine is the sole owner.|' /opt/gsa-tv/control-plane/Dockerfile
sudo sed -i 's|image: gsa-tv/control-plane:1.7.2|image: gsa-tv/control-plane:1.7.4|' /opt/gsa-tv/control-plane/compose.yml
node --check /opt/gsa-tv/control-plane/src/app.js
! sudo grep -q 'spawn("/app/bin/encoder-client.js"' /opt/gsa-tv/control-plane/src/app.js
sudo grep -q 'encoderEngineRequest("/v1/ensure", "POST"' /opt/gsa-tv/control-plane/src/app.js
! sudo grep -q '^COPY bin/' /opt/gsa-tv/control-plane/Dockerfile
sudo grep -q 'image: gsa-tv/control-plane:1.7.4' /opt/gsa-tv/control-plane/compose.yml
sudo docker build -q -t gsa-tv/control-plane:1.7.4-canonical-check /opt/gsa-tv/control-plane >/dev/null
sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.7.4-canonical-check -lc 'test ! -e /app/bin/encoder-client.js && grep -q "/v1/ensure" /app/src/app.js'
echo CANONICAL_FIX_PASS
echo "backup_stamp=$STAMP"
sudo grep -nE 'image:|ENCODER_ENGINE_URL' /opt/gsa-tv/control-plane/compose.yml
sudo grep -nE 'Legacy direct|COPY bin' /opt/gsa-tv/control-plane/Dockerfile
sudo grep -nE 'encoderEngineRequest\\("/v1/ensure"|encoder-client' /opt/gsa-tv/control-plane/src/app.js | head -n 20
`,300000);
process.stdout.write(r.stdout); if(r.stderr) process.stderr.write(r.stderr);
