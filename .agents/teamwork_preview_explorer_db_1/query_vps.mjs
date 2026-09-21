import { spawnSync } from 'child_process';

const sshKey = "C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key";
const sshHost = "opc@147.15.43.141";

export function runPsql(sql) {
  const res = spawnSync(
    'ssh',
    ['-i', sshKey, '-o', 'StrictHostKeyChecking=no', sshHost, 'PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub'],
    { input: sql, maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' }
  );
  if (res.error) throw res.error;
  return res.stdout + '\n' + (res.stderr || '');
}

if (process.argv[2]) {
  console.log(runPsql(process.argv.slice(2).join(' ')));
}
