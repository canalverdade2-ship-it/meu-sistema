import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
echo '---PATCH---'
if sudo test -f /home/opc/fix-gsa-1638-restore.py; then sudo sed -n '1,260p' /home/opc/fix-gsa-1638-restore.py; else echo MISSING; fi
echo '---SOURCE-FILES---'
sudo find /opt/gsa-tv/control-plane -maxdepth 3 -type f \( -name 'app.js' -o -name 'Dockerfile' -o -name 'docker-compose.yml' \) -printf '%p\n' | sort
echo '---CURRENT-SOURCE-SECTIONS---'
src=/opt/gsa-tv/control-plane/src/app.js
if sudo test -f "$src"; then
  sudo sed -n '930,1045p' "$src"
  sudo sed -n '4090,4170p' "$src"
  sudo sed -n '4490,4565p' "$src"
fi
echo '---IMAGES---'
sudo docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedAt}}' | grep '^gsa-tv/control-plane:' | head -12
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
