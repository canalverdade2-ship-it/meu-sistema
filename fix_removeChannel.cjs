const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/admin/CollaboratorDashboard.tsx',
  'src/components/admin/DemandasColaboradorModule.tsx',
  'src/components/prestador/PrestadorAgenda.tsx',
  'src/components/prestador/PrestadorDemandas.tsx',
  'src/components/prestador/PrestadorDocumentos.tsx',
  'src/components/prestador/PrestadorFinanceiro.tsx',
  'src/components/prestador/PrestadorPremios.tsx',
  'src/components/prestador/PrestadorPromocoes.tsx',
  'src/components/prestador/PrestadorSuporte.tsx',
  'src/components/prestador/PrestadorVouchers.tsx',
  'src/hooks/useAdminNotifications.tsx',
  'src/hooks/useProviderNotifications.tsx',
  'src/pages/Fornecedor/FornecedorDashboard.tsx',
  'src/pages/SecureAdminPanel.tsx'
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf-8');

  // Replace usages
  content = content.replace(/void supabase\.removeChannel\((.*?)\)/g, 'supabase.removeChannel($1).catch(console.error)');
  
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`Fixed removeChannel in ${filePath}`);
});
