const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});const p=(await b.pages()).find(x=>x.url().includes('flow.google.com/project/'));if(!p)throw Error('page');
 await p.keyboard.press('Escape');await sleep(500);
 const first=await p.$('flow-grid-tile-container flow-video-tile .pre-hover-overlay');if(!first)throw Error('play');await first.click();await sleep(4000);
 const out=await p.evaluate(()=>({
  resources:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/flow-content|\.mp4|video|media/i.test(x)).slice(-100),
  media:[...document.querySelectorAll('video,audio,source')].map(e=>({tag:e.tagName,src:e.src,currentSrc:e.currentSrc,html:e.outerHTML.slice(0,1000)})),
  dialogs:[...document.querySelectorAll('[role=dialog],mat-dialog-container,.cdk-overlay-pane')].map(e=>e.outerHTML.slice(0,20000))
 }));console.log(JSON.stringify(out,null,2));await b.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
