const fs = require('fs');
const path = require('path');

const filesToDelete = [
  // 29 in src/components/admin/
  'src/components/admin/AreaVIPModule.tsx',
  'src/components/admin/EmpresaModule.tsx',
  'src/components/admin/PrestadoresModule.tsx',
  'src/components/admin/PromocoesModule.tsx',
  'src/components/admin/TicketsModule.tsx',
  'src/components/admin/products/ProductVariationsEditor.tsx',
  'src/components/admin/ClientesModule.tsx',
  'src/components/admin/CobrancaModule.tsx',
  'src/components/admin/CreditoModule.tsx',
  'src/components/admin/CuponsLojaModule.tsx',
  'src/components/admin/EmprestimosModule.tsx',
  'src/components/admin/FinanceiroModule.tsx',
  'src/components/admin/IndicacoesModule.tsx',
  'src/components/admin/LojaTrocasModule.tsx',
  'src/components/admin/OrcamentosModule.tsx',
  'src/components/admin/OrdensServicoModule.tsx',
  'src/components/admin/PremiosModule.tsx',
  'src/components/admin/PromoAnalytics.tsx',
  'src/components/admin/PromocaoQuantidadeForm.tsx',
  'src/components/admin/PromocaoQuantidadeModule.tsx',
  'src/components/admin/PromoDetalhesModal.tsx',
  'src/components/admin/ReembolsosModule.tsx',
  'src/components/admin/VouchersModule.tsx',
  'src/components/admin/clientes/AdminClienteDocumentos.tsx',
  'src/components/admin/ecommerce/EcommerceAnalytics.tsx',
  'src/components/admin/ecommerce/PricingPanel.tsx',
  'src/components/admin/prestadores/PrestadoresCadastro.tsx',
  'src/components/admin/prestadores/PrestadoresDemandas.tsx',
  'src/components/admin/prestadores/PrestadoresFinanceiro.tsx',
  // 20 in other src/
  'src/components/AppClientShell.tsx',
  'src/components/client/marketplace/MarketplaceModuleCard.tsx',
  'src/components/client/marketplace/TravelPackagesPage.tsx',
  'src/components/client/store/HeroBannerCarousel.tsx',
  'src/components/client/store/StoreHubCancelOrder.tsx',
  'src/components/client/store/StoreHubExchanges.tsx',
  'src/components/client/store/StoreHubRefunds.tsx',
  'src/components/client/store/StoreHubVipPromos.tsx',
  'src/components/public/BrandPortfolioDialog.tsx',
  'src/components/public/FreeToolsCalculatorDialog.tsx',
  'src/data/publicProjectTypes.ts',
  'src/hooks/use-mobile.tsx',
  'src/hooks/useStoreCart.ts',
  'src/hooks/useStoreOrders.ts',
  'src/hooks/useStoreProducts.ts',
  'src/lib/error-capture.ts',
  'src/lib/lovable-error-reporting.ts',
  'src/routing/adminNavigation.ts',
  'src/utils/paymentPropagation.ts',
  'src/utils/vipStyles.ts'
];

console.log('Total files to delete:', filesToDelete.length);

// 1. Scan for any external references
function scanDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (['node_modules', '.git', '.agents', 'dist'].includes(entry)) continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      scanDir(full, fileList);
    } else if (/\.(ts|tsx|js|jsx|json)$/.test(entry)) {
      fileList.push(full);
    }
  }
  return fileList;
}

const allFiles = scanDir('.');
const targetSet = new Set(filesToDelete.map(f => path.normalize(path.resolve(f))));

let references = [];

for (const file of allFiles) {
  const normFile = path.normalize(path.resolve(file));
  if (targetSet.has(normFile)) continue;

  const content = fs.readFileSync(file, 'utf8');
  for (const target of filesToDelete) {
    const base = path.basename(target, path.extname(target));
    // Exact module import check
    const importRegex = new RegExp(`from\\s+['"][^'"]*\\b${base}\\b['"]`, 'g');
    if (importRegex.test(content)) {
      references.push({ file, target, base });
    }
  }
}

if (references.length > 0) {
  console.error('WARNING: Found active references:', references);
} else {
  console.log('Verified: 0 external active references to target files.');
}

// 2. Perform deletion
let deletedCount = 0;
for (const relPath of filesToDelete) {
  const fullPath = path.resolve(relPath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`Deleted: ${relPath}`);
    deletedCount++;
  } else {
    console.log(`Already missing: ${relPath}`);
  }
}

console.log(`Summary: Successfully deleted ${deletedCount} / ${filesToDelete.length} files.`);
