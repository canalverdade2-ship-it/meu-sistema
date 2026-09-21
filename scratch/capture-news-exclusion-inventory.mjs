import fs from 'node:fs';
import {runSshScript} from './ssh2-run.mjs';
const result=await runSshScript("find /opt/gsa-tv/cache/media /home/opc/gsa-ai/editions -type f \\( -iname '*.mp4' -o -iname '*.webm' -o -iname '*.mov' \\) -printf '%s\\t%p\\n'");
const files=result.stdout.trim().split('\n').filter(Boolean).map(line=>{const i=line.indexOf('\t');return {size:Number(line.slice(0,i)),path:line.slice(i+1)}});
fs.writeFileSync('scratch/news-existing-vps-videos.json',JSON.stringify({captured_at:new Date().toISOString(),purpose:'exclusion inventory for newly acquired News footage',note:'Metadata baseline only; renamed/recoded duplicates also require source and visual checks.',files},null,2));
console.log(`${files.length} existing files inventoried for exclusion.`);
