import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const remoteDir='/home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05';
const localDir=path.resolve('assets/gsa-tv/voices/auditions-2026-09-05');
fs.mkdirSync(localDir,{recursive:true});

await new Promise((resolve,reject)=>{
  const conn=new Client();
  conn.on('ready',()=>conn.sftp((err,sftp)=>{
    if(err)return reject(err);
    sftp.readdir(remoteDir,async(err,files)=>{
      if(err)return reject(err);
      try{
        for(const f of files.filter(x=>x.filename.endsWith('.mp3')||x.filename==='manifest.json')){
          await new Promise((res,rej)=>sftp.fastGet(`${remoteDir}/${f.filename}`,path.join(localDir,f.filename),e=>e?rej(e):res()));
          console.log('DOWNLOADED',f.filename);
        }
        conn.end();resolve();
      }catch(e){conn.end();reject(e)}
    });
  }));
  conn.on('error',reject);
  conn.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000});
});
