import {Client} from 'ssh2';
import {readInfraKey} from './ssh2-run.mjs';
const files=[
 ['/home/opc/gsa-ai/qc_v3/anchors_contact_sheet.jpg','scratch/gsa-news-anchors-contact-sheet.jpg'],
 ['/home/opc/gsa-ai/editions/gsa-news-2026-09-01-30min/work/male-anchor-selected.png','scratch/gsa-news-male-anchor-selected.png'],
 ['/home/opc/gsa-ai/editions/gsa-news-2026-09-01-30min/work/male-anchor-options.png','scratch/gsa-news-male-anchor-options.png']
];
await new Promise((resolve,reject)=>{const c=new Client();c.on('ready',()=>c.sftp((e,s)=>{if(e)return reject(e);let n=0;for(const [a,b] of files)s.fastGet(a,b,err=>{if(err){c.end();reject(err);return}if(++n===files.length){c.end();resolve()}})}));c.on('error',reject);c.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000})});
console.log('downloaded='+files.length);
