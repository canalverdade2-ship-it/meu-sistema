const fs = require('fs');
const path = require('path');

const root = process.cwd();
const audit = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_cleanup_1', 'all_unreachable.json'), 'utf8'));

const adminUnreachable = [];
for (const [dir, files] of Object.entries(audit)) {
  if (dir.startsWith('src/components/admin')) {
    adminUnreachable.push(...files);
  }
}

console.log('Total unreachable admin files:', adminUnreachable.length);

const detailed = adminUnreachable.map(item => {
  const fullPath = path.join(root, item.file);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n').length;
  
  // Extract export names
  const exports = [];
  const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:function|const|class|interface|type)\s+([A-Za-z0-9_]+)/g);
  for (const m of exportMatches) {
    exports.push(m[1]);
  }

  // Determine which super domain supersedes this
  let superDomain = 'Unknown';
  const f = item.file;
  if (f.includes('Orcamentos') || f.includes('OrdensServico') || f.includes('Demandas') || f.includes('Vendas') || f.includes('Loja') || f.includes('Travel') || f.includes('Viagens') || f.includes('Classifieds') || f.includes('Shopee') || f.includes('GsaTv') || f.includes('ServicePackages') || f.includes('Servicos') || f.includes('produtos') || f.includes('products')) {
    superDomain = 'SD1: Operações & Orçamentos';
  } else if (f.includes('Financeiro') || f.includes('Cobranca') || f.includes('Fiscal') || f.includes('Emprestimos') || f.includes('Credito') || f.includes('Rentabilidade') || f.includes('Reembolsos') || f.includes('CalculatorPro')) {
    superDomain = 'SD2: Financeiro & Faturamento';
  } else if (f.includes('Prestadores') || f.includes('Fornecedores') || f.includes('Careers') || f.includes('Affiliate') || f.includes('Partners') || f.includes('Premios') || f.includes('Vouchers') || f.includes('Promocoes') || f.includes('Promo') || f.includes('Indicacoes') || f.includes('Cupons')) {
    superDomain = 'SD3: Pessoas, RH & Prestadores';
  } else if (f.includes('Clientes') || f.includes('Cadastro') || f.includes('AreaVIP') || f.includes('Tickets') || f.includes('Protection') || f.includes('Empresa') || f.includes('Contratos') || f.includes('saude') || f.includes('seguros')) {
    superDomain = 'SD4: Contratos, Clientes & Jurídico';
  } else if (f.includes('Governanca') || f.includes('Dashboard') || f.includes('Acessos') || f.includes('Configuracoes') || f.includes('SystemMonitor') || f.includes('Relatorios') || f.includes('SiteCampaign')) {
    superDomain = 'SD5: Governança & Configurações';
  }

  return {
    file: item.file,
    lines,
    exports,
    superDomain,
    importedBy: item.importedBy,
    scriptMatches: item.scriptMatches,
    testMatches: item.testMatches,
  };
});

fs.writeFileSync(
  path.join(root, '.agents', 'explorer_diag_cleanup_1', 'detailed_unreachable_admin.json'),
  JSON.stringify(detailed, null, 2),
  'utf8'
);

console.log(JSON.stringify(detailed.map(d => ({
  file: d.file,
  lines: d.lines,
  superDomain: d.superDomain,
  importedByCount: d.importedBy.length,
  scriptRefsCount: d.scriptMatches.length,
  testRefsCount: d.testMatches.length
})), null, 2));
