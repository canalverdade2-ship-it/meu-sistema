const fs = require('fs');
const path = require('path');

const summary = JSON.parse(fs.readFileSync(path.join(__dirname, 'db_analysis_summary.json'), 'utf8'));

console.log('--- TABLES BY DOMAIN PREFIX ---');
const domainMap = new Map();

for (const t of summary.tables) {
  let domain = 'core';
  const name = t.name;
  if (name.startsWith('gsa_tv_')) domain = 'gsa_tv';
  else if (name.startsWith('gsa_viagens_') || name.startsWith('viagens_')) domain = 'gsa_viagens';
  else if (name.startsWith('gsa_saude_') || name.startsWith('saude_')) domain = 'gsa_saude';
  else if (name.startsWith('gsa_seguros_') || name.startsWith('seguros_')) domain = 'gsa_seguros';
  else if (name.startsWith('hub_classificados_') || name.startsWith('classificados_')) domain = 'classificados';
  else if (name.startsWith('gsa_ad_') || name.startsWith('ad_') || name.startsWith('advertising_')) domain = 'advertising';
  else if (name.startsWith('afiliado_') || name.startsWith('afiliados') || name.startsWith('gsa_affiliate_')) domain = 'afiliados';
  else if (name.startsWith('parceiro_') || name.startsWith('parceiros')) domain = 'parceiros';
  else if (name.startsWith('fornecedor_') || name.startsWith('fornecedores') || name.startsWith('pedidos_compra') || name.startsWith('cotacoes_')) domain = 'fornecedores_procurement';
  else if (name.startsWith('prestador_') || name.startsWith('prestadores')) domain = 'prestadores';
  else if (name.startsWith('colaborador_') || name.startsWith('colaboradores') || name.startsWith('funcoes')) domain = 'colaboradores';
  else if (name.startsWith('cliente_') || name.startsWith('clientes') || name.startsWith('client_')) domain = 'clientes_crm';
  else if (name.startsWith('produto_') || name.startsWith('produtos') || name.startsWith('loja_') || name.startsWith('pedidos') || name.startsWith('promoc')) domain = 'marketplace_store';
  else if (name.startsWith('fatura') || name.startsWith('pagamento') || name.startsWith('saque') || name.startsWith('transferencia') || name.startsWith('carteira') || name.startsWith('extrato') || name.startsWith('ponto') || name.startsWith('cobranca') || name.startsWith('emprestimo')) domain = 'financeiro_fintech';
  else if (name.startsWith('ticket') || name.startsWith('notificac') || name.startsWith('whatsapp') || name.startsWith('suporte') || name.startsWith('os_')) domain = 'comunicacao_suporte';
  else if (name.startsWith('admin_') || name.startsWith('audit_') || name.startsWith('system_') || name.startsWith('secure_session') || name.startsWith('sessao_')) domain = 'admin_security';
  else if (name.startsWith('site_campaign') || name.startsWith('campaign_')) domain = 'campanhas_marketing';
  else if (name.startsWith('gsa_careers') || name.startsWith('vagas_')) domain = 'carreiras_rh';
  else domain = 'outros_operacoes';

  if (!domainMap.has(domain)) domainMap.set(domain, []);
  domainMap.get(domain).push(t);
}

for (const [dom, tbls] of domainMap.entries()) {
  console.log(`Domain: ${dom} (${tbls.length} tables)`);
}

// Check key functions
console.log('\n--- KEY RPCs / FUNCTIONS SEARCH ---');
const vitalKeywords = [
  'checkout',
  'wallet',
  'saldo',
  'pontos',
  'points',
  'resgate',
  'recurso',
  'appeal',
  'login',
  'session',
  'fatura',
  'orcamento',
  'vaquinha',
  'affiliate'
];

const foundFunctions = {};
for (const kw of vitalKeywords) {
  foundFunctions[kw] = summary.functions.filter(f => f.name.includes(kw)).map(f => ({ name: f.name, file: f.file, isSecDef: f.isSecDef }));
  console.log(`Keyword "${kw}": found ${foundFunctions[kw].length} functions`);
}

fs.writeFileSync(path.join(__dirname, 'domain_table_breakdown.json'), JSON.stringify({
  domains: Object.fromEntries(Array.from(domainMap.entries()).map(([k, v]) => [k, v.map(t => ({ name: t.name, colCount: t.columnCount, cols: t.columns, pks: t.primaryKeys, fks: t.foreignKeys, rls: t.rlsEnabled }))])),
  vitalFunctions: foundFunctions
}, null, 2), 'utf8');

console.log('Breakdown saved to domain_table_breakdown.json');
