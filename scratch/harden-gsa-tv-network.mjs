import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
for port in 5432/tcp 5433/tcp 5678/tcp; do
  sudo firewall-cmd --permanent --zone=public --remove-port="$port" >/dev/null || true
done
sudo firewall-cmd --reload >/dev/null
# Containers publicados podem atravessar a zona normal do firewalld. A cadeia
# DOCKER-USER bloqueia apenas entrada pela interface pública; localhost,
# Cloudflare Tunnel e a rede privada de automação continuam permitidos.
for port in 5432 5433 5678; do
  sudo firewall-cmd --permanent --direct --add-rule ipv4 filter DOCKER-USER 0 -i enp0s6 -p tcp --dport "$port" -j DROP >/dev/null || true
done
sudo firewall-cmd --reload >/dev/null
echo PUBLIC_PORTS
sudo firewall-cmd --zone=public --list-ports
echo LOCAL_HEALTH
curl -fsS http://127.0.0.1:5678/healthz
echo
curl -fsS http://127.0.0.1:9202/health
echo
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
