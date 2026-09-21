const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const fs=require('fs');
const path=require('path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PROJECT=process.argv[2]||'ac1da714-fe03-4812-b62d-fb92d575e554';
const OUT=process.argv[3]||`/home/opc/gsa-ai/work/identity-flow-20260907/export-${PROJECT}.json`;
const LOG=OUT.replace(/\.json$/,'.log');
function log(...a){const s=`${new Date().toISOString()} ${a.join(' ')}`;console.log(s);fs.appendFileSync(LOG,s+'\n');}
const mediaId=u=>(u||'').match(/\/image\/([^?]+)/)?.[1]||'';
(async()=>{
 const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});let p=(await b.pages()).find(x=>x.url().includes(`/project/${PROJECT}`));
 if(!p){p=await b.newPage();await p.goto(`https://flow.google.com/project/${PROJECT}`,{waitUntil:'domcontentloaded',timeout:60000});await sleep(3500)}
 await p.bringToFront();await p.keyboard.press('Escape');await sleep(500);
 const results=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT,'utf8')):{};
 const v=await p.$('.cdk-virtual-scrollable.page-container');if(!v)throw Error('page scroll container missing');
 let stable=0,lastCount=Object.keys(results).length;
 for(let pass=0;pass<120 && stable<8;pass++){
   const dims=await p.evaluate(e=>({top:e.scrollTop,h:e.clientHeight,sh:e.scrollHeight}),v);
   const visible=await p.evaluate(()=>[...document.querySelectorAll('flow-grid-tile-container flow-video-tile img.thumbnail')].map(img=>({id:(img.src.match(/\/image\/([^?]+)/)||[])[1]||'',aria:img.closest('flow-grid-tile-container')?.getAttribute('aria-label')||''})).filter(x=>x.id));
   for(const item of visible){
     if(results[item.id]?.video_url)continue;
     const sel=`flow-grid-tile-container flow-video-tile img.thumbnail[src*="${item.id}"]`;
     let img=await p.$(sel);if(!img)continue;const tile=await img.evaluateHandle(e=>e.closest('flow-grid-tile-container'));
     const footer=await tile.asElement().$('flow-tile-hover-footer .footer-left');
     let detail='';
     if(footer){await footer.click();await sleep(500);detail=await p.evaluate(()=>document.body.innerText||'');await p.keyboard.press('Escape');await sleep(250)}
     img=await p.$(sel);if(!img)continue;const play=await img.evaluateHandle(e=>e.parentElement.querySelector('.pre-hover-overlay'));
     if(!play.asElement())continue;await play.asElement().click();
     try{await p.waitForSelector('video.main-video',{timeout:12000});}catch{}
     await sleep(350);const url=await p.$eval('video.main-video',e=>e.currentSrc||e.src).catch(()=> '');
     await p.keyboard.press('Escape');await sleep(300);
     const promptMatch=detail.match(/(GSA[^\n]{0,80})\s+[—-]\s+official\s+(opening|closing)/i);
     results[item.id]={id:item.id,aria:item.aria,video_url:url,prompt_name:promptMatch?.[1]?.trim()||'',kind:promptMatch?.[2]?.toLowerCase()||'',captured_at:new Date().toISOString()};
     fs.writeFileSync(OUT,JSON.stringify(results,null,2));log('CAPTURE',Object.keys(results).length,item.id,item.aria,results[item.id].kind,url?'url_ok':'url_missing');
   }
   const now=Object.keys(results).length;stable=now===lastCount?stable+1:0;lastCount=now;
   const d=await p.evaluate(e=>({top:e.scrollTop,h:e.clientHeight,sh:e.scrollHeight}),v);
   let next=d.top+Math.floor(d.h*.72);if(next>=d.sh-d.h-5){if(stable<4)next=0;else next=d.sh;}await p.evaluate((e,y)=>e.scrollTop=y,v,next);await sleep(700);
 }
 log('CAPTURE_COMPLETE',Object.keys(results).length);await b.disconnect();
})().catch(e=>{log('FATAL',e.stack||e.message);process.exit(1)});
