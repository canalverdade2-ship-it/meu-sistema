import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo du -sh /home/opc/*
sudo du -sh /home/opc/.* 2>/dev/null || true
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
