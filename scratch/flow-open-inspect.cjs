const puppeteer=require('/usr/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9228'});
  const p=(await b.pages()).find(x=>x.url().includes('flow.google.com/project/'));
  if(!p) throw Error('Flow project page not found');
  const plays=await p.$$('flow-grid-tile-container flow-video-tile .pre-hover-overlay');
  if(!plays.length) throw Error('No video play overlay visible');
  await plays[0].click(); await sleep(2500);
  const data=await p.evaluate(()=>({
    text:(document.body.innerText||'').slice(0,5000),
    videos:[...document.querySelectorAll('video')].map(v=>({src:v.src,currentSrc:v.currentSrc,poster:v.poster,duration:v.duration})),
    buttons:[...document.querySelectorAll('button')].map(b=>({aria:b.getAttribute('aria-label'),title:b.getAttribute('title'),text:(b.innerText||'').trim()})).filter(x=>x.aria||x.title||x.text),
    links:[...document.querySelectorAll('a')].map(a=>({href:a.href,text:(a.innerText||'').trim(),download:a.download})).filter(x=>x.href)
  }));
  console.log(JSON.stringify(data,null,2));
  await p.screenshot({path:'/home/opc/gsa-ai/work/identity-flow-20260907/open-detail.png'});
  await b.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
