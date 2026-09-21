import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(String.raw`set -e
sudo docker ps -a --format '{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}' | grep 'gsa-tv-control-plane' || true
sudo docker inspect --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' gsa-tv-control-plane 2>/dev/null || true
sudo docker inspect --format '{{json .Config.Labels}}' gsa-tv-control-plane 2>/dev/null || true
sudo grep -n 'image:' /opt/gsa-tv/control-plane/compose.yml || true
curl -fsS http://127.0.0.1:9202/health || true
echo
`, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
