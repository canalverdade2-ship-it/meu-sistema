import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`echo PUBLISH_HELP
sudo docker exec n8n n8n publish:workflow --help 2>&1 || true
echo WORKFLOWS
sudo docker exec n8n n8n list:workflow 2>/dev/null || true
echo NETWORK
sudo docker network inspect gsa-tv-automation-net --format '{{range $k,$v := .Containers}}{{$v.Name}}={{$v.IPv4Address}} {{end}}' 2>&1 || true
echo SERVICES
for u in gsa-tv-n8n-network.service gsa-tv-n8n-network.timer gsa-tv-n8n-bridge.service; do echo -n "$u="; systemctl is-active "$u" 2>/dev/null || true; done
`;
const r=await runSshScript(remote,45000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
