import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const creds=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const password=creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!password)throw new Error('Senha de infraestrutura não encontrada.');
const sql=['20260831203000_gsa_tv_master_operations.sql','20260901014500_gsa_tv_operational_completeness.sql'].map(n=>fs.readFileSync(new URL('../supabase/migrations/'+n,import.meta.url),'utf8')).join('\n');
const files={
  Dockerfile:fs.readFileSync(new URL('../infrastructure/gsa-tv/services/watchdog/Dockerfile',import.meta.url),'utf8'),
  'package.json':fs.readFileSync(new URL('../infrastructure/gsa-tv/services/watchdog/package.json',import.meta.url),'utf8'),
  'src/app.js':fs.readFileSync(new URL('../infrastructure/gsa-tv/services/watchdog/src/app.js',import.meta.url),'utf8'),
};
const compose=`services:\n  watchdog:\n    build: .\n    image: gsa-tv/watchdog:1.1.0\n    container_name: gsa-tv-watchdog\n    restart: unless-stopped\n    network_mode: host\n    env_file: .env\n    read_only: true\n    tmpfs:\n      - /tmp:size=64m,mode=1777\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL\n    volumes:\n      - /opt/gsa-tv/preview:/preview:ro\n      - /opt/gsa-tv/watchdog/secrets/ffplayout-admin-password:/run/secrets/ffplayout-admin-password:ro\n`;
files['compose.yml']=compose;
const payload64=Buffer.from(JSON.stringify(files)).toString('base64');
const sql64=Buffer.from(sql).toString('base64');
const pw64=Buffer.from(password).toString('base64');
const dbPassword=encodeURIComponent(password);
const env64=Buffer.from([
  'PORT=9204',`DATABASE_URL=postgresql://supabase_admin:${dbPassword}@127.0.0.1:5433/gsahub`,'CHANNEL_ID=ch-main',
  'CONTROL_PLANE_URL=http://127.0.0.1:9202','FFPLAYOUT_URL=http://127.0.0.1:8787','FFPLAYOUT_CHANNEL_ID=1',
  'FFPLAYOUT_PASSWORD_FILE=/run/secrets/ffplayout-admin-password','HLS_URL=http://127.0.0.1:8787/public/1/live/stream.m3u8','PREVIEW_FILE=/preview/1/live/stream.m3u8','N8N_WHATSAPP_WEBHOOK_URL=http://127.0.0.1:5678/webhook/send-whatsapp'
].join('\n')+'\n').toString('base64');
const remote=`set -euo pipefail
base=/opt/gsa-tv/watchdog
work=/tmp/gsa-tv-watchdog
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1
rm -rf "$work" && mkdir -p "$work/src"
sudo mkdir -p "$base/secrets"
sudo install -m 0400 -o 988 -g 989 /opt/gsa-tv/secrets/ffplayout-admin-password "$base/secrets/ffplayout-admin-password"
printf '%s' '${payload64}' | base64 -d | python3 -c 'import sys,json,os; d=json.load(sys.stdin); b="/tmp/gsa-tv-watchdog"; [(os.makedirs(os.path.dirname(b+"/"+k),exist_ok=True),open(b+"/"+k,"w",encoding="utf-8").write(v)) for k,v in d.items()]'
printf '%s' '${env64}' | base64 -d > "$work/.env"
sudo cp -a "$work/." "$base/"
sudo chown -R root:root "$base"
sudo chmod 600 "$base/.env"
sudo chown 988:989 "$base/secrets/ffplayout-admin-password"
sudo chmod 0400 "$base/secrets/ffplayout-admin-password"
sudo chown -R 986:989 /opt/gsa-tv/preview
sudo find /opt/gsa-tv/preview -type d -exec chmod 2750 {} +
sudo find /opt/gsa-tv/preview -type f -exec chmod 0640 {} +
sudo docker compose --project-directory "$base" -f "$base/compose.yml" build --pull
sudo docker compose --project-directory "$base" -f "$base/compose.yml" up -d
sleep 20
curl --fail --silent http://127.0.0.1:9204/health; echo
curl --fail --silent http://127.0.0.1:9204/metrics | head -20
sudo docker inspect --format 'container={{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|image={{.Config.Image}}' gsa-tv-watchdog
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "select 'samples',count(*) from public.gsa_tv_watchdog_samples; select 'execution',count(*) from public.gsa_tv_execution_log;"
`;
const result=await runSshScript(remote,240000);
process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
