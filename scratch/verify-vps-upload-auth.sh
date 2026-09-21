node <<'JS'
(async()=>{
for (const route of ['/upload','/delete']) {
for (const auth of ['', 'Bearer invalid-audit-token']) {
const r=await fetch('http://127.0.0.1:9095'+route,{method:route==='/delete'?'DELETE':'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:'{"paths":[]}'});
console.log(route,auth?'invalid bearer':'anonymous',r.status);
if(r.status!==401)process.exitCode=1;
}}
const h=await fetch('http://127.0.0.1:9095/health');console.log('health',h.status);
})().catch(e=>{console.error(e.message);process.exitCode=1});
JS
