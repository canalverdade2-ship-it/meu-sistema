import fs from 'node:fs';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const local=process.argv[2];
const remote=process.argv[3];
if(!local||!remote)throw new Error('Uso: local remote');
const conn=new Client();
await new Promise((resolve,reject)=>{
 conn.on('ready',()=>conn.sftp((error,sftp)=>{
  if(error)return reject(error);
  sftp.fastPut(local,remote,(uploadError)=>{
   conn.end();
   if(uploadError)reject(uploadError); else resolve();
  });
 }));
 conn.on('error',reject);
 conn.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000});
});
console.log(`${local} -> ${remote} (${fs.statSync(local).size} bytes)`);
