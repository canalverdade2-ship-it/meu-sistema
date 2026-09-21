import { runSshScript } from './ssh2-run.mjs';

const modelId = '75de8b72edf6470d87795be3f083ffe6';
const remoteJs = String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json'));
const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');
const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);
d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);
const key=JSON.parse(Buffer.concat([d.update(b),d.final()])).api_key;
(async()=>{const r=await fetch('https://api.fish.audio/model/${modelId}',{method:'DELETE',headers:{Authorization:'Bearer '+key}});const body=await r.text();if(!r.ok&&r.status!==404)throw Error('delete '+r.status+' '+body.slice(0,300));console.log(JSON.stringify({ok:true,status:r.status,deleted:r.status!==404,already_absent:r.status===404}))})().catch(e=>{console.error(e.message);process.exit(1)});
`;
const payload = Buffer.from(remoteJs, 'utf8').toString('base64');
const result = await runSshScript(`set -eu
printf '%s' '${payload}' | base64 -d > /tmp/delete-adriano-v1.js
node /tmp/delete-adriano-v1.js
rm -f /tmp/delete-adriano-v1.js
sudo rm -f /home/opc/gsa-ai/qc/adriano-avatar/adriano-farias-voice-qc-v1.mp3 /home/opc/gsa-ai/qc/adriano-avatar/adriano-farias-voice-training-v1.wav /home/opc/gsa-ai/qc/adriano-avatar/voice-manifest.json
`, 120000);
process.stdout.write(result.stdout);
