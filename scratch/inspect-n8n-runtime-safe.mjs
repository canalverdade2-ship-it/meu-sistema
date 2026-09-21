import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
node <<'NODE'
const {execFileSync}=require('child_process');
const j=JSON.parse(execFileSync('docker',['inspect','n8n'],{encoding:'utf8'}))[0];
const env=Object.fromEntries((j.Config.Env||[]).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
const sensitive=/KEY|PASSWORD|SECRET|TOKEN|API|CREDENTIAL|AUTH/i;
console.log('image='+j.Config.Image);
console.log('restart='+j.HostConfig.RestartPolicy.Name);
console.log('cmd='+JSON.stringify(j.Config.Cmd||[]));
console.log('entrypoint='+JSON.stringify(j.Config.Entrypoint||[]));
console.log('user='+(j.Config.User||''));
console.log('workdir='+(j.Config.WorkingDir||''));
console.log('mounts='+JSON.stringify(j.Mounts.map(m=>({type:m.Type,name:m.Name||null,source:m.Source,destination:m.Destination,rw:m.RW}))));
console.log('networks='+JSON.stringify(Object.fromEntries(Object.entries(j.NetworkSettings.Networks).map(([k,v])=>[k,{ip:v.IPAddress,aliases:v.Aliases||[]}]))));
console.log('ports='+JSON.stringify(j.HostConfig.PortBindings));
for(const k of Object.keys(env).sort()) console.log('env|'+k+'='+(sensitive.test(k)?'<redacted>':env[k]));
NODE
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);