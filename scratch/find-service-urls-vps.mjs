import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript("grep -n -A18 -B4 'SERVICE_URLS' /opt/gsa-tv/control-plane/src/app.js\n",120000);process.stdout.write(r.stdout);
