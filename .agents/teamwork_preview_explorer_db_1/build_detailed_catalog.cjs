const fs = require('fs');
const path = require('path');

const summary = JSON.parse(fs.readFileSync(path.join(__dirname, 'db_analysis_summary.json'), 'utf8'));

// Build detailed domain catalog
const domains = {
  '1. Autenticação, Sessões & Governança de Segurança': [],
  '2. CRM & Clientes (Identidade, VIP, Indicações, Bloqueios)': [],
  '3. Financeiro & Fintech (Faturas, Pagamentos, Carteira, Saques, Empréstimos, Cobranças)': [],
  '4. Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos, Solicitacoes, Devoluções)': [],
  '5. Programa de Parceiros & Resgates de Benefícios (Appeals/Recursos, Outbox)': [],
  '6. Programa de Afiliados (Links, Conversões, Comissões, Saques, Transferências)': [],
  '7. Prestadores de Serviços & Workstation (Demandas, Ordens de Serviço, Repasses)': [],
  '8. Fornecedores & Procurement (Cotações, Pedidos de Compra, Homologação)': [],
  '9. Colaboradores & Perfis Administrativos (Auditoria, Módulos, Permissões RBAC)': [],
  '10. GSA Viagens (Pacotes, Cotações, Reservas, Propostas, Parcelamentos)': [],
  '11. GSA Saúde (Planos, Cotações, Propostas, Vidas, Contratos)': [],
  '12. GSA Seguros (Apólices, Sinistros, Cotações, Ramos)': [],
  '13. Hub Classificados (Anúncios, Categorias, Propostas, Moderação, Comissões)': [],
  '14. Plataforma de Publicidade & Ads (Campanhas, Criativos, Métricas, Faturamento)': [],
  '15. GSA TV (Grade de Programação, Canais, Mídias, IA Editorial, Logs de Transmissão)': [],
  '16. Marketing, Campanhas & Vaquinhas Coletivas (Banners Hero, Vaquinhas, Site Campaigns)': [],
  '17. Comunicação, Suporte & RH (Tickets, Mensagens, WhatsApp Outbox, Notificações, Carreiras)': []
};

function assignDomain(name) {
  if (name.startsWith('gsa_tv_')) return '15. GSA TV (Grade de Programação, Canais, Mídias, IA Editorial, Logs de Transmissão)';
  if (name.startsWith('gsa_viagens_') || name.startsWith('viagens_')) return '10. GSA Viagens (Pacotes, Cotações, Reservas, Propostas, Parcelamentos)';
  if (name.startsWith('gsa_saude_') || name.startsWith('saude_')) return '11. GSA Saúde (Planos, Cotações, Propostas, Vidas, Contratos)';
  if (name.startsWith('gsa_seguros_') || name.startsWith('seguros_')) return '12. GSA Seguros (Apólices, Sinistros, Cotações, Ramos)';
  if (name.startsWith('hub_classificados_') || name.startsWith('classificados_')) return '13. Hub Classificados (Anúncios, Categorias, Propostas, Moderação, Comissões)';
  if (name.startsWith('gsa_ad_') || name.startsWith('ad_') || name.startsWith('advertising_')) return '14. Plataforma de Publicidade & Ads (Campanhas, Criativos, Métricas, Faturamento)';
  if (name.startsWith('afiliado_') || name.startsWith('afiliados') || name.startsWith('gsa_afiliado_') || name.startsWith('gsa_affiliate_')) return '6. Programa de Afiliados (Links, Conversões, Comissões, Saques, Transferências)';
  if (name.startsWith('parceiro_') || name.startsWith('parceiros')) return '5. Programa de Parceiros & Resgates de Benefícios (Appeals/Recursos, Outbox)';
  if (name.startsWith('fornecedor_') || name.startsWith('fornecedores') || name.startsWith('pedidos_compra') || name.startsWith('cotacoes_')) return '8. Fornecedores & Procurement (Cotações, Pedidos de Compra, Homologação)';
  if (name.startsWith('prestador_') || name.startsWith('prestadores') || name.startsWith('demanda_')) return '7. Prestadores de Serviços & Workstation (Demandas, Ordens de Serviço, Repasses)';
  if (name.startsWith('colaborador_') || name.startsWith('colaboradores') || name.startsWith('funcoes') || name.startsWith('solicitacoes_exclusao')) return '9. Colaboradores & Perfis Administrativos (Auditoria, Módulos, Permissões RBAC)';
  if (name.startsWith('cliente_') || name.startsWith('clientes') || name.startsWith('client_') || name.startsWith('indicac') || name.startsWith('vouchers')) return '2. CRM & Clientes (Identidade, VIP, Indicações, Bloqueios)';
  if (name.startsWith('produto_') || name.startsWith('produtos') || name.startsWith('loja_') || name.startsWith('pedidos') || name.startsWith('promoc')) return '4. Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos, Solicitacoes, Devoluções)';
  if (name.startsWith('fatura') || name.startsWith('pagamento') || name.startsWith('saque') || name.startsWith('transferencia') || name.startsWith('carteira') || name.startsWith('extrato') || name.startsWith('ponto') || name.startsWith('cobranca') || name.startsWith('emprestimo')) return '3. Financeiro & Fintech (Faturas, Pagamentos, Carteira, Saques, Empréstimos, Cobranças)';
  if (name.startsWith('ticket') || name.startsWith('notificac') || name.startsWith('whatsapp') || name.startsWith('suporte') || name.startsWith('os_') || name.startsWith('gsa_careers') || name.startsWith('vagas_')) return '17. Comunicação, Suporte & RH (Tickets, Mensagens, WhatsApp Outbox, Notificações, Carreiras)';
  if (name.startsWith('admin_') || name.startsWith('audit_') || name.startsWith('system_') || name.startsWith('secure_session') || name.startsWith('sistema_sessoes') || name.startsWith('gsa_auth') || name.startsWith('sessao_') || name.startsWith('empresa')) return '1. Autenticação, Sessões & Governança de Segurança';
  if (name.startsWith('site_campaign') || name.startsWith('campaign_') || name.startsWith('gsa_hero_banners') || name.startsWith('loja_vaquinhas') || name.startsWith('blog_posts')) return '16. Marketing, Campanhas & Vaquinhas Coletivas (Banners Hero, Vaquinhas, Site Campaigns)';
  
  // Fallback checks
  if (/contrato/i.test(name)) return '3. Financeiro & Fintech (Faturas, Pagamentos, Carteira, Saques, Empréstimos, Cobranças)';
  if (/orcamento/i.test(name) || /ordens_/i.test(name) || /servico/i.test(name)) return '7. Prestadores de Serviços & Workstation (Demandas, Ordens de Serviço, Repasses)';
  
  return '1. Autenticação, Sessões & Governança de Segurança';
}

for (const t of summary.tables) {
  const d = assignDomain(t.name);
  domains[d].push(t);
}

console.log('--- TABLES PER DOMAIN ---');
for (const [d, tbls] of Object.entries(domains)) {
  console.log(`${d}: ${tbls.length} tables`);
}

fs.writeFileSync(path.join(__dirname, 'detailed_domain_catalog.json'), JSON.stringify(domains, null, 2), 'utf8');
console.log('Saved detailed_domain_catalog.json');
