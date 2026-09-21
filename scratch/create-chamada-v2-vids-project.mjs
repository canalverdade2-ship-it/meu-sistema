import { runSshScript } from './ssh2-run.mjs';

const js=String.raw`
const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async()=>{
 const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});
 const p=await b.newPage();
 await p.goto('https://vids.new',{waitUntil:'domcontentloaded',timeout:120000});
 await new Promise(r=>setTimeout(r,7000));
 console.log('URL',p.url());
 console.log((await p.evaluate(()=>document.body.innerText)).slice(0,5000));
 const title=await p.$('input[aria-label="Renomear"]');
 if(title){
   await title.click({clickCount:3});
   await title.type('GSA TV — Chamada da Grade V2 — Master 85s',{delay:5});
   await p.keyboard.press('Enter');
   console.log('RENAMED');
 }
 await b.disconnect();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
`;
const enc=Buffer.from(js).toString('base64');
const r=await runSshScript(`printf '%s' '${enc}'|base64 -d >/tmp/create-chamada-v2-vids.js\nnode /tmp/create-chamada-v2-vids.js\nrm -f /tmp/create-chamada-v2-vids.js`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
