import { runSshScript } from './ssh2-run.mjs';

const res = await runSshScript(`node /home/opc/gsa-ai/bin/google-session-login.js`, 60000);
console.log('STDOUT:\n', res.stdout);
if (res.stderr) console.error('STDERR:\n', res.stderr);
