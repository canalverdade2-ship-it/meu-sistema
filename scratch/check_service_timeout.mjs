import { runSshScript } from './ssh2-run.mjs';

const cmd = `
systemctl show -p TimeoutStartUSec,TimeoutSec gsa-tv-backup.service
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
