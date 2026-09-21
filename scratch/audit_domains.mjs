import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') && !f.endsWith('.b64')).sort();

const tablePolicies = new Map();
function getPolicies(tbl) {
  const norm = tbl.toLowerCase().replace(/^public\./, '').replace(/^["']|["']$/g, '');
  if (!tablePolicies.has(norm)) tablePolicies.set(norm, new Map());
  return tablePolicies.get(norm);
}

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');

  // DROP POLICY
  const dropRegex = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_"]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_"]+)/gi;
  let dm;
  while ((dm = dropRegex.exec(content)) !== null) {
    const pName = dm[1].toLowerCase().replace(/^["']|["']$/g, '');
    const tbl = dm[2].toLowerCase().replace(/^["']|["']$/g, '');
    getPolicies(tbl).delete(pName);
  }

  // CREATE POLICY
  const createRegex = /CREATE\s+POLICY\s+([a-zA-Z0-9_"]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_"]+)([\s\S]*?);/gi;
  let cm;
  while ((cm = createRegex.exec(content)) !== null) {
    const pName = cm[1].toLowerCase().replace(/^["']|["']$/g, '');
    const tbl = cm[2].toLowerCase().replace(/^["']|["']$/g, '');
    const rest = cm[3];

    let cmd = 'ALL';
    const cmdM = rest.match(/FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)/i);
    if (cmdM) cmd = cmdM[1].toUpperCase();

    let roles = ['public'];
    const rolesM = rest.match(/TO\s+([a-zA-Z0-9_,\s]+?)(?:USING|WITH\s+CHECK|$)/i);
    if (rolesM) roles = rolesM[1].split(',').map(r => r.trim().toLowerCase()).filter(Boolean);

    let qual = '';
    const qualM = rest.match(/USING\s*\(([\s\S]*?)\)(?:\s+WITH\s+CHECK|$)/i);
    if (qualM) qual = qualM[1].trim();

    let withCheck = '';
    const withCheckM = rest.match(/WITH\s+CHECK\s*\(([\s\S]*?)\)$/i);
    if (withCheckM) withCheck = withCheckM[1].trim();

    const upTo = content.substring(0, cm.index);
    const lineNum = upTo.split('\n').length;

    getPolicies(tbl).set(pName, {
      name: pName,
      table: tbl,
      cmd,
      roles,
      qual,
      withCheck,
      file,
      line: lineNum
    });
  }
}

const domains = {
  prestador: [
    'prestadores', 'prestador_demandas', 'prestador_demandas_historico',
    'prestador_faturas', 'prestador_documentos', 'prestador_historico',
    'prestador_premios', 'prestador_promocoes', 'prestador_promocoes_ativacoes',
    'prestador_saques', 'prestador_suporte_demandas', 'prestador_transacoes',
    'prestador_vouchers', 'prestador_agendamentos'
  ],
  parceiro: [
    'parceiros', 'parceiros_resgates', 'parceiros_resgates_recursos',
    'parceiros_resgates_eventos'
  ],
  fornecedor: [
    'fornecedores', 'fornecedor_produtos', 'fornecedores_pedidos'
  ],
  colaborador: [
    'colaboradores', 'os_suporte_mensagens', 'suporte_mensagens'
  ],
  afiliado: [
    'gsa_afiliados', 'gsa_afiliado_links', 'gsa_afiliado_conversoes',
    'gsa_afiliado_saques', 'gsa_afiliado_comissoes', 'gsa_afiliado_programas',
    'gsa_afiliado_indicacoes'
  ],
  anunciante: [
    'gsa_advertisers', 'gsa_ad_placements', 'gsa_ad_requests',
    'gsa_ad_request_placements', 'gsa_ad_proposals', 'gsa_ad_proposal_versions',
    'gsa_ad_negotiations', 'gsa_ad_campaigns', 'gsa_ad_creatives',
    'gsa_ad_campaign_placements', 'gsa_ad_daily_metrics', 'gsa_ad_audit_logs',
    'gsa_hero_banners'
  ],
  clientes: [
    'clientes', 'cliente_documentos', 'cliente_enderecos', 'cliente_cartoes',
    'cliente_premios', 'notificacoes'
  ],
  financeiro: [
    'saques', 'faturas', 'pagamentos', 'carteira_lancamentos',
    'extrato_financeiro', 'transferencias', 'emprestimos',
    'emprestimo_parcelas', 'pontos_movimentacoes', 'points_transactions',
    'cobrancas'
  ],
  marketplace: [
    'produtos', 'produto_variantes', 'orcamentos', 'ordens_compra',
    'loja_pedido_itens', 'loja_carrinhos', 'loja_favoritos',
    'loja_solicitacoes', 'vouchers', 'cupons_loja', 'cupons_ativados',
    'promocoes', 'promocoes_quantidade', 'promocoes_quantidade_ativadas',
    'promocoes_quantidade_uso'
  ],
  gsatv_core: [
    'gsa_tv_channels', 'gsa_tv_channel_secrets', 'gsa_tv_media_items',
    'gsa_tv_schedule_slots', 'gsa_tv_playlists', 'gsa_tv_incidents',
    'gsa_tv_audit_log', 'gsa_tv_jobs', 'system_settings', 'sistema_sessoes'
  ]
};

const domainReport = {};

for (const [dName, tblList] of Object.entries(domains)) {
  domainReport[dName] = [];
  for (const t of tblList) {
    const pols = Array.from(getPolicies(t).values());
    domainReport[dName].push({
      table: t,
      policyCount: pols.length,
      policies: pols.map(p => ({
        name: p.name,
        cmd: p.cmd,
        roles: p.roles,
        qual: p.qual.substring(0, 100),
        withCheck: p.withCheck ? p.withCheck.substring(0, 100) : ''
      }))
    });
  }
}

fs.writeFileSync(path.join(root, 'scratch', 'domain_security_audit.json'), JSON.stringify(domainReport, null, 2));

for (const [dName, list] of Object.entries(domainReport)) {
  console.log(`\n========================================`);
  console.log(`DOMAIN: ${dName.toUpperCase()} (${list.length} tables)`);
  console.log(`========================================`);
  for (const item of list) {
    const status = item.policyCount > 0 ? `✅ ${item.policyCount} policies` : '⚠️ 0 POLICIES';
    console.log(`- ${item.table.padEnd(35)} : ${status}`);
  }
}
