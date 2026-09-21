import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo du -sh /home/opc/gsa-ai/editions/*
sudo du -sh /home/opc/gsa-ai/data/*
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
