import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo find /opt/gsa-tv/cache/media/1/news -type f -newermt "2026-09-07 07:00:00" | wc -l
sudo find /opt/gsa-tv/cache/media/1/news -type f -newermt "2026-09-07 07:00:00" | head -n 30
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
