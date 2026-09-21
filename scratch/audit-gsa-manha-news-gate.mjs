import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!password) throw new Error('Senha de infraestrutura não encontrada.');
const pw64 = Buffer.from(password).toString('base64');
const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' <<'SQL'
select 'media',id,state,approval_state,rights_ok,duration_s,drive_path
from public.gsa_tv_media_items
where id='media-gsa-manha-news-2026-09-04-draft-qc-v1';

select 'schedule',v.id,v.broadcast_date,v.version,v.state,v.title
from public.gsa_tv_schedule_versions v
where v.channel_id='ch-main' and v.broadcast_date='2026-09-04'
order by v.version desc;

select 'block',b.id,b.planned_start_offset_s,b.planned_duration_s,p.name,
       coalesce(b.media_item_id,'NULL'),coalesce(b.notes,''),b.metadata::text
from public.gsa_tv_program_blocks b
join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id
left join public.gsa_tv_programs p on p.id=b.program_id
where v.channel_id='ch-main' and v.broadcast_date='2026-09-04'
  and b.planned_start_offset_s=27000
order by v.version desc;

select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,'')
from public.gsa_tv_channels where id='ch-main';
SQL
sudo docker inspect --format 'container|{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.Config.Image}}' gsa-tv-control-plane gsa-tv-ffplayout n8n
`;
const result = await runSshScript(remote, 60000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
