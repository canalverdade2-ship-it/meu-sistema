import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(String.raw`set -euo pipefail
sudo find /opt/gsa-tv/fallback -maxdepth 2 -type f -printf '%p|%s\n' | sort
sudo find /opt/gsa-tv/cache/media -maxdepth 3 -type f -iname '*fallback*' -printf '%p|%s\n' | head -20
sudo stat -c '%a|%U|%G|%n' /opt/gsa-tv/fallback /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4 /opt/gsa-tv/runtime-test
`,30000); process.stdout.write(r.stdout); process.stderr.write(r.stderr);
