import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
sudo docker inspect n8n --format 'IMAGE={{.Config.Image}} RESTART={{.HostConfig.RestartPolicy.Name}} NETWORK={{.HostConfig.NetworkMode}}'
sudo docker inspect n8n --format 'PORTS={{json .HostConfig.PortBindings}}'
sudo docker inspect n8n --format 'MOUNTS={{json .Mounts}}'
sudo docker inspect n8n --format 'CMD={{json .Config.Cmd}} ENTRY={{json .Config.Entrypoint}}'
sudo docker inspect n8n --format 'NETWORKS={{json .NetworkSettings.Networks}}'
echo CANDIDATES
sudo find /opt /home/opc /root -maxdepth 5 -type f \( -name 'compose.yml' -o -name 'docker-compose.yml' -o -name 'compose.yaml' -o -name 'docker-compose.yaml' \) -print 2>/dev/null | head -100
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
