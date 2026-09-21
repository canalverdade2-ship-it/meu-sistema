import fs from 'node:fs';
import path from 'node:path';
import sharp from 'file:///C:/Users/Adriano%20Farias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs';

const pRoot=path.resolve('scratch/qc-v2/presenters');
const lRoot=path.resolve('scratch/qc-v2/logos');
const out=path.resolve('scratch/qc-v2/panels'); fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(pRoot,'manifest.json'),'utf8'));
const byProgram=Object.fromEntries(manifest.map(x=>[x.program,x]));
const groups=[
 ['jornalismo',['gsa-tempo']],
 ['futuro',['gsa-mercado','gsa-cidadania','gsa-business','gsa-tech','gsa-motor']],
 ['vida',['gsa-agro','gsa-mundo','gsa-destinos','gsa-bem-viver','gsa-sabor']],
 ['fe',['gsa-em-fe','gsa-hora-da-palavra','gsa-historias-da-biblia']],
 ['entretenimento-a',['gsa-music','gsa-ta-na-rede','gsa-esportes','gsa-cinema']],
 ['entretenimento-b',['gsa-sessao-pipoca','gsa-desenhos','gsa-planeta-terra','gsa-misterios']]
];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
for(const [name,programs] of groups){
 const count=programs.length, cardW=count===1?430:count===3?420:count===4?370:320, gap=24;
 const total=count*cardW+(count-1)*gap, start=Math.round((1920-total)/2);
 const comps=[];
 for(let i=0;i<count;i++){
  const key=programs[i], item=byProgram[key], x=start+i*(cardW+gap), y=count===1?170:150;
  const portrait=await sharp(path.join(pRoot,`${key}.png`)).resize(cardW,610,{fit:'cover',position:'attention'}).modulate({brightness:.86,saturation:.92}).png().toBuffer();
  const logoPath=path.join(lRoot,`${key}.png`);
  const logo=await sharp(logoPath).resize({width:Math.round(cardW*.76),height:125,fit:'inside'}).png().toBuffer();
  const card=await sharp({create:{width:cardW,height:820,channels:4,background:{r:7,g:18,b:39,alpha:.92}}})
   .composite([
    {input:portrait,left:0,top:0},
    {input:Buffer.from(`<svg width="${cardW}" height="820"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="50%" stop-color="#071227" stop-opacity="0"/><stop offset="76%" stop-color="#071227" stop-opacity="0.97"/></linearGradient></defs><rect width="${cardW}" height="820" rx="24" fill="none" stroke="#d7ad4b" stroke-width="4"/><rect width="${cardW}" height="820" rx="24" fill="url(#g)"/><text x="${cardW/2}" y="785" font-family="Arial" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">${esc(item.presenter)}</text></svg>`),left:0,top:0},
    {input:logo,left:Math.round((cardW-(await sharp(logo).metadata()).width)/2),top:625}
   ]).png().toBuffer();
  comps.push({input:card,left:x,top:y});
 }
 const title=name.startsWith('entretenimento')?'ENTRETENIMENTO':name==='futuro'?'PRESENTE E FUTURO':name==='vida'?'VIDA E MUNDO':name==='fe'?'FÉ E INSPIRAÇÃO':'INFORMAÇÃO EM MOVIMENTO';
 comps.push({input:Buffer.from(`<svg width="1920" height="1080"><text x="960" y="100" font-family="Arial" font-size="48" font-weight="700" letter-spacing="8" text-anchor="middle" fill="#f0d889">${title}</text><line x1="700" y1="125" x2="1220" y2="125" stroke="#d7ad4b" stroke-width="3"/></svg>`),left:0,top:0});
 await sharp({create:{width:1920,height:1080,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(comps).png().toFile(path.join(out,`${name}.png`));
 console.log(name);
}
