const { execSync } = require('child_process');

function runPsql(sql) {
  const sanitized = sql.replace(/"/g, '\\"');
  const sshCmd = `ssh -i "C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key" -o StrictHostKeyChecking=no opc@147.15.43.141 "PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A -c \\"${sanitized}\\""`;
  try {
    return execSync(sshCmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

console.log('--- ALL COLUMNS OF parceiros_resgates ---');
console.log(runPsql("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='parceiros_resgates' ORDER BY ordinal_position;"));

console.log('--- DEFINITION OF gsa_public_resgatar_beneficio_parceiro ---');
console.log(runPsql("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='gsa_public_resgatar_beneficio_parceiro';"));
