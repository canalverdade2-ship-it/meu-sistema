import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
echo 'CONFIG'
sudo docker inspect gsa-tv-control-plane --format 'image={{.Config.Image}} restart={{.HostConfig.RestartPolicy.Name}} network={{.HostConfig.NetworkMode}} readonly={{.HostConfig.ReadonlyRootfs}} user={{.Config.User}}'
echo 'LABELS'
sudo docker inspect gsa-tv-control-plane --format '{{json .Config.Labels}}'
echo 'MOUNTS'
sudo docker inspect gsa-tv-control-plane --format '{{range .Mounts}}{{println .Source "|" .Destination "|" .Mode}}{{end}}'
echo 'TMPFS'
sudo docker inspect gsa-tv-control-plane --format '{{json .HostConfig.Tmpfs}}'
echo 'SECURITY'
sudo docker inspect gsa-tv-control-plane --format 'capdrop={{json .HostConfig.CapDrop}} security={{json .HostConfig.SecurityOpt}} envfile-na'
echo 'FILES'
sudo find /opt/gsa-tv -maxdepth 3 -type f \( -name 'compose*.yml' -o -name 'docker-compose*.yml' -o -name '*.service' \) -print | sort
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
