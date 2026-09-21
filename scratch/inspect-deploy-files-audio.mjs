import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== COMPOSE FILES ==='
sudo find /opt/gsa-tv -maxdepth 3 -type f | grep -E '/(compose|docker-compose)[^/]*\\.ya?ml$' || true
echo '=== IMAGE REFERENCES ==='
sudo grep -RniE 'control-plane:1\\.8\\.2|gsa-tv-control-plane|encoder-engine' /opt/gsa-tv/*.yml /opt/gsa-tv/*.yaml /opt/gsa-tv/*/*.yml /opt/gsa-tv/*/*.yaml 2>/dev/null | head -n 100 || true
echo '=== CONTAINER LABELS ==='
for c in gsa-tv-control-plane gsa-tv-encoder-engine; do
  sudo docker inspect "$c" --format '{{.Name}}|image={{.Config.Image}}|project={{index .Config.Labels "com.docker.compose.project"}}|file={{index .Config.Labels "com.docker.compose.project.config_files"}}|service={{index .Config.Labels "com.docker.compose.service"}}' 2>/dev/null || true
done
echo '=== ENGINE ENV SAFE ==='
sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -vEi 'key|secret|password|token|rtmp_url' | sort
`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
