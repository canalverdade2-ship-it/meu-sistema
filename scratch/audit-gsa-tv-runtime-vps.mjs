import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const password = credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!password) throw new Error('Senha de infraestrutura não encontrada.');
const encoded = Buffer.from(password).toString('base64');
const sql = [
  "select 'channel',id,status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels",
  "select 'schedule',count(*) from public.gsa_tv_schedule_slots where scheduled_end>now()",
  "select 'media',state,count(*) from public.gsa_tv_media_items group by state order by state",
  "select 'media_item',id,media_kind,state,rights_ok,title from public.gsa_tv_media_items order by created_at desc limit 10",
  "select 'jobs',status,count(*) from public.gsa_tv_jobs group by status order by status",
  "select 'failed_job',job_type,left(replace(coalesce(error_message,''),E'\\n',' '),2000) from public.gsa_tv_jobs where status='failed' order by created_at desc limit 10",
  "select 'open_incident',severity,message from public.gsa_tv_incidents where not resolved order by created_at desc limit 20",
  "select 'domain','programs',count(*) from public.gsa_tv_programs union all select 'domain','series',count(*) from public.gsa_tv_series union all select 'domain','episodes',count(*) from public.gsa_tv_episodes union all select 'domain','schedule_versions',count(*) from public.gsa_tv_schedule_versions union all select 'domain','program_blocks',count(*) from public.gsa_tv_program_blocks union all select 'domain','campaigns',count(*) from public.gsa_tv_ad_campaigns union all select 'domain','rights_records',count(*) from public.gsa_tv_rights_records union all select 'domain','comments',count(*) from public.gsa_tv_comments union all select 'domain','graphics',count(*) from public.gsa_tv_graphics union all select 'domain','live_sources',count(*) from public.gsa_tv_live_sources union all select 'domain','ai_projects',count(*) from public.gsa_tv_ai_projects union all select 'domain','ai_assets',count(*) from public.gsa_tv_ai_assets union all select 'domain','presenters',count(*) from public.gsa_tv_ai_presenters",
  "select 'schedule_state',state,count(*) from public.gsa_tv_schedule_versions group by state order by state",
  "select 'ai_job_state',state,count(*) from public.gsa_tv_ai_jobs group by state order by state",
  "select 'ai_asset_state',asset_type,approval_state,count(*) from public.gsa_tv_ai_assets group by asset_type,approval_state order by asset_type,approval_state",
  "select 'provider',provider,default_model,(api_key_ciphertext is not null) from public.gsa_tv_ai_provider_secrets order by updated_at desc",
  "select 'alerts',enabled,min_severity,cooldown_minutes,(whatsapp_number is not null) from public.gsa_tv_alert_settings where channel_id='ch-main'",
  "select 'backup',backup_type,state,size_bytes,finished_at from public.gsa_tv_backup_runs order by started_at desc limit 3",
].join('; ');
const remote = `export PGPASSWORD=$(printf '%s' '${encoded}' | base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -F '|' -c "${sql}"`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
