import { runRemotePsqlJson } from './audit_helpers.mjs';
import fs from 'fs';

const rpcList = [
  'gsa_admin_update_affiliate_points_settings',
  'gsa_admin_alterar_status_cliente',
  'gsa_admin_ajustar_saldo_cliente',
  'gsa_admin_save_calculator_pro_product',
  'gsa_admin_create_calculator_pro_voucher',
  'gsa_admin_gerar_acordo_cobranca',
  'gsa_admin_protestar_cobranca',
  'gsa_admin_registrar_cobranca_historico',
  'gsa_admin_cancelar_acordo_cobranca',
  'gsa_admin_emprestimo_enviar_proposta',
  'gsa_admin_emprestimo_enviar_oferta_quitacao',
  'gsa_admin_release_affiliate_commissions',
  'gsa_admin_decide_affiliate_payout',
  'gsa_admin_adjust_affiliate_balance',
  'gsa_admin_adjust_points',
  'gsa_admin_update_career_application',
  'gsa_public_resgatar_beneficio_parceiro',
  'gsa_admin_complete_partner_redemption',
  'gsa_admin_process_travel_refund',
  'gsa_admin_approve_budget',
  'gsa_criar_vaquinha',
  'gsa_obter_vaquinha',
  'gsa_confirmar_contribuicao_vaquinha',
  'gsa_registrar_pendencia_whatsapp'
];

const rpcSources = runRemotePsqlJson(`
  SELECT 
    p.proname,
    pg_get_function_arguments(p.oid) AS args,
    pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS is_security_definer,
    p.proacl::text AS acl,
    p.prosrc AS body
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname IN (${rpcList.map(r => `'${r}'`).join(', ')})
  ORDER BY p.proname;
`);

fs.writeFileSync('.agents/teamwork_preview_explorer_db_1/rpc_sources_dump.json', JSON.stringify(rpcSources, null, 2));

console.log(`Fetched ${rpcSources.length} RPC definitions.`);
for (const r of rpcSources) {
  console.log(`\n=== FUNCTION ${r.proname}(${r.args}) ===`);
  console.log(`Security Definer: ${r.is_security_definer} | ACL: ${r.acl}`);
}
