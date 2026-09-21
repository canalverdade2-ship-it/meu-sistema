import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo head -n 30 /opt/gsa-tv/backups/full/20260907T062245Z/media.sha256
echo "..."
sudo grep 'news/' /opt/gsa-tv/backups/full/20260907T062245Z/media.sha256 | head -n 10
echo "Count of files in 20260907 media backup:"
sudo wc -l /opt/gsa-tv/backups/full/20260907T062245Z/media.sha256
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
