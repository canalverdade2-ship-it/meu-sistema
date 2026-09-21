import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo install -d -m 0700 /opt/gsa-tv/backups/n8n
backup=/tmp/n8n-$stamp.dump
docker exec evo-postgres pg_dump -U evo -d n8n -Fc > "$backup"
test -s "$backup"
sudo install -m 0600 "$backup" /opt/gsa-tv/backups/n8n/n8n-$stamp.dump
docker inspect n8n > /tmp/n8n-$stamp.inspect.json
sudo install -m 0600 /tmp/n8n-$stamp.inspect.json /opt/gsa-tv/backups/n8n/n8n-$stamp.inspect.json
cfg=$(docker exec n8n sh -lc 'sha256sum /home/node/.n8n/config 2>/dev/null | cut -d" " -f1 || true')
size=$(stat -c %s "$backup")
echo "backup=ok|stamp=$stamp|bytes=$size|config_checksum_present=$([ -n "$cfg" ] && echo yes || echo no)"
rm -f "$backup" /tmp/n8n-$stamp.inspect.json
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);