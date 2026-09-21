import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
for c in gsa-tv-control-plane gsa-tv-encoder-engine; do
 echo "=== $c ==="
 sudo docker inspect "$c" --format 'id={{.Id}} image={{.Config.Image}} started={{.State.StartedAt}} restart={{.HostConfig.RestartPolicy.Name}} project={{index .Config.Labels "com.docker.compose.project"}} service={{index .Config.Labels "com.docker.compose.service"}} workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}} config={{index .Config.Labels "com.docker.compose.project.config_files"}} network={{.HostConfig.NetworkMode}}'
done
echo '=== STATUS API ==='
token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' /opt/gsa-tv/control-plane/.env)
curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status || true
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
