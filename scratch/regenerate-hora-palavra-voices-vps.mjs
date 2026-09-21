import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`
set -euo pipefail
node <<'NODE'
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),path=require('path');
const base='/home/opc/gsa-ai/qc/fish-voices';
const dir=base+'/auditions-2026-09-05';
function secret(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key}
const options=[
 {n:2,id:'8888dddd118648abba34a6cb24bab0f7',title:'Opção A — acolhedora e contemplativa',speed:.96},
 {n:3,id:'7e849da826ed4201a813881181628e8e',title:'Opção B — próxima e expressiva',speed:.97},
 {n:4,id:'31b9d6ebdb6c470f993ff29b82e66255',title:'Opção C — clara e serena',speed:.96}
];
const text='Olá... Seja muito bem-vindo à Hora da Palavra. Hoje, vamos conversar sobre um ensinamento da Bíblia que pode trazer direção, esperança e paz para as decisões da nossa vida.';
(async()=>{
 const key=secret(), made=[];
 for(const o of options){
  const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify({text,reference_id:o.id,format:'mp3',normalize:true,latency:'normal',prosody:{speed:o.speed,volume:0,normalize_loudness:true}})});
  const b=Buffer.from(await r.arrayBuffer());
  if(!r.ok) throw new Error(o.title+' Fish TTS '+r.status+': '+b.toString().slice(0,300));
  const file='gsa-hora-da-palavra--opcao-masculina-0'+o.n+'.mp3';
  fs.writeFileSync(path.join(dir,file),b,{mode:0o640});
  made.push({...o,file,bytes:b.length,status:'pending_approval'});
 }
 const decisionsPath=base+'/voice-approval-decisions-2026-09-05aset.json';
 const realPath=base+'/voice-approval-decisions-2026-09-05.json';
 const d=JSON.parse(fs.readFileSync(realPath,'utf8'));
 d.replacement.status='first_replacement_rejected';
 d.replacement.rejected_at=new Date().toISOString();
 d.replacement.reason='Usuário avaliou a primeira opção como muito ruim.';
 d.replacement_candidates=made;
 d.updated_at=new Date().toISOString();
 fs.writeFileSync(realPath,JSON.stringify(d,null,2));
 let html=fs.readFileSync(path.join(dir,'PAINEL_AUDICAO.html'),'utf8');
 const cards=made.map(o=>'<article><h2>GSA Hora da Palavra</h2><h3>'+o.title+'</h3><audio controls preload="metadata" src="'+o.file+'"></audio><span class="tag">masculina · natural · espiritual · aprovação pendente</span></article>').join('');
 html=html.replace(/<article><h2>GSA Hora da Palavra<\/h2>[\s\S]*?<\/article>/,cards);
 fs.writeFileSync(path.join(dir,'PAINEL_AUDICAO.html'),html);
 console.log(JSON.stringify({ok:true,made}));
})().catch(e=>{console.error(e.stack);process.exit(1)});
NODE
sudo install -m 0644 /home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/PAINEL_AUDICAO.html /var/www/uploads/gsa-tv-voice-casting-2026-09-05/PAINEL_AUDICAO.html
for n in 02 03 04; do sudo install -m 0644 "/home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/gsa-hora-da-palavra--opcao-masculina-$n.mp3" "/var/www/uploads/gsa-tv-voice-casting-2026-09-05/gsa-hora-da-palavra--opcao-masculina-$n.mp3"; done
cat >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md <<'EOF'

## 2026-09-05 — Segunda rodada de voz para GSA Hora da Palavra
- A primeira opção masculina para GSA Hora da Palavra foi expressamente reprovada pelo usuário e não poderá ser usada em produção.
- Foram geradas três novas alternativas masculinas para comparação: A acolhedora/contemplativa, B próxima/expressiva e C clara/serena.
- A direção prioriza naturalidade, acolhimento, expressão e espiritualidade, evitando leitura mecânica, voz publicitária e imitação direta de Salomão Oliveira.
- As 21 vozes anteriormente aprovadas permanecem inalteradas e oficiais.
- O painel público foi atualizado em https://api.147-15-43-141.nip.io/uploads/gsa-tv-voice-casting-2026-09-05/PAINEL_AUDICAO.html?v=3.
- As três alternativas permanecem pendentes de aprovação; nenhuma foi oficializada.
- Nenhum componente da transmissão ao vivo foi alterado ou reiniciado.
EOF
curl -fsS -o /dev/null -w 'panel=%{http_code}\n' 'https://api.147-15-43-141.nip.io/uploads/gsa-tv-voice-casting-2026-09-05/PAINEL_AUDICAO.html?v=3'
for n in 02 03 04; do curl -fsS -o /dev/null -w "audio-$n=%{http_code}\\n" "https://api.147-15-43-141.nip.io/uploads/gsa-tv-voice-casting-2026-09-05/gsa-hora-da-palavra--opcao-masculina-$n.mp3"; done
`;

const result=await runSshScript(remote,300000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
