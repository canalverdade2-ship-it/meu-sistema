import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo ls -lah /home/opc/gsa-ai/work/
sudo du -sh /home/opc/gsa-ai/work/* | sort -hr
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
