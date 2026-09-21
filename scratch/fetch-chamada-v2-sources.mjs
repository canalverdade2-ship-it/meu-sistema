import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const remoteRoot = '/home/opc/gsa-ai/work/chamada-grade-v2';
const names = ['config.json','finish-v2.sh','DIRECAO_CRIATIVA_E_STORYBOARD.md','SHOTLIST.csv'];
const localRoot = path.resolve('scratch/qc-v2/remote');
fs.mkdirSync(localRoot, { recursive: true });

const conn = new Client();
await new Promise((resolve, reject) => {
  conn.on('ready', resolve).on('error', reject).connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000});
});
const sftp = await new Promise((resolve, reject) => conn.sftp((e,s)=>e?reject(e):resolve(s)));
for (const name of names) {
  await new Promise((resolve, reject) => sftp.fastGet(`${remoteRoot}/${name}`, path.join(localRoot,name), e=>e?reject(e):resolve()));
  console.log(name);
}
conn.end();
