import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo du -sh /home/opc/gsa-ai/* | sort -hr | head -n 25
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
