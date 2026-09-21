const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const edges = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'teamwork_preview_explorer_m1_graph', 'connection_edges.json'), 'utf8'));

let md = `# MATRIZ DE TESTES DINÂMICOS DE CONEXÕES — GSA HUB

**Documento Oficial**: \`MATRIZ_TESTES_CONEXOES.md\`  
**Milestone**: Milestone 1 — Baseline Inicial, Inventário de Escopo e Grafo de Conexões (R1)  
**Data da Auditoria**: 2026-09-16  
**Status Canônico de 100% dos Itens**: **\`ANALISADO ESTATICAMENTE\`** (Zero alegações prematuras de \`VALIDADO\`)  
**Metodologia de Teste para o Milestone 2**: Especificação exaustiva de quatro critérios obrigatórios para cada uma das 80 arestas do Grafo de Conexões:
1. **Cenário Positivo (Happy Path)**: Entradas válidas, transição de estado esperada e conformidade de resposta.
2. **Cenário Negativo & Tratamento de Falhas**: Limites de entrada, concorrência, rate limiting, credenciais inválidas e integridade ACID.
3. **Método de Verificação de Persistência Física no Banco**: Queries SQL diretas no PostgreSQL atestando a integridade dos dados e travas de linha.
4. **Método de Validação de Propagação Reativa/Visual**: Comprovação de sincronismo em outros dashboards, eventos de WebSocket Realtime e invalidação de cache.

---

## 1. RESUMO EXECUTIVO DO CATÁLOGO DE TESTES

| Métrica | Quantidade | Observação |
|---|---|---|
| **Arestas com Testes Dinâmicos Especificados** | **80 arestas** | Cobertura de 100% das arestas canônicas (\`EDGE-001\` a \`EDGE-080\`) |
| **Cenários Positivos Mapeados** | **80 cenários** | Happy path detalhado com validação de payload |
| **Cenários Negativos Mapeados** | **80 cenários** | Testes de exceção, concorrência, limite e segurança |
| **Métodos de Verificação de Persistência no Banco** | **80 métodos SQL** | Consultas diretas em tabelas PostgreSQL |
| **Métodos de Verificação de Propagação Reativa** | **80 métodos** | Validações em dashboards e canais WebSocket Realtime |
| **Status Inicial Canônico** | **ANALISADO ESTATICAMENTE** | Todos os itens prontos para execução dinâmica no Milestone 2 |

---

## 2. REGRAS DE OURO PARA A EXECUÇÃO DINÂMICA (MILESTONE 2)

Em observância irrestrita às Regras de Ouro e aos Requisitos R2 e R3 do projeto:
1. **Proibição de Mascarar Falhas**: É terminantemente proibido remover assertions de testes, silenciar exceções ou retornar valores estáticos em mocks apenas para obter status verde.
2. **Persistência Real Obrigatória**: O teste dinâmico deve atestar que a mutação persiste de verdade no banco de dados através de consultas \`SELECT\` subsequentes ou recarregamento limpo de tela.
3. **Propagação Cross-Módulo Obrigatória**: O teste deve verificar se a alteração realizada no Módulo A (ex: aprovação de resgate pelo ADM) é refletida no Módulo B (ex: consulta pública de protocolo pelo cliente e saldo de pontos) sem necessidade de reload forçado.
4. **Respeito aos Mecanismos de Concorrência**: Testar se as proteções anti-duplo clique (\`isSubmittingRef\`, locks de concorrência \`SELECT ... FOR UPDATE\`, \`SessionMutex\`) evitam operações duplicadas sob chamadas paralelas concorrentes.

---

## 3. CATÁLOGO CONSOLIDADO DE TESTES DINÂMICOS POR ARESTA (\`EDGE-001\` A \`EDGE-080\`)

| ID da Aresta | Domínio Funcional | Elemento de Origem (UI) | Cenário Positivo (Happy Path) | Cenário Negativo / Tratamento de Falhas | Verificação de Persistência no Banco | Validação de Propagação Reativa | Status Canônico |
|---|---|---|---|---|---|---|---|
`;

