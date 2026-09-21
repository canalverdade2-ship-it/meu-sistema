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

const foundTargets = [];
const missingTargets = [];

targetFiles.forEach(target => {
  const match = allFiles.find(f => path.basename(f) === target);
  if (match) {
    foundTargets.push({ name: target, path: match });
  } else {
    missingTargets.push(target);
  }
});

console.log(`Found: ${foundTargets.length} / ${targetFiles.length}`);
if (missingTargets.length > 0) {
  console.log('Missing targets:', missingTargets);
}

// Now let's analyze each of the 98 target files
const fileAudits = [];

foundTargets.forEach(({ name, path: filePath }) => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Realtime hook detection
  const usesCanonicalHook = content.includes('useRealtimeSubscription');
  const usesRealtimeShorthand = content.includes('useRealtime(');
  const usesDeprecatedHook = content.includes('useRealtimeTable');
  const usesDirectChannel = content.includes('.channel(');
  const usesSubscribeToTable = content.includes('subscribeToTable');

  // Interval detection
  const usesInterval = content.includes('setInterval');

  // Anti-patterns
  const hasDateNowInChannel = content.includes('Date.now()') && (content.includes('.channel(') || content.includes('channelName'));
  const hasMathRandomInChannel = content.includes('Math.random()') && (content.includes('.channel(') || content.includes('channelName'));
  const hasUnsubscribeOnly = content.includes('.unsubscribe()') && !content.includes('removeChannel');

  // Table subscriptions
  const tables = [];
  const tableRegex = /table:\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    tables.push(match[1]);
  }
  const useRtShorthandRegex = /useRealtime\(\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
  while ((match = useRtShorthandRegex.exec(content)) !== null) {
    tables.push(match[1]);
  }

  // Modals / Drawers detection (Realtime in inactive components)
  const isModalOrDrawer = name.toLowerCase().includes('modal') || name.toLowerCase().includes('drawer') || name.toLowerCase().includes('wizard');
  const hasEnabledProp = content.includes('enabled:');
  const hasRealtimeInModal = isModalOrDrawer && (usesCanonicalHook || usesRealtimeShorthand || usesDeprecatedHook || usesDirectChannel);
  const hasInactiveLeak = hasRealtimeInModal && !hasEnabledProp;

  fileAudits.push({
    name,
    path: filePath,
    usesCanonicalHook,
    usesRealtimeShorthand,
    usesDeprecatedHook,
    usesDirectChannel,
    usesSubscribeToTable,
    usesInterval,
    hasDateNowInChannel,
    hasMathRandomInChannel,
    hasUnsubscribeOnly,
    tables: [...new Set(tables)],
    isModalOrDrawer,
    hasRealtimeInModal,
    hasEnabledProp,
    hasInactiveLeak
  });
});

fs.writeFileSync('.agents/explorer_r5_antipatterns/target_files_audit.json', JSON.stringify(fileAudits, null, 2));
console.log('Saved target_files_audit.json');
