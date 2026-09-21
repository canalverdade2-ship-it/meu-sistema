import { runPsql } from './query_vps.mjs';

console.log('--- Checking parceiros columns ---');
console.log(runPsql(`
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'parceiros' AND column_name LIKE 'redemption%'
ORDER BY column_name;
`));

console.log('--- Checking parceiros_resgates columns ---');
console.log(runPsql(`
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'parceiros_resgates'
ORDER BY ordinal_position;
`));

console.log('--- Checking partner redemption RPCs ---');
console.log(runPsql(`
SELECT p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND (
  p.proname LIKE '%partner%' OR 
  p.proname LIKE '%parceiro%' OR
  p.proname IN ('gsa_public_resgatar_beneficio_parceiro', 'gsa_admin_save_partner', 'gsa_admin_partners_snapshot', 'gsa_admin_list_partner_redemptions', 'gsa_admin_complete_partner_redemption')
);
`));

console.log('--- Checking missing RPCs investigated earlier ---');
console.log(runPsql(`
SELECT p.proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'gsa_criar_vaquinha',
  'gsa_obter_vaquinha',
  'gsa_confirmar_contribuicao_vaquinha',
  'gsa_admin_approve_budget',
  'gsa_admin_process_travel_refund'
);
`));
