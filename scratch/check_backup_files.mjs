import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo ls -lah /opt/gsa-tv/backups/full/20260907T062245Z/
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
