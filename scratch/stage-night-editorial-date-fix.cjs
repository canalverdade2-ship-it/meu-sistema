const fs=require('fs');
const cp=require('child_process');
const crypto=require('crypto');
const source='/opt/gsa-tv/control-plane/src/editorial-production.js';
const live=cp.execFileSync('docker',['exec','gsa-tv-control-plane','cat','/app/src/editorial-production.js'],{encoding:'utf8'});
const host=fs.readFileSync(source,'utf8');
if(live!==host)throw Error('Host/container divergentes; reconciliar antes de alterar');
const old=`and broadcast_date between (now() at time zone 'America/Sao_Paulo')::date+1
                                and (now() at time zone 'America/Sao_Paulo')::date+$2::int`;
const replacement=`and broadcast_date between
             (now() at time zone 'America/Sao_Paulo')::date
               + case when (now() at time zone 'America/Sao_Paulo')::time < time '06:00' then 0 else 1 end
             and (now() at time zone 'America/Sao_Paulo')::date + $2::int
               - case when (now() at time zone 'America/Sao_Paulo')::time < time '06:00' then 1 else 0 end`;
if(host.split(old).length!==2)throw Error('Ancora de patch inesperada');
const root='/home/opc/gsa-ai/work/night-factory-20260910';
fs.mkdirSync(root,{recursive:true});
const target=root+'/editorial-production.js';
fs.writeFileSync(target,host.replace(old,replacement),{mode:0o640});
cp.execFileSync('node',['--check',target]);
const mod=require(target);
const calls=[];
const pool={query:async(sql,params)=>{calls.push({sql,params});return {rows:[],rowCount:0};}};
(async()=>{
 const result=await mod.prepareEditorialProjects({pool,channelId:'ch-main',days:2});
 if(result.blocks!==0||calls.length!==1||!calls[0].sql.includes("time '06:00'"))throw Error('Teste de selecao falhou');
 const evidence={staged:true,activated:false,source,source_sha256:crypto.createHash('sha256').update(host).digest('hex'),staged_sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),syntax:'pass',mock_selection:'pass',target};
 fs.writeFileSync(root+'/date-fix-evidence.json',JSON.stringify(evidence,null,2),{mode:0o640});
 console.log(JSON.stringify(evidence));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
