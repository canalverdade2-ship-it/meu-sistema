import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!key || !password) throw new Error('Credenciais de infraestrutura não encontradas.');
const sql = [
  '../supabase/migrations/20260831124500_gsa_tv_end_to_end_hardening.sql',
  '../supabase/migrations/20260831133000_gsa_tv_media_probe_queue.sql',
  '../supabase/migrations/20260831173000_gsa_tv_advertising_library.sql',
  '../supabase/migrations/20260831203000_gsa_tv_editorial_control_room_ai_foundation.sql',
  '../supabase/migrations/20260831211500_gsa_tv_domain_admin_api.sql',
  '../supabase/migrations/20260831220000_gsa_tv_ai_schema_reconciliation.sql',
  '../supabase/migrations/20260831220500_gsa_tv_ai_provider_security.sql',
  '../supabase/migrations/20260831221000_gsa_tv_schedule_version_workflow.sql',
].map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const sql64 = Buffer.from(sql).toString('base64');
const pw64 = Buffer.from(password).toString('base64');
const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -v ON_ERROR_STOP=1 <<'SQL'
select 'rpc_snapshot='||coalesce(to_regprocedure('public.gsa_admin_gsa_tv_snapshot(uuid,text)')::text,'missing');
select 'rpc_mutate='||coalesce(to_regprocedure('public.gsa_admin_gsa_tv_mutate(uuid,text,text,jsonb)')::text,'missing');
select 'anon_channel_select='||has_table_privilege('anon','public.gsa_tv_channels','SELECT');
select 'auth_channel_select='||has_table_privilege('authenticated','public.gsa_tv_channels','SELECT');
select 'anon_snapshot_execute='||has_function_privilege('anon','public.gsa_admin_gsa_tv_snapshot(uuid,text)','EXECUTE');
select 'auth_snapshot_execute='||has_function_privilege('authenticated','public.gsa_admin_gsa_tv_snapshot(uuid,text)','EXECUTE');
select 'stored_stream_secrets='||count(*) from public.gsa_tv_channels where stream_key is not null or config ?| array['stream_key','youtube_stream_key','rtmp_key'];
select 'media_storage_columns='||count(*) from information_schema.columns where table_schema='public' and table_name='gsa_tv_media_items' and column_name in ('media_kind','approval_state','metadata');
select 'gsa_tv_domain_tables='||count(*) from information_schema.tables where table_schema='public' and table_name like 'gsa_tv_%';
select 'domain_snapshot='||coalesce(to_regprocedure('public.gsa_admin_gsa_tv_domain_snapshot(uuid,text)')::text,'missing');
SQL`;
const result = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', ['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'], { input: remote, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'Falha sem saída.');
  process.exit(result.status || 1);
}
process.stdout.write(result.stdout);
