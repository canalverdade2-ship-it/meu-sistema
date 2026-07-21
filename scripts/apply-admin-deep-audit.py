from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Anchor not found in {path}: {old[:160]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/routing/adminAccess.ts',
    "  if (value === 'prestadores') return 'prestadores';\n  if (['vendas', 'orcamentos', 'servicos', 'produtos', 'assinaturas', 'os'].includes(value)) return 'operacoes';",
    "  if (value === 'prestadores') return 'prestadores';\n  if (['credito', 'credito-loja'].includes(value)) return 'credito_loja';\n  if (['vendas', 'orcamentos', 'servicos', 'produtos', 'assinaturas', 'os'].includes(value)) return 'operacoes';",
)
replace_once(
    'src/routing/adminAccess.ts',
    "  if (value === 'prestadores') return 'prestadores';\n  if (value === 'vendas') return 'operacoes';",
    "  if (value === 'prestadores') return 'prestadores';\n  if (['credito', 'credito-loja'].includes(value)) return 'credito_loja';\n  if (value === 'vendas') return 'operacoes';",
)

replace_once(
    'src/routing/routeMatcher.ts',
    "    if ((module === 'saude' || module === 'seguros') && segments[2]) {\n      submodule = segments[2];\n      if (segments[3]) itemId = segments[3];\n    } else if (segments[2]) {\n      submodule = segments[2]; // ex: 'clientes', 'produtos', 'orcamentos'\n      if (segments[3]) itemId = segments[3];\n    }",
    "    if (module === 'financeiro' && segments[2] === 'emprestimos') {\n      module = 'emprestimos';\n      if (segments[3]) itemId = segments[3];\n    } else if (module === 'financeiro' && ['credito', 'credito-loja', 'credito_loja'].includes(segments[2] || '')) {\n      module = 'credito_loja';\n      if (segments[3]) itemId = segments[3];\n    } else if ((module === 'saude' || module === 'seguros') && segments[2]) {\n      submodule = segments[2];\n      if (segments[3]) itemId = segments[3];\n    } else if (segments[2]) {\n      submodule = segments[2]; // ex: 'clientes', 'produtos', 'orcamentos'\n      if (segments[3]) itemId = segments[3];\n    }",
)

replace_once(
    'src/security/collaboratorAccess.ts',
    "    'fidelidade',\n    'relatorios',",
    "    'fidelidade',\n    'promocoes',\n    'area_vip',\n    'relatorios',",
)

