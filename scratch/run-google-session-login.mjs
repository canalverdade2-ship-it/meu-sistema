import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`timeout 90s node /home/opc/gsa-ai/bin/google-session-login.js || true`,120000);
process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
