import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const projectRoot = 'c:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)';
const creds = fs.readFileSync(path.join(projectRoot, 'CREDENCIAIS_SISTEMA_GSA.md'), 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();

console.log('SSH Key exists:', fs.existsSync(key));
console.log('Password exists:', !!password);

const pw64 = Buffer.from(password, 'utf8').toString('base64');
const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -c "\\d public.schema_migrations"
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -At -c "SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 15;"
`;

const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', [
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'ConnectTimeout=10',
  '-i', key,
  'opc@147.15.43.141',
  'bash', '-s'
], { input: remote, encoding: 'utf8', timeout: 25000 });

console.log('STATUS:', ssh.status);
console.log('STDOUT:\n', ssh.stdout);
if (ssh.stderr) console.error('STDERR:\n', ssh.stderr);
