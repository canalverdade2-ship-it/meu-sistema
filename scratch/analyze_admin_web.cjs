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

const files = getAllFiles(adminDir, '.tsx');

function determineSquadAndDomain(relPath, fileName, content) {
  const p = relPath.toLowerCase();
  const f = fileName.toLowerCase();

  // Squad 1: Core, Infraestrutura, Automações & Governança
  if (
    p.startsWith('infra/') ||
    p.startsWith('ui/') ||
    p.startsWith('super-domains/governanca/') ||
    p.startsWith('super-domains/shared/') ||
    ['dashboard.tsx', 'collaboratordashboard.tsx', 'adminnavigation.tsx', 'acessosmodule.tsx', 'configuracoesmodule.tsx', 'systemmonitormodule.tsx', 'systemstatusindicator.tsx', 'empresamodule.tsx', 'whatsapphealthmonitor.tsx'].includes(f)
  ) {
    return {
      squad: 'Squad 1 — Core, Governança & Infraestrutura',
      domain: 'Core & Infraestrutura'
    };
  }

  // Squad 2: Financeiro, Cobrança, Fiscal & Contratos
  if (
    p.startsWith('super-domains/financeiro/') ||
    p.startsWith('super-domains/contratos/') ||
    ['cobrancamodule.tsx', 'fiscalmodule.tsx', 'painelrentabilidade.tsx', 'calculatorproadminpanel.tsx'].includes(f)
  ) {
    return {
      squad: 'Squad 2 — Financeiro, Fiscal & Contratos',
      domain: 'Financeiro, Fiscal & Contratos'
    };
  }

  // Squad 3: Pessoas, CRM, Cadastros & Parceiros
  if (
    p.startsWith('super-domains/pessoas/') ||
    p.startsWith('clientes/') ||
    p.startsWith('prestadores/') ||
    ['cadastromodule.tsx', 'fornecedoresmodule.tsx', 'fornecedoressection.tsx', 'partnersadminmodule.tsx', 'partnerredemptiondetailmodal.tsx', 'affiliateadminmodule.tsx', 'careersadminmodule.tsx', 'careervacanciesmanager.tsx'].includes(f)
  ) {
    return {
      squad: 'Squad 3 — Pessoas, CRM, Cadastros & Parceiros',
      domain: 'Pessoas, CRM & Parceiros'
    };
  }

  // Squad 4: Operações, Demandas, Ordens de Serviço & Atendimento
  if (
    p.startsWith('super-domains/operacoes/') ||
    p.startsWith('demandas/') ||
    ['vendasmodule.tsx', 'demandascolaboradormodule.tsx', 'demandasmodule.tsx', 'orcamentosmodule.tsx', 'orcamentosworkstation.tsx', 'ordensassinarutamodule.tsx', 'ordenscompramodule.tsx', 'ordensservicamodule.tsx', 'ordensassinaturamodule.tsx', 'ordensservicomodule.tsx', 'tarefasworkstation.tsx', 'ticketsmodule.tsx', 'shopeeoperationsmodule.tsx'].includes(f)
  ) {
    return {
      squad: 'Squad 4 — Operações, Demandas & Ordens',
      domain: 'Operações & Atendimento'
    };
  }

  // Squad 5: E-commerce, Catálogo, Loja & Fidelidade
  if (
    p.startsWith('products/') ||
    p.startsWith('ecommerce/') ||
    ['produtosmodule.tsx', 'assinaturasmodule.tsx', 'servicepackagesmodule.tsx', 'categoriaslojamodule.tsx', 'classificadosmodule.tsx', 'promocoesmodule.tsx', 'promocaoquantidademodule.tsx', 'promoanalytics.tsx', 'promodetalhesmodal.tsx', 'indicacoesmodule.tsx', 'vouchersmodule.tsx', 'premiosmodule.tsx', 'areavipmodule.tsx'].includes(f)
  ) {
    return {
      squad: 'Squad 5 — E-commerce, Catálogo & Fidelidade',
      domain: 'E-commerce & Fidelidade'
    };
  }

  // Squad 6: Mídia, GSA TV & Marketing
  if (
    p.startsWith('gsa-tv/') ||
    ['gsatvmodule.tsx', 'gsatvcontrolroom.tsx', 'gsatvliveconsole.tsx', 'gsatvgraphics.tsx', 'gsatvlivesources.tsx', 'gsatvrights.tsx', 'advertisingadminmodule.tsx', 'sitecampaignadminpage.tsx', 'scrapingadminmodule.tsx'].includes(f)
  ) {
    return {
      squad: 'Squad 6 — Mídia, GSA TV & Marketing',
      domain: 'Mídia & GSA TV'
    };
  }

  // Squad 7: Benefícios, Saúde, Seguros & Viagens
  if (
    p.startsWith('saude/') ||
    p.startsWith('seguros/') ||
    ['protectionadminmodule.tsx', 'traveladminmodule.tsx'].includes(f)
  ) {
    return {
      squad: 'Squad 7 — Benefícios, Seguros & Viagens',
      domain: 'Benefícios & Seguros'
    };
  }

  // Squad 8: BI, Relatórios & Analytics
  if (
    p.startsWith('relatorios/') ||
    ['relatoriosmodule.tsx'].includes(f)
  ) {
    return {
      squad: 'Squad 8 — BI & Relatórios Gerenciais',
      domain: 'BI & Relatórios'
    };
  }

  return {
    squad: 'Squad 1 — Core, Governança & Infraestrutura',
    domain: 'Core & Utilitários'
  };
}

