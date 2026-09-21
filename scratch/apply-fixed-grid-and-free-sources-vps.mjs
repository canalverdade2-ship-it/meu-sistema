import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!key || !password) throw new Error('Credenciais de infraestrutura não encontradas.');

const sql = fs.readFileSync(
  new URL('../supabase/migrations/20260903223000_gsa_tv_fixed_weekly_grid_and_free_sources.sql', import.meta.url),
  'utf8',
);
const sql64 = Buffer.from(sql).toString('base64');
const pw64 = Buffer.from(password).toString('base64');
const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -v ON_ERROR_STOP=1 <<'SQL'
select 'programs',count(*) from public.gsa_tv_programs where channel_id='ch-main' and name like 'GSA %';
select 'weekly_slots',count(*) from public.gsa_tv_weekly_grid_slots where channel_id='ch-main' and enabled;
select 'sources',count(*),count(*) filter(where enabled),bool_and(free_only) from public.gsa_tv_editorial_sources where channel_id='ch-main';
select 'source_links',count(*) from public.gsa_tv_program_source_links l join public.gsa_tv_programs p on p.id=l.program_id where p.channel_id='ch-main';
select 'future_published_days',count(distinct broadcast_date),min(broadcast_date),max(broadcast_date) from public.gsa_tv_schedule_versions where channel_id='ch-main' and state='published' and broadcast_date>current_date;
select 'day_coverage',weekday,sum(case when end_time>start_time then extract(epoch from end_time-start_time) else 86400-extract(epoch from start_time)+extract(epoch from end_time) end)::int from public.gsa_tv_weekly_grid_slots where channel_id='ch-main' and enabled group by weekday order by weekday;
SQL`;

const result = spawnSync(
  'C:/Windows/System32/OpenSSH/ssh.exe',
  ['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'],
  { input: remote, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'Falha sem saída.');
  process.exit(result.status || 1);
}
process.stdout.write(result.stdout);
