import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo find /opt/gsa-tv/cache/media/1 -maxdepth 1 -ls
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
