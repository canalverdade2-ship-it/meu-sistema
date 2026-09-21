const fs = require('fs');
const path = require('path');

const targetFiles = [
  'AcessosModule.tsx', 'AdminPrestadorDocumentos.tsx', 'AdvertiserPortal.tsx',
  'AdvertisingAdminModule.tsx', 'AffiliateAdminModule.tsx', 'AfiliadoDashboard.tsx',
  'AfiliadosSection.tsx', 'AreaVipView.tsx', 'AssinaturasModule.tsx',
  'AtendimentoTicketsView.tsx', 'CalculadorasGatewayView.tsx', 'CareersAdminModule.tsx',
  'CheckoutModal.tsx', 'CheckoutPage.tsx', 'ClassifiedsModule.tsx',
  'ClientAffiliatePanel.tsx', 'ClientAreaVIP.tsx', 'ClientAssinaturas.tsx',
  'ClientFidelidade.tsx', 'ClientFinanceiro.tsx', 'ClientIndiqueGanhe.tsx',
  'ClientMeuCredito.tsx', 'ClientOrcamentos.tsx', 'ClientPontos.tsx',
  'ClientProdutos.tsx', 'ClientProfile.tsx', 'ClientServicos.tsx',
  'ClientSuporte.tsx', 'ClientTransferencias.tsx', 'ClientVouchers.tsx',
  'CobrancaView.tsx', 'ConfiguracoesModule.tsx', 'ContratosDocumentosView.tsx',
  'CreateListingWizard.tsx', 'CrmClientesView.tsx', 'Dashboard.tsx',
  'DemandasColaboradorModule.tsx', 'DemandasComentarios.tsx', 'DemandasDashboard.tsx',
  'DemandasDetalhesModal.tsx', 'EcommerceHeader.tsx', 'EcommerceHome.tsx',
  'EditClassifiedListingPage.tsx', 'EmprestimosCreditoView.tsx', 'FaturamentoView.tsx',
  'FidelidadePromocoesSection.tsx', 'FinanceiroSuperDomain.tsx', 'FiscalModule.tsx',
  'FiscalView.tsx', 'FluxoCaixaView.tsx', 'FornecedoresModule.tsx',
  'FornecedoresSection.tsx', 'GovernancaAcessosView.tsx', 'GovernancaAuditoriaView.tsx',
  'GovernancaConfiguracoesView.tsx', 'GovernancaExecutiveDashboard.tsx', 'GovernancaInfraView.tsx',
  'GsaSaudeView.tsx', 'GsaSegurosView.tsx', 'GsaTvModule.tsx',
  'HubEmpresasView.tsx', 'NovaDemandaModal.tsx', 'NovoPrestadorDrawer.tsx',
  'OperacoesSuperDomain.tsx', 'OrcamentosWorkstation.tsx', 'OrdensAssinaturaModule.tsx',
  'OrdensCompraModule.tsx', 'PartnersAdminModule.tsx', 'PartnersPage.tsx',
  'PaymentModal.tsx', 'PayoutClearanceDrawer.tsx', 'PessoasSuperDomain.tsx',
  'PrestadorDetailDrawer.tsx', 'PrestadoresSection.tsx', 'ProdutosModule.tsx',
  'ProtectionAdminModule.tsx', 'ProtocolConsultPage.tsx', 'PurchasesPage.tsx',
  'RentabilidadeReembolsosView.tsx', 'SaquesList.tsx', 'SaquesRepassesSection.tsx',
  'ScrapingAdminModule.tsx', 'ServicePackagesModule.tsx', 'ServicosModule.tsx',
  'ShopeeOperationsModule.tsx', 'SiteCampaignAdminModule.tsx', 'StoreHub.tsx',
  'SupportConversationModal.tsx', 'SystemMonitorModule.tsx', 'TrabalheConoscoSection.tsx',
  'TravelAdminModule.tsx', 'TravelCancellationsPage.tsx', 'TravelProposalsPage.tsx',
  'TravelQuoteRequestPage.tsx', 'TravelReservationPage.tsx', 'usePublicRegistrationSettings.ts',
  'VendasModule.tsx', 'ViagensCategoriasModule.tsx'
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.agents' && file !== 'dist') {
        results = results.concat(walk(filePath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const allFiles = walk('src');

const detailedAudit = [];

targetFiles.forEach(targetName => {
  const match = allFiles.find(f => path.basename(f) === targetName);
  if (!match) {
    detailedAudit.push({
      name: targetName,
      status: 'FILE_NOT_FOUND'
    });
    return;
  }

  const content = fs.readFileSync(match, 'utf8');
  const lines = content.split('\n');

  // Check hooks used
  const usesCanonicalHook = content.includes('useRealtimeSubscription');
  const usesRealtimeShorthand = content.includes('useRealtime(');
  const usesDeprecatedHook = content.includes('useRealtimeTable');
  const usesDirectChannel = content.includes('.channel(');
  const usesSubscribeToTable = content.includes('subscribeToTable');

  let hookType = 'NONE';
  if (usesCanonicalHook) hookType = 'useRealtimeSubscription';
  else if (usesRealtimeShorthand) hookType = 'useRealtime';
  else if (usesDeprecatedHook) hookType = 'useRealtimeTable';
  else if (usesDirectChannel) hookType = 'supabase.channel (direct)';
  else if (usesSubscribeToTable) hookType = 'subscribeToTable';

  // Check tables & filters
  const tables = [];
  const tableDetails = [];
  const tableRegex = /table:\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
  let m;
  while ((m = tableRegex.exec(content)) !== null) {
    const table = m[1];
    const index = m.index;
    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + 250);
    const snippet = content.slice(start, end);
    const hasFilter = snippet.includes('filter:');
    const filterMatch = snippet.match(/filter:\s*([^,\n}]+)/);
    const hasDebounce = snippet.includes('debounceMs:');
    const debounceMatch = snippet.match(/debounceMs:\s*(\d+)/);

    tableDetails.push({
      table,
      hasFilter,
      filter: filterMatch ? filterMatch[1].trim() : null,
      hasDebounce,
      debounceMs: debounceMatch ? parseInt(debounceMatch[1]) : null
    });
    tables.push(table);
  }

  // Also check useRealtime('table') shorthand
  const shorthandRegex = /useRealtime\(\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
  while ((m = shorthandRegex.exec(content)) !== null) {
    tables.push(m[1]);
    tableDetails.push({
      table: m[1],
      hasFilter: false,
      filter: null,
      hasDebounce: false,
      debounceMs: null
    });
  }

  // Also check useRealtimeTable('table' or ['a', 'b'])
  const rtTableRegex = /useRealtimeTable\(\s*(\[[^\]]+\]|['"`][a-zA-Z0-9_-]+['"`])/g;
  while ((m = rtTableRegex.exec(content)) !== null) {
    const rawVal = m[1];
    tables.push(rawVal);
    tableDetails.push({
      table: rawVal,
      hasFilter: false,
      filter: null,
      hasDebounce: false,
      debounceMs: null
    });
  }

  // Also check .channel().on('postgres_changes', { table: '...' })
  const chanRegex = /\.on\(\s*['"]postgres_changes['"],\s*({[^}]+})/g;
  while ((m = chanRegex.exec(content)) !== null) {
    const opts = m[1];
    const tMatch = opts.match(/table:\s*['"`]([a-zA-Z0-9_-]+)['"`]/);
    const fMatch = opts.match(/filter:\s*([^,\n}]+)/);
    if (tMatch) {
      tables.push(tMatch[1]);
      tableDetails.push({
        table: tMatch[1],
        hasFilter: Boolean(fMatch),
        filter: fMatch ? fMatch[1].trim() : null,
        hasDebounce: false,
        debounceMs: null
      });
    }
  }

  // Detect anti-patterns for this specific file
  const antiPatterns = [];

  // AP1: Broadcast without filter on tenant/large tables
  const sensitiveTables = ['clientes', 'faturas', 'pedidos', 'saques', 'orcamentos', 'ordens_servico', 'transacoes', 'notificacoes', 'prestador_demandas', 'prestador_transacoes', 'loja_pedidos', 'loja_pedido_itens', 'cupons_ativados', 'cliente_promocoes', 'tickets'];
  const isClientOrProvider = match.toLowerCase().includes('client') || match.toLowerCase().includes('prestador') || match.toLowerCase().includes('afiliado');
  
  tableDetails.forEach(td => {
    if (isClientOrProvider && sensitiveTables.includes(td.table) && !td.hasFilter) {
      antiPatterns.push({
        category: '1. Broadcast sem filtro em tabela crítica/tenant',
        severity: '🔴 Crítico',
        detail: `Tabela '${td.table}' monitorada sem filtro de ID do usuário/tenant em componente cliente/portal.`
      });
    }
  });

  // AP2: Unstable channel names
  if (content.includes('Date.now()') && (content.includes('.channel(') || content.includes('channelName'))) {
    antiPatterns.push({
      category: '2. Channel name instável',
      severity: '🔴 Crítico',
      detail: `Geração de channelName com Date.now() em render loop ou subscription imperativa.`
    });
  }
  if (content.includes('Math.random()') && (content.includes('.channel(') || content.includes('channelName'))) {
    antiPatterns.push({
      category: '2. Channel name instável',
      severity: '🟡 Alerta',
      detail: `Geração de channelName com Math.random() dinâmico.`
    });
  }

  // AP3: Missing cleanup / direct channel without removeChannel
  if (usesDirectChannel && !content.includes('removeChannel')) {
    antiPatterns.push({
      category: '3. Missing cleanup',
      severity: '🔴 Crítico',
      detail: `Canal direto criado com .channel() sem chamada a supabase.removeChannel no unmount.`
    });
  }

  // AP4: Double subscription
  const uniqueTables = [...new Set(tables)];
  if (tables.length > uniqueTables.length) {
    // Check if same table is in multiple subscriptions
    const counts = {};
    tables.forEach(t => counts[t] = (counts[t] || 0) + 1);
    const duplicates = Object.keys(counts).filter(t => counts[t] > 1);
    if (duplicates.length > 0) {
      antiPatterns.push({
        category: '4. Double subscription',
        severity: '🟡 Alerta',
        detail: `Mesma tabela monitorada múltiplas vezes no componente: ${duplicates.join(', ')}.`
      });
    }
  }

  // AP5: Unstable onChange / deps
  const depsMatch = content.match(/useRealtimeSubscription\([^,]+,\s*\[([^\]]+)\]\s*\)/);
  if (depsMatch) {
    const depsStr = depsMatch[1];
    if (depsStr.includes('load') || depsStr.includes('fetch') || depsStr.includes('() =>')) {
      antiPatterns.push({
        category: '5. onChange / deps instável',
        severity: '🟡 Alerta',
        detail: `Passagem de deps instáveis [${depsStr.trim()}] para useRealtimeSubscription, anulando a proteção de memoização interna.`
      });
    }
  }

  // AP6: Masked polling
  if (content.includes('setInterval(') && (content.includes('load') || content.includes('fetch') || content.includes('refresh') || content.includes('check'))) {
    antiPatterns.push({
      category: '6. Polling mascarado',
      severity: '🟡 Alerta',
      detail: `Uso de setInterval para re-fetch periódico em vez de ou concorrente a Realtime CDC.`
    });
  }

  // AP7: Realtime in inactive component
  const isModalOrDrawer = targetName.toLowerCase().includes('modal') || targetName.toLowerCase().includes('drawer') || targetName.toLowerCase().includes('wizard');
  if (isModalOrDrawer && (usesCanonicalHook || usesRealtimeShorthand || usesDeprecatedHook || usesDirectChannel)) {
    if (!content.includes('enabled:')) {
      antiPatterns.push({
        category: '7. Realtime em componente inativo',
        severity: '🟡 Alerta',
        detail: `Modal/Drawer com realtime ativo sem controle de 'enabled: isOpen', mantendo WebSocket aberto quando fechado.`
      });
    }
  }

  detailedAudit.push({
    name: targetName,
    path: match,
    hookType,
    tables: [...new Set(tables)],
    tableDetails,
    antiPatterns,
    severity: antiPatterns.some(a => a.severity.includes('🔴')) ? '🔴 Crítico' : (antiPatterns.length > 0 ? '🟡 Alerta' : '🟢 OK')
  });
});

fs.writeFileSync('.agents/explorer_r5_antipatterns/full_98_audit.json', JSON.stringify(detailedAudit, null, 2));

const criticalCount = detailedAudit.filter(d => d.severity === '🔴 Crítico').length;
const alertCount = detailedAudit.filter(d => d.severity === '🟡 Alerta').length;
const okCount = detailedAudit.filter(d => d.severity === '🟢 OK').length;

console.log(`\n========================================`);
console.log(`AUDIT SUMMARY OF 98 COMPONENTS:`);
console.log(`🔴 Crítico: ${criticalCount}`);
console.log(`🟡 Alerta:  ${alertCount}`);
console.log(`🟢 OK:      ${okCount}`);
console.log(`Total:     ${detailedAudit.length}`);
console.log(`========================================`);
