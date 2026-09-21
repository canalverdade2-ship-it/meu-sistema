import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== CONTROL ==='
sudo docker inspect gsa-tv-control-plane --format 'image={{.Config.Image}} restart={{.HostConfig.RestartPolicy.Name}} network={{.HostConfig.NetworkMode}} workdir={{.Config.WorkingDir}} user={{.Config.User}}'
sudo docker inspect gsa-tv-control-plane --format '{{range .Mounts}}{{println .Type .Source .Destination .RW}}{{end}}'
echo '=== ENGINE ==='
sudo docker inspect gsa-tv-encoder-engine --format 'image={{.Config.Image}} restart={{.HostConfig.RestartPolicy.Name}} network={{.HostConfig.NetworkMode}} workdir={{.Config.WorkingDir}} user={{.Config.User}}'
sudo docker inspect gsa-tv-encoder-engine --format '{{range .Mounts}}{{println .Type .Source .Destination .RW}}{{end}}'
echo '=== IMAGES ==='
sudo docker images --no-trunc --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedAt}}' | grep -E 'gsa|control|encoder' || true
echo '=== LAUNCH FILES ==='
find /opt/gsa-tv -maxdepth 4 -type f \( -name '*.sh' -o -name '*.service' -o -name 'docker-compose*.yml' -o -name 'compose*.yml' \) -print
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
