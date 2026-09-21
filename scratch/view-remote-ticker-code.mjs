import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript("sudo sed -n '565,595p' /opt/gsa-tv/control-plane/src/app.js",30000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
