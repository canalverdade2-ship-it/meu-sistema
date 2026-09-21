import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript("sed -n '395,495p;895,940p;3570,3610p;4790,4825p' /opt/gsa-tv/control-plane/src/app.js\n",120000);process.stdout.write(r.stdout);
