import fs from 'node:fs';
const src='scratch/deploy-gsa-tv-runtime-1_6_7.mjs';
const dst='scratch/deploy-gsa-tv-runtime-1_6_8.mjs';
let s=fs.readFileSync(src,'utf8').replaceAll('1.6.7','1.6.8').replaceAll('1_6_7','1_6_8');
fs.writeFileSync(dst,s);
console.log(dst);
