import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript("sudo nl -ba /usr/local/sbin/gsa-rtmp-single-owner-guard | sed -n '1,80p'\n",120000);
process.stdout.write(r.stdout);
