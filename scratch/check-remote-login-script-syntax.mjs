import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`node --check /tmp/login-exact.js 2>&1 || true`,30000);process.stdout.write(r.stdout);
