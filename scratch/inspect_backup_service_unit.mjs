import { runSshScript } from './ssh2-run.mjs';

const cmd = `
cat /etc/systemd/system/gsa-tv-backup.service
echo "--- TIMER ---"
cat /etc/systemd/system/gsa-tv-backup.timer
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
