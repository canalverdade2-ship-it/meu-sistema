import { runSshScript } from './ssh2-run.mjs';

const shot = process.argv[2];
const prompts = {
  '001': '8-second premium broadcast ident plate for a Brazilian television network: a refined pulse of warm metallic gold light travels through a deep navy-black atmospheric space, revealing elegant layered depth, subtle glass particles and cinematic volumetric rays, controlled forward camera move, sophisticated major-network visual language, photorealistic, no people, no readable text, no logo, no watermark, horizontal 16:9.',
  '003': '8-second photorealistic premium television newsroom establishing shot at dawn: a modern Brazilian newsroom gradually powers on, monitors glow in deep navy and warm gold, camera glides smoothly through an empty editorial floor toward an illuminated studio, credible large-broadcaster production design, no people, no readable text, no logos, no watermark, horizontal 16:9.',
  '007': '8-second photorealistic premium Brazilian television weather sequence: elegant animated meteorological map over a coastal Brazilian metropolis, layered clouds, rain bands and atmospheric currents moving naturally, navy blue and warm gold broadcast palette, smooth cinematic camera orbit, factual public-service tone, no disaster, no readable text, no logo, no watermark, horizontal 16:9.',
  '008': '8-second photorealistic prime-time television transition: nighttime Brazilian city skyline flows into a sophisticated active newsroom through a seamless glass reflection, deep navy, silver and warm gold lighting, dynamic but controlled broadcast camera move, credible major-network aesthetic, no readable text, no logo, no watermark, horizontal 16:9.'
};
if (!prompts[shot]) throw new Error(`Shot desconhecido: ${shot}`);
const payload = Buffer.from(JSON.stringify({shot, prompt: prompts[shot]})).toString('base64');
const js = String.raw`
const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const data=JSON.parse(Buffer.from(process.argv[2],'base64').toString());
(async()=>{
 const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});
 const p=(await b.pages()).find(x=>x.url().includes('flow.google.com/project/'));
 if(!p) throw new Error('Projeto Flow não encontrado');
 const i=await p.$('input[aria-label="Texto editável"]');
 const g=await p.$('button[aria-label="Iniciar geração"]');
 if(!i||!g) throw new Error('Controles do compositor ausentes');
 await i.click();
 await p.keyboard.down('Control');
 await p.keyboard.press('A');
 await p.keyboard.up('Control');
 await p.keyboard.press('Backspace');
 await p.keyboard.type(data.prompt,{delay:1});
 await new Promise(r=>setTimeout(r,500));
 const result=await p.evaluate((shot)=>{
   const i=document.querySelector('input[aria-label="Texto editável"]');
   const g=document.querySelector('button[aria-label="Iniciar geração"]');
   if(g.disabled||g.getAttribute('aria-disabled')==='true') return {ok:false,reason:'gerar desativado',shot,len:i.value.length};
   g.click();
   return {ok:true,shot,len:i.value.length};
 },data.shot);
 console.log(JSON.stringify(result));
 await new Promise(r=>setTimeout(r,1500));
 console.log((await p.evaluate(()=>document.body.innerText)).slice(-1200));
 await b.disconnect();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
`;
const enc = Buffer.from(js).toString('base64');
const r = await runSshScript(`printf '%s' '${enc}'|base64 -d >/tmp/submit-chamada-shot.js\nnode /tmp/submit-chamada-shot.js '${payload}'\nrm -f /tmp/submit-chamada-shot.js`, 60000);
process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
