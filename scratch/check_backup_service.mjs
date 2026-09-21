import { runSshScript } from './ssh2-run.mjs';

const cmd = `
systemctl status gsa-tv-backup.service --no-pager || true
echo "--- TIMER ---"
systemctl list-timers gsa-tv-backup.timer --no-pager
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
