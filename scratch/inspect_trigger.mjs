import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const credsPath = path.join(projectRoot, 'CREDENCIAIS_SISTEMA_GSA.md');
const creds = fs.readFileSync(credsPath, 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();

function runRemotePsql(sql) {
  const pw64 = Buffer.from(password, 'utf8').toString('base64');
  const sql64 = Buffer.from(sql, 'utf8').toString('base64');

  const remote = `set -euo pipefail
export PGPASSWORD=$(printf '%s' '${pw64}' | base64 -d)
printf '%s' '${sql64}' | base64 -d | psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1
`;

  const ssh = spawnSync('C:/Windows/System32/OpenSSH/ssh.exe', [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=20',
    '-i', key,
    'opc@147.15.43.141',
    'bash', '-s'
  ], {
    input: remote,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024
  });

  if (ssh.status !== 0) {
    throw new Error(`Remote query failed (status ${ssh.status}):\n${ssh.stderr || ssh.stdout}`);
  }

  return ssh.stdout;
}

const out = runRemotePsql(`
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'gsa_guard_duplicate_active_client_ticket';
`);
console.log(out);
