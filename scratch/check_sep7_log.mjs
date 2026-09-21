import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo journalctl -u gsa-tv-backup.service --since '2026-09-07 06:00:00' --until '2026-09-07 07:10:00' --no-pager
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
