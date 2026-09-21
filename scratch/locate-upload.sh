pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))if(p.name==="gsa-upload")console.log(p.pm2_env.pm_exec_path)})'
