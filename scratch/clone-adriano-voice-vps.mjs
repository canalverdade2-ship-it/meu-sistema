import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const localInput = new URL('../assets/gsa-tv/avatars/adriano-farias/voice/adriano-farias-voice-training-v1.wav', import.meta.url);
const localOutput = new URL('../assets/gsa-tv/avatars/adriano-farias/voice/adriano-farias-voice-qc-v1.mp3', import.meta.url);
const remoteInput = '/home/opc/gsa-ai/qc/adriano-avatar/adriano-farias-voice-training-v1.wav';
const remoteOutput = '/home/opc/gsa-ai/qc/adriano-avatar/adriano-farias-voice-qc-v1.mp3';

const remoteJs = String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
function secret(){
  const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));
  const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');
  const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16);
  const d=crypto.createDecipheriv('aes-256-gcm',k,n); d.setAAD(Buffer.from(v.aad)); d.setAuthTag(t);
  return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key;
}
(async()=>{
  const key=secret();
  const form=new FormData();
  form.append('type','tts');
  form.append('title','Adriano Farias — Voz Institucional GSA TV');
  form.append('train_mode','fast');
  form.append('visibility','private');
  form.append('description','Voz institucional privada de Adriano Farias, criada com autorização expressa do próprio titular para apresentações e comerciais da GSA TV.');
  form.append('tags','GSA TV');
  form.append('tags','Português Brasil');
  form.append('enhance_audio_quality','true');
  form.append('generate_sample','false');
  form.append('voices',new Blob([fs.readFileSync('${remoteInput}')],{type:'audio/wav'}),'adriano-farias-voice-training-v1.wav');
  const create=await fetch('https://api.fish.audio/model',{method:'POST',headers:{Authorization:'Bearer '+key},body:form});
  const body=await create.text();
  if(!create.ok) throw new Error('create_model '+create.status+' '+body.slice(0,500));
  const model=JSON.parse(body), id=model._id||model.id;
  if(!id) throw new Error('create_model missing id');
  const text='Olá! Eu sou Adriano Farias. É uma alegria apresentar as novidades e os projetos da GSA TV, uma emissora feita para informar, inspirar e aproximar pessoas.';
  const tts=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify({text,reference_id:id,format:'mp3',normalize:true,latency:'normal',prosody:{speed:.97,volume:0,normalize_loudness:true}})});
  const audio=Buffer.from(await tts.arrayBuffer());
  if(!tts.ok) throw new Error('tts '+tts.status+' '+audio.toString().slice(0,500));
  fs.writeFileSync('${remoteOutput}',audio,{mode:0o640});
  fs.writeFileSync('/home/opc/gsa-ai/qc/adriano-avatar/voice-manifest.json',JSON.stringify({created_at:new Date().toISOString(),voice_id:id,title:model.title,state:model.state,visibility:model.visibility,training_file:'${remoteInput}',qc_file:'${remoteOutput}',consent:'express_user_authorization_in_chat'},null,2),{mode:0o640});
  console.log(JSON.stringify({ok:true,voice_id:id,state:model.state,visibility:model.visibility,qc_bytes:audio.length}));
})().catch(e=>{console.error(e.message);process.exit(1)});
`;

function connect(){ return new Promise((resolve,reject)=>{ const c=new Client(); c.on('ready',()=>resolve(c)).on('error',reject).connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000}); }); }
function exec(c,cmd){ return new Promise((resolve,reject)=>c.exec(cmd,(e,s)=>{if(e)return reject(e);let o='',r='';s.on('data',d=>o+=d);s.stderr.on('data',d=>r+=d);s.on('close',code=>code?reject(new Error(r||o)):resolve({stdout:o,stderr:r}));})); }
function sftp(c){ return new Promise((resolve,reject)=>c.sftp((e,s)=>e?reject(e):resolve(s))); }
function fastPut(s,l,r){ return new Promise((resolve,reject)=>s.fastPut(l,r,e=>e?reject(e):resolve())); }
function fastGet(s,r,l){ return new Promise((resolve,reject)=>s.fastGet(r,l,e=>e?reject(e):resolve())); }

const c=await connect();
try{
  await exec(c,"mkdir -p /home/opc/gsa-ai/qc/adriano-avatar && chmod 750 /home/opc/gsa-ai/qc/adriano-avatar");
  const s=await sftp(c);
  await fastPut(s,fileURLToPath(localInput),remoteInput);
  const payload=Buffer.from(remoteJs).toString('base64');
  const result=await exec(c,`printf '%s' '${payload}' | base64 -d | node`);
  await fastGet(s,remoteOutput,fileURLToPath(localOutput));
  process.stdout.write(result.stdout);
} finally { c.end(); }
