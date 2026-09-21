import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const remote='/home/opc/gsa-ai/work/chamada-grade-v2';
await runSshScript(`mkdir -p '${remote}/assets/presenter-panels'`);
const files=fs.readdirSync('scratch/qc-v2/panels').filter(x=>x.endsWith('.png')).map(x=>[`scratch/qc-v2/panels/${x}`,`${remote}/assets/presenter-panels/${x}`]);
files.push(['scratch/qc-v2/render-presenter-pass-vps.sh',`${remote}/render-presenter-pass-vps.sh`]);
const conn=new Client();
await new Promise((resolve,reject)=>conn.on('ready',resolve).on('error',reject).connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000}));
const sftp=await new Promise((resolve,reject)=>conn.sftp((e,s)=>e?reject(e):resolve(s)));
for(const [local,target] of files){await new Promise((resolve,reject)=>sftp.fastPut(path.resolve(local),target,e=>e?reject(e):resolve())); console.log(target);}
conn.end();
