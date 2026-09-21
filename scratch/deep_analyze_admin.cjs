const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const adminDir = path.join(rootDir, 'src', 'components', 'admin');

function getAllFiles(dir, ext = '.tsx') {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, ext));
    } else if (file.endsWith(ext)) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = getAllFiles(adminDir, '.tsx').sort();

function classifyFile(relPathFromAdmin, fileName) {
  const p = relPathFromAdmin.toLowerCase();
  const f = fileName.toLowerCase();

  // Squad 1: Core, Governança & Infraestrutura
  if (
    p.startsWith('infra/') ||
    p.startsWith('ui/') ||
    p.startsWith('super-domains/governanca/') ||
    p.startsWith('super-domains/shared/') ||
    ['dashboard.tsx', 'collaboratordashboard.tsx', 'adminnavigation.tsx', 'acessosmodule.tsx', 'configuracoesmodule.tsx', 'systemmonitormodule.tsx', 'systemstatusindicator.tsx', 'empresamodule.tsx', 'whatsapphealthmonitor.tsx'].includes(f)
  ) {
    return {
      squadId: 'squad-1',
      squad: 'Squad 1 — Core, Governança & Infraestrutura',
      domain: 'Core, Governança & Infraestrutura'
    };
  }

  // Squad 2: Financeiro, Fiscal & Cobrança
  if (
    p.startsWith('super-domains/financeiro/') ||
    ['financeiromodule.tsx', 'cobrancamodule.tsx', 'fiscalmodule.tsx', 'creditomodule.tsx', 'emprestimosmodule.tsx', 'reembolsosmodule.tsx', 'painelrentabilidade.tsx', 'calculatorproadminpanel.tsx', 'calculatorpropaymentconfiguration.tsx'].includes(f)
  ) {
    return {
      squadId: 'squad-2',
      squad: 'Squad 2 — Financeiro, Cobrança & Fiscal',
      domain: 'Financeiro, Cobrança & Fiscal'
    };
  }

  // Squad 3: Contratos, Jurídico & Documentação (Super Domain Contratos)
  if (p.startsWith('super-domains/contratos/')) {
    return {
      squadId: 'squad-3',
      squad: 'Squad 3 — Contratos, Jurídico & Grandes Contas',
      domain: 'Contratos & Gestão Jurídica'
    };
  }

  // Squad 4: Pessoas, CRM, Cadastros & Parceiros
  if (
    p.startsWith('super-domains/pessoas/') ||
    p.startsWith('clientes/') ||
    p.startsWith('prestadores/') ||
    ['cadastromodule.tsx', 'clientesmodule.tsx', 'prestadoresmodule.tsx', 'fornecedoresmodule.tsx', 'partnersadminmodule.tsx', 'affiliateadminmodule.tsx', 'careersadminmodule.tsx', 'careervacanciesmanager.tsx'].includes(f)
  ) {
    return {
      squadId: 'squad-4',
      squad: 'Squad 4 — Pessoas, CRM, Cadastros & Parceiros',
      domain: 'Pessoas, CRM & Cadastros'
    };
  }

  // Squad 5: Operações, Demandas, Ordens de Serviço & Atendimento
  if (
    p.startsWith('super-domains/operacoes/') ||
    p.startsWith('demandas/') ||
    ['vendasmodule.tsx', 'demandascolaboradormodule.tsx', 'orcamentosmodule.tsx', 'ordensassinaturamodule.tsx', 'ordenscompramodule.tsx', 'ordensservicomodule.tsx', 'ticketsmodule.tsx', 'shopeeoperationsmodule.tsx'].includes(f)
  ) {
    return {
      squadId: 'squad-5',
      squad: 'Squad 5 — Operações, Demandas & Atendimento',
      domain: 'Operações, Demandas & Ordens'
    };
  }

  // Squad 6: E-commerce, Catálogo, Loja Virtual & Fidelidade
  if (
    p.startsWith('products/') ||
    p.startsWith('ecommerce/') ||
    ['produtosmodule.tsx', 'servicosmodule.tsx', 'servicepackagesmodule.tsx', 'assinaturasmodule.tsx', 'lojacategoriasmodule.tsx', 'lojadestacadosmodule.tsx', 'lojatrocasmodule.tsx', 'classificadosmodule.tsx', 'classifiedsmodule.tsx', 'cuponslojamodule.tsx', 'promocoesmodule.tsx', 'promocaoquantidademodule.tsx', 'promocaoquantidadeform.tsx', 'promoanalytics.tsx', 'promodetalhesmodal.tsx', 'indicacoesmodule.tsx', 'vouchersmodule.tsx', 'premiosmodule.tsx', 'areavipmodule.tsx'].includes(f)
  ) {
    return {
      squadId: 'squad-6',
      squad: 'Squad 6 — E-commerce, Catálogo, Loja & Fidelidade',
      domain: 'E-commerce, Catálogo & Fidelidade'
    };
  }

  // Squad 7: Mídia, GSA TV, Publicidade & Automações
  if (
    p.startsWith('gsa-tv/') ||
    ['gsatvmodule.tsx', 'gsatvcontrolroom.tsx', 'gsatvliveconsole.tsx', 'gsatvgraphics.tsx', 'gsatvlivesources.tsx', 'gsatvrights.tsx', 'advertisingadminmodule.tsx', 'sitecampaignadminpage.tsx', 'sitecampaignadminmodule.tsx', 'sitecampaigndeletionpanel.tsx', 'sitecampaignpermissionmatrix.tsx', 'scrapingadminmodule.tsx', 'scrapingexecutionmonitormodal.tsx'].includes(f)
  ) {
    return {
      squadId: 'squad-7',
      squad: 'Squad 7 — Mídia, GSA TV & Publicidade',
      domain: 'Mídia, GSA TV & Publicidade'
    };
  }

  // Squad 8: Benefícios, Seguros, Saúde & Viagens
  if (
    p.startsWith('saude/') ||
    p.startsWith('seguros/') ||
    ['protectionadminmodule.tsx', 'traveladminmodule.tsx', 'viagenscategoriasmodule.tsx'].includes(f)
  ) {
    return {
      squadId: 'squad-8',
      squad: 'Squad 8 — Benefícios, Seguros & Viagens',
      domain: 'Benefícios, Seguros & Viagens'
    };
  }

  // Squad 9: BI, Relatórios Gerenciais & Analytics
  if (
    p.startsWith('relatorios/') ||
    ['relatoriosmodule.tsx'].includes(f)
  ) {
    return {
      squadId: 'squad-9',
      squad: 'Squad 9 — BI, Relatórios & Analytics',
      domain: 'BI & Relatórios Gerenciais'
    };
  }

  console.warn(`Unclassified file: ${relPathFromAdmin}`);
  return {
    squadId: 'squad-1',
    squad: 'Squad 1 — Core, Governança & Infraestrutura',
    domain: 'Core & Utilitários'
  };
}

