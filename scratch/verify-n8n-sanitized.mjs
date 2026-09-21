import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== secret-file ==='
sudo stat -c 'mode=%a|owner=%U:%G|bytes=%s' /etc/gsa/n8n.env
echo '=== compose ==='
grep -E '^(name:|    image:|    container_name:|    env_file:|      - "127\.0\.0\.1:5678:5678"|    external: true)' /home/opc/gsa-hub/docker-compose.yml || true
echo '=== hardcoded-secret-files ==='
grep -RIlE 'POSTGRES_PASSWORD:[[:space:]]*[^$]|N8N_ENCRYPTION_KEY:[[:space:]]*[^$]|AUTH_API_KEY:[[:space:]]*[^$]|DATABASE_CONNECTION_URI=.*://[^[:space:]]+:[^@]+@' /home/opc/gsa-hub 2>/dev/null || true
echo '=== tv-through-bridge ==='
docker exec n8n node -e "fetch('http://172.30.250.1:19202/automation/snapshot').then(r=>r.json()).then(d=>{let c=d.channel||{};console.log('status='+c.status+'|desired='+c.desired_state+'|playout='+c.playout_state+'|signal='+c.signal_state+'|error='+(c.last_error||''))}).catch(e=>{console.error(e.message);process.exit(1)})"
echo '=== bindings ==='
docker inspect -f '{{(index (index .HostConfig.PortBindings "5678/tcp") 0).HostIp}}:{{(index (index .HostConfig.PortBindings "5678/tcp") 0).HostPort}}' n8n
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);