import fs from 'node:fs';
import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript("set -euo pipefail\ncat /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\n",120000);
fs.writeFileSync('scratch/GSA_TV_MEMORY_CHANGELOG.vps.snapshot.md',r.stdout,'utf8');
console.log(JSON.stringify({bytes:Buffer.byteLength(r.stdout),lines:r.stdout.split(/\r?\n/).length-1,path:'scratch/GSA_TV_MEMORY_CHANGELOG.vps.snapshot.md'}));
