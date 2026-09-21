import {runSshScript} from './ssh2-run.mjs';
const js=String.raw`const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
function key(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key}
(async()=>{const k=key();for(const q of ['Holt','Nyla']){const r=await fetch('https://api.fish.audio/model?title='+encodeURIComponent(q)+'&page_size=20',{headers:{Authorization:'Bearer '+k}});const j=await r.json();const items=(j.items||[]).map(x=>({id:x._id,title:x.title,languages:x.languages}));console.log(JSON.stringify({query:q,status:r.status,count:items.length,items}));}})().catch(e=>{console.error('fish_model_audit_failed');process.exit(1)});`;
const j64=Buffer.from(js).toString('base64');
const sh=String.raw`set -euo pipefail
echo '=== PURGE OLD HARDCODED FISH TOKENS ==='
files=$(grep -RIl 'sk-fish-' /opt/gsa-tv/ai-worker /home/opc/gsa-ai 2>/dev/null || true)
if [ -n "$files" ]; then
  while IFS= read -r f; do sudo sed -E -i 's/sk-fish-[A-Za-z0-9_-]+/__FISH_API_KEY_FROM_SECURE_VAULT__/g' "$f"; done <<<"$files"
fi
remaining=$(grep -RIl 'sk-fish-' /opt/gsa-tv/ai-worker /home/opc/gsa-ai 2>/dev/null | wc -l || true)
echo "remaining_plaintext_files=$remaining"
printf '%s' '${j64}'|base64 -d >/tmp/audit-fish-models.js
node /tmp/audit-fish-models.js
rm -f /tmp/audit-fish-models.js
`;
const r=await runSshScript(sh,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
