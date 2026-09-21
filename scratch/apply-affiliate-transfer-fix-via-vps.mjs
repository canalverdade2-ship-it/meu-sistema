import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const creds = fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260828223000_fix_affiliate_transfer_rpc_exposure.sql', import.meta.url), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!key || !password) throw new Error('Credenciais da VPS/banco nao localizadas.');
const pw64 = Buffer.from(password, 'utf8').toString('base64');
const sql64 = Buffer.from(migration, 'utf8').toString('base64');
const remote = `set -euo pipefail\nexport PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)\nprintf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1\npsql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -c \"select p.proname||'|'||has_function_privilege('anon',p.oid,'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('gsa_client_lookup_affiliate_transfer_target','gsa_client_transfer_affiliate_balance','gsa_client_affiliate_transfers') order by p.proname\"`;
const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', ['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'], { input: remote, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
console.log('SSH_STATUS=' + ssh.status);
if (ssh.stdout) console.log(ssh.stdout.trim());
if (ssh.stderr) console.error(ssh.stderr.trim());
if (ssh.status !== 0) process.exit(ssh.status ?? 1);
