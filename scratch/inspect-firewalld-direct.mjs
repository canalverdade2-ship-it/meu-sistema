import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
sudo cat /etc/firewalld/direct.xml 2>/dev/null || true
echo RUNTIME
sudo firewall-cmd --direct --get-all-rules 2>/dev/null || true
echo PERMANENT
sudo firewall-cmd --permanent --direct --get-all-rules 2>/dev/null || true
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
