import { runSshScript } from './ssh2-run.mjs';
const remote = String.raw`set -euo pipefail
page=$(curl -fsSL --max-time 12 -A 'Mozilla/5.0 GSA-TV-Monitor/1.0' 'https://www.youtube.com/watch?v=kX7gdLa1dK0')
if printf '%s' "$page" | grep -Eq '"isLiveNow"[[:space:]]*:[[:space:]]*true|"isLive"[[:space:]]*:[[:space:]]*true'; then echo youtube_public_live=true; else echo youtube_public_live=false; exit 1; fi
sudo docker inspect --format 'control={{.State.Status}}|{{.State.Health.Status}}|{{.Config.Image}}' gsa-tv-control-plane
`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