const detailed = [];

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

  // Table access detection
  const tableOps = {};
  const addTableOp = (table, op) => {
    if (!table || ['select', 'insert', 'update', 'delete', 'error', 'data', 'auth', 'public'].includes(table)) return;
    if (!tableOps[table]) tableOps[table] = new Set();
    tableOps[table].add(op);
  };

  // match supabase.from('tbl').select/insert/update/delete
  const fromRegex = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)(?:\.([a-zA-Z0-9_]+)\b)?/g;
  let m;
  while ((m = fromRegex.exec(content)) !== null) {
    const table = m[1];
    const nextCall = m[2];
    if (['select', 'insert', 'update', 'delete', 'upsert'].includes(nextCall)) {
      addTableOp(table, nextCall);
    } else {
      addTableOp(table, 'query');
    }
  }

  // match clientOperationalWrite(id, 'tbl', 'op', ...)
  const cowRegex = /clientOperationalWrite\([^,]+,\s*['"`]([a-zA-Z0-9_]+)['"`],\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
  while ((m = cowRegex.exec(content)) !== null) {
    addTableOp(m[1], m[2]);
  }

  // match useRealtimeSubscription tables
  const rtRegex = /tables\s*:\s*\[([^\]]+)\]/g;
  while ((m = rtRegex.exec(content)) !== null) {
    const sub = m[1].matchAll(/['"`]([a-zA-Z0-9_]+)['"`]/g);
    for (const sm of sub) {
      addTableOp(sm[1], 'realtime');
    }
  }

  // single table in subscription or hook
  const tablePropRegex = /table\s*:\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
  while ((m = tablePropRegex.exec(content)) !== null) {
    addTableOp(m[1], 'realtime/query');
  }

  // RPC detection
  const rpcs = new Set();
  const rpcRegex = /(?:\.rpc|callAdminRpc|callClientRpc)(?:<[^>]+>)?\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
  while ((m = rpcRegex.exec(content)) !== null) {
    rpcs.add(m[1]);
  }

  // Edge Functions
  const edgeFunctions = new Set();
  const efRegex = /\.functions\.invoke\(\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
  while ((m = efRegex.exec(content)) !== null) {
    edgeFunctions.add(m[1]);
  }

  // Capabilities
  const hasForm = /<form\b|useForm|handleSubmit|onSubmit=/i.test(content);
  const hasTable = /<table\b|<tbody\b|<tr\b|<th\b|ag-grid|DataTable|TacticalDataGrid/i.test(content);
  const hasModal = /Dialog|Modal|Sheet|Drawer|Popover|AlertDialog|SlideOver/i.test(content);
  const hasFilter = /filter|search|busca|filtro|StatusFilter|DateRange|Select|Combobox/i.test(content);
  const hasRealtime = /useRealtimeSubscription|useRealtimeTable|\.channel\(/i.test(content);
  const hasExport = /export|csv|excel|pdf|download|relatorio|imprimir/i.test(content);
  const hasTabs = /Tabs|TabList|activeTab|setActiveTab/i.test(content);

  // Key interactive features / actions detected
  const actions = [];
  if (/<input\b|<textarea\b|<select\b/i.test(content)) actions.push('Inputs/Forms');
  if (hasTable) actions.push('Tabela de Dados');
  if (hasFilter) actions.push('Busca/Filtros');
  if (hasModal) actions.push('Modais/Drawers');
  if (hasTabs) actions.push('Navegação em Abas');
  if (hasRealtime) actions.push('Sincronização Realtime');
  if (hasExport) actions.push('Exportação/Impressão');
  if (/toast\.(?:success|error)|alert\(/i.test(content)) actions.push('Feedback/Notificações');
  if (/\b(?:status|situacao)\s*===/i.test(content) || /status/i.test(content)) actions.push('Gestão de Status');
  if (/\b(?:upload|anexo|arquivo|comprovante|file)\b/i.test(content)) actions.push('Upload/Anexos');

  const { squad, domain } = determineSquadAndDomain(relPathFromAdmin, fileName, content);

  const formattedTables = Object.entries(tableOps).map(([tbl, ops]) => `${tbl} (${Array.from(ops).join(', ')})`);

  detailed.push({
    fileName,
    componentName,
    relPathFromRoot,
    relPathFromAdmin,
    lines,
    squad,
    domain,
    tables: formattedTables,
    rawTables: Object.keys(tableOps).sort(),
    rpcs: Array.from(rpcs).sort(),
    edgeFunctions: Array.from(edgeFunctions).sort(),
    capabilities: actions,
    metrics: {
      hasForm,
      hasTable,
      hasModal,
      hasFilter,
      hasRealtime,
      hasExport,
      hasTabs
    }
  });
}

fs.writeFileSync(path.join(__dirname, 'admin_components_detailed.json'), JSON.stringify(detailed, null, 2));

console.log('Processed', detailed.length, 'components.');
const squadCounts = {};
detailed.forEach(d => {
  squadCounts[d.squad] = (squadCounts[d.squad] || 0) + 1;
});
console.log('\n=== BREAKDOWN BY SQUAD ===');
Object.entries(squadCounts).sort().forEach(([sq, c]) => {
  console.log(`- ${sq}: ${c} components`);
});
