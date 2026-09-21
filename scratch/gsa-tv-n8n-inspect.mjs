import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -e
printf '%s\n' '=== control-plane ==='
sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}'
printf '%s\n' '=== n8n-container ==='
sudo docker inspect n8n --format '{{.Config.Image}}|{{.HostConfig.RestartPolicy.Name}}|{{json .Config.Labels}}'
printf '%s\n' '=== n8n-networks ==='
sudo docker inspect n8n --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}|{{$v.IPAddress}}{{println}}{{end}}'
printf '%s\n' '=== n8n-mounts ==='
sudo docker inspect n8n --format '{{range .Mounts}}{{.Type}}|{{.Source}}|{{.Destination}}{{println}}{{end}}'
printf '%s\n' '=== workflow-count ==='
sudo docker exec n8n n8n list:workflow 2>/dev/null | wc -l
printf '%s\n' '=== automation-snapshot ==='
sudo docker exec gsa-tv-control-plane node -e "fetch('http://127.0.0.1:9202/automation/snapshot',{headers:{authorization:'Bearer '+process.env.INTERNAL_API_TOKEN}}).then(async r=>{let j=await r.json();console.log(JSON.stringify({http:r.status,channel:j.channel,watchdog:j.watchdog,counts:j.counts,storage:j.storage},null,2))}).catch(e=>{console.error(e.message);process.exit(1)})"
`;
const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
