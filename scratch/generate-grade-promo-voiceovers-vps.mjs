import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const outDir = new URL('../assets/gsa-tv/chamada-grade/voiceovers/', import.meta.url);
fs.mkdirSync(outDir, { recursive: true });
const scripts = [
  'Informação, conhecimento, fé, cultura e entretenimento. GSA TV: uma programação completa, feita para acompanhar todos os momentos do seu dia.',
  'Marcelo Valença e Lívia Fontes trazem as notícias no GSA Manhã News, no GSA Meio Dia News e no GSA News Noite. Três edições próprias, com informação, prestação de serviço e os principais acontecimentos do Brasil e do mundo.',
  'Eduardo Salles traduz a economia no GSA Mercado. Clara Venturi apresenta a previsão no GSA Tempo. Patrícia Silva aproxima você dos seus direitos no GSA Cidadania. Ricardo Brandão inspira quem empreende no GSA Business. Caio Nex revela as novidades no GSA Tech. E Bruna Ventura acelera com você no GSA Motor.',
  'Daniel Campos conecta produção e tecnologia no GSA Agro. Olívia Valverde explica o cenário internacional no GSA Mundo. Marina Horizonte conduz novas experiências no GSA Destinos. Lucas Sereno compartilha qualidade de vida no GSA Bem Viver. E Salomão Oliveira apresenta receitas e novidades no GSA Sabor.',
  'No GSA Em Fé, o Pastor Samuel Veredas inspira e fortalece o coração. O GSA Hora da Palavra ensina a Bíblia de forma prática. E Salomão Oliveira dá vida às grandes narrativas no GSA Histórias da Bíblia.',
  'Mauro Beat comanda o GSA Music. Nina Conecta mostra o que está no GSA Tá na Rede. André Linhares entra em campo no GSA Esportes. Thea Lumière apresenta o GSA Cinema. Beto Pipoca anima o GSA Sessão Pipoca. Luna Alegria diverte no GSA Desenhos. Gaia Monteverde revela o GSA Planeta Terra. E Aurora Alencar investiga o GSA Mistérios. GSA TV. Conteúdo que informa, inspira e aproxima você.'
];
const remoteDir='/home/opc/gsa-ai/qc/chamada-grade-2026-09-06';
const remoteJs=String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
function key(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json'));const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex'),n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);return JSON.parse(Buffer.concat([d.update(b),d.final()])).api_key}
(async()=>{const k=key(),scripts=${JSON.stringify(scripts)};fs.mkdirSync('${remoteDir}',{recursive:true});for(let i=0;i<scripts.length;i++){const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+k,'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify({text:scripts[i],reference_id:'5c8a9b5d0b2549c7ada853529199ebe5',format:'mp3',normalize:false,latency:'normal'})});const b=Buffer.from(await r.arrayBuffer());if(!r.ok)throw Error('tts '+(i+1)+' '+r.status+' '+b.toString().slice(0,200));fs.writeFileSync('${remoteDir}/bloco-'+String(i+1).padStart(2,'0')+'.mp3',b,{mode:0o640});console.log(JSON.stringify({block:i+1,bytes:b.length}))}})().catch(e=>{console.error(e.message);process.exit(1)});
`;
function connect(){return new Promise((res,rej)=>{const c=new Client();c.on('ready',()=>res(c)).on('error',rej).connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000})})}
function exec(c,cmd){return new Promise((res,rej)=>c.exec(cmd,(e,s)=>{if(e)return rej(e);let o='',r='';s.on('data',d=>o+=d);s.stderr.on('data',d=>r+=d);s.on('close',n=>n?rej(new Error(r||o)):res(o))}))}
function sftp(c){return new Promise((res,rej)=>c.sftp((e,s)=>e?rej(e):res(s)))}
function get(s,r,l){return new Promise((res,rej)=>s.fastGet(r,l,e=>e?rej(e):res()))}
const c=await connect();try{const payload=Buffer.from(remoteJs).toString('base64');console.log(await exec(c,`printf '%s' '${payload}' | base64 -d > /tmp/gsa-grade-voiceovers.js && node /tmp/gsa-grade-voiceovers.js && rm -f /tmp/gsa-grade-voiceovers.js`));const sf=await sftp(c);for(let i=1;i<=6;i++){const n='bloco-'+String(i).padStart(2,'0')+'.mp3';await get(sf,`${remoteDir}/${n}`,fileURLToPath(new URL(n,outDir)))}}finally{c.end()}
