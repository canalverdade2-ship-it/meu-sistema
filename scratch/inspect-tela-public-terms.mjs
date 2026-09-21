const origin='https://telabrasil.cultura.gov.br';
const html=await (await fetch(new URL(process.argv[2]||'/',origin))).text();
const paths=[...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]))];
for(let i=0;i<paths.length;i+=5){
 await Promise.all(paths.slice(i,i+5).map(async path=>{
  const js=await (await fetch(new URL(path,origin))).text();
  const matches=[...js.matchAll(/.{0,150}(?:termos.de.uso|termos-de|retransmi|exibi[çc][aã]o.{0,15}(?:p[uú]blica|coletiva)|uso pessoal|terms.of.use|\.pdf|termo-de-adesao).{0,400}/gi)].map(m=>m[0]);
  if(matches.length) console.log(JSON.stringify({path,matches}));
 }));
}
