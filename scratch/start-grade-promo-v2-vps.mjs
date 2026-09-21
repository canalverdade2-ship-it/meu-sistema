import fs from 'node:fs';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const files=[
  ['assets/gsa-tv/chamada-grade-v2/DIRECAO_CRIATIVA_E_STORYBOARD.md','/home/opc/gsa-ai/work/chamada-grade-v2/DIRECAO_CRIATIVA_E_STORYBOARD.md'],
  ['assets/gsa-tv/chamada-grade-v2/SHOTLIST.csv','/home/opc/gsa-ai/work/chamada-grade-v2/SHOTLIST.csv']
];
const entry=`

## 2026-09-06 — Nova chamada profissional V2 aprovada e iniciada

- O operador aprovou expressamente o início da nova chamada sob a arquitetura híbrida registrada às 16:33:20Z.
- Conceito aprovado para desenvolvimento: **“Um universo de conteúdo. Uma só GSA TV.”**
- Pré-produção iniciada pelo fluxo obrigatório: conceito, mensagem institucional, storyboard, arco musical, regras de motion design, gates de aprovação e shot list.
- Master planejado com 85 segundos, 1920x1080, 30 fps; derivações previstas de 60 s, 30 s e 15 s.
- Estrutura temporal: impacto institucional; jornalismo; informação/futuro; vida/mundo; fé/inspiração; entretenimento; clímax da marca.
- A shot list inicial contém 30 grupos de planos e meta de aproximadamente 55 takes úteis, majoritariamente entre 0,8 e 2,2 segundos.
- Documentos canônicos da nova produção:
  - \`/home/opc/gsa-ai/work/chamada-grade-v2/DIRECAO_CRIATIVA_E_STORYBOARD.md\`
  - \`/home/opc/gsa-ai/work/chamada-grade-v2/SHOTLIST.csv\`
- A chamada anterior continua rejeitada e não será usada como base criativa; somente ativos individuais tecnicamente válidos poderão ser reavaliados.
- Nenhum encoder, RTMP, grade, playlist ou sinal ao vivo foi alterado nesta etapa.
`;
function connect(){return new Promise((res,rej)=>{const c=new Client();c.on('ready',()=>res(c)).on('error',rej).connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:20000})})}
function exec(c,cmd){return new Promise((res,rej)=>c.exec(cmd,(e,s)=>{if(e)return rej(e);let o='',r='';s.on('data',d=>o+=d);s.stderr.on('data',d=>r+=d);s.on('close',n=>n?rej(new Error(r||o)):res(o))}))}
function sftp(c){return new Promise((res,rej)=>c.sftp((e,s)=>e?rej(e):res(s)))}
function put(s,l,r){return new Promise((res,rej)=>s.fastPut(l,r,e=>e?rej(e):res()))}
const c=await connect();try{await exec(c,'mkdir -p /home/opc/gsa-ai/work/chamada-grade-v2');const sf=await sftp(c);for(const [l,r] of files)await put(sf,l,r);const p=Buffer.from(entry).toString('base64');console.log(await exec(c,`printf '%s' '${p}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sha256sum /home/opc/gsa-ai/work/chamada-grade-v2/DIRECAO_CRIATIVA_E_STORYBOARD.md /home/opc/gsa-ai/work/chamada-grade-v2/SHOTLIST.csv
tail -n 16 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`))}finally{c.end()}
