import fs from 'node:fs';
import path from 'node:path';
import { runSshScript } from './ssh2-run.mjs';

const root = new URL('../', import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');
const workflowDir = new URL('../infrastructure/gsa-tv/n8n/workflows/', import.meta.url);
const files = {
  'server.js': read('infrastructure/gsa-tv/services/n8n-bridge/server.js'),
  'ensure-network.sh': read('infrastructure/gsa-tv/scripts/ensure-n8n-automation-network.sh'),
  'import-workflows.sh': read('infrastructure/gsa-tv/scripts/import-n8n-workflows.sh'),
  'gsa-tv-n8n-network.service': read('infrastructure/gsa-tv/systemd/gsa-tv-n8n-network.service'),
  'gsa-tv-n8n-network.timer': read('infrastructure/gsa-tv/systemd/gsa-tv-n8n-network.timer'),
  'gsa-tv-n8n-bridge.service': read('infrastructure/gsa-tv/systemd/gsa-tv-n8n-bridge.service'),
};
for (const name of fs.readdirSync(workflowDir).filter((x) => x.endsWith('.json'))) {
  files[`workflows/${name}`] = fs.readFileSync(new URL(name, workflowDir), 'utf8');
}
const payload64 = Buffer.from(JSON.stringify(files)).toString('base64');

const remote = `set -euo pipefail
work=/tmp/gsa-tv-n8n-automation
rm -rf "$work" && mkdir -p "$work/workflows"
printf '%s' '${payload64}' | base64 -d | python3 -c 'import sys,json,os; d=json.load(sys.stdin); b="/tmp/gsa-tv-n8n-automation"; [(os.makedirs(os.path.dirname(b+"/"+k),exist_ok=True),open(b+"/"+k,"w",encoding="utf-8").write(v)) for k,v in d.items()]'
token=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="INTERNAL_API_TOKEN"{sub(/^INTERNAL_API_TOKEN=/,"");print;exit}')
test -n "$token"
`;
const remote2 = `snap_code=$(curl -sS -o /tmp/gsa-tv-automation-snapshot.json -w '%{http_code}' -H "Authorization: Bearer $token" http://127.0.0.1:9202/automation/snapshot)
test "$snap_code" = "200"
python3 -c 'import json; j=json.load(open("/tmp/gsa-tv-automation-snapshot.json")); c=j.get("channel") or {}; print("snapshot=ok|status=%s|desired=%s|signal=%s|ai_ready=%s"%(c.get("status"),c.get("desired_state"),c.get("signal_state"),len(j.get("ai_ready") or [])))'
sudo install -d -m 0750 -o root -g gsa-tv /opt/gsa-tv/n8n-bridge
sudo install -d -m 0755 -o root -g root /opt/gsa-tv/n8n/workflows
sudo install -m 0644 "$work/server.js" /opt/gsa-tv/n8n-bridge/server.js
sudo install -m 0755 "$work/ensure-network.sh" /opt/gsa-tv/n8n-bridge/ensure-network.sh
sudo install -m 0755 "$work/import-workflows.sh" /opt/gsa-tv/n8n-bridge/import-workflows.sh
sudo cp -f "$work"/workflows/*.json /opt/gsa-tv/n8n/workflows/
sudo chown -R root:root /opt/gsa-tv/n8n/workflows
sudo find /opt/gsa-tv/n8n/workflows -maxdepth 1 -type f -name '*.json' -exec chmod 0644 {} +
printf 'LISTEN_HOST=172.30.250.1\nPORT=19202\nALLOWED_CLIENT=172.30.250.2\nCONTROL_PLANE_URL=http://127.0.0.1:9202\nINTERNAL_API_TOKEN=%s\n' "$token" | sudo tee /opt/gsa-tv/n8n-bridge/.env >/dev/null
sudo chown root:gsa-tv /opt/gsa-tv/n8n-bridge/.env
sudo chmod 0640 /opt/gsa-tv/n8n-bridge/.env
sudo install -m 0644 "$work/gsa-tv-n8n-network.service" /etc/systemd/system/gsa-tv-n8n-network.service
sudo install -m 0644 "$work/gsa-tv-n8n-network.timer" /etc/systemd/system/gsa-tv-n8n-network.timer
sudo install -m 0644 "$work/gsa-tv-n8n-bridge.service" /etc/systemd/system/gsa-tv-n8n-bridge.service
sudo systemctl daemon-reload
sudo systemctl start gsa-tv-n8n-network.service
sudo systemctl enable --now gsa-tv-n8n-network.timer
sudo systemctl enable --now gsa-tv-n8n-bridge.service
`;
const remote3 = `sudo /opt/gsa-tv/n8n-bridge/import-workflows.sh
sudo docker restart n8n >/dev/null
for i in $(seq 1 60); do if curl -fsS http://127.0.0.1:5678/healthz >/dev/null 2>&1; then break; fi; sleep 1; done
curl -fsS http://127.0.0.1:5678/healthz >/dev/null
sudo systemctl restart gsa-tv-n8n-bridge.service
sleep 2
bridge_health=$(curl -sS -o /tmp/gsa-tv-bridge-health.json -w '%{http_code}' http://172.30.250.1:19202/health)
test "$bridge_health" = "200"
host_snapshot=$(curl -sS -o /tmp/gsa-tv-host-snapshot.txt -w '%{http_code}' http://172.30.250.1:19202/automation/snapshot)
test "$host_snapshot" = "403"
sudo docker exec n8n node -e "fetch('http://172.30.250.1:19202/automation/snapshot').then(async r=>{const j=await r.json();const c=j.channel||{};console.log('n8n_bridge='+r.status+'|'+c.status+'|'+c.signal_state);if(r.status!==200)process.exit(1)}).catch(e=>{console.error(e.message);process.exit(1)})"
db_user=$(sudo docker inspect n8n --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DB_POSTGRESDB_USER"{print $2}')
db_name=$(sudo docker inspect n8n --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DB_POSTGRESDB_DATABASE"{print $2}')
workflow_state=$(sudo docker exec evo-postgres psql -U "$db_user" -d "$db_name" -At -F '|' -c "select id,name,active from workflow_entity where name like 'GSA TV %' order by name")
printf '%s\n' "$workflow_state" | awk -F'|' '{print "workflow|"$1"|"$2"|active="($3=="t"?1:0)}'
test "$(printf '%s\n' "$workflow_state" | grep -c '|t$')" = "8"
systemctl is-active gsa-tv-n8n-bridge.service
systemctl is-active gsa-tv-n8n-network.timer
`;
const result = await runSshScript(remote + remote2 + remote3, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
