import { runSshScript } from './ssh2-run.mjs';
const js=`const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');(async()=>{const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});const ps=await b.pages();for(let i=0;i<ps.length;i++){console.log(JSON.stringify({i,url:ps[i].url(),title:await ps[i].title()}))}await b.disconnect()})().catch(e=>{console.error(e.stack);process.exit(1)});`;
const e=Buffer.from(js).toString('base64');
const r=await runSshScript(`echo '${e}'|base64 -d >/tmp/tabs.js
node /tmp/tabs.js
rm -f /tmp/tabs.js`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
