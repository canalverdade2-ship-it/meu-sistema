import fs from 'node:fs';
const src='scratch/deploy-gsa-tv-watchdog.mjs';
const dst='scratch/deploy-gsa-tv-watchdog-1_2_0.mjs';
let s=fs.readFileSync(src,'utf8').replaceAll('gsa-tv/watchdog:1.1.0','gsa-tv/watchdog:1.2.0');
fs.writeFileSync(dst,s);
console.log(dst);
