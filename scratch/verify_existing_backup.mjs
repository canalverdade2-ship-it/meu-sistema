import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo bash -c '
cd /opt/gsa-tv/backups/full/20260907T062245Z
sha256sum -c manifest.sha256
'
`;

const res = await runSshScript(cmd, 300000);
console.log(res.stdout);
