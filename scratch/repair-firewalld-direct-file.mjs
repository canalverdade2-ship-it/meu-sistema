import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo cp -a /etc/firewalld/direct.xml "/etc/firewalld/direct.xml.before-gsa-tv-$stamp"
sudo sed -i '/chain="DOCKER-USER".*--dport \(5432\|5433\|5678\)/d' /etc/firewalld/direct.xml
sudo systemctl restart firewalld
sudo firewall-cmd --state
sudo firewall-cmd --zone=public --list-ports
curl -fsS http://127.0.0.1:5678/healthz
echo
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
