import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== REMOTE SOURCE HASHES ==='
sudo sha256sum /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/watchdog/src/app.js /opt/gsa-tv/encoder-engine/src/app.js /opt/gsa-tv/control-plane/compose.yml /opt/gsa-tv/watchdog/compose.yml /opt/gsa-tv/encoder-engine/compose.yml 2>/dev/null || true
echo '=== IMAGE LABELS ==='
for i in gsa-tv/control-plane:1.7.9 gsa-tv/encoder-engine:1.1.0 gsa-tv/watchdog:1.2.0; do sudo docker image inspect "$i" --format '{{json .Config.Labels}}|created={{.Created}}|id={{.Id}}' 2>/dev/null || true; done
echo '=== BACKUP ARCHIVE CONTENT CHECK LATEST ==='
latest=$(sudo find /opt/gsa-tv/backups/full -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)
echo "latest=$latest"
if [ -n "$latest" ]; then
  sudo tar -tzf "$latest/runtime-config.tgz" 2>/dev/null | grep -E 'encoder-engine|control-plane|watchdog|compose|runtime' | head -n 200 || true
  sudo sha256sum -c "$latest/manifest.sha256" 2>/dev/null | tail -n 20 || true
fi
echo '=== STALE/LEGACY COMPOSES ==='
sudo find /opt/gsa-tv -maxdepth 3 -type f -iname '*compose*.yml' -printf '%TY-%Tm-%Td %TH:%TM %p\n' | sort
sudo grep -RIlE 'control-plane:(1\.7\.[0-8]|latest)|encoder-engine:1\.0\.0|udp://127\.0\.0\.1:12345' /opt/gsa-tv --include='*.yml' --include='*.js' --include='*.md' 2>/dev/null | head -n 160
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
