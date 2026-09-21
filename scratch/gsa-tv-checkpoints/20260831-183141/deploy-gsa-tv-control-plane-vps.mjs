import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!key || !password) throw new Error('Credenciais de infraestrutura não encontradas.');
const files = {
  Dockerfile: fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/Dockerfile', import.meta.url), 'utf8'),
  'package.json': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/package.json', import.meta.url), 'utf8'),
  'src/app.js': fs.readFileSync(new URL('../infrastructure/gsa-tv/services/playout-api/src/app.js', import.meta.url), 'utf8'),
};
const compose = `services:\n  control-plane:\n    build: .\n    image: gsa-tv/control-plane:1.3.0\n    container_name: gsa-tv-control-plane\n    restart: unless-stopped\n    network_mode: host\n    env_file: .env\n    read_only: true\n    tmpfs:\n      - /tmp:size=64m,mode=1777\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL\n    volumes:\n      - /opt/gsa-tv/playlists:/playlists\n      - /opt/gsa-tv/cache/media:/media\n      - /opt/gsa-tv/fallback:/fallback:ro\n    healthcheck:\n      test: [\"CMD\", \"node\", \"-e\", \"require('http').get('http://127.0.0.1:9202/health',r=>process.exit(r.statusCode===200?0:1))\"]\n      interval: 30s\n      timeout: 5s\n      retries: 3\n`;
files['compose.yml'] = compose;
const payload = Buffer.from(JSON.stringify(files)).toString('base64');
const encodedPassword = encodeURIComponent(password);
const token = crypto.randomBytes(32).toString('hex');
const env = `PORT=9202\nDATABASE_URL=postgresql://supabase_admin:${encodedPassword}@127.0.0.1:5433/gsahub\nINTERNAL_API_TOKEN=${token}\nCHANNEL_ID=ch-main\nFFPLAYOUT_URL=http://127.0.0.1:8787/\nMEDIA_WORKER_URL=http://127.0.0.1:9200/health\nCACHE_MANAGER_URL=http://127.0.0.1:9201/health\nPLAYLIST_COMPILER_URL=http://127.0.0.1:9203/health\nPLAYLISTS_DIR=/playlists\nMEDIA_DIR=/media\nUPLOAD_DIR=/media/incoming\nFALLBACK_FILE=/fallback/gsa-tv-fallback-720p30.mp4\nMAX_UPLOAD_BYTES=10737418240\nALLOWED_ORIGINS=http://localhost:3000,https://gsahub.com.br,https://www.gsahub.com.br\n`;
const env64 = Buffer.from(env).toString('base64');
const remote = `set -euo pipefail
base=/opt/gsa-tv/control-plane
sudo mkdir -p "$base/src" /opt/gsa-tv/playlists /opt/gsa-tv/cache/media/incoming
printf '%s' '${payload}' | base64 -d | python3 -c 'import sys,json,os,base64; d=json.load(sys.stdin); base="/tmp/gsa-tv-control-plane"; os.makedirs(base+"/src",exist_ok=True); [(open(base+"/"+k,"w",encoding="utf-8").write(v)) for k,v in d.items()]'
printf '%s' '${env64}' | base64 -d > /tmp/gsa-tv-control-plane/.env
sudo docker inspect gsa-auth-session --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^GSA_TV_SECRET_KEY=' >> /tmp/gsa-tv-control-plane/.env
sudo cp -a /tmp/gsa-tv-control-plane/. "$base/"
sudo chmod 600 "$base/.env"
sudo chown -R root:root "$base"
sudo chmod 755 "$base" "$base/src"
sudo chown 989:989 /opt/gsa-tv/playlists
sudo chown -R 989:989 /opt/gsa-tv/cache/media
sudo docker compose --project-directory "$base" -f "$base/compose.yml" build --pull
sudo docker compose --project-directory "$base" -f "$base/compose.yml" up -d
sleep 5
curl --fail --silent http://127.0.0.1:9202/health
echo
sudo docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' gsa-tv-control-plane
`;
const result = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', ['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'], { input: remote, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout || 'Falha sem saída.'); process.exit(result.status || 1); }
process.stdout.write(result.stdout);
