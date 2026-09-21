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

// 1. Get an active partner slug
const partnerSlug = runPsql("SELECT slug FROM public.parceiros WHERE status='ativo' LIMIT 1;");
console.log('Testing with active partner slug:', partnerSlug);

// 2. Call RPC gsa_public_resgatar_beneficio_parceiro
const rpcCall = `SELECT public.gsa_public_resgatar_beneficio_parceiro(NULL, '${partnerSlug}', 'Auditor Test Lead', '11987654321', NULL, 'auditor.lead@gsahub.com.br');`;
const rpcResult = runPsql(rpcCall);
console.log('RPC execution result:');
console.log(rpcResult);

const parsed = JSON.parse(rpcResult);
console.log('Parsed success:', parsed.success);
console.log('Parsed protocolo:', parsed.protocolo);
console.log('Parsed email:', parsed.email);
console.log('Parsed delay_24h:', parsed.delay_24h);

// 3. Query parceiros_resgates for the inserted row
const resgateId = parsed.resgate_id;
const rowResult = runPsql(`SELECT id, nome_completo, email, telefone, codigo_gerado, tipo_resgate, status FROM public.parceiros_resgates WHERE id='${resgateId}';`);
console.log('Inserted resgate row:', rowResult);

// 4. Query parceiros boolean flags
const partnerFlags = runPsql(`SELECT slug, redemption_delay_24h, redemption_has_coupon, redemption_has_link FROM public.parceiros WHERE slug='${partnerSlug}';`);
console.log('Partner boolean flags:', partnerFlags);

// Cleanup test resgate
runPsql(`DELETE FROM public.parceiros_resgates WHERE id='${resgateId}';`);
console.log('Cleaned up test resgate successfully.');
