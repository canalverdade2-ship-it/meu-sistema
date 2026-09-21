import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript("sudo grep -n -C 2 GRAPHICS_ZMQ /opt/gsa-tv/control-plane/src/app.js || true\n",30000);
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
