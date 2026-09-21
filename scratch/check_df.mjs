import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== DF -H ==="
df -h
echo ""
echo "=== BACKUP DIR SIZE ==="
sudo du -sh /opt/gsa-tv/backups/full/* 2>/dev/null || true
sudo du -sh /opt/gsa-tv/cache/media 2>/dev/null || true
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
