import { runSshScript } from './ssh2-run.mjs';
const js=String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),path=require('path');
function secret(){const v=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json','utf8'));const k=Buffer.from(cp.execFileSync('sudo',['docker','exec','gsa-tv-control-plane','printenv','GSA_TV_SECRET_KEY'],{encoding:'utf8'}).trim(),'hex');const n=Buffer.from(v.nonce,'base64url'),a=Buffer.from(v.ciphertext,'base64url'),t=a.subarray(-16),b=a.subarray(0,-16),d=crypto.createDecipheriv('aes-256-gcm',k,n);d.setAAD(Buffer.from(v.aad));d.setAuthTag(t);return JSON.parse(Buffer.concat([d.update(b),d.final()]).toString()).api_key}
const texts={
'GSA Mercado':'Olá, eu sou Eduardo Salles. No GSA Mercado, você acompanha os movimentos da economia e entende como cada mudança pode afetar o seu dia a dia.',
'GSA Tempo':'Olá, eu sou Clara Venturi. O dia começa com sol entre nuvens, mas áreas de instabilidade podem provocar chuva forte no período da tarde.',
'GSA Cidadania':'Olá, eu sou Patrícia Silva. Informação clara sobre seus direitos, serviços públicos e oportunidades para cuidar melhor da sua família.',
'GSA Business':'Eu sou Ricardo Brandão. Estratégia, inovação e decisões inteligentes para transformar boas ideias em negócios sustentáveis.',
'GSA Tech':'Fala, pessoal! Eu sou Caio Nex. Hoje vamos descobrir uma tecnologia que promete mudar a maneira como trabalhamos e nos conectamos.',
'GSA Motor':'Eu sou Bruna Ventura. Aperte o cinto, porque hoje vamos conhecer desempenho, segurança e as novidades que movimentam o mundo dos motores.',
'GSA Agro':'Olá, eu sou Daniel Campos. Informação do campo, tecnologia rural e os caminhos de quem alimenta o Brasil todos os dias.',
'GSA Mundo':'Eu sou Olívia Valverde. Agora, os acontecimentos internacionais que ajudam você a compreender um mundo em constante transformação.',
'GSA Destinos':'Oi, eu sou Marina Horizonte. Prepare as malas: nosso próximo destino reúne paisagens incríveis, cultura e experiências inesquecíveis.',
'GSA Bem Viver':'Eu sou Lucas Sereno. Pequenas escolhas podem trazer mais equilíbrio, saúde e qualidade de vida para a sua rotina.',
'GSA Sabor':'Olá, eu sou a chef Lorena Prado. Hoje vamos preparar uma receita simples, cheia de sabor e com aquele carinho especial de comida feita em casa.',
'GSA Em Fé':'Eu sou o pastor Samuel Veredas. Respire fundo e abra o coração, porque Deus sempre tem uma palavra de esperança para renovar a nossa caminhada.',
'GSA Hora da Palavra':'Olá, eu sou Elisa Monteiro. Em poucos minutos, um ensinamento da Bíblia para iluminar suas decisões e fortalecer sua vida espiritual.',
'GSA Tá na Rede':'Oi, gente! Eu sou Nina Conecta. Vem comigo conferir os assuntos, tendências e histórias que estão movimentando a internet.',
'GSA Esportes':'Eu sou André Linhares. Prepare a torcida, porque a emoção do esporte começa agora, com informação, energia e todos os destaques da rodada!',
'GSA Mistérios':'Eu sou Aurora Alencar. Existem histórias que atravessam o tempo e perguntas que ainda permanecem sem resposta. Vamos investigar juntos.',
'GSA Music':'Fala, galera! Eu sou Mauro Beat. Aumente o som, porque a melhor música, os grandes sucessos e muita energia começam agora.',
'GSA Cinema':'Eu sou Thea Lumière. Luzes, câmera e grandes histórias: vamos descobrir os filmes que marcaram gerações e continuam emocionando o público.',
'GSA Sessão Pipoca':'Oi, eu sou Beto Pipoca. Prepare o sofá e a pipoca, porque hoje tem diversão, aventura e uma história especial para toda a família.',
'GSA Planeta Terra':'Eu sou Gaia Monteverde. Em cada floresta, oceano e montanha, a natureza revela histórias extraordinárias sobre a vida em nosso planeta.',
'GSA Histórias da Bíblia':'Eu sou Salomão Oliveira. Hoje, vamos atravessar os caminhos das Escrituras e conhecer uma história de coragem, fé e transformação.',
'GSA Desenhos':'Oi, turminha! Eu sou Luna Alegria. Preparem a imaginação, porque nossa próxima aventura está cheia de descobertas, amizade e diversão!'};
function slug(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
(async()=>{const key=secret(),a=JSON.parse(fs.readFileSync('/home/opc/gsa-ai/qc/fish-voices/provisional-assignment-2026-09-05.json','utf8'));const dir='/home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05';fs.mkdirSync(dir,{recursive:true});let ok=0;for(const v of a){const body={text:texts[v.program],reference_id:v.voice_id,format:'mp3',normalize:true,latency:'normal',prosody:{speed:v.program==='GSA Esportes'?1.08:(['GSA Em Fé','GSA Hora da Palavra','GSA Histórias da Bíblia','GSA Planeta Terra','GSA Mistérios'].includes(v.program)?.94:1),volume:0,normalize_loudness:true}};const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify(body)});const b=Buffer.from(await r.arrayBuffer());if(!r.ok){console.error(JSON.stringify({program:v.program,status:r.status,error:b.toString().slice(0,200)}));continue}const file=slug(v.program)+'--'+slug(v.presenter)+'.mp3';fs.writeFileSync(path.join(dir,file),b,{mode:0o640});v.audition_file=file;v.audition_bytes=b.length;ok++;console.log(JSON.stringify({program:v.program,presenter:v.presenter,file,bytes:b.length}))}fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(a,null,2));console.log(JSON.stringify({complete:true,ok,total:a.length,dir}))})().catch(e=>{console.error(e.stack);process.exit(1)});`;
const e=Buffer.from(js).toString('base64');const r=await runSshScript(`printf '%s' '${e}'|base64 -d >/tmp/generate-auditions.js
node /tmp/generate-auditions.js
rm -f /tmp/generate-auditions.js`,300000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
