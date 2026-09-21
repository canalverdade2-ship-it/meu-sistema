const { execSync } = require('child_process');

const sshKey = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';
const remoteHost = 'opc@147.15.43.141';

function runSql(sql) {
  const cleanSql = sql.replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  const cmd = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no -o ConnectTimeout=15 ${remoteHost} "PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -A -c \\"${cleanSql}\\""`;
  return execSync(cmd, { encoding: 'utf8' });
}

console.log('=== TEST 1: Query parceiros table columns ===');
const pResult = runSql("SELECT slug, name, redemption_delay_24h, redemption_has_coupon, redemption_has_link FROM public.parceiros WHERE status = 'ativo' LIMIT 3;");
console.log(pResult.trim());

console.log('\n=== TEST 2: Test gsa_public_resgatar_beneficio_parceiro RPC ===');
const firstPartnerSlug = runSql("SELECT slug FROM public.parceiros WHERE status = 'ativo' LIMIT 1;").trim();
console.log('Using partner slug:', firstPartnerSlug);

const rpcCall = `SELECT public.gsa_public_resgatar_beneficio_parceiro(NULL, '${firstPartnerSlug}', 'Auditoria E2E Explorer', '11999998888', NULL, 'auditoria.e2e@gsa.com.br');`;
const rpcRes = runSql(rpcCall);
console.log('RPC Result:\n', JSON.stringify(JSON.parse(rpcRes.trim()), null, 2));

console.log('\n=== TEST 3: Query parceiros_resgates table for created record ===');
const resgateQuery = "SELECT id, parceiro_id, nome_completo, email, telefone, codigo_gerado, tipo_resgate, status, created_at FROM public.parceiros_resgates WHERE email = 'auditoria.e2e@gsa.com.br' ORDER BY created_at DESC LIMIT 1;";
const resgateRec = runSql(resgateQuery);
console.log('Created Resgate in DB:\n', resgateRec.trim());

// Cleanup test record
runSql("DELETE FROM public.parceiros_resgates WHERE email = 'auditoria.e2e@gsa.com.br';");
console.log('Cleaned up test record successfully.');