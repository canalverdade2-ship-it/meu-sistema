const fs=require('fs'),cp=require('child_process'),vm=require('vm'),crypto=require('crypto');
const live=cp.execFileSync('docker',['exec','gsa-tv-control-plane','cat','/app/src/app.js'],{encoding:'utf8',maxBuffer:4*1024*1024});
const host=fs.readFileSync('/opt/gsa-tv/control-plane/src/app.js','utf8');
const hostDiffers=host!==live; // Stage from running version only; never overwrite the host source.
const start=live.indexOf('async function probeProgramBuilderMaster(');
const end=live.indexOf('async function scheduleProgramBuilderMaster(',start);
if(start<0||end<start)throw Error('Limites de patch desconhecidos');
const original=live.slice(start,end);
const fixed=original.replace(/\b1280\b/g,'1920').replace(/\b720\b/g,'1080').replace('1280x720','1920x1080');
const patched=live.slice(0,start)+fixed+live.slice(end);
const target='/home/opc/gsa-ai/work/night-factory-20260910/app.js';
fs.writeFileSync(target,patched,{mode:0o640});
cp.execFileSync('node',['--check',target]);
const func=fixed.slice(0,fixed.indexOf('async function registerProgramBuilderMaster('));
const probeData={streams:[{codec_type:'video',codec_name:'h264',width:1920,height:1080,avg_frame_rate:'30/1'},{codec_type:'audio',codec_name:'aac',sample_rate:'48000',channels:2}],format:{duration:'1800'}};
const context=vm.createContext({execFileAsync:async()=>({stdout:JSON.stringify(probeData)}),parseFpsValue:s=>s.includes('/')?Number(s.split('/')[0])/Number(s.split('/')[1]):Number(s)});
vm.runInContext(func+';globalThis.probe=probeProgramBuilderMaster;',context);
(async()=>{
 await context.probe('/test.mp4');
 probeData.streams[0].width=1280;probeData.streams[0].height=720;
 let rejected=false;try{await context.probe('/test.mp4');}catch{rejected=true;}
 if(!rejected)throw Error('720p deveria ser rejeitado');
 const evidence={staged:true,activated:false,requires_source_reconciliation:hostDiffers,target,source_sha256:crypto.createHash('sha256').update(live).digest('hex'),host_sha256:crypto.createHash('sha256').update(host).digest('hex'),staged_sha256:crypto.createHash('sha256').update(patched).digest('hex'),syntax:'pass',accept1080:'pass',reject720:'pass'};
 fs.writeFileSync('/home/opc/gsa-ai/work/night-factory-20260910/1080-fix-evidence.json',JSON.stringify(evidence,null,2),{mode:0o640});
 console.log(JSON.stringify(evidence));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
