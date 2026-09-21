import fs from 'node:fs';
const doc=JSON.parse(fs.readFileSync('scratch/news-editorial-20260908.json','utf8'));
const results=[];
for(const story of doc.stories){
 const sources=[];
 for(const url of story.sources||[]){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});const html=await r.text();sources.push({url,status:r.status,page_title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g,' ').trim()||null,review:'human_editorial_check_required'});}catch(e){sources.push({url,error:e.message,review:'unverified'});}
 }
 results.push({id:story.id,title:story.title,sources});
 console.log(story.id,sources.map(s=>s.status||'ERROR').join(','));
 fs.writeFileSync('scratch/news-source-audit.json',JSON.stringify({checked_at:new Date().toISOString(),note:'HTTP availability is not factual validation. No rights to video inferred from an article.',stories:results},null,2));
}
