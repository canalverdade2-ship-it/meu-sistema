import { runSshScript } from './ssh2-run.mjs';
const js=String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),path=require('path');
function secret(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key}
function slug(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
const spoken={
'GSA Manhã News':'Gê Esse Á Manhã News','GSA Meio Dia News':'Gê Esse Á Meio-Dia News','GSA News Noite':'Gê Esse Á News Noite',
'GSA Mercado':'Gê Esse Á Mercado','GSA Tempo':'Gê Esse Á Tempo','GSA Cidadania':'Gê Esse Á Cidadania','GSA Business':'Gê Esse Á Business','GSA Tech':'Gê Esse Á Tech','GSA Motor':'Gê Esse Á Motor','GSA Agro':'Gê Esse Á Agro','GSA Mundo':'Gê Esse Á Mundo','GSA Destinos':'Gê Esse Á Destinos','GSA Bem Viver':'Gê Esse Á Bem Viver','GSA Sabor':'Gê Esse Á Sabor','GSA Em Fé':'Gê Esse Á Em Fé','GSA Hora da Palavra':'Gê Esse Á Hora da Palavra','GSA Tá na Rede':'Gê Esse Á Tá na Rede','GSA Esportes':'Gê Esse Á Esportes','GSA Mistérios':'Gê Esse Á Mistérios','GSA Music':'Gê Esse Á Music','GSA Cinema':'Gê Esse Á Cinema','GSA Sessão Pipoca':'Gê Esse Á Sessão Pipoca','GSA Planeta Terra':'Gê Esse Á Planeta Terra','GSA Histórias da Bíblia':'Gê Esse Á Histórias da Bíblia','GSA Desenhos':'Gê Esse Á Desenhos'};
(async()=>{const key=secret(),base='/home/opc/gsa-ai/qc/program-bumpers-2026-09-05',dry=path.join(base,'dry');fs.mkdirSync(dry,{recursive:true});const cast=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/qc/fish-voices/provisional-assignment-2026-09-05.json','utf8'));const voices=new Map(cast.map(x=>[x.program,x.voice_id]));const master='5c8a9b5d0b2549c7ada853529199ebe5';for(const p of ['GSA Manhã News','GSA Meio Dia News','GSA News Noite'])voices.set(p,master);let ok=0;for(const [program,label] of Object.entries(spoken)){for(const kind of ['apresentando','de-volta']){const text=kind==='apresentando'?'Estamos apresentando: '+label+'.':'Estamos de volta com: '+label+'.';const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify({text,reference_id:voices.get(program),format:'mp3',normalize:true,latency:'normal',prosody:{speed:1,volume:0,normalize_loudness:true}})});const b=Buffer.from(await r.arrayBuffer());if(!r.ok){console.error(JSON.stringify({program,kind,status:r.status,error:b.toString().slice(0,200)}));continue}const f=slug(program)+'--'+kind+'.mp3';fs.writeFileSync(path.join(dry,f),b,{mode:0o640});ok++;console.log(JSON.stringify({program,kind,file:f,bytes:b.length}))}}fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify({created_at:new Date().toISOString(),model:'s2.1-pro-free',total:50,voices:Object.fromEntries(voices),spoken},null,2));console.log(JSON.stringify({complete:true,ok,expected:50,base}))})().catch(e=>{console.error(e.stack);process.exit(1)});`;
const e=Buffer.from(js).toString('base64');
const sh=`printf '%s' '${e}'|base64 -d >/tmp/generate-bumpers.js
node /tmp/generate-bumpers.js
rm -f /tmp/generate-bumpers.js
sudo mkdir -p /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/dry /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered
sudo cp /home/opc/gsa-ai/qc/program-bumpers-2026-09-05/dry/*.mp3 /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/dry/
sudo cp /home/opc/gsa-ai/qc/program-bumpers-2026-09-05/manifest.json /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/
for f in /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/dry/*.mp3; do
  n=$(basename "$f")
  sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
    -i "/media/1/identity/program-bumpers-2026-09-05/dry/$n" \
    -f lavfi -i "sine=frequency=110:duration=7,volume=0.045" \
    -f lavfi -i "sine=frequency=165:duration=7,volume=0.025" \
    -f lavfi -i "sine=frequency=247:duration=7,volume=0.018" \
    -filter_complex "[1:a][2:a][3:a]amix=inputs=3:normalize=0,afade=t=in:st=0:d=.25,afade=t=out:st=5.2:d=1.8[bed];[0:a]adelay=250|250,volume=1.18[vox];[bed][vox]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]" \
    -map "[a]" -ac 2 -ar 48000 -b:a 192k "/media/1/identity/program-bumpers-2026-09-05/mastered/$n"
done
sudo cp /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/*.mp3 /home/opc/gsa-ai/qc/program-bumpers-2026-09-05/ 2>/dev/null || true
sudo chown -R opc:opc /home/opc/gsa-ai/qc/program-bumpers-2026-09-05
echo DRY=$(find /home/opc/gsa-ai/qc/program-bumpers-2026-09-05/dry -name '*.mp3'|wc -l)
echo MASTERED=$(find /home/opc/gsa-ai/qc/program-bumpers-2026-09-05 -maxdepth 1 -name '*.mp3'|wc -l)`;
const r=await runSshScript(sh,600000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
