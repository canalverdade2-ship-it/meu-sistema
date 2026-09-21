import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript("sed -n '1070,1145p' /opt/gsa-tv/control-plane/src/app.js\n",120000);process.stdout.write(r.stdout);
