import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`printf '%s\n' '=== control-plane ==='
sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>&1 || true
printf '%s\n' '=== snapshot-http ==='
token=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | awk -F= '$1=="INTERNAL_API_TOKEN"{sub(/^INTERNAL_API_TOKEN=/,"");print;exit}')
if [ -n "$token" ]; then curl -sS -o /tmp/snapdiag.json -w '%{http_code}\n' -H "Authorization: Bearer $token" http://127.0.0.1:9202/automation/snapshot; python3 -c 'import json; p="/tmp/snapdiag.json"; j=json.load(open(p)); print({"error":j.get("error"),"channel":j.get("channel"),"ai_ready_count":len(j.get("ai_ready") or [])})' 2>/dev/null || true; else echo token_missing; fi
printf '%s\n' '=== installed-files ==='
for f in /opt/gsa-tv/n8n-bridge/server.js /opt/gsa-tv/n8n-bridge/.env /etc/systemd/system/gsa-tv-n8n-network.service /etc/systemd/system/gsa-tv-n8n-bridge.service; do [ -e "$f" ] && echo yes:$f || echo no:$f; done
printf '%s\n' '=== network ==='
sudo docker network inspect gsa-tv-automation-net --format '{{json .IPAM.Config}}|{{range $k,$v := .Containers}}{{$v.Name}}={{$v.IPv4Address}} {{end}}' 2>&1 || true
printf '%s\n' '=== systemd ==='
for u in gsa-tv-n8n-network.service gsa-tv-n8n-network.timer gsa-tv-n8n-bridge.service; do echo -n "$u="; systemctl is-active "$u" 2>/dev/null || true; done
printf '%s\n' '=== workflows ==='
sudo docker exec n8n n8n list:workflow 2>/dev/null || true
`;
const r=await runSshScript(remote,45000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
