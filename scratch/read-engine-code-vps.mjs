import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript("sudo sed -n '1,260p' /opt/gsa-tv/encoder-engine/src/app.js\n",120000);
process.stdout.write(r.stdout);
