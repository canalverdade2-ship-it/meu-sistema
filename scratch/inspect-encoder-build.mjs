import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(String.raw`set -euo pipefail
echo IMAGES
sudo docker image ls --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedSince}}' | grep 'gsa-tv/encoder-engine' || true
echo PROCESSES
ps -eo pid,etimes,cmd | grep -E 'docker build|buildkit|npm install|apt-get' | grep -v grep || true
echo DISK
df -h / /var/lib/docker 2>/dev/null || true
echo DOCKER
sudo docker ps -a --format '{{.Names}}|{{.Status}}|{{.Image}}' | grep encoder || true
`, 30000);
process.stdout.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr);
