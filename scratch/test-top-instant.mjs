import { runSshScript } from './ssh2-run.mjs';

const script = `
top -b -n 2 -d 1 | tail -n +$(top -b -n 1 | wc -l) | head -n 25
`;

const res = await runSshScript(script);
console.log(res.stdout);
