import { runSshScript } from './ssh2-run.mjs';

const py = String.raw`import base64, hashlib, json, os, re, subprocess
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

legacy='/home/opc/gsa-ai/check_vids_flow_02sep.js'
text=open(legacy,encoding='utf-8').read()
m=re.search(r"keyboard\.type\('([^']+)'", text)
if not m: raise SystemExit('credencial legada não localizada')
password=m.group(1)
email='adriano9865@gmail.com'
key_hex=subprocess.check_output(['sudo','docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],text=True).strip()
if not re.fullmatch(r'[0-9a-fA-F]{64}',key_hex): raise SystemExit('chave do cofre indisponível')
key=bytes.fromhex(key_hex); nonce=os.urandom(12); aes=AESGCM(key)
payload=json.dumps({'email':email,'password':password},ensure_ascii=False).encode()
cipher=aes.encrypt(nonce,payload,b'gsa-google-production-v1')
out={'version':1,'algorithm':'AES-256-GCM','aad':'gsa-google-production-v1','nonce':base64.urlsafe_b64encode(nonce).decode(),'ciphertext':base64.urlsafe_b64encode(cipher).decode(),'account':email,'purpose':'Google Vids e Google Flow'}
os.makedirs('/home/opc/gsa-ai/secrets',exist_ok=True)
path='/home/opc/gsa-ai/secrets/google-production.enc.json'
open(path,'w',encoding='utf-8').write(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
os.chmod(path,0o600)
# Remove a senha em texto claro do script legado, preservando-o como referência histórica.
clean=text[:m.start(1)]+'__REMOVIDA_USE_COFRE__'+text[m.end(1):]
open(legacy,'w',encoding='utf-8').write(clean)
print(json.dumps({'ok':True,'path':path,'account':email,'mode':oct(os.stat(path).st_mode & 0o777),'legacy_scrubbed':True}))
`;
const login = String.raw`const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
function unlock(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/google-production.enc.json','utf8'));const key=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');const nonce=Buffer.from(v.nonce,'base64url'),all=Buffer.from(v.ciphertext,'base64url'),tag=all.subarray(-16),body=all.subarray(0,-16);const d=crypto.createDecipheriv('aes-256-gcm',key,nonce);d.setAAD(Buffer.from(v.aad));d.setAuthTag(tag);return JSON.parse(Buffer.concat([d.update(body),d.final()]).toString('utf8'));}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function login(page,cred){
 if(!page.url().includes('accounts.google'))return 'AUTH_OK';
 const account=await page.evaluateHandle(email=>[...document.querySelectorAll('[data-email],li,[role=link],[role=button]')].find(e=>(e.getAttribute('data-email')||e.innerText||'').includes(email)),cred.email);
 if(account.asElement())await account.asElement().click();else throw new Error('conta não encontrada');
 await sleep(3500); if(!page.url().includes('accounts.google'))return 'AUTH_OK';
 const pw=await page.$('input[type=password]'); if(pw){await pw.type(cred.password,{delay:15});const next=await page.$('#passwordNext,button[jsname="LgbsSe"]');if(next)await next.click();await sleep(9000);}
 return page.url().includes('accounts.google')?'AUTH_PENDING':'AUTH_OK';
}
(async()=>{const cred=unlock(),b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});const pages=(await b.pages()).filter(p=>p.url().includes('accounts.google'));
for(const p of pages){const kind=p.url().includes('service=wise')?'VIDS':'FLOW';try{console.log(kind,await Promise.race([login(p,cred),new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),30000))]))}catch(e){console.log(kind,'ATTENTION',e.message)}}
await b.disconnect()})().catch(e=>{console.error(e.message);process.exit(1)});`;

const py64=Buffer.from(py).toString('base64'); const js64=Buffer.from(login).toString('base64');
const remote=String.raw`set -euo pipefail
printf '%s' '${py64}' | base64 -d > /tmp/install-google-vault.py
python3 /tmp/install-google-vault.py
rm -f /tmp/install-google-vault.py
printf '%s' '${js64}' | base64 -d > /home/opc/gsa-ai/bin/google-session-login.js
chmod 700 /home/opc/gsa-ai/bin/google-session-login.js
cat >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md <<'EOF'

## 2026-09-04 — Cofre de autenticação Google para produção
- A conta operacional do Google Vids/Flow foi registrada no cofre criptografado AES-256-GCM da VPS.
- A senha não foi gravada neste changelog nem em documentação aberta.
- Referência segura: /home/opc/gsa-ai/secrets/google-production.enc.json (permissão 0600).
- Recuperação automatizada de sessão: /home/opc/gsa-ai/bin/google-session-login.js.
- A senha em texto aberto encontrada em um script legado foi removida.
- Autorização: solicitação expressa do responsável pelo canal nesta conversa.
EOF
`;
const r=await runSshScript(remote,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
