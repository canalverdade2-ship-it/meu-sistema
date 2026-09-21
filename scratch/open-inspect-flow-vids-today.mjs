import { runSshScript } from './ssh2-run.mjs';
const js=String.raw`const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async()=>{const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});
for(const [name,url] of [['FLOW','https://labs.google/fx/pt/tools/flow'],['VIDS','https://vids.new']]){
 let p=await b.newPage(); await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000}); await new Promise(r=>setTimeout(r,6000));
 console.log('===',name,'==='); console.log('URL',p.url()); console.log('TITLE',await p.title()); console.log((await p.evaluate(()=>document.body.innerText)).slice(0,4000));
 await p.screenshot({path:'/home/opc/gsa-ai/'+name.toLowerCase()+'-today.png'});
}
await b.disconnect()})().catch(e=>{console.error(e.stack||e);process.exit(1)});`;
const enc=Buffer.from(js).toString('base64');
const r=await runSshScript(`printf '%s' '${enc}' | base64 -d > /home/opc/gsa-ai/open-inspect-today.js\nnode /home/opc/gsa-ai/open-inspect-today.js`,120000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
