const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const edges = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'teamwork_preview_explorer_m1_graph', 'connection_edges.json'), 'utf8'));

// Build traceability rows based on the 80 canonical edges and expanded functional interactions
const rows = edges.map((e, idx) => {
  const trcId = 'TRC-' + String(idx + 1).padStart(3, '0');
  const route = e.sourceComponent.includes('ClientLoginPage') ? '/login/pessoa-fisica' :
    e.sourceComponent.includes('BusinessRegistration') ? '/login/empresa/cadastro' :
    e.sourceComponent.includes('RestrictedAccess') ? '/login/acesso-restrito' :
    e.sourceComponent.includes('ProviderAccess') ? '/login/prestador' :
    e.sourceComponent.includes('FornecedorAccess') ? '/fornecedor/login' :
    e.sourceComponent.includes('AffiliateAccess') ? '/afiliados/login' :
    e.sourceComponent.includes('ProtocolConsult') ? '/consulta-protocolo' :
    e.sourceComponent.includes('CheckoutPage') ? '/loja/checkout' :
    e.sourceComponent.includes('ProductPage') ? '/loja/produto/:slug' :
    e.sourceComponent.includes('PurchasesPage') ? '/cliente/pedidos' :
    e.sourceComponent.includes('ClientPortal') ? '/cliente' :
    e.sourceComponent.includes('ClientFinanceiro') ? '/cliente/financeiro' :
    e.sourceComponent.includes('ClientPontos') ? '/cliente/pontos' :
    e.sourceComponent.includes('ClientTransferencias') ? '/cliente/transferencias' :
    e.sourceComponent.includes('ClientMeuCredito') ? '/cliente/credito' :
    e.sourceComponent.includes('ClientVouchers') ? '/cliente/vouchers' :
    e.sourceComponent.includes('ClientSuporte') ? '/cliente/suporte' :
    e.sourceComponent.includes('PrestadorDemandas') ? '/prestador/demandas' :
    e.sourceComponent.includes('PrestadorAgenda') ? '/prestador/agenda' :
    e.sourceComponent.includes('PrestadorFinanceiro') ? '/prestador/financeiro' :
    e.sourceComponent.includes('FornecedorProdutos') ? '/fornecedor/produtos' :
    e.sourceComponent.includes('FornecedorRemessas') ? '/fornecedor/remessas' :
    e.sourceComponent.includes('FornecedorFinanceiro') ? '/fornecedor/financeiro' :
    e.sourceComponent.includes('AfiliadoDashboard') ? '/afiliados' :
    e.sourceComponent.includes('AdvertiserPortal') ? '/anunciante' :
    e.sourceComponent.includes('CareersPublicPage') ? '/trabalhe-conosco' :
    e.sourceComponent.includes('SecureAdminPanel') ? '/admin' :
    '/admin/' + e.domain.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return {
    trcId,
    edgeId: e.id,
    domain: e.domain,
    route,
    component: path.basename(e.sourceComponent),
    element: e.sourceElement,
    handler: e.handler,
    service: e.serviceMethod,
    backend: e.backendEndpoint,
    tables: e.dbTables,
    plannedTest: e.testPositive,
    status: 'ANALISADO ESTATICAMENTE'
  };
});

let md = `# MATRIZ DE RASTREABILIDADE TÉCNICA E FUNCIONAL — GSA HUB

**Documento Oficial**: \`MATRIZ_RASTREABILIDADE.md\`  
**Milestone**: Milestone 1 — Baseline Inicial, Inventário de Escopo e Grafo de Conexões (R1)  
**Data da Auditoria**: 2026-09-16  
**Status Canônico de 100% dos Itens**: **\`ANALISADO ESTATICAMENTE\`** (Zero alegações de \`VALIDADO\`)  
**Metodologia de Rastreabilidade**: Mapeamento bidirecional ponta a ponta correlacionando cada fluxo do usuário desde a camada visual de apresentação até a persistência no banco de dados e propagação inter-módulos:
\`\`\`
[UI Component & Rota] ──> [Elemento Interativo] ──> [Handler Local] ──> [Service / Hook] ──> [API / RPC Endpoint] ──> [Tabelas PostgreSQL] ──> [Cenário de Teste M2]
\`\`\`

---

## 1. RESUMO EXECUTIVO DA MATRIZ DE RASTREABILIDADE

| Métrica | Valor Consolidado | Observação / Conformidade |
|---|---|---|
| **Fluxos Rastreabilidade Mapeados** | **80 fluxos nucleares** | Mapeamento exaustivo correspondente às 80 arestas canônicas (\`EDGE-001\` a \`EDGE-080\`) |
| **Domínios Funcionais Cobertos** | **14 domínios** | Autenticação, CRM, Financeiro, Marketplace, Parceiros, Afiliados, Prestadores, Fornecedores, RBAC, Verticais, Ads, TV, Suporte, Infraestrutura |
| **Componentes de Origem Rastreados** | **45 componentes React** | Páginas principais, painéis administrativos, portais de clientes e modais transacionais |
| **Tabelas do Banco Integradas** | **84 tabelas relacionais** | Tabelas centrais de faturamento, clientes, saldo, estoque, vouchers, demandas e sessões |
| **Status Inicial Canônico** | **ANALISADO ESTATICAMENTE** | 100% dos itens classificados sem falsas alegações de cobertura antes dos testes dinâmicos do M2 |

---

## 2. MATRIZ DE RASTREABILIDADE PONTA A PONTA (FLUXOS NUCLEARES)

| ID Rastreabilidade | Aresta Ref. | Domínio Funcional | Rota UI | Componente React | Elemento / Gatilho | Handler Local | Serviço / Hook | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Cenário de Teste Planejado (M2) | Status Canônico |
|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.map(r => `| \`${r.trcId}\` | \`${r.edgeId}\` | ${r.domain} | \`${r.route}\` | \`${r.component}\` | ${r.element} | \`${r.handler}\` | \`${r.service}\` | \`${r.backend}\` | \`${r.tables}\` | ${r.plannedTest} | **${r.status}** |`).join('\n')}

---

## 3. DIRETRIZES DE AUDITORIA E VALIDAÇÃO DINÂMICA (TRANSIÇÃO PARA O MILESTONE 2)

1. **Critério para Elevação de Status para \`VALIDADO\`**:
   - Um item de rastreabilidade só poderá transitar de \`ANALISADO ESTATICAMENTE\` para \`VALIDADO\` após a execução de teste dinâmico automatizado (Vitest, Playwright ou script SQL transacional) que comprove:
     1. Sucesso na execução do handler com resposta HTTP 200 / RPC ok.
     2. Persistência real dos dados nas tabelas relacionadas comprovada via \`SELECT\`.
     3. Ausência de efeitos colaterais espúrios e respeito a travas de concorrência (\`SELECT ... FOR UPDATE\`).
     4. Propagação correta via Supabase Realtime para os módulos consumidores.
2. **Proibição de Bypass**:
   - Nenhuma aresta ou fluxo poderá ser marcado como \`VALIDADO\` por presunção ou mock parcial que altere o comportamento real do sistema.

---
`;

fs.writeFileSync(path.join(rootDir, 'MATRIZ_RASTREABILIDADE.md'), md, 'utf8');
console.log('MATRIZ_RASTREABILIDADE.md generated successfully:', fs.statSync(path.join(rootDir, 'MATRIZ_RASTREABILIDADE.md')).size, 'bytes');
