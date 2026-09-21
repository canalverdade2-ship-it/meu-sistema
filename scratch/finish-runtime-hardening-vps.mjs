import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';
const patcher = fs.readFileSync(new URL('./patch-engine-compose.mjs', import.meta.url)).toString('base64');
const result = await runSshScript(`set -Eeuo pipefail
echo '${patcher}' | base64 -d > /tmp/patch-engine-compose.mjs
sudo node /tmp/patch-engine-compose.mjs /opt/gsa-tv/encoder-engine/compose.yml
rm -f /tmp/patch-engine-compose.mjs
sudo docker compose -f /opt/gsa-tv/encoder-engine/compose.yml config --quiet
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -c "update public.gsa_tv_backup_runs set state='failed',finished_at=now(),details=jsonb_build_object('reason','execução órfã encontrada e reconciliada pela auditoria 2026-09-06') where state='running' and started_at < now()-interval '1 hour'" >/dev/null
echo 'engine logging:'; sudo grep -A5 -B1 'logging:' /opt/gsa-tv/encoder-engine/compose.yml
echo 'old running backups:'; psql "$DB_URL" -X -Atc "select count(*) from public.gsa_tv_backup_runs where state='running' and started_at < now()-interval '1 hour'"
echo 'filler max:'; sudo node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('/opt/gsa-tv/playlists/1/'+new Date().toISOString().slice(0,10)+'.json')); const a=p.program.filter(x=>x.source.includes('filler')); console.log(Math.max(...a.map(x=>x.duration)),a.length)"
echo 'control logs:'; sudo docker logs --since 5m gsa-tv-control-plane 2>&1 | tail -n 80
echo 'engine:'; curl -fsS http://127.0.0.1:9210/health; echo
`,180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