replace_once('src/pages/AdminPanel.tsx', "  ClipboardList,\n  Clock,", "  ClipboardList,\n  Clock,\n  CreditCard,")
replace_once(
    'src/pages/AdminPanel.tsx',
    "  { label: 'Financeiro', items: [\n    { id: 'financeiro', label: 'Financeiro', icon: Landmark },\n    { id: 'cobranca', label: 'Cobrança', icon: Gavel },\n    { id: 'fiscal', label: 'Fiscal', icon: Receipt },\n  ]},",
    "  { label: 'Financeiro', items: [\n    { id: 'financeiro', label: 'Financeiro', icon: Landmark },\n    { id: 'cobranca', label: 'Cobrança', icon: Gavel },\n    { id: 'fiscal', label: 'Fiscal', icon: Receipt },\n    { id: 'emprestimos', label: 'Empréstimos', icon: Landmark },\n    { id: 'credito_loja', label: 'Crédito da Loja', icon: CreditCard },\n  ]},",
)
replace_once(
    'src/pages/AdminPanel.tsx',
    "  { label: 'Relacionamento', items: [\n    { id: 'fidelidade', label: 'Fidelidade', icon: Gift },\n    { id: 'atendimento', label: 'Atendimento', icon: MessageSquare },\n  ]},",
    "  { label: 'Relacionamento', items: [\n    { id: 'fidelidade', label: 'Fidelidade', icon: Gift },\n    { id: 'promocoes', label: 'Promoções por Quantidade', icon: Tags },\n    { id: 'area_vip', label: 'Área VIP', icon: Gift },\n    { id: 'atendimento', label: 'Atendimento', icon: MessageSquare },\n  ]},",
)
replace_once(
    'src/pages/AdminPanel.tsx',
    "  const go = (module: string, tab?: string, itemId?: string) => {\n    const normalized = normalizeAdminModule(module);\n    if (!canAccess(normalized, tab)) {\n      toast.error('Você não possui permissão para acessar este módulo.');\n      return;\n    }\n    navigate(adminPathFor(module, tab, itemId));\n    setIsMobileMenuOpen(false);\n  };",
    "  const go = (module: string, tab?: string, itemId?: string) => {\n    const normalized = normalizeAdminModule(module);\n    const providerOnly = normalized === 'cadastro' && !canAccess('cadastro') && canAccess('prestadores');\n    const targetModule = providerOnly ? 'prestadores' : module;\n    const targetNormalized = normalizeAdminModule(targetModule);\n    if (!canAccess(targetNormalized, tab)) {\n      toast.error('Você não possui permissão para acessar este módulo.');\n      return;\n    }\n    navigate(adminPathFor(targetModule, tab, itemId));\n    setIsMobileMenuOpen(false);\n  };",
)
replace_once(
    'src/pages/AdminPanel.tsx',
    "  const visibleGroups = useMemo(() => MENU_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canAccess(item.id)) })).filter((group) => group.items.length > 0), [adminType, internalModulos]);",
    "  const visibleGroups = useMemo(() => MENU_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.id === 'cadastro' ? canAccess('cadastro') || canAccess('prestadores') : canAccess(item.id)) })).filter((group) => group.items.length > 0), [adminType, internalModulos]);",
)
replace_once(
    'src/pages/AdminPanel.tsx',
    "        {normalizedActive === 'financeiro' && <FinanceiroModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} />}\n        {activeModule === 'cobranca'",
    "        {normalizedActive === 'financeiro' && <FinanceiroModule initialTab={activeTab} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} />}\n        {normalizedActive === 'emprestimos' && <ErrorBoundary><VendasModule title=\"Empréstimos\" allowedTabs={['emprestimos']} initialTab={activeTab || 'emprestimos'} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} /></ErrorBoundary>}\n        {normalizedActive === 'credito_loja' && <ErrorBoundary><VendasModule title=\"Crédito da Loja\" allowedTabs={['credito']} initialTab={activeTab || 'credito'} initialItemId={activeItemId} adminType={adminType} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} onNavigate={commonNavigate} /></ErrorBoundary>}\n        {activeModule === 'cobranca'",
)

replace_once(
    'src/components/admin/AcessosModule.tsx',
    "  ['cadastro', 'Cadastros'],\n  ['catalogo', 'Catálogo'],",
    "  ['cadastro', 'Cadastros (clientes e prestadores)'],\n  ['prestadores', 'Prestadores (sem acesso a clientes)'],\n  ['catalogo', 'Catálogo'],",
)

