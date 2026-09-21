import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const base='/home/opc/gsa-ai/work/identity-flow-20260907';
const cand=path.join(base,'candidates');
const logos='/home/opc/gsa-ai/data/downloads/identity-logos-20260907';
const out=path.join(base,'masters-v4');
fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(cand).filter(x=>x.endsWith('.mp4')).sort();
const by=n=>path.join(cand,files[n-1]);
const map=[
 ['gsa-misterios',2,1],['gsa-planeta-terra',4,3],['gsa-desenhos',6,5],['gsa-sessao-pipoca',8,7],['gsa-cinema',10,9],['gsa-esportes',12,11],['gsa-ta-na-rede',14,13],['gsa-music',16,15],['gsa-hora-da-palavra',18,17],['gsa-historias-da-biblia',20,19],['gsa-em-fe',22,26],['gsa-sabor',24,23],['gsa-bem-viver',28,27],['gsa-destinos',30,29],['gsa-mundo',31,33],['gsa-agro',34,32],['gsa-motor',36,35],['gsa-tech',37,37],['gsa-business',43,40],['gsa-cidadania',44,39],['gsa-tempo',45,42],['gsa-meio-dia-news',47,46],['gsa-manha-news',48,48],['gsa-news-noite',41,38],['gsa-mercado',50,49]
];
const run=args=>spawnSync('docker',['run','--rm','-i','-u','0','-v','/home:/home','-v','/opt:/opt','gsa-tv/control-plane:1.7.9','ffmpeg',...args],{encoding:'utf8',maxBuffer:8e6});
const records=[];
for(const [slug,opening,closing] of map) for(const [kind,n] of [['opening',opening],['closing',closing]]) {
 const src=by(n),logo=path.join(logos,`${slug}.png`),dst=path.join(out,`${slug}-${kind}.mp4`);
 const logoStart=kind==='opening'?4.65:4.15;
 const logoOut=kind==='opening'?9.65:9.35;
 const fc=`[0:v]scale=2304:1296:force_original_aspect_ratio=increase,crop=1920:1080,setpts=1.25*PTS,fps=30,trim=duration=10,gblur=sigma=12,eq=saturation=1.10:contrast=1.04,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.08:t=fill[scene];[scene]drawbox=x=0:y=0:w=iw:h=ih:color=0x020713@0.98:t=fill:enable='gte(t,${logoStart-0.45})'[base];[1:v]scale=1050:760:force_original_aspect_ratio=decrease,format=rgba,fade=t=in:st=${logoStart}:d=0.65:alpha=1,fade=t=out:st=${logoOut}:d=0.35:alpha=1[lg];[base][lg]overlay=(W-w)/2:(H-h)/2:enable='gte(t,${logoStart})'[v];[0:a]atempo=0.8,atrim=duration=10,afade=t=in:st=0:d=0.35,afade=t=out:st=9.35:d=0.65[a]`;
 const args=['-y','-i',src,'-loop','1','-framerate','30','-i',logo,'-filter_complex',fc,'-map','[v]','-map','[a]','-t','10','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dst];
 const r=run(args); if(r.status!==0){console.error('FAIL',slug,kind,r.stderr.slice(-2000));process.exit(1)}
 records.push({slug,kind,source_index:n,source:src,logo,master:dst}); console.log(`${records.length}/50 ${slug} ${kind}`);
}
fs.writeFileSync(path.join(out,'master-manifest.json'),JSON.stringify(records,null,2));


