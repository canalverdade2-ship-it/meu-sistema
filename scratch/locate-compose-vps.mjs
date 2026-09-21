import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo docker inspect gsa-tv-control-plane --format '{{json .Config.Labels}}'
sudo docker inspect gsa-tv-control-plane --format '{{json .HostConfig.Binds}}'
sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}} {{json .Config.Env}}'
systemctl list-unit-files | grep -Ei 'gsa|control|encoder' || true
grep -Rni 'gsa-tv-control-plane' /etc/systemd /opt/gsa-tv 2>/dev/null | head -n 100 || true
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
