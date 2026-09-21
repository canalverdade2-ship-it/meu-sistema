import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const conn=new Client();
await new Promise((resolve,reject)=>conn.on('ready',resolve).on('error',reject).connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000}));
const sftp=await new Promise((resolve,reject)=>conn.sftp((e,s)=>e?reject(e):resolve(s)));
const remote='/home/opc/gsa-ai/work/chamada-grade-v2/assets/logos';
const local=path.resolve('scratch/qc-v2/logos'); fs.mkdirSync(local,{recursive:true});
const list=await new Promise((resolve,reject)=>sftp.readdir(remote,(e,l)=>e?reject(e):resolve(l)));
for(const item of list.filter(x=>x.filename.endsWith('.png')&&!x.filename.startsWith('qc-')&&!x.filename.startsWith('board-'))){
 await new Promise((resolve,reject)=>sftp.fastGet(`${remote}/${item.filename}`,path.join(local,item.filename),e=>e?reject(e):resolve()));
 console.log(item.filename);
}
conn.end();
