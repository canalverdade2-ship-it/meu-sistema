import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`
set -euo pipefail
node <<'NODE'
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),path=require('path');
const base='/home/opc/gsa-ai/qc/fish-voices';
const dir=base+'/auditions-2026-09-05';
const provisional=JSON.parse(fs.readFileSync(base+'/provisional-assignment-2026-09-05.json','utf8'));
const now=new Date().toISOString();
const rejectedProgram='GSA Hora da Palavra';
const replacement={
  program:rejectedProgram,
  former_presenter:'Elisa Monteiro',
  former_voice_id:'81e2371a6a434798929bd1c17a69fd92',
  status:'replacement_pending_approval',
  presenter:'Apresentador masculino — nome artístico a definir',
  voice_id:'e056abef5c294c96945b70b40fcfbaac',
  catalog_title:'Narrador Espiritual',
  direction:'Voz masculina profunda, serena e espiritual; próxima do registro de Salomão Oliveira, porém com identidade própria.',
  production_direction:'Mais naturalidade e expressão: pausas orgânicas, variação de ritmo e intenção por frase, sem interpretação teatral exagerada.'
};
const decisions=provisional.map(v=>v.program===rejectedProgram
  ? {...v,status:'rejected',decision_at:now,reason:'Substituir por voz masculina próxima ao registro de Salomão Oliveira.'}
  : {...v,status:'approved',decision_at:now,production_direction:'Manter identidade vocal; aumentar naturalidade e expressão conforme a identidade editorial do programa.'});
fs.writeFileSync(base+'/voice-approval-decisions-2026-09-05.json',JSON.stringify({updated_at:now,approved_count:21,rejected_count:1,decisions,replacement},null,2));
fs.writeFileSync(base+'/official-assignment-2026-09-05.json',JSON.stringify({updated_at:now,status:'21_official_1_pending_replacement',voices:decisions.filter(x=>x.status==='approved'),pending:[replacement]},null,2));

function secret(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key}
(async()=>{
 const text='Olá. Em poucos minutos, vamos refletir juntos sobre um ensinamento da Bíblia, compreender sua mensagem e levá-la para as escolhas da vida cotidiana.';
 const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+secret(),'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify({text,reference_id:replacement.voice_id,format:'mp3',normalize:true,latency:'normal',prosody:{speed:.95,volume:0,normalize_loudness:true}})});
 const b=Buffer.from(await r.arrayBuffer());
 if(!r.ok) throw new Error('Fish TTS '+r.status+': '+b.toString().slice(0,300));
 const file='gsa-hora-da-palavra--opcao-masculina-01.mp3';
 fs.writeFileSync(path.join(dir,file),b,{mode:0o640});
 replacement.audition_file=file; replacement.audition_bytes=b.length;
 const decisionPath=base+'/voice-approval-decisions-2026-09-05.json';
 const d=JSON.parse(fs.readFileSync(decisionPath,'utf8')); d.replacement=replacement; fs.writeFileSync(decisionPath,JSON.stringify(d,null,2));
 const officialPath=base+'/official-assignment-2026-09-05.json';
 const o=JSON.parse(fs.readFileSync(officialPath,'utf8')); o.pending=[replacement]; fs.writeFileSync(officialPath,JSON.stringify(o,null,2));
 let html=fs.readFileSync(path.join(dir,'PAINEL_AUDICAO.html'),'utf8');
 html=html.replace(/<article><h2>GSA Hora da Palavra<\/h2>[\s\S]*?<\/article>/,
 '<article><h2>GSA Hora da Palavra</h2><h3>Opção masculina — nome artístico a definir</h3><audio controls src="'+file+'"></audio><span class="tag">masculina · profunda · serena · espiritual · aprovação pendente</span></article>');
 fs.writeFileSync(path.join(dir,'PAINEL_AUDICAO.html'),html);
 console.log(JSON.stringify({ok:true,file,bytes:b.length,approved:21,pending:1}));
})().catch(e=>{console.error(e.stack);process.exit(1)});
NODE
sudo install -m 0644 /home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/PAINEL_AUDICAO.html /var/www/uploads/gsa-tv-voice-casting-2026-09-05/PAINEL_AUDICAO.html
sudo install -m 0644 /home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/gsa-hora-da-palavra--opcao-masculina-01.mp3 /var/www/uploads/gsa-tv-voice-casting-2026-09-05/gsa-hora-da-palavra--opcao-masculina-01.mp3
cat >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md <<'EOF'

## 2026-09-05 — Aprovação das vozes e substituição em GSA Hora da Palavra
- O usuário aprovou 21 das 22 vozes de apresentadores previamente apresentadas no painel de audição.
- As 21 vozes aprovadas foram oficializadas em /home/opc/gsa-ai/qc/fish-voices/official-assignment-2026-09-05.json.
- A voz feminina de Elisa Monteiro em GSA Hora da Palavra foi rejeitada e retirada do painel ativo.
- Por decisão do usuário, GSA Hora da Palavra passará a ter apresentador masculino. Nome artístico e avatar masculino ainda dependem de definição/aprovação.
- Foi criada uma nova opção masculina com Fish Audio (Narrador Espiritual, voice_id e056abef5c294c96945b70b40fcfbaac), próxima ao registro profundo e sereno de Salomão Oliveira, mas com identidade própria.
- Amostra nova: /home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05/gsa-hora-da-palavra--opcao-masculina-01.mp3.
- Painel público atualizado: https://api.147-15-43-141.nip.io/uploads/gsa-tv-voice-casting-2026-09-05/PAINEL_AUDICAO.html?v=2.
- Nova regra de direção vocal aprovada: preservar as vozes escolhidas, acrescentando mais naturalidade e expressão por meio de pausas orgânicas, variação de ritmo, intenção por frase e emoção coerente com cada programa, sem exagero teatral.
- Registro detalhado das decisões: /home/opc/gsa-ai/qc/fish-voices/voice-approval-decisions-2026-09-05.json.
- Nenhum encoder, RTMP, playlist ou serviço da transmissão ao vivo foi reiniciado nesta operação.
EOF
curl -fsS -o /dev/null -w 'panel=%{http_code}\n' 'https://api.147-15-43-141.nip.io/uploads/gsa-tv-voice-casting-2026-09-05/PAINEL_AUDICAO.html?v=2'
curl -fsS -o /dev/null -w 'audio=%{http_code}\n' 'https://api.147-15-43-141.nip.io/uploads/gsa-tv-voice-casting-2026-09-05/gsa-hora-da-palavra--opcao-masculina-01.mp3'
tail -n 18 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`;

const result=await runSshScript(remote,300000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
