import { runSshScript } from './ssh2-run.mjs';
const panel=process.argv[2], prompt=process.argv.slice(3).join(' ');
const data=Buffer.from(JSON.stringify({panel,prompt})).toString('base64');
const js=String.raw`
const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const d=JSON.parse(Buffer.from(process.argv[2],'base64').toString());
(async()=>{
 const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});
 const p=(await b.pages()).find(x=>x.url().includes('/videos/d/1NoUuv9KmksylGMfxKdbcXCvXHYZ9k89XvcwAhwKErjo/'));
 if(!p)throw Error('Vids ausente');
 let file=await p.$('input[type=file][accept*="image"]');
 if(!file){
  const tab=await p.$('[role=tab][aria-label="Animar"]');
  if(!tab){const ai=await p.$('[role=button][aria-label="Gerar um vídeo com IA"]');await ai.evaluate(e=>e.click());await sleep(1200)}
  const anim=await p.$('[role=tab][aria-label="Animar"]'); if(!anim)throw Error('tab Animar ausente'); const active=await anim.evaluate(e=>e.getAttribute('aria-selected')==='true'||e.className.includes('--active')); if(!active){await anim.evaluate(e=>e.click()); await sleep(500)}
  let add=await p.$('button[aria-label="Adicionar imagem"]');
  if(!add){const cleared=await p.evaluate(()=>{const e=[...document.querySelectorAll('button,[role=button]')].find(x=>(x.innerText||'').trim()==='Limpar'&&x.getBoundingClientRect().width>0);if(!e)return false;e.click();return true});if(cleared){await sleep(700);add=await p.$('button[aria-label="Adicionar imagem"]')}}
  if(!add){const ok=await p.evaluate(()=>{const e=[...document.querySelectorAll('button[aria-label="Abrir"]')].find(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&r.y>400});if(!e)return false;e.click();return true});if(!ok)throw Error('controle Abrir ausente');await sleep(700);add=await p.$('button[aria-label="Adicionar imagem"]')}
  if(!add)throw Error('Adicionar imagem ausente'); await add.evaluate(e=>e.click()); await sleep(500); file=await p.$('input[type=file][accept*="image"]');
 }
 if(!file)throw Error('input file ausente'); await file.uploadFile(d.panel); await sleep(1800);
 const box=await p.$('[aria-label^="Adicione sua imagem e descreva"]'); if(!box)throw Error('prompt ausente'); await box.click();
 await p.keyboard.down('Control');await p.keyboard.press('A');await p.keyboard.up('Control');await p.keyboard.press('Backspace');await p.keyboard.type(d.prompt,{delay:1});await sleep(300);
 const go=await p.$('button[aria-label="Gerar"]');if(!go)throw Error('Gerar ausente');if(await go.evaluate(e=>e.disabled||e.getAttribute('aria-disabled')==='true'))throw Error('Gerar desativado');await go.evaluate(e=>e.click());await sleep(2200);
 console.log('ANIMATION_SUBMITTED',d.panel);console.log((await p.evaluate(()=>document.body.innerText)).slice(-1200));await b.disconnect();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
`;
const e=Buffer.from(js).toString('base64');const r=await runSshScript(`printf '%s' '${e}'|base64 -d >/tmp/avs.js\nnode /tmp/avs.js '${data}'\nrm /tmp/avs.js`,90000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
