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

console.log('--- 1. TABLE COUNT ---');
console.log('Total public tables:', runPsql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"));

console.log('--- 2. REQUIRED TABLES CHECK ---');
const tables = ['contratos', 'blog_posts', 'loja_vaquinhas', 'loja_vaquinha_contribuicoes', 'gsa_hero_banners', 'whatsapp_pendencias_ativas', 'parceiros', 'parceiros_resgates', 'sistema_sessoes'];
for (const t of tables) {
  const res = runPsql(`SELECT to_regclass('public.${t}');`);
  console.log(`Table ${t}: ${res}`);
}

console.log('--- 3. REQUIRED COLUMNS CHECK ---');
const cols = [
  ['parceiros', 'redemption_delay_24h'],
  ['parceiros', 'redemption_has_coupon'],
  ['parceiros', 'redemption_has_link'],
  ['parceiros_resgates', 'email'],
  ['parceiros_resgates', 'codigo_gerado'],
  ['parceiros_resgates', 'protocolo'],
  ['parceiros_resgates', 'link_ativacao'],
  ['cliente_promocoes', 'visualizado'],
  ['viagens_transacoes', 'resposta_admin'],
  ['produtos', 'avaliacao_media'],
  ['produtos', 'total_avaliacoes'],
  ['prestador_documentos', 'updated_at'],
  ['tickets', 'updated_at'],
  ['prestador_promocoes', 'data_inicio'],
  ['prestadores', 'nome_completo']
];
for (const [tbl, col] of cols) {
  const res = runPsql(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${tbl}' AND column_name='${col}';`);
  console.log(`Column ${tbl}.${col}: ${res || 'MISSING'}`);
}

console.log('--- 4. RPC FUNCTIONS & PERMISSIONS CHECK ---');
const rpcs = [
  'gsa_public_resgatar_beneficio_parceiro',
  'gsa_admin_complete_partner_redemption',
  'gsa_admin_approve_budget',
  'gsa_admin_process_travel_refund',
  'gsa_criar_vaquinha',
  'gsa_obter_vaquinha',
  'gsa_confirmar_contribuicao_vaquinha',
  'gsa_admin_save_partner_redemption_fields',
  'gsa_admin_list_partner_redemptions'
];
for (const r of rpcs) {
  const q = `SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args, array_to_string(p.proacl, ', ') as acls FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = '${r}';`;
  const res = runPsql(q);
  console.log(`RPC ${r}:\n${res || 'MISSING'}`);
}
