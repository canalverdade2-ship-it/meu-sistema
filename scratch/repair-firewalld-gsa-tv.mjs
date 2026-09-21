import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
for port in 5432 5433 5678; do
  sudo firewall-cmd --permanent --direct --remove-rule ipv4 filter DOCKER-USER 0 -i enp0s6 -p tcp --dport "$port" -j DROP >/dev/null 2>&1 || true
done
sudo firewall-cmd --reload >/dev/null
sudo firewall-cmd --state
sudo firewall-cmd --zone=public --list-ports
curl -fsS http://127.0.0.1:5678/healthz
echo
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
