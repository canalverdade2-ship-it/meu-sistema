const fs = require('fs');
const path = require('path');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog_complete.json'), 'utf8'));
const tables = catalog.tables;

// Define domain rules based on DOCUMENTACAO_SISTEMA.md:
// Domain 1: Autenticação, Sessões & Governança de Segurança (auth, sessoes, audit, settings, empresa, rate_limit, blacklists, nonces)
// Domain 2: CRM & Clientes (clientes, client_*, level_*, indicacoes, vouchers, etc.)
// Domain 3: Financeiro & Fintech (faturas, pagamentos, carteira_*, extrato_*, saques, transferencias, pontos_*, cobrancas*, emprestimos*, contratos, formas_pagamento)
// Domain 4: Marketplace & E-commerce (produtos, produto_*, pedidos, loja_*, promocoes_quantidade*, promocoes*, cupons_*, shopee_*)
// Domain 5: Parceiros & Benefícios (parceiros, parceiros_resgates*)
// Domain 6: Afiliados (afiliados, gsa_afiliado_*, afiliado_*)
// Domain 7: Prestadores & Workstation (prestadores, prestador_*, servicos, servicos_*, orcamentos, ordens_servico, ordens_compra, ordens_assinatura, demanda_*)
// Domain 8: Fornecedores & Procurement (fornecedores, fornecedor_*, pedidos_compra*, cotacoes_compra*, cotacoes_itens)
// Domain 9: Colaboradores & RBAC (colaboradores, funcoes, colaborador_modulos, solicitacoes_exclusao)
// Domain 10: GSA Viagens (viagens_*, gsa_viagens_*)
// Domain 11: GSA Saúde (saude_*)
// Domain 12: GSA Seguros (seguros_*)
// Domain 13: Classificados (classificados_*)
// Domain 14: Publicidade & Ads (gsa_ad_*)
// Domain 15: GSA TV (gsa_tv_*)
// Domain 16: Marketing & Campanhas (gsa_hero_banners, blog_posts, campanhas*)
// Domain 17: Comunicação, Suporte & RH (tickets, ticket_*, notificacoes, notificacao_*, suporte_*, os_suporte_*, os_notas, whatsapp_*, gsa_careers_*)

function getDomain(name) {
  const n = name.toLowerCase();
  if (n.startsWith('gsa_tv_')) return { num: 15, name: 'GSA TV & Streaming' };
  if (n.startsWith('saude_')) return { num: 11, name: 'GSA Saúde' };
  if (n.startsWith('seguros_')) return { num: 12, name: 'GSA Seguros' };
  if (n.startsWith('viagens_') || n.startsWith('gsa_viagens_')) return { num: 10, name: 'GSA Viagens' };
  if (n.startsWith('classificados_')) return { num: 13, name: 'Hub Classificados' };
  if (n.startsWith('gsa_ad_')) return { num: 14, name: 'Publicidade & Ads' };
  if (n.startsWith('afiliado_') || n.startsWith('gsa_afiliado_') || n === 'afiliados') return { num: 6, name: 'Programa de Afiliados' };
  if (n.startsWith('fornecedor_') || n === 'fornecedores' || n.startsWith('pedidos_compra') || n.startsWith('cotacoes_compra') || n === 'cotacoes_itens') return { num: 8, name: 'Fornecedores & Procurement' };
  if (n.startsWith('parceiros_') || n === 'parceiros') return { num: 5, name: 'Programa de Parceiros & Resgates' };
  if (n.startsWith('prestador_') || n === 'prestadores' || n.startsWith('servicos') || n === 'orcamentos' || n.startsWith('ordens_') || n.startsWith('demanda_') || n === 'orcamento_timeline') return { num: 7, name: 'Prestadores de Serviços & Workstation' };
  if (n === 'colaboradores' || n === 'funcoes' || n === 'colaborador_modulos' || n === 'solicitacoes_exclusao') return { num: 9, name: 'Colaboradores & RBAC' };
  if (n.startsWith('loja_') || n.startsWith('produto_') || n === 'produtos' || n === 'pedidos' || n.startsWith('promocoes') || n.startsWith('cupons_') || n.startsWith('shopee_')) return { num: 4, name: 'Marketplace & E-commerce' };
  if (n.startsWith('fatura') || n === 'pagamentos' || n.startsWith('carteira_') || n.startsWith('extrato_') || n === 'saques' || n === 'transferencias' || n.startsWith('pontos_') || n.startsWith('cobranca') || n.startsWith('emprestimo') || n === 'contratos' || n === 'formas_pagamento' || n === 'points_transactions') return { num: 3, name: 'Financeiro & Fintech' };
  if (n.startsWith('cliente') || n === 'clientes' || n.startsWith('client_') || n.startsWith('level_') || n === 'indicacoes' || n === 'vouchers') return { num: 2, name: 'CRM & Clientes' };
  if (n === 'gsa_hero_banners' || n === 'blog_posts' || n.startsWith('campanhas')) return { num: 16, name: 'Marketing & Campanhas' };
  if (n.startsWith('ticket') || n.startsWith('notificaca') || n.startsWith('notificacoes') || n.startsWith('suporte_') || n.startsWith('os_suporte_') || n === 'os_notas' || n.startsWith('gsa_careers_') || n.startsWith('whatsapp_')) return { num: 17, name: 'Comunicação, Suporte & RH' };
  return { num: 1, name: 'Autenticação, Sessões & Governança de Segurança' };
}

const domainCounts = {};
for (let i = 1; i <= 17; i++) domainCounts[i] = { count: 0, tables: [] };

tables.forEach(t => {
  const d = getDomain(t.name);
  t.domainNum = d.num;
  t.domainName = d.name;
  domainCounts[d.num].count++;
  domainCounts[d.num].tables.push(t.name);
});

console.log('=== CLASSIFIED TABLES PER DOMAIN ===');
for (let i = 1; i <= 17; i++) {
  console.log(`Domain ${String(i).padStart(2, ' ')}: ${String(domainCounts[i].count).padStart(3, ' ')} tables | ${getDomainByNum(i)}`);
}

function getDomainByNum(num) {
  const map = {
    1: 'Autenticação, Sessões & Governança',
    2: 'CRM & Clientes',
    3: 'Financeiro & Fintech',
    4: 'Marketplace & E-commerce',
    5: 'Parceiros & Benefícios',
    6: 'Programa de Afiliados',
    7: 'Prestadores & Workstation',
    8: 'Fornecedores & Procurement',
    9: 'Colaboradores & RBAC',
    10: 'GSA Viagens',
    11: 'GSA Saúde',
    12: 'GSA Seguros',
    13: 'Hub Classificados',
    14: 'Publicidade & Ads',
    15: 'GSA TV & Streaming',
    16: 'Marketing & Campanhas',
    17: 'Comunicação, Suporte & RH'
  };
  return map[num];
}

fs.writeFileSync(path.join(__dirname, 'classified_catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');
console.log('Saved classified_catalog.json');