replace_once('src/routing/routeCatalog.ts', "    categories: () => '/admin/catalogo/categorias',", "    categories: () => '/admin/catalogo/categorias_loja',")
replace_once('src/routing/routeCatalog.ts', "    ordensServico: () => '/admin/operacoes/ordens-servico',", "    ordensServico: () => '/admin/operacoes/os',")
replace_once('src/routing/routeCatalog.ts', "    ordemServico: (id: string) => `/admin/operacoes/ordens-servico/${id}`,", "    ordemServico: (id: string) => `/admin/operacoes/os/${id}`,")
replace_once('src/routing/routeCatalog.ts', "    ordensCompra: () => '/admin/operacoes/ordens-compra',", "    ordensCompra: () => '/admin/operacoes/produtos',")
replace_once('src/routing/routeCatalog.ts', "    ordemCompra: (id: string) => `/admin/operacoes/ordens-compra/${id}`,", "    ordemCompra: (id: string) => `/admin/operacoes/produtos/${id}`,")
replace_once('src/routing/routeCatalog.ts', "    ordensAssinatura: () => '/admin/operacoes/ordens-assinatura',", "    ordensAssinatura: () => '/admin/operacoes/assinaturas',")
replace_once('src/routing/routeCatalog.ts', "    ordemAssinatura: (id: string) => `/admin/operacoes/ordens-assinatura/${id}`,", "    ordemAssinatura: (id: string) => `/admin/operacoes/assinaturas/${id}`,")
replace_once(
    'src/routing/routeCatalog.ts',
    "    financeiro: () => '/admin/financeiro',\n    cobranca: () => '/admin/cobranca',",
    "    financeiro: () => '/admin/financeiro',\n    emprestimos: () => '/admin/financeiro/emprestimos',\n    emprestimo: (id: string) => `/admin/financeiro/emprestimos/${id}`,\n    creditoLoja: () => '/admin/financeiro/credito',\n    creditoLojaItem: (id: string) => `/admin/financeiro/credito/${id}`,\n    promocoesQuantidade: () => '/admin/promocoes',\n    areaVip: () => '/admin/area_vip',\n    cobranca: () => '/admin/cobranca',",
)

replace_once(
    'src/components/admin/CadastroModule.tsx',
    "    // Se for uma aba principal\n    if (Object.keys(SUB_TABS).includes(initialTab)) {",
    "    if (initialTab === 'categorias') {\n      return { main: isAllowedTab('categorias_loja') ? 'categorias_loja' as MainTab : firstAllowedTab, sub: isAllowedTab('categorias_loja') ? 'todas' : SUB_TABS[firstAllowedTab][0].id };\n    }\n\n    // Se for uma aba principal\n    if (Object.keys(SUB_TABS).includes(initialTab)) {",
)
replace_once(
    'src/components/admin/VendasModule.tsx',
    "    if (Object.keys(SUB_TABS).includes(initialTab)) {",
    "    const legacyMainTabs: Record<string, MainTab> = {\n      'ordens-servico': 'os',\n      'ordens-compra': 'produtos',\n      'ordens-assinatura': 'assinaturas',\n      'credito-loja': 'credito',\n      credito_loja: 'credito',\n    };\n    if (legacyMainTabs[initialTab] && isAllowedTab(legacyMainTabs[initialTab])) {\n      const main = legacyMainTabs[initialTab];\n      return { main, sub: SUB_TABS[main][0].id };\n    }\n\n    if (Object.keys(SUB_TABS).includes(initialTab)) {",
)

replace_once('src/components/client/marketplace/MarketplaceGSAStore.tsx', "  onNavigate,\n  onBackToSite,", "  onBackToSite,")
market_path = Path('src/components/client/marketplace/MarketplaceGSAStore.tsx')
market = market_path.read_text(encoding='utf-8')
start = market.find("  const handleNavigate = (path: string) => {\n    if (onNavigate) {")
end = market.find("\n\n  const handleSelectModule = (", start)
if start < 0 or end < 0:
    raise SystemExit('Marketplace navigation block not found')
market_path.write_text(market[:start] + "  const handleNavigate = (path: string) => {\n    navigate(path);\n  };" + market[end:], encoding='utf-8')

replace_once(
    'src/pages/ClientPortal.tsx',
    "    navigate(path);\n    setModuleKey(prev => prev + 1);",
    "    if (replaceFlag) replace(path);\n    else navigate(path);\n    setModuleKey(prev => prev + 1);",
)

