import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
sudo tee /opt/gsa-tv/bin/deploy-control-plane-safe.sh >/dev/null <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ]; then
  echo 'Uso: deploy-control-plane-safe.sh gsa-tv/control-plane:<versao>' >&2
  exit 64
fi
target_image="$1"
if ! printf '%s' "$target_image" | grep -Eq '^gsa-tv/control-plane:[A-Za-z0-9._-]+$'; then
  echo 'Imagem de Control Plane inválida.' >&2
  exit 64
fi
dburl=$(docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
state=$(docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select desired_state,signal_state from public.gsa_tv_channels where id='ch-main'")
encoders=$(docker top gsa-tv-control-plane -eo pid,args 2>/dev/null | grep -c '[f]fmpeg' || true)
if [ "$state" = 'running|sending' ] || [ "$encoders" -gt 0 ]; then
  echo "REFUSED: canal em transmissao ($state; encoders=$encoders). A troca do container encerraria o FFmpeg ativo." >&2
  echo 'Use uma janela off-air ou migre primeiro o encoder para um serviço independente.' >&2
  exit 75
fi
docker image inspect "$target_image" >/dev/null
echo "SAFE_TO_DEPLOY|$target_image|$state|encoders=$encoders"
SH
sudo chmod 0755 /opt/gsa-tv/bin/deploy-control-plane-safe.sh
set +e
guard_output=$(sudo /opt/gsa-tv/bin/deploy-control-plane-safe.sh gsa-tv/control-plane:1.6.39 2>&1)
guard_rc=$?
set -e
echo "guard_rc|$guard_rc"
echo "guard_output|$guard_output"
test "$guard_rc" -eq 75
echo "running_container|$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Status}}|{{.State.Health.Status}}')"
echo "encoder_count|$(sudo docker top gsa-tv-control-plane -eo pid,args | grep -c '[f]fmpeg' || true)"
`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
