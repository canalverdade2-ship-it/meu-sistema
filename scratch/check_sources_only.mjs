import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== SOURCES IN 2026-09-09.json ==="
sudo jq -r '.program[].source' /opt/gsa-tv/playlists/1/2026-09-09.json | sort -u
echo "=== SOURCES IN 2026-09-10.json ==="
sudo jq -r '.program[].source' /opt/gsa-tv/playlists/1/2026-09-10.json | sort -u
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
