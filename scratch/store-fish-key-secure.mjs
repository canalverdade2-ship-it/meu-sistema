import {runSshScript} from './ssh2-run.mjs';
const secret=process.env.GSA_FISH_KEY;
if(!secret || !secret.startsWith('sk-fish-')) throw new Error('Chave Fish ausente ou inválida no processo temporário.');
const payload64=Buffer.from(JSON.stringify({api_key:secret})).toString('base64');
const node=String.raw`const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
const clear=Buffer.from(process.argv[2],'base64');
const key=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');
if(key.length!==32)throw new Error('invalid vault key');
const nonce=crypto.randomBytes(12),aad='gsa-tv:fish-audio:production:v1';
const c=crypto.createCipheriv('aes-256-gcm',key,nonce);c.setAAD(Buffer.from(aad));
const body=Buffer.concat([c.update(clear),c.final()]),tag=c.getAuthTag();
const out={version:1,algorithm:'aes-256-gcm',aad,nonce:nonce.toString('base64url'),ciphertext:Buffer.concat([body,tag]).toString('base64url'),created_at:new Date().toISOString()};
fs.writeFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json',JSON.stringify(out,null,2)+'\n',{mode:0o600});
clear.fill(0);console.log('fish_vault_written');`;
const test=String.raw`const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));
const key=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');
const nonce=Buffer.from(v.nonce,'base64url'),all=Buffer.from(v.ciphertext,'base64url'),tag=all.subarray(-16),body=all.subarray(0,-16);
const d=crypto.createDecipheriv('aes-256-gcm',key,nonce);d.setAAD(Buffer.from(v.aad));d.setAuthTag(tag);const obj=JSON.parse(Buffer.concat([d.update(body),d.final()]).toString('utf8'));
fetch('https://api.fish.audio/model?page_size=1',{headers:{Authorization:'Bearer '+obj.api_key}}).then(async r=>{console.log(JSON.stringify({auth_status:r.status,ok:r.ok}));process.exit(r.ok?0:2)}).catch(e=>{console.error('network_error');process.exit(3)});`;
const n64=Buffer.from(node).toString('base64'),t64=Buffer.from(test).toString('base64');
const sh=String.raw`set -euo pipefail
install -d -m 700 /home/opc/gsa-ai/secrets
printf '%s' '${n64}'|base64 -d >/tmp/store-fish-vault.js
node /tmp/store-fish-vault.js '${payload64}'
chmod 600 /home/opc/gsa-ai/secrets/fish-production.enc.json
rm -f /tmp/store-fish-vault.js
printf '%s' '${t64}'|base64 -d >/tmp/test-fish-vault.js
node /tmp/test-fish-vault.js
rm -f /tmp/test-fish-vault.js
stat -c '%a|%s|%n' /home/opc/gsa-ai/secrets/fish-production.enc.json`;
const r=await runSshScript(sh,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
