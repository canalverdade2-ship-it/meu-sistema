import { runSshScript } from './ssh2-run.mjs';

const script = `
cat /var/log/gsa-process-guardian.log
`;

const res = await runSshScript(script);
console.log(res.stdout);
