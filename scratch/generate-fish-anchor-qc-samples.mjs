import {runSshScript} from './ssh2-run.mjs';
const js=String.raw`const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
function secret(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key}
const voices=[['masculino','fafc0100f94747259ecd6081ae5226aa','Esta é uma amostra técnica da voz masculina oficial da GSA TV. Informação clara, natural e confiável.'],['feminino','74b5a4384563467b80dd0ca12ca5fd04','Esta é uma amostra técnica da voz feminina oficial da GSA TV. Informação clara, natural e confiável.']];
(async()=>{const key=secret();fs.mkdirSync('/home/opc/gsa-ai/qc/fish-voices',{recursive:true});for(const [name,id,text] of voices){const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',model:'s2.1-pro'},body:JSON.stringify({text,reference_id:id,format:'mp3',normalize:true,latency:'normal'})});const buf=Buffer.from(await r.arrayBuffer());if(!r.ok){console.error(JSON.stringify({name,status:r.status,bytes:buf.length}));process.exitCode=2;continue}const out='/home/opc/gsa-ai/qc/fish-voices/anchor-'+name+'-qc-2026-09-04.mp3';fs.writeFileSync(out,buf,{mode:0o640});console.log(JSON.stringify({name,status:r.status,bytes:buf.length,path:out}));}})().catch(e=>{console.error('tts_qc_failed:'+e.message);process.exit(1)});`;
const j64=Buffer.from(js).toString('base64');
const sh=String.raw`set -euo pipefail
printf '%s' '${j64}'|base64 -d >/tmp/fish-anchor-qc.js
node /tmp/fish-anchor-qc.js
rm -f /tmp/fish-anchor-qc.js
for f in /home/opc/gsa-ai/qc/fish-voices/*.mp3; do ffprobe -v error -show_entries format=filename,duration,size -of compact=p=0:nk=1 "$f"; done
`;
const r=await runSshScript(sh,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
