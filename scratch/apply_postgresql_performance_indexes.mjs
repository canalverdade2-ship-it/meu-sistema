import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const credsPath = path.join(projectRoot, 'CREDENCIAIS_SISTEMA_GSA.md');
const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '20260911040000_postgresql_performance_optimization_indexes.sql');

if (!fs.existsSync(credsPath)) {
  console.error('Credentials file not found:', credsPath);
  process.exit(1);
}

if (!fs.existsSync(migrationPath)) {
  console.error('Migration file not found:', migrationPath);
  process.exit(1);
}

const creds = fs.readFileSync(credsPath, 'utf8');
const key = creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
const password = creds.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();

if (!key || !password) {
  console.error('Failed to extract SSH key or database password from CREDENCIAIS_SISTEMA_GSA.md');
  process.exit(1);
}

console.log('--- APPLYING MIGRATION TO POSTGRESQL (VPS 147.15.43.141:5433) ---');
console.log('Migration file:', migrationPath);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const pw64 = Buffer.from(password, 'utf8').toString('base64');
const sql64 = Buffer.from(migrationSql, 'utf8').toString('base64');

const remoteScript = `set -euo pipefail
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
  input: remoteScript,
  encoding: 'utf8',
  timeout: 120000,
  maxBuffer: 20 * 1024 * 1024
});

console.log('SSH Exit Status:', ssh.status);
if (ssh.stdout) {
  console.log('--- STDOUT ---');
  console.log(ssh.stdout);
}
if (ssh.stderr) {
  console.error('--- STDERR ---');
  console.error(ssh.stderr);
}

if (ssh.status !== 0) {
  console.error('Migration failed with non-zero exit code:', ssh.status);
  process.exit(ssh.status || 1);
}

console.log('Migration successfully executed and schema reloaded!');
