import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!password) throw new Error('Senha de infraestrutura não encontrada.');

const sql = fs.readFileSync(new URL('../supabase/migrations/20260902170000_gsa_tv_media_purge_cascade.sql', import.meta.url), 'utf8');

const files = {
  Dockerfile: fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/Dockerfile', import.meta.url), 'utf8'),
  'package.json': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/package.json', import.meta.url), 'utf8'),
  'src/app.js': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/src/app.js', import.meta.url), 'utf8'),
  'src/gemini.js': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/src/gemini.js', import.meta.url), 'utf8'),
};

files['compose.yml'] = `services:
  control-plane:
    build: .
    image: gsa-tv/control-plane:1.6.15
    container_name: gsa-tv-control-plane
    restart: unless-stopped
    network_mode: host
    env_file: .env
    read_only: true
    tmpfs:
      - /tmp:size=64m,mode=1777
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    volumes:
      - /opt/gsa-tv/playlists:/playlists
      - /opt/gsa-tv/cache/media:/media
      - /opt/gsa-tv/fallback:/fallback:ro
      - /opt/gsa-tv/preview:/preview:ro
      - /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password:/run/secrets/ffplayout-admin-password:ro
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:9202/health',r=>process.exit(r.statusCode===200?0:1))"]
      interval: 30s
      timeout: 5s
      retries: 3
`;

const payload = Buffer.from(JSON.stringify(files)).toString('base64');
const sql64 = Buffer.from(sql).toString('base64');
const pw64 = Buffer.from(password).toString('base64');

const remote = String.raw`set -euo pipefail
echo "=== 1. APLICANDO MIGRAÇÃO SQL NO POSTGRESQL ==="
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1 >/tmp/gsa-tv-migrate-cascade.log
echo "Migração SQL aplicada com sucesso."

echo "=== 2. COMPILANDO GSA-TV/CONTROL-PLANE:1.6.15 ==="
base=/opt/gsa-tv/control-plane
work=/tmp/gsa-tv-control-plane-1_6_15
rm -rf "$work" && mkdir -p "$work/src"
printf '%s' '${payload}' | base64 -d | python3 -c 'import sys,json,os; d=json.load(sys.stdin); b="/tmp/gsa-tv-control-plane-1_6_15"; [(os.makedirs(os.path.dirname(b+"/"+k),exist_ok=True),open(b+"/"+k,"w",encoding="utf-8").write(v)) for k,v in d.items()]'

sudo docker build -t gsa-tv/control-plane:1.6.15 "$work" >/tmp/gsa-tv-build-1.6.15.log
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.6.15 --check /app/src/app.js
echo "Imagem gsa-tv/control-plane:1.6.15 compilada e sintaxe validada."

echo "=== 3. ATUALIZANDO ARQUIVOS DE PRODUÇÃO E REINICIANDO CONTAINER ==="
sudo install -m 0644 -o root -g root "$work/Dockerfile" "$base/Dockerfile"
sudo install -m 0644 -o root -g root "$work/package.json" "$base/package.json"
sudo install -m 0644 -o root -g root "$work/src/app.js" "$base/src/app.js"
sudo install -m 0644 -o root -g root "$work/src/gemini.js" "$base/src/gemini.js"
sudo install -m 0644 -o root -g root "$work/compose.yml" "$base/compose.yml"

sudo docker stop -t 15 gsa-tv-control-plane >/dev/null || true
sudo docker rm gsa-tv-control-plane >/dev/null || true
sudo docker compose -p control-plane --project-directory "$base" -f "$base/compose.yml" up -d >/tmp/gsa-tv-up-1.6.15.log

for i in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:9202/health >/tmp/gsa-tv-health-1.6.15.json 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "=== 4. STATUS DO CONTROL PLANE ==="
cat /tmp/gsa-tv-health-1.6.15.json; echo
sudo docker inspect --format 'container={{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|image={{.Config.Image}}' gsa-tv-control-plane
sudo docker exec gsa-tv-control-plane sh -lc "grep -q 'purgeMediaFiles' /app/src/app.js && echo purge_media_files=ok"
sudo docker exec gsa-tv-control-plane sh -lc "grep -q 'cleanOrphanMediaFiles' /app/src/app.js && echo clean_orphan_media=ok"

echo "=== 5. DISPARANDO VARREDURA DE ÓRFÃOS PARA LIBERAR ESPAÇO IMEDIATO ==="
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -c "INSERT INTO public.gsa_tv_jobs(channel_id, job_type, status, progress, payload) VALUES('ch-main', 'cache_cleanup', 'pending', 0, '{}'::jsonb);"
sleep 5
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -c "SELECT id, job_type, status, progress, result FROM public.gsa_tv_jobs WHERE job_type='cache_cleanup' ORDER BY created_at DESC LIMIT 1;"
`;

const res = await runSshScript(remote, 300000);
process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);