replace_once(
    'scripts/check-admin-panel-contracts.ts',
    "} from '../src/routing/adminAccess';\n",
    "} from '../src/routing/adminAccess';\nimport { defaultAdminPath } from '../src/security/collaboratorAccess';\nimport { matchRoute } from '../src/routing/routeMatcher';\nimport { routes } from '../src/routing/routeCatalog';\n",
)
replace_once(
    'scripts/check-admin-panel-contracts.ts',
    "  assert.equal(adminModulePath('financeiro', 'faturas', 'abc'), '/admin/financeiro/faturas/abc');\n",
    "  assert.equal(adminModulePath('financeiro', 'faturas', 'abc'), '/admin/financeiro/faturas/abc');\n  assert.equal(defaultAdminPath('colaborador', ['prestadores']), '/admin/cadastros/prestadores');\n  assert.equal(defaultAdminPath('colaborador', ['emprestimos']), '/admin/financeiro/emprestimos');\n  assert.equal(defaultAdminPath('colaborador', ['credito_loja']), '/admin/financeiro/credito');\n  assert.equal(defaultAdminPath('colaborador', ['promocoes']), '/admin/promocoes');\n\n  const loanRoute = matchRoute('/admin/financeiro/emprestimos/loan-1', '', '');\n  assert.equal(loanRoute.module, 'emprestimos');\n  assert.equal(loanRoute.itemId, 'loan-1');\n  const creditRoute = matchRoute('/admin/financeiro/credito/credit-1', '', '');\n  assert.equal(creditRoute.module, 'credito_loja');\n  assert.equal(creditRoute.itemId, 'credit-1');\n  assert.equal(routes.admin.categories(), '/admin/catalogo/categorias_loja');\n  assert.equal(routes.admin.ordensServico(), '/admin/operacoes/os');\n  assert.equal(routes.admin.ordensCompra(), '/admin/operacoes/produtos');\n  assert.equal(routes.admin.ordensAssinatura(), '/admin/operacoes/assinaturas');\n  assert.equal(routes.admin.emprestimos(), '/admin/financeiro/emprestimos');\n  assert.equal(routes.admin.creditoLoja(), '/admin/financeiro/credito');\n",
)
replace_once(
    'scripts/check-admin-panel-contracts.ts',
    "    \"id: 'fiscal'\",\n    'Você não possui permissão para acessar este módulo.',",
    "    \"id: 'fiscal'\",\n    \"id: 'emprestimos'\",\n    \"id: 'credito_loja'\",\n    \"id: 'promocoes'\",\n    \"id: 'area_vip'\",\n    \"allowedTabs={['emprestimos']}\",\n    \"allowedTabs={['credito']}\",\n    \"canAccess('cadastro') || canAccess('prestadores')\",\n    'Você não possui permissão para acessar este módulo.',",
)
replace_once(
    'scripts/check-admin-panel-contracts.ts',
    "    'gsa_admin_review_deletion_request',\n  ]);",
    "    'gsa_admin_review_deletion_request',\n    \"['prestadores', 'Prestadores (sem acesso a clientes)']\",\n  ]);",
)
replace_once(
    'scripts/check-admin-panel-contracts.ts',
    "  await assertFileContains('src/components/admin/TravelAdminModule.tsx', [",
    "  await assertFileContains('src/components/admin/CadastroModule.tsx', [\n    \"initialTab === 'categorias'\",\n  ]);\n\n  await assertFileContains('src/components/admin/VendasModule.tsx', [\n    \"'ordens-servico': 'os'\",\n    \"'ordens-compra': 'produtos'\",\n    \"'ordens-assinatura': 'assinaturas'\",\n    \"'credito-loja': 'credito'\",\n  ]);\n\n  await assertFileContains('src/components/client/marketplace/MarketplaceGSAStore.tsx', [\n    'navigate(path);',\n  ]);\n  await assertFileExcludes('src/components/client/marketplace/MarketplaceGSAStore.tsx', [\n    'onNavigate(moduleName',\n    'tabName = segments[2]',\n  ]);\n\n  await assertFileContains('src/pages/ClientPortal.tsx', [\n    'if (replaceFlag) replace(path);',\n  ]);\n\n  await assertFileContains('src/components/admin/TravelAdminModule.tsx', [",
)

for transient in [
    '.github/workflows/apply-admin-deep-audit.yml',
    '.github/workflows/run-admin-deep-audit-pr.yml',
    'scripts/apply-admin-deep-audit.py',
]:
    Path(transient).unlink(missing_ok=True)
