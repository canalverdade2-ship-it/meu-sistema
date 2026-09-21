import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== TMP BACKUP DIR CONTENTS ==="
sudo ls -lah /opt/gsa-tv/backups/full/.20260910T015950Z.tmp/
echo ""
echo "=== DISK USAGE ==="
df -h /
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
