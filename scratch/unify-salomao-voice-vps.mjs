import { runSshScript } from './ssh2-run.mjs';

const js = String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),path=require('path');
const base='/home/opc/gsa-ai/qc/fish-voices', dir=base+'/auditions-2026-09-05';
const voiceId='99cf4cc9b5484393ab6da5655529bb3e';
function secret(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key}
(async()=>{
 const text='Olá. Seja muito bem-vindo à Hora da Palavra. Em poucos minutos, vamos compreender um ensinamento da Bíblia e descobrir como aplicá-lo às escolhas da nossa vida.';
 const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+secret(),'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify({text,reference_id:voiceId,format:'mp3',normalize:true,latency:'normal',prosody:{speed:.95,volume:0,normalize_loudness:true}})});
 const b=Buffer.from(await r.arrayBuffer()); if(!r.ok) throw new Error('Fish TTS '+r.status+': '+b.toString().slice(0,300));
 const file='gsa-hora-da-palavra--voz-salomao-oliveira.mp3'; fs.writeFileSync(path.join(dir,file),b,{mode:0o640});
 const p=base+'/official-assignment-2026-09-05.json', o=JSON.parse(fs.readFileSync(p,'utf8'));
 o.voices=o.voices.filter(x=>x.program!=='GSA Hora da Palavra');
 o.voices.push({program:'GSA Hora da Palavra',presenter:'Apresentador masculino — nome artístico a definir',voice_id:voiceId,catalog_title:'Voz Narrador Cinema',status:'approved',approved_at:new Date().toISOString(),voice_shared_with:'GSA Histórias da Bíblia / Salomão Oliveira',production_direction:'Mesma identidade vocal de Salomão Oliveira; interpretação própria para ensino bíblico curto, natural e próxima.'});
 o.pending=[]; o.status='22_voices_official'; o.updated_at=new Date().toISOString(); fs.writeFileSync(p,JSON.stringify(o,null,2));
 const dp=base+'/voice-approval-decisions-2026-09-05.json', d=JSON.parse(fs.readFileSync(dp,'utf8'));
 d.replacement={program:'GSA Hora da Palavra',status:'approved',voice_id:voiceId,voice_shared_with:'GSA Histórias da Bíblia / Salomão Oliveira',audition_file:file,approved_at:new Date().toISOString()};
 d.replacement_candidates=(d.replacement_candidates||[]).map(x=>({...x,status:'rejected_by_unification_decision'})); d.updated_at=new Date().toISOString(); fs.writeFileSync(dp,JSON.stringify(d,null,2));
 let html=fs.readFileSync(path.join(dir,'PAINEL_AUDICAO.html'),'utf8');
 html=html.replace(/(?:<article><h2>GSA Hora da Palavra<\/h2>[\s\S]*?<\/article>)+/,'<article><h2>GSA Hora da Palavra</h2><h3>Voz oficial de Salomão Oliveira</h3><audio controls preload="metadata" src="'+file+'"></audio><span class="tag">aprovada · compartilhada com GSA Histórias da Bíblia</span></article>');
 fs.writeFileSync(path.join(dir,'PAINEL_AUDICAO.html'),html);
 console.log(JSON.stringify({ok:true,program:'GSA Hora da Palavra',voice_id:voiceId,file,bytes:b.length}));
})().catch(e=>{console.error(e.stack);process.exit(1)});
`;

const encoded=Buffer.from(js).toString('base64');
const changelog=Buffer.from(`\n## 2026-09-05 — Voz unificada de Salomão Oliveira\n- Por decisão expressa do usuário, GSA Hora da Palavra e GSA Histórias da Bíblia passam a usar a mesma voz oficial de Salomão Oliveira.\n- Voice ID oficial compartilhado: 99cf4cc9b5484393ab6da5655529bb3e.\n- As três alternativas da segunda rodada foram rejeitadas e não devem ser usadas.\n- A diferenciação entre os programas será feita por roteiro, ritmo e direção editorial, preservando a mesma identidade vocal.\n- A amostra definitiva de GSA Hora da Palavra foi gerada e incluída no painel público.\n- As 22 escolhas vocais estão agora oficializadas.\n- Nenhum encoder, RTMP, playlist ou serviço da transmissão foi alterado ou reiniciado.\n`).toString('base64');
const remote=`set -euo pipefail
echo '${encoded}' | base64 -d > /tmp/unify-salomao.js
node /tmp/unify-salomao.js
rm -f /tmp/unify-salomao.js
sudo install -m 0644 /home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/PAINEL_AUDICAO.html /var/www/uploads/gsa-tv-voice-casting-2026-09-05/PAINEL_AUDICAO.html
sudo install -m 0644 /home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/gsa-hora-da-palavra--voz-salomao-oliveira.mp3 /var/www/uploads/gsa-tv-voice-casting-2026-09-05/gsa-hora-da-palavra--voz-salomao-oliveira.mp3
echo '${changelog}' | base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
curl -fsS -o /dev/null -w 'panel=%{http_code}\\n' 'https://api.147-15-43-141.nip.io/uploads/gsa-tv-voice-casting-2026-09-05/PAINEL_AUDICAO.html?v=4'
curl -fsS -o /dev/null -w 'audio=%{http_code}\\n' 'https://api.147-15-43-141.nip.io/uploads/gsa-tv-voice-casting-2026-09-05/gsa-hora-da-palavra--voz-salomao-oliveira.mp3'
tail -n 10 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const result=await runSshScript(remote,300000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
