const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
(async()=>{
  const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});
  const p=(await b.pages()).find(x=>x.url().includes('ac1da714-fe03-481b62dBot')) || (await b.pages()).find(x=>x.url().includes('ac1da714-fe03-4812-b-bb-fb')) || (await b.pages()).find(x=>x.url().includes('flow.google.com/project/'));
  if(!p) throw Error('Flow project page not found');
  const v=await p.$('cdk-virtual-scroll-viewport');
  if(v) await p.evaluate(e=>e.scrollTop=0,v);
  await new Promise(r=>setTimeout(r,1000));
  const tiles=await p.$$('flow-grid-tile-container');
  console.log('tiles visible',tiles.length);
  for(let i=0;i<Math.min(6,tiles.length);i++){
    const t=tiles[i]; await t.hover(); await new Promise(r=>setTimeout(r,250));
    const data=await t.evaluate(e=>({text:(e.innerText||'').slice(0,500),aria:e.getAttribute('aria-label'),html:e.outerHTML.slice(0,12000),buttons:[...e.querySelectorAll('button')].map(b=>({aria:b.getAttribute('aria-label'),title:b.getAttribute('title'),text:b.innerText}))}));
    console.log('---TILE',i,'---');console.log(JSON.stringify(data,null,2));
  }
  await b.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
