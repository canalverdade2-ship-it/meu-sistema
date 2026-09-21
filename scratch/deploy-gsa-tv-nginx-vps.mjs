import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!key) throw new Error('Chave da VPS não encontrada.');
const location = fs.readFileSync(new URL('../infrastructure/gsa-tv/nginx/gsa-tv-api-location.conf', import.meta.url), 'utf8');
const encoded = Buffer.from(location).toString('base64');
const remote = `set -euo pipefail
conf=/etc/nginx/nginx.conf
backup=/etc/nginx/nginx.conf.gsa-tv-$(date +%Y%m%d%H%M%S)
sudo cp "$conf" "$backup"
printf '%s' '${encoded}' | base64 -d > /tmp/gsa-tv-api-location.conf
sudo python3 - <<'PY'
from pathlib import Path
conf = Path('/etc/nginx/nginx.conf')
text = conf.read_text()
if 'location /gsa-tv/' not in text:
    location = Path('/tmp/gsa-tv-api-location.conf').read_text()
    needle = '''        location / {
            return 404;
        }'''
    if needle not in text:
        raise SystemExit('Ponto seguro de insercao nao encontrado.')
    indented = '\\n'.join(('        ' + line if line else '') for line in location.splitlines())
    text = text.replace(needle, indented + '\\n\\n' + needle, 1)
    conf.write_text(text)
PY
if ! sudo nginx -t; then
  sudo cp "$backup" "$conf"
  exit 1
fi
sudo systemctl reload nginx
curl --fail --silent https://api.147-15-43-141.nip.io/gsa-tv/health
echo
`;
const result = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', ['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'], { input: remote, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout || 'Falha ao publicar a rota.'); process.exit(result.status || 1); }
process.stdout.write(result.stdout);
