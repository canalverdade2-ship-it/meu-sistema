import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const remote=process.argv[2];
const local=process.argv[3];
if(!remote||!local)throw new Error('Uso: remote local');
fs.mkdirSync(path.dirname(local),{recursive:true});
const conn=new Client();
await new Promise((resolve,reject)=>{
 conn.on('ready',()=>conn.sftp((error,sftp)=>{
  if(error)return reject(error);
  sftp.fastGet(remote,local,(downloadError)=>{
   conn.end();
   if(downloadError)reject(downloadError); else resolve();
  });
 }));
 conn.on('error',reject);
 conn.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000});
});
console.log(`${local} ${fs.statSync(local).size}`);
