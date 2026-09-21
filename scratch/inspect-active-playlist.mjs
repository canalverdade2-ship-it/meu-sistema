import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
day=$(TZ=America/Sao_Paulo date +%Y-%m-%d)
echo "day=$day"
echo '=== playlist files ==='
sudo find /opt/gsa-tv/playlists/1 -maxdepth 1 -type f -printf '%f|%s|%y\n' | sort | tail -6
echo '=== editorial refs ==='
sudo grep -R -n -m 5 'gsa-hub-editorial-ep01.mp4' /opt/gsa-tv/playlists/1 || true
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
