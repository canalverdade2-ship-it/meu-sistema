import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== SOURCES IN 2026-09-09.json ==="
sudo jq -r '.program[].source' /opt/gsa-tv/playlists/1/2026-09-09.json | sort -u

echo "=== SOURCES IN 2026-09-10.json ==="
sudo jq -r '.program[].source' /opt/gsa-tv/playlists/1/2026-09-10.json | sort -u

echo "=== IDENTITY SUBDIRECTORIES ==="
sudo ls -lah /opt/gsa-tv/cache/media/1/identity/vinhetas/
sudo ls -lah /opt/gsa-tv/cache/media/1/identity/audio/
sudo ls -lah /opt/gsa-tv/cache/media/1/identity/motion_bg/
sudo ls -lah /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/
sudo ls -lah /opt/gsa-tv/cache/media/1/identity/timeline/

echo "=== RUNTIME BADGE FILE ==="
sudo ls -lah /opt/gsa-tv/runtime/gsa-tv-live-badge.txt
sudo cat /opt/gsa-tv/runtime/gsa-tv-live-badge.txt
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
