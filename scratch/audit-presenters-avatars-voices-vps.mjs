import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== MASTER DOCUMENTS ==='
sudo ls -lh /home/opc/gsa-ai/docs/GSA_TV_CASTING_MASTER_2026-09-04.md /home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md 2>/dev/null || true
echo '=== CASTING MASTER ==='
sudo sed -n '1,260p' /home/opc/gsa-ai/docs/GSA_TV_CASTING_MASTER_2026-09-04.md 2>/dev/null || true
echo '=== VOICE/AVATAR LATEST CHANGELOG ==='
sudo grep -nEi 'avatar|voz|vozes|apresentador|casting|Salomão|Patrícia|Sara Oliveira' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md | tail -n 120 || true
echo '=== DATABASE PRESENTER SUMMARY ==='
db=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$db" -X -qAt -F '|' -c "select count(*) from public.gsa_tv_presenters" 2>/dev/null || true
sudo docker run --rm --network host postgres:15-alpine psql "$db" -X -qAt -F '|' -c "select id,coalesce(name,''),coalesce(program_name,''),coalesce(avatar_status::text,''),coalesce(voice_status::text,'') from public.gsa_tv_presenters order by program_name,name" 2>/dev/null || true
`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
