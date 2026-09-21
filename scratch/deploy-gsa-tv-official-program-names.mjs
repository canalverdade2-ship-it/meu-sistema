import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const credentials = fs.readFileSync(
  new URL('../CREDENCIAIS_SISTEMA_GSA.md', import.meta.url),
  'utf8',
);
const password = credentials.match(/Senha Master:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if (!password) throw new Error('Credencial indisponível');

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20260903210000_gsa_tv_official_program_names.sql', import.meta.url),
  'utf8',
);
const migrationEncoded = Buffer.from(migration).toString('base64');
const passwordEncoded = Buffer.from(password).toString('base64');

const result = await runSshScript(String.raw`
set -euo pipefail
target='/tmp/gsa-tv-official-program-names.sql'
printf '%s' '${migrationEncoded}' | base64 -d > "$target"
export PGPASSWORD=$(printf '%s' '${passwordEncoded}' | base64 -d)
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -X -v ON_ERROR_STOP=1 -f "$target"
rm -f -- "$target"
`, 30000);

process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
