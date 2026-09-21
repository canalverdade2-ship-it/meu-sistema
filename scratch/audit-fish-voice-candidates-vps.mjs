import { runSshScript } from './ssh2-run.mjs';

const js = String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
function secret(){
  const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));
  const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');
  const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16);
  const d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);
  return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key;
}
const queries=['português','brasileira','brasileiro','locutor','locutora','jornalista','esporte','futebol','pastor','pregador','bíblia','espiritual','chef','culinária','tecnologia','jovem','cinema','documentário','infantil','viagem','natureza','mistério','economia','agro','automóveis','música'];
(async()=>{
  const key=secret(), found=new Map();
  const urls=[
    'https://api.fish.audio/model?language=pt&page_size=100&sort_by=task_count',
    ...queries.map(q=>'https://api.fish.audio/model?title='+encodeURIComponent(q)+'&page_size=30&sort_by=task_count')
  ];
  for(const url of urls){
    const r=await fetch(url,{headers:{Authorization:'Bearer '+key}});
    if(!r.ok){console.error('HTTP',r.status,new URL(url).search);continue;}
    const j=await r.json();
    for(const x of (j.items||[])){
      const hay=[x.title,x.description,...(x.tags||[]),...(x.languages||[])].join(' ');
      if((x.languages||[]).includes('pt') || /portugu|brasil|locutor|locutora|jornal|esport|futebol|pastor|pregador|b[ií]blia|chef|culin|tecnolog|cinema|document|infantil|viagem|natureza|mist[eé]rio|econom|agro|autom[oó]v|m[uú]sic/i.test(hay)) found.set(x._id,x);
    }
  }
  const out=[...found.values()].map(x=>({
    id:x._id,title:x.title,description:x.description||'',tags:x.tags||[],languages:x.languages||[],
    task_count:x.task_count||0,like_count:x.like_count||0,visibility:x.visibility,
    samples:(x.samples||[]).map(s=>({title:s.title||'',audio:s.audio||s.url||s.file||s.filename||'',text:s.text||''})),
    default_text:x.default_text||''
  })).sort((a,b)=>b.task_count-a.task_count);
  fs.mkdirSync('/home/opc/gsa-ai/qc/fish-voices',{recursive:true});
  fs.writeFileSync('/home/opc/gsa-ai/qc/fish-voices/candidate-catalog-2026-09-05.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify({status:'ok',candidates:out.length,top:out.slice(0,80)},null,2));
})().catch(e=>{console.error('audit_failed:'+e.message);process.exit(1)});
`;

const encoded = Buffer.from(js).toString('base64');
const sh = `printf '%s' '${encoded}' | base64 -d > /tmp/gsa-fish-candidates.js
node /tmp/gsa-fish-candidates.js
rm -f /tmp/gsa-fish-candidates.js`;
const result=await runSshScript(sh,180000);
process.stdout.write(result.stdout);
if(result.stderr)process.stderr.write(result.stderr);
