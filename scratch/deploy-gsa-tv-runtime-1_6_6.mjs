import fs from 'node:fs';
import crypto from 'node:crypto';
import { runSshScript } from './ssh2-run.mjs';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!password) throw new Error('Senha de infraestrutura não encontrada.');
const migrationFiles = [
  '20260831124500_gsa_tv_end_to_end_hardening.sql',
  '20260831133000_gsa_tv_media_probe_queue.sql',
  '20260831155000_gsa_tv_channel_secrets.sql',
  '20260831160000_fix_gsa_tv_secret_service_access.sql',
  '20260831173000_gsa_tv_advertising_library.sql',
  '20260831181000_gsa_tv_runtime_integrity.sql',
  '20260831181500_gsa_tv_job_concurrency.sql',
  '20260831203000_gsa_tv_editorial_control_room_ai_foundation.sql',
  '20260831203000_gsa_tv_master_operations.sql',
  '20260831211500_gsa_tv_domain_admin_api.sql',
  '20260831220000_gsa_tv_ai_schema_reconciliation.sql',
  '20260831220500_gsa_tv_ai_provider_security.sql',
  '20260831221000_gsa_tv_schedule_version_workflow.sql',
  '20260831223000_gsa_tv_published_schedule_runtime.sql',
  '20260901014500_gsa_tv_operational_completeness.sql',
  '20260901033000_gsa_tv_gemini_provider.sql',
];
const sql = migrationFiles.map((name) => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).join('\n');
const files = {
  Dockerfile: fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/Dockerfile', import.meta.url), 'utf8'),
  'package.json': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/package.json', import.meta.url), 'utf8'),
  'src/app.js': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/src/app.js', import.meta.url), 'utf8'),
  'src/gemini.js': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/src/gemini.js', import.meta.url), 'utf8'),
};
const compose = `services:\n  control-plane:\n    build: .\n    image: gsa-tv/control-plane:1.6.6\n    container_name: gsa-tv-control-plane\n    restart: unless-stopped\n    network_mode: host\n    env_file: .env\n    read_only: true\n    tmpfs:\n      - /tmp:size=64m,mode=1777\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL\n    volumes:\n      - /opt/gsa-tv/playlists:/playlists\n      - /opt/gsa-tv/cache/media:/media\n      - /opt/gsa-tv/fallback:/fallback:ro\n      - /opt/gsa-tv/preview:/preview:ro\n      - /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password:/run/secrets/ffplayout-admin-password:ro\n    healthcheck:\n      test: [\"CMD\", \"node\", \"-e\", \"require('http').get('http://127.0.0.1:9202/health',r=>process.exit(r.statusCode===200?0:1))\"]\n      interval: 30s\n      timeout: 5s\n      retries: 3\n`;
files['compose.yml'] = compose;
const payload64 = Buffer.from(JSON.stringify(files)).toString('base64');
const sql64 = Buffer.from(sql).toString('base64');
const pw64 = Buffer.from(password).toString('base64');
const dbPassword = encodeURIComponent(password);
const token = crypto.randomBytes(32).toString('hex');
const env = [
  'PORT=9202', `DATABASE_URL=postgresql://supabase_admin:${dbPassword}@127.0.0.1:5433/gsahub`,
  `INTERNAL_API_TOKEN=${token}`, 'CHANNEL_ID=ch-main', 'FFPLAYOUT_URL=http://127.0.0.1:8787',
  'FFPLAYOUT_CHANNEL_ID=1', 'FFPLAYOUT_USERNAME=admin',
  'FFPLAYOUT_PASSWORD_FILE=/run/secrets/ffplayout-admin-password', 'CHANNEL_TIMEZONE=America/Sao_Paulo',
  'PLAYLISTS_DIR=/playlists/1', 'MEDIA_DIR=/media/1', 'UPLOAD_DIR=/media/1/incoming',
  'FALLBACK_FILE=/media/1/identity/gsa-tv-fallback-720p30.mp4', 'SCHEDULE_FILLER_FILE=/media/1/filler/gsa-tv-filler-600.mp4',
  'PREVIEW_DIR=/preview/1/live', 'PREVIEW_TOKEN_TTL_SECONDS=900',
  'MAX_UPLOAD_BYTES=10737418240',
  'ALLOWED_ORIGINS=http://localhost:3000,https://gsahub.com.br,https://www.gsahub.com.br',
].join('\n') + '\n';
const env64 = Buffer.from(env).toString('base64');
const remote = `set -euo pipefail
base=/opt/gsa-tv/control-plane
work=/tmp/gsa-tv-control-plane-1_6_6
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1 >/tmp/gsa-tv-migrate.log
rm -rf "$work" && mkdir -p "$work/src"
printf '%s' '${payload64}' | base64 -d | python3 -c 'import sys,json,os; d=json.load(sys.stdin); b="/tmp/gsa-tv-control-plane-1_6_6"; [(os.makedirs(os.path.dirname(b+"/"+k),exist_ok=True),open(b+"/"+k,"w",encoding="utf-8").write(v)) for k,v in d.items()]'
printf '%s' '${env64}' | base64 -d > "$work/.env"
`;
const remoteTail = `tv_secret=$(sudo docker inspect gsa-auth-session --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="GSA_TV_SECRET_KEY"{sub(/^GSA_TV_SECRET_KEY=/,"");print;exit}')
test -n "$tv_secret"
printf 'GSA_TV_SECRET_KEY=%s\n' "$tv_secret" >> "$work/.env"
sudo mkdir -p "$base/src" "$base/secrets" /opt/gsa-tv/playlists/1 /opt/gsa-tv/cache/media/1/incoming /opt/gsa-tv/cache/media/1/filler /opt/gsa-tv/cache/media/1/identity
sudo install -m 0400 -o 989 -g 989 /opt/gsa-tv/secrets/ffplayout-admin-password "$base/secrets/ffplayout-admin-password"
sudo chown root:989 /opt/gsa-tv/fallback /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4
sudo chmod 0750 /opt/gsa-tv/fallback
sudo chmod 0640 /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4
sudo cp -f /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4 /opt/gsa-tv/cache/media/1/filler/filler.mp4
if ! sudo test -s /opt/gsa-tv/cache/media/1/identity/gsa-tv-fallback-720p30.mp4; then sudo cp -f /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4 /opt/gsa-tv/cache/media/1/identity/gsa-tv-fallback-720p30.mp4; fi
sudo cp -a "$work/." "$base/"
sudo chmod 600 "$base/.env"
sudo chown -R root:root "$base"
sudo chown 989:989 "$base/secrets/ffplayout-admin-password"
sudo chmod 0400 "$base/secrets/ffplayout-admin-password"
sudo chown -R 989:986 /opt/gsa-tv/playlists/1 /opt/gsa-tv/cache/media/1
sudo find /opt/gsa-tv/playlists/1 /opt/gsa-tv/cache/media/1 -type d -exec chmod 2775 {} +
sudo find /opt/gsa-tv/playlists/1 /opt/gsa-tv/cache/media/1 -type f -exec chmod 0664 {} +
sudo chown -R 986:989 /opt/gsa-tv/preview
sudo find /opt/gsa-tv/preview -type d -exec chmod 2750 {} +
sudo find /opt/gsa-tv/preview -type f -exec chmod 0640 {} +
sudo docker compose --project-directory "$base" -f "$base/compose.yml" build --pull >/tmp/gsa-tv-build.log
if ! sudo test -s /opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4; then
  sudo docker run --rm --user 989:989 -v /opt/gsa-tv/fallback:/fallback:ro -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.6 ffmpeg -hide_banner -loglevel error -stream_loop 19 -i /fallback/gsa-tv-fallback-720p30.mp4 -t 600 -c copy -movflags +faststart /media/1/filler/gsa-tv-filler-600.mp4
fi
sudo docker compose --project-directory "$base" -f "$base/compose.yml" up -d
sleep 7
curl --fail --silent http://127.0.0.1:9202/health
echo
sudo docker inspect --format 'container={{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|image={{.Config.Image}}' gsa-tv-control-plane
sudo docker exec gsa-tv-control-plane sh -lc "grep -q 'credentials_check' /app/src/app.js && grep -q 'ffplayoutLogin' /app/src/app.js && echo deployed_markers=ok"
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "select 'snapshot_states',position('desired_state' in pg_get_functiondef('public.gsa_admin_gsa_tv_snapshot(uuid,text)'::regprocedure))>0,position('signal_state' in pg_get_functiondef('public.gsa_admin_gsa_tv_snapshot(uuid,text)'::regprocedure))>0; select 'mutate_credentials_check',position('credentials_check' in pg_get_functiondef('public.gsa_admin_gsa_tv_mutate(uuid,text,text,jsonb)'::regprocedure))>0;"
`;
const result = await runSshScript(remote + remoteTail, 240000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
