import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260722190000_close_production_inventory_gaps.sql';
const finalizationPath = 'supabase/migrations/20260722190100_finalize_client_rls_and_affiliate_status.sql';
const workflowPath = '.github/workflows/apply-production-inventory-gaps.yml';
const mapperPath = 'scripts/list-database-source-references.mjs';

const migration = fs.readFileSync(migrationPath, 'utf8');
const finalization = fs.readFileSync(finalizationPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const mapper = fs.readFileSync(mapperPath, 'utf8');
const migrationPlan = `${migration}\n${finalization}`;

for (const [name, sql] of [['principal', migration], ['finalização', finalization]]) {
  assert.match(sql, /^BEGIN;/m, `A migration de ${name} deve iniciar transação explícita.`);
  assert.match(sql, /^COMMIT;$/m, `A migration de ${name} deve concluir a transação.`);
}

const requiredRpcs = [
  'gsa_admin_affiliate_snapshot',
  'gsa_admin_create_supplier_order',
  'gsa_admin_decide_affiliate_payout',
  'gsa_admin_review_supplier_delivery',
  'gsa_admin_review_supplier_product',
  'gsa_admin_set_affiliate_status',
  'gsa_admin_supplier_set_status',
  'gsa_admin_supplier_snapshot',
  'gsa_admin_update_affiliate_program',
  'gsa_admin_update_supplier_payable',
  'gsa_client_affiliate_snapshot',
  'gsa_client_cancel_affiliate_payout',
  'gsa_client_create_affiliate_link',
  'gsa_client_create_service_quote',
  'gsa_client_join_affiliate',
  'gsa_client_request_affiliate_payout',
  'gsa_client_service_catalog',
  'gsa_client_update_affiliate_profile',
  'gsa_public_register_supplier',
  'gsa_supplier_dashboard_snapshot',
  'gsa_supplier_mark_order_seen',
  'gsa_supplier_request_product',
  'gsa_supplier_session_access_state',
  'gsa_supplier_submit_delivery',
];

for (const rpc of requiredRpcs) {
  assert.ok(
    migrationPlan.includes(rpc) || workflow.includes(rpc),
    `RPC obrigatória ausente do plano de aplicação/verificação: ${rpc}`,
  );
}

const protectedTables = [
  'gsa_ad_maintenance_state',
  'gsa_ad_rate_limit_buckets',
  'gsa_afiliado_atribuicoes',
  'gsa_afiliado_cliques',
  'gsa_afiliado_comissao_eventos',
  'gsa_afiliado_comissoes',
  'gsa_afiliado_conversoes',
  'gsa_afiliado_links',
  'gsa_afiliado_programas',
  'gsa_afiliado_saques',
  'gsa_afiliados',
  'loja_carrinhos',
  'produtos_fornecedores_config',
  'promocoes_quantidade_ativadas',
];
for (const table of protectedTables) {
  assert.ok(migrationPlan.includes(table), `Tabela sem proteção declarada: ${table}`);
  assert.ok(workflow.includes(table), `Tabela sem verificação de produção: ${table}`);
}

for (const version of [
  '20260721210100',
  '20260721223100',
  '20260722020000',
  '20260722021000',
  '20260722022000',
  '20260722030000',
  '20260722190000',
  '20260722190100',
]) {
  assert.ok(workflow.includes(version), `Versão não contemplada pelo workflow: ${version}`);
}

assert.match(finalization, /DROP POLICY IF EXISTS/, 'Políticas antigas devem ser removidas antes da regra canônica.');
assert.match(finalization, /status = public\.gsa_afiliados\.status/, 'A adesão repetida não pode remover suspensão administrativa.');
assert.match(workflow, /environment:\s*production/, 'O workflow deve usar o ambiente production.');
assert.match(workflow, /FECHAR_INVENTARIO_PRODUCAO/, 'A confirmação manual explícita é obrigatória.');
assert.doesNotMatch(workflow, /supabase db push/, 'O workflow não pode usar db push sobre o histórico legado.');
assert.match(workflow, /npm run test:database-inventory/, 'O inventário independente final é obrigatório.');
assert.match(mapper, /database-source-references\.json/, 'O mapa de referências deve ser persistido como artifact.');

console.log('PRODUCTION_INVENTORY_GAP_CONTRACTS_OK');
