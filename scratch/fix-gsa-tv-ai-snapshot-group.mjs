import fs from 'node:fs';
const p='infrastructure/gsa-tv/services/playout-api/src/app.js';
let s=fs.readFileSync(p,'utf8');
const old="group by state order by state\",[CHANNEL_ID])";
const neu="group by j.state order by j.state\",[CHANNEL_ID])";
if(!s.includes(old)) throw new Error('marker not found');
fs.writeFileSync(p,s.replace(old,neu));
