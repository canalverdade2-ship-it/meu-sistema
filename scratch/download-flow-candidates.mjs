import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const base='/home/opc/gsa-ai/work/identity-flow-20260907';
const outDir=path.join(base,'candidates');fs.mkdirSync(outDir,{recursive:true});
const main=JSON.parse(fs.readFileSync(path.join(base,'export-ac1da.json'),'utf8'));
const mercado=JSON.parse(fs.readFileSync(path.join(base,'export-mercado.json'),'utf8')).slice(0,2);
const items=[...Object.values(main).map(x=>({...x,project:'ac1da714-fe03-4812-b62d-fb92d575e554'})),...mercado.map((x,i)=>({id:`mercado-${i===0?'closing':'opening'}`,aria:x.aria,video_url:x.video_url,prompt_name:'GSA Mercado',kind:i===0?'closing':'opening',project:'5bab07f8-bed9-43e6-aae8-d05f735e4e0c'}))];
for(let i=0;i<items.length;i++){
 const x=items[i], file=path.join(outDir,`${String(i+1).padStart(2,'0')}-${x.id}.mp4`);x.file=file;
 if(!fs.existsSync(file)||fs.statSync(file).size<100000){const r=await fetch(x.video_url);if(!r.ok)throw Error(`${r.status} ${x.id}`);await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(file));}
 console.log(`${i+1}/${items.length}`,path.basename(file),fs.statSync(file).size);
}
fs.writeFileSync(path.join(base,'candidate-manifest.json'),JSON.stringify(items.map(({video_url,...x})=>x),null,2));
