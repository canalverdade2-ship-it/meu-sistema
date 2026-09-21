import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260831103000_careers_vacancies_and_notifications.sql', import.meta.url), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!key || !password) throw new Error('Credenciais da VPS/banco nao localizadas.');
const pw64 = Buffer.from(password, 'utf8').toString('base64');
const sql64 = Buffer.from(migration, 'utf8').toString('base64');
const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -c "select to_regclass('public.gsa_careers_vacancies'),to_regclass('public.gsa_careers_notification_outbox'),to_regprocedure('public.gsa_public_list_career_vacancies()'),has_function_privilege('anon','public.gsa_public_list_career_vacancies()','EXECUTE'),has_table_privilege('anon','public.gsa_careers_notification_outbox','SELECT')"
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO public.gsa_careers_applications(id,protocol,candidate_name,document,email,phone,desired_area,employment_type,status)
VALUES('00000000-0000-4000-8000-000000000099','RH-TEST-NOTIFY','Candidato Teste','00000000000','teste@example.invalid','11999999999','Tecnologia & Desenvolvimento','clt','received');
UPDATE public.gsa_careers_applications SET status='under_review',public_message='Teste transacional' WHERE id='00000000-0000-4000-8000-000000000099';
SELECT CASE WHEN count(*)=1 THEN 'CAREERS_NOTIFICATION_TRIGGER_OK' ELSE 'CAREERS_NOTIFICATION_TRIGGER_FAIL' END
FROM public.gsa_careers_notification_outbox WHERE application_id='00000000-0000-4000-8000-000000000099' AND status='under_review';
ROLLBACK;
SQL
sudo systemctl is-active gsa-backup.timer
sudo docker ps --format '{{.Names}}|{{.Status}}'`;
const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', ['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'], { input: remote, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
console.log('SSH_STATUS=' + ssh.status);
if (ssh.stdout) console.log(ssh.stdout.trim());
if (ssh.stderr) console.error(ssh.stderr.trim());
if (ssh.status !== 0) process.exit(ssh.status ?? 1);
