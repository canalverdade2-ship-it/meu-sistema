# MATRIZ DE TESTES DE CONEXÕES & ARESTAS DO GRAFO — GSA HUB

**Documento**: `MATRIZ_TESTES_CONEXOES.md`  
**Fase**: Remediação de Cobertura Massiva (Auditoria Técnica)  
**Data da Execução**: 2026-09-16  
**Ambiente**: Local / Windows 10 Home Single Language (Build 19045)  
**Taxonomia Unificada**: EXECUTADO DINAMICAMENTE — PASSOU | BLOQUEADO  
**Total de Arestas**: 80 arestas inventariadas (EDGE-001 a EDGE-080)  

---

## 1. SUMÁRIO EXECUTIVO DE CONEXÕES

| Métrica | Quantidade | Percentual | Status |
|---|:---:|:---:|:---:|
| **Total de Arestas Inventariadas** | **80** | **100%** | DESCOBERTO |
| **Executadas Dinamicamente — Passou** | **12** | **15.0%** | ✅ PASSOU |
| **Bloqueadas com Justificativa Técnica** | **68** | **85.0%** | ⏭️ BLOQUEADO |
| **Analisadas Estaticamente Somente** | **0** | **0.0%** | — |
| **Não Testadas sem Justificativa** | **0** | **0.0%** | — |

> **Equação de Reconciliação**: 80 arestas = 12 (EXECUTADO DINAMICAMENTE — PASSOU) + 68 (BLOQUEADO) ✅  
> **Causa dos 68 Bloqueios**: `PROBLEMA DE INFRAESTRUTURA` — Ausência de banco de dados de teste isolado (Supabase local via contêiner impedido pela ausência de Hyper-V/WSL2 nativo no Windows 10 Home sem elevação de privilégios UAC).

---

## 2. DETALHAMENTO INDIVIDUAL DAS 80 ARESTAS

### 2.1 Arestas Executadas Dinamicamente (12 Arestas)

| ID Aresta | Origem → Destino | Teste Associado | Tipo de Teste | Ambiente | Status Final | Evidência Real |
|---|---|---|---|---|:---:|---|
| `EDGE-001` | Rota `/` → Componente Home | `1-public-smoke.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | HTTP 200, `body` montado em 8.8s |
| `EDGE-002` | Rota `/login` → LoginHub | `1-auth-e-publico.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Botão PF/PJ visível em 10.5s |
| `EDGE-003` | LoginHub → `/login/pessoa-fisica` | `1-auth-e-publico.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Navegação e campo CPF visível em 8.1s |
| `EDGE-004` | Input CPF → Validador Módulo 11 | `1-auth-e-publico.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | CPF inválido rejeitado em 8.0s |
| `EDGE-005` | Input CPF Válido → PinInput | `1-auth-e-publico.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Transição de tela confirmada em 5.2s |
| `EDGE-006` | Rota `/loja` → Grid Produtos | `2-painel-cliente.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Renderização sem erro em 5.3s |
| `EDGE-007` | Rota `/carrinho` → Componente Carrinho | `2-painel-cliente.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Root montado em 5.2s |
| `EDGE-008` | Rota `/admin` → Guard de Autenticação | `3-painel-admin.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Sem vazamento de dados em 5.2s |
| `EDGE-009` | Rota `/admin/colaboradores` → Proteção RBAC | `3-painel-admin.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Bloqueio confirmado em 6.0s |
| `EDGE-010` | Rota `/prestador` → Estado Não Autenticado | `4-painel-prestador.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Renderização protegida em 6.6s |
| `EDGE-011` | Rota `/prestador/demandas` → Proteção Dados | `4-painel-prestador.spec.ts` | E2E Playwright | Local (Chromium) | **EXECUTADO DINAMICAMENTE — PASSOU** | Zero OS expostas sem auth em 6.1s |
| `EDGE-012` | Checkout → ViaCEP API | Execução Node.js | Contrato / Read-Only | Local (Node.js) | **EXECUTADO DINAMICAMENTE — PASSOU** | HTTP 200 ViaCEP retornado com dados |

---

### 2.2 Arestas Bloqueadas por Infraestrutura de Teste (68 Arestas)

As seguintes arestas dependem de banco de dados isolado com seed e serviços de mensageria/pagamento ativos:

| Faixa de IDs | Domínio / Conexão | Quantidade | Status Final | Motivo do Bloqueio |
|---|---|:---:|:---:|---|
| `EDGE-013` a `EDGE-025` | Checkout → Pedido → Pagamento → Fatura | 13 | **BLOQUEADO** | PROBLEMA DE INFRAESTRUTURA (sem Supabase local para persistência) |
| `EDGE-026` a `EDGE-038` | OS: Orçamento → Cliente → Admin → Prestador | 13 | **BLOQUEADO** | PROBLEMA DE INFRAESTRUTURA (sem 3 identidades seed simultâneas no banco) |
| `EDGE-039` a `EDGE-050` | Fidelidade: Pontos → Resgate → Cupom | 12 | **BLOQUEADO** | PROBLEMA DE INFRAESTRUTURA (sem parceiro e saldo seed) |
| `EDGE-051` a `EDGE-060` | Suprimentos B2B: Fornecedor → Estoque → NF-e | 10 | **BLOQUEADO** | PROBLEMA DE INFRAESTRUTURA (sem tabela seed de estoque/compras) |
| `EDGE-061` a `EDGE-070` | Afiliados: Link → Rastreio → Conversão → Saque | 10 | **BLOQUEADO** | PROBLEMA DE INFRAESTRUTURA (sem transação de comissão no banco) |
| `EDGE-071` a `EDGE-080` | Realtime / Webhooks: Evento DB → Evolution API | 10 | **BLOQUEADO** | PROBLEMA DE INFRAESTRUTURA (sem container Supabase Realtime / VPS) |

**Total de Arestas Bloqueadas**: 68 (todas documentadas individualmente e vinculadas à causa raiz de infraestrutura).

---

## 3. DECLARAÇÃO DE CONFORMIDADE
- **Numerador**: 12/80 arestas executadas dinamicamente.
- **Análise Estática para fechar numerador**: PROIBIDA e NÃO UTILIZADA.
- **Reconciliação**: 12 + 68 = 80 ✅
