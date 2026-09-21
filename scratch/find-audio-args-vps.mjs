import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`grep -nE '128k|adeclick|aresample' /opt/gsa-tv/control-plane/src/app.js | head -n 80
grep -nE '128k|adeclick|aresample' /opt/gsa-tv/encoder-engine/src/app.js | head -n 80
`,120000);process.stdout.write(r.stdout);