const detailedCatalog = [];

for (const filePath of files) {
  const relPathFromRoot = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const relPathFromAdmin = path.relative(adminDir, filePath).replace(/\\/g, '/');
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;

  // Component Name
  let componentName = path.basename(filePath, '.tsx');
  const defaultExportMatch = content.match(/export\s+default\s+(?:function\s+)?([A-Za-z0-9_]+)/);
  const namedExportMatch = content.match(/export\s+function\s+([A-Za-z0-9_]+)/);
  const constExportMatch = content.match(/export\s+const\s+([A-Za-z0-9_]+)\s*=/);
  if (defaultExportMatch && defaultExportMatch[1]) {
    componentName = defaultExportMatch[1];
  } else if (namedExportMatch && namedExportMatch[1]) {
    componentName = namedExportMatch[1];
  } else if (constExportMatch && constExportMatch[1]) {
    componentName = constExportMatch[1];
  }

  // Table operations
  const tableOps = {};
  const addTableOp = (table, op) => {
    if (!table || ['select', 'insert', 'update', 'delete', 'error', 'data', 'auth', 'public', 'table'].includes(table)) return;
    if (!tableOps[table]) tableOps[table] = new Set();
    tableOps[table].add(op);
  };

  const fromRegex = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)(?:\.([a-zA-Z0-9_]+)\b)?/g;
  let m;
  while ((m = fromRegex.exec(content)) !== null) {
    const table = m[1];
    const nextCall = m[2];
    if (['select', 'insert', 'update', 'delete', 'upsert'].includes(nextCall)) {
      addTableOp(table, nextCall);
    } else {
      addTableOp(table, 'select/query');
    }
  }

  const cowRegex = /clientOperationalWrite\([^,]+,\s*['"`]([a-zA-Z0-9_]+)['"`],\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
  while ((m = cowRegex.exec(content)) !== null) {
    addTableOp(m[1], m[2]);
  }

  const rtRegex = /tables\s*:\s*\[([^\]]+)\]/g;
  while ((m = rtRegex.exec(content)) !== null) {
    const sub = m[1].matchAll(/['"`]([a-zA-Z0-9_]+)['"`]/g);
    for (const sm of sub) {
      addTableOp(sm[1], 'realtime');
    }
  }

  const tablePropRegex = /table\s*:\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
  while ((m = tablePropRegex.exec(content)) !== null) {
    addTableOp(m[1], 'realtime/query');
  }

  // RPCs
  const rpcs = new Set();
  const rpcRegex = /(?:\.rpc|callAdminRpc|callClientRpc)(?:<[^>]+>)?\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
  while ((m = rpcRegex.exec(content)) !== null) {
    rpcs.add(m[1]);
  }

  // Edge Functions
  const edgeFunctions = new Set();
  const efRegex = /\.functions\.invoke\(\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
  let efMatch;
  while ((efMatch = efRegex.exec(content)) !== null) {
    edgeFunctions.add(efMatch[1]);
  }

  // Interactive capabilities & UI patterns
  const hasForm = /<form\b|useForm|handleSubmit|onSubmit=/i.test(content);
  const hasTable = /<table\b|<tbody\b|<tr\b|<th\b|ag-grid|DataTable|TacticalDataGrid/i.test(content);
  const hasModal = /Dialog|Modal|Sheet|Drawer|Popover|AlertDialog|SlideOver/i.test(content);
  const hasFilter = /filter|search|busca|filtro|StatusFilter|DateRange|Select|Combobox/i.test(content);
  const hasRealtime = /useRealtimeSubscription|useRealtimeTable|\.channel\(/i.test(content);
  const hasExport = /export|csv|excel|pdf|download|relatorio|imprimir/i.test(content);
  const hasTabs = /Tabs|TabList|activeTab|setActiveTab/i.test(content);
  const hasUpload = /upload|input[^>]+type=["']file["']|FileReader|dropzone/i.test(content);

  const capabilities = [];
  if (hasForm) capabilities.push('Formulários interativos');
  if (hasTable) capabilities.push('Listagem em Tabela/Grid');
  if (hasFilter) capabilities.push('Barra de Busca e Filtros');
  if (hasModal) capabilities.push('Modais / Drawers contextuais');
  if (hasTabs) capabilities.push('Navegação em Abas internas');
  if (hasRealtime) capabilities.push('Assinatura Supabase Realtime');
  if (hasExport) capabilities.push('Exportação de Dados / Relatórios');
  if (hasUpload) capabilities.push('Upload de Arquivos / Comprovantes');

  // Estimate mobile complexity
  let complexity = 'Baixa';
  if (lines > 800 || (hasTable && hasForm && hasModal && hasRealtime) || Object.keys(tableOps).length > 5 || rpcs.size > 2) {
    complexity = 'Alta';
  } else if (lines > 300 || hasTable || hasModal || Object.keys(tableOps).length > 2 || rpcs.size > 0) {
    complexity = 'Média';
  }

  const { squadId, squad, domain } = classifyFile(relPathFromAdmin, fileName);

  const tableSummary = Object.entries(tableOps).map(([t, ops]) => `${t} [${Array.from(ops).join(', ')}]`);

  detailedCatalog.push({
    fileName,
    componentName,
    relPathFromRoot,
    relPathFromAdmin,
    lines,
    squadId,
    squad,
    domain,
    tables: tableSummary,
    tableNames: Object.keys(tableOps).sort(),
    rpcs: Array.from(rpcs).sort(),
    edgeFunctions: Array.from(edgeFunctions).sort(),
    capabilities,
    complexity,
    metrics: {
      lines,
      tableCount: Object.keys(tableOps).length,
      rpcCount: rpcs.size,
      hasForm,
      hasTable,
      hasModal,
      hasFilter,
      hasRealtime,
      hasExport,
      hasTabs,
      hasUpload
    }
  });
}

fs.writeFileSync(path.join(__dirname, 'admin_survey_catalog.json'), JSON.stringify(detailedCatalog, null, 2));

console.log(`Analyzed ${detailedCatalog.length} files successfully.`);

const squadMap = {};
detailedCatalog.forEach(item => {
  if (!squadMap[item.squad]) squadMap[item.squad] = [];
  squadMap[item.squad].push(item);
});

console.log('\n=== RECONCILED SQUAD DISTRIBUTION ===');
let totalAssigned = 0;
Object.keys(squadMap).sort().forEach(sq => {
  const count = squadMap[sq].length;
  totalAssigned += count;
  console.log(`${sq}: ${count} components`);
});
console.log(`\nTotal verified: ${totalAssigned} / 176`);
