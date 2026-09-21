import {runSshScript} from './ssh2-run.mjs';
const assets=[
 {id:'congresso-real',url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Imagens_de_Bras%C3%ADlia_-_Congresso_Nacional_%2850059647053%29.jpg/1280px-Imagens_de_Bras%C3%ADlia_-_Congresso_Nacional_%2850059647053%29.jpg',title:'Imagens de Brasília — Congresso Nacional',author:'Agência Senado',license:'CC BY 2.0',source:'Wikimedia Commons'},
 {id:'urna-real',url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Brazilian_DRE_voting_machine_for_2022_elections.jpg/1280px-Brazilian_DRE_voting_machine_for_2022_elections.jpg',title:'Brazilian DRE voting machine for 2022 elections',author:'Tribunal Superior Eleitoral',license:'Domínio público',source:'Wikimedia Commons'},
 {id:'petroleiro-real',url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/Oil_Tanker_in_North_Sea_3928.jpg/1280px-Oil_Tanker_in_North_Sea_3928.jpg',title:'Oil Tanker in North Sea',author:'ImagePerson',license:'CC BY 4.0',source:'Wikimedia Commons'},
 {id:'nepal-mapa-real',url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/20170817_Nepal_India_Bangladesh_Floods.pdf/page1-1280px-20170817_Nepal_India_Bangladesh_Floods.pdf.jpg',title:'Nepal, India and Bangladesh Floods — ERCC',author:'Emergency Response Coordination Centre',license:'Domínio público',source:'Wikimedia Commons'},
 {id:'tecnologia-real',url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/DHL_Netherlands_local_site_computer_room_wires_and_ductwork_-_IMG_3296.jpg/1280px-DHL_Netherlands_local_site_computer_room_wires_and_ductwork_-_IMG_3296.jpg',title:'Computer room wires and ductwork',author:'Jemimus',license:'CC BY 2.0',source:'Wikimedia Commons'},
 {id:'onu-real',url:'https://upload.wikimedia.org/wikipedia/commons/f/ff/General_Assembly_of_the_United_Nations.jpg',title:'General Assembly of the United Nations',author:'azugaldia',license:'CC BY 2.0',source:'Wikimedia Commons'}
];
const encoded=Buffer.from(JSON.stringify(assets,null,2)).toString('base64');
const remote=String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2
sudo install -d -m 0775 -o 989 -g 986 "$root/real"
printf '%s' '${encoded}' | base64 -d | sudo tee "$root/real/licenses.json" >/dev/null
sudo chown 989:986 "$root/real/licenses.json"
sudo chmod 0644 "$root/real/licenses.json"
sudo node - <<'NODE'
const fs=require('fs'),https=require('https'),path=require('path');
const root='/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/real';
const assets=JSON.parse(fs.readFileSync(root+'/licenses.json'));
function get(url,file,n=0){return new Promise((resolve,reject)=>{https.get(url,{headers:{'User-Agent':'GSA-TV-Editorial/1.0 (licensed-media-download)'}},r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location)return resolve(get(r.headers.location,file,n+1));if(r.statusCode!==200)return reject(Object.assign(new Error('HTTP '+r.statusCode+' '+url),{status:r.statusCode}));const w=fs.createWriteStream(file);r.pipe(w);w.on('finish',()=>w.close(resolve));}).on('error',reject)})}
(async()=>{for(const a of assets){const file=path.join(root,a.id+'.jpg');if(!fs.existsSync(file)||fs.statSync(file).size<10000){for(let n=0;n<4;n++){try{await get(a.url,file);break}catch(e){if(e.status!==429||n===3)throw e;await new Promise(r=>setTimeout(r,5000*(n+1)))}}}console.log(a.id,fs.statSync(file).size,a.license,a.author);await new Promise(r=>setTimeout(r,1500))}})().catch(e=>{console.error(e);process.exit(1)})
NODE
sudo chown -R 989:986 "$root/real"
`;
const r=await runSshScript(remote,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
