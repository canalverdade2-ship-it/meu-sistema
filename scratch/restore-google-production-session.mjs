import { runSshScript } from './ssh2-run.mjs';
const js=String.raw`const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs=require('fs');
async function login(p){
 if(!p.url().includes('accounts.google')) return 'already';
 const account=await p.evaluateHandle(()=>[...document.querySelectorAll('[data-email],li,[role=link],[role=button]')].find(e=>(e.getAttribute('data-email')||e.innerText||'').includes('adriano9865@gmail.com')));
 if(account.asElement()) await account.asElement().click(); else throw new Error('conta cadastrada não encontrada');
 await new Promise(r=>setTimeout(r,4500));
 if(!p.url().includes('accounts.google')) return 'ok-account';
 const pw=await p.$('input[type=password]');
 if(pw){
   const old=fs.readFileSync('/home/opc/gsa-ai/check_vids_flow_02sep.js','utf8');
   const secret=old.match(/keyboard\.type\('([^']+)'/)?.[1]; if(!secret) throw new Error('credencial local não localizada');
   await pw.type(secret,{delay:20}); const next=await p.$('#passwordNext,button[jsname="LgbsSe"]'); if(next) await next.click();
   await new Promise(r=>setTimeout(r,10000));
 }
 return p.url().includes('accounts.google')?'attention':'ok';
}
(async()=>{const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'}); const pages=await b.pages();
for(const p of pages.filter(x=>x.url().includes('accounts.google'))){ const before=p.url().includes('service=wise')?'VIDS':'FLOW'; let state; try{state=await login(p)}catch(e){state='error:'+e.message} console.log(before,state,p.url().includes('accounts.google')?'AUTH_PENDING':'AUTH_OK'); }
await b.disconnect()})().catch(e=>{console.error(e.message);process.exit(1)});`;
const enc=Buffer.from(js).toString('base64'); const r=await runSshScript(`printf '%s' '${enc}' | base64 -d > /home/opc/gsa-ai/restore-google-session.js\nnode /home/opc/gsa-ai/restore-google-session.js`,120000); process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