edges.forEach(e => {
  md += `| \`${e.id}\` | ${e.domain} | \`${path.basename(e.sourceComponent)}\`<br>${e.sourceElement} | ${e.testPositive} | ${e.testNegative} | \`${e.testPersistence}\` | ${e.testPropagation} | **${e.status}** |\n`;
});

md += `\n---

## 4. ESPECIFICAÇÃO TÉCNICA DETALHADA DE TESTES POR ARESTA

`;

edges.forEach(e => {
  md += `### Especificação de Teste: \`${e.id}\` — ${e.sourceElement}
- **Domínio**: ${e.domain}
- **Elemento UI & Handler**: \`${path.basename(e.sourceComponent)}\` ──> \`${e.handler}\`
- **Serviço & Endpoint**: \`${e.serviceMethod}\` ──> \`${e.backendEndpoint}\`
- **Tabelas do Banco**: \`${e.dbTables}\`
- **Cenário Positivo**:
  - *Procedimento*: ${e.testPositive}
  - *Critério de Aceitação*: Resposta 200/OK, retorno tipado de dados e atualização de estado no cliente.
- **Cenário Negativo & Resiliência**:
  - *Procedimento*: ${e.testNegative}
  - *Critério de Aceitação*: Tratamento adequado do erro com exibição de toast informativo, sem crash de renderização e sem dados corrompidos.
- **Método de Verificação de Persistência no Banco**:
  - *Comando SQL / Verificação*: \`${e.testPersistence}\`
  - *Critério de Aceitação*: O registro deve existir no PostgreSQL com os campos correspondentes devidamente preenchidos.
- **Método de Validação da Propagação Cross-Módulo**:
  - *Procedimento de Teste*: ${e.testPropagation}
  - *Alvo de Propagação*: ${e.propagationTarget}
  - *Critério de Aceitação*: O componente ou tela receptora deve reagir automaticamente via Supabase Realtime ou invalidação de cache.
- **Status de Auditoria**: **\`${e.status}\`**

`;
});

md += `---

## 5. PLANEJAMENTO DE IMPLEMENTAÇÃO E EXECUÇÃO (MILESTONE 2)

As especificações contidas nesta matriz serão transformadas em suítes de testes dinâmicos automatizados no Milestone 2, organizadas nos seguintes módulos:
- \`src/tests/connections/auth-connections.test.ts\` (EDGE-001 a EDGE-007)
- \`src/tests/connections/crm-vip-connections.test.ts\` (EDGE-008 a EDGE-011)
- \`src/tests/connections/fintech-wallet-connections.test.ts\` (EDGE-012 a EDGE-022)
- \`src/tests/connections/marketplace-concurrency.test.ts\` (EDGE-023 a EDGE-028)
- \`src/tests/connections/partners-appeals-connections.test.ts\` (EDGE-029 a EDGE-032)
- \`src/tests/connections/affiliates-payout-connections.test.ts\` (EDGE-033 a EDGE-036)
- \`src/tests/connections/providers-workstation-connections.test.ts\` (EDGE-037 a EDGE-040)
- \`src/tests/connections/suppliers-procurement-connections.test.ts\` (EDGE-041 a EDGE-044)
- \`src/tests/connections/admin-rbac-connections.test.ts\` (EDGE-045)
- \`src/tests/connections/verticals-integrations.test.ts\` (EDGE-046 a EDGE-050)
- \`src/tests/connections/adserver-campaigns.test.ts\` (EDGE-051 a EDGE-052)
- \`src/tests/connections/gsatv-broadcast-connections.test.ts\` (EDGE-053 a EDGE-054, EDGE-072 a EDGE-073)
- \`src/tests/connections/system-wide-cross-propagation.test.ts\` (EDGE-055 a EDGE-080)
`;

fs.writeFileSync(path.join(rootDir, 'MATRIZ_TESTES_CONEXOES.md'), md, 'utf8');
console.log('MATRIZ_TESTES_CONEXOES.md generated successfully:', fs.statSync(path.join(rootDir, 'MATRIZ_TESTES_CONEXOES.md')).size, 'bytes');
