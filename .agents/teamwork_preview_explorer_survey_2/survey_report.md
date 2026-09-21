# Relatório de Auditoria — Especialista em Performance Frontend React & Hooks
**Fase:** Survey Phase — GSA HUB Deep System Audit & Automated Remediation Project  
**Data:** 2026-08-28  
**Autor:** Explorer 2 (Frontend React Performance & Hooks Specialist)  
**Escopo:** Todos os componentes React, custom hooks, gerenciamento de estado e gargalos de performance do ecossistema GSA HUB (`src/`).

---

## 1. Sumário Executivo

A auditoria estática e sintática profunda de 445 arquivos TypeScript/React revelou que a base de código do GSA HUB possui padrões avançados de resiliência e contratos de segurança bem estruturados, mas apresenta **gargalos críticos de performance, violações pontuais das Regras dos Hooks e problemas de renderização em cascata** que afetam a estabilidade da interface e o consumo de recursos (banco de dados e WebSocket):

1. **Bloqueador de Compilação TypeScript**: Corrupção sintática em `src/lib/whatsappNotificationService.ts:331` (backtick espúrio `PR`MIO*` quebrando o parser TS).
2. **Violação das Regras dos Hooks**: Execução condicional de hook em `src/hooks/useRealtime.ts:289,295` dentro de ramificações `if/else`.
3. **Channel Thrashing em Supabase Realtime**: 62 ocorrências em 59 módulos onde a passagem do segundo argumento `deps` em `useRealtimeSubscription` (com referências instáveis como `fetchProdutos`, `search` ou filtros) anula a proteção contra stale closures e destrói/recria canais WebSocket a cada tecla digitada no campo de busca.
4. **Desperdício de Renderização por Providers Não-Memoizados**: 3 Context Providers (`FileViewerContext`, `ClientNotificationContext`, `ProviderNotificationContext`) passando objetos literais inline no prop `value`, forçando re-renderização de toda a árvore de clientes a cada ciclo.
5. **Gargalos de Memória e Listagens Pesadas**: Componentes como `ProdutosModule.tsx` baixando até 20.000 registros na memória do navegador via loop `while(hasMore)` em vez de paginação server-side nativa.
6. **Vazamento de Timers / Memory Leaks**: `OrderSuccessPage.tsx` disparando `setInterval` de confetes sem função de cleanup no `useEffect`.
7. **81 Componentes Monolíticos (>600 linhas)**: Incluindo `StoreHub.tsx` (3.351 linhas), `ProdutosModule.tsx` (2.944 linhas) e `CheckoutPage.tsx` (2.720 linhas) acumulando dezenas de `useState` sem divisão de responsabilidades.

---

## 2. Diagnóstico Detalhado por Área

### 2.1. Regras dos Hooks e Conformidade React

#### [CRÍTICO] Violação de Hook Condicional em `useRealtime.ts`
- **Arquivo:** `src/hooks/useRealtime.ts` (Linhas 272–296)
- **Problema:** A função `useRealtime` chama `useRealtimeSubscription` dentro de um bloco condicional `if (typeof tableOrOptions === 'string') { return useRealtimeSubscription(...) }`.
- **Impacto:** Viola a 1ª Regra dos Hooks ("Only Call Hooks at the Top Level"). Embora `tableOrOptions` raramente mude de tipo em tempo de execução, essa construção impede otimizações do compilador React 19 / Fast Refresh e gera avisos do linter.
- **Código Atual:**
```typescript
// src/hooks/useRealtime.ts (linhas 272-296)
export function useRealtime<T = any>(
  tableOrOptions: string | RealtimeSubscriptionConfig<T> | RealtimeSubscriptionConfig<T>[],
  onChangeOrDeps?: (() => void | Promise<void>) | DependencyList,
  optionsOrDeps?: Partial<RealtimeSubscriptionConfig<T>> | DependencyList
): RealtimeSubscriptionResult {
  if (typeof tableOrOptions === 'string') {
    const table = tableOrOptions;
    // ...
    return useRealtimeSubscription<T>(config, deps); // <-- CHAMADA DENTRO DE IF
  }

  const options = tableOrOptions;
  const deps = ...;
  return useRealtimeSubscription<T>(options, deps);  // <-- SEGUNDA CHAMADA
}
```
- **Estratégia de Correção:**
Normalizar os parâmetros previamente e executar uma única chamada incondicional a `useRealtimeSubscription` no nível superior da função:
```typescript
export function useRealtime<T = any>(
  tableOrOptions: string | RealtimeSubscriptionConfig<T> | RealtimeSubscriptionConfig<T>[],
  onChangeOrDeps?: (() => void | Promise<void>) | DependencyList,
  optionsOrDeps?: Partial<RealtimeSubscriptionConfig<T>> | DependencyList
): RealtimeSubscriptionResult {
  const isString = typeof tableOrOptions === 'string';
  const onChange = typeof onChangeOrDeps === 'function' ? onChangeOrDeps : undefined;
  const isArrayDeps = Array.isArray(optionsOrDeps);
  const extraOptions = typeof optionsOrDeps === 'object' && !isArrayDeps
    ? (optionsOrDeps as Partial<RealtimeSubscriptionConfig<T>>)
    : {};
  const deps = isString
    ? (isArrayDeps ? (optionsOrDeps as DependencyList) : (Array.isArray(onChangeOrDeps) ? onChangeOrDeps : undefined))
    : (Array.isArray(onChangeOrDeps) ? onChangeOrDeps : (Array.isArray(optionsOrDeps) ? optionsOrDeps : undefined));

  const config: RealtimeSubscriptionConfig<T> | RealtimeSubscriptionConfig<T>[] = isString
    ? { table: tableOrOptions, onChange, ...extraOptions }
    : tableOrOptions;

  return useRealtimeSubscription<T>(config, deps);
}
```

---

### 2.2. Realtime Subscriptions & Channel Thrashing

#### [ALTA PRIORIDADE] Sobrescrita de Dependências em `useRealtimeSubscription`
- **Arquivos Afetados:** 59 arquivos, 62 ocorrências.
  - Principais: `ProdutosModule.tsx:313`, `AssinaturasModule.tsx:107`, `CareersAdminModule.tsx:127`, `OrcamentosWorkstation.tsx:150`, `OrdensAssinaturaModule.tsx:124`, `OrdensCompraModule.tsx:143`, `ServicosModule.tsx:83`, `FiscalModule.tsx:82`, `ClientIndiqueGanhe.tsx:102`, `ClientServicos.tsx:96`, `ClientSuporte.tsx:82`, `ClientVouchers.tsx:50`.
- **Mecanismo do Problema:**
  O hook `useRealtimeSubscription` possui um mecanismo interno baseado em `callbacksRef.current` que atualiza referências a callbacks (`onChange`, `onPayload`) a cada render sem recriar o canal Supabase. Porém, a linha 242 do hook possui:
  ```typescript
  // src/hooks/useRealtime.ts:242
  deps ? deps : [isEnabled, JSON.stringify(rawConfigs.map(...))]
  ```
  Quando os módulos passam `[fetchProdutos, selectedProduto?.id]` ou `[activeTab, search, tipoClienteFilter]`, o `useEffect` passa a observar esse array externo.
  Como `fetchProdutos` ou `search` mudam a cada tecla digitada no campo de busca:
  1. O canal WebSocket ativo é desfeito (`supabase.removeChannel`).
  2. Um novo canal com novo nome randômico é criado e subscrito.
  3. Durante a digitação rápida de 10 caracteres, 10 conexões Supabase Realtime são criadas e destruídas em menos de 2 segundos.
- **Impacto:** Degradação severa de desempenho do navegador, rate limiting do Supabase Realtime e desperdício de sockets.
- **Estratégia de Correção:**
  1. No hook `useRealtimeSubscription`, remover o parâmetro `deps` ou usá-lo apenas para valores escalares de configuração, confiando na chave estrutural `JSON.stringify(rawConfigs)` já existente.
  2. Nos módulos consumidores, remover o segundo argumento `[fetchData, search, ...]` de todas as chamadas `useRealtimeSubscription([...])`.

#### [MÉDIA PRIORIDADE] Inscrições Globais sem Filtro por Proprietário em Telas de Cliente
- **Arquivo:** `src/components/client/ClientProdutos.tsx:96`
- **Problema:** O componente `ClientProdutos` (área do cliente para visualizar suas compras) se inscreve globalmente na tabela `produtos` sem filtro: `{ table: 'produtos', onChange: fetchMeusProdutos }`.
- **Impacto:** Toda vez que um administrador altera qualquer produto do catálogo na loja, todos os clientes conectados que estiverem na tela "Meus Produtos" disparam requisições para recarregar seus próprios pedidos.
- **Estratégia de Correção:** Remover a assinatura na tabela `produtos` ou restringir apenas a eventos de `ordens_compra` com `filter: cliente_id=eq.${clientId}`.

#### [MÉDIA PRIORIDADE] Inscrição Manual sem Cancelamento Canônico em `useVipLevels.ts`
- **Arquivo:** `src/hooks/useVipLevels.ts:48-57`
- **Problema:** Cria um canal manual via `supabase.channel('vip-changes-...')` sem usar `useRealtimeSubscription` e sem debounce.
- **Estratégia de Correção:** Migrar para `useRealtimeSubscription({ table: 'client_levels', onChange: fetchLevels, debounceMs: 300 })`.

---

### 2.3. Context Providers & Re-renderizações em Cascata

#### [ALTA PRIORIDADE] Falta de Memoização em Valores de Contexto
A tabela abaixo detalha os 3 Context Providers com objetos literais inline no prop `value`:

| Arquivo | Linha | Context Provider | Causa | Impacto |
|---|---|---|---|---|
| `src/contexts/FileViewerContext.tsx` | 118 | `FileViewerContext.Provider` | `value={{ openFile, closeFile }}` inline sem `useMemo`, `openFile` e `closeFile` sem `useCallback` | Re-renderiza todos os botões/visualizadores de arquivo a cada alteração de modal |
| `src/hooks/useClientNotifications.tsx` | 420 | `ClientNotificationContext.Provider` | `value={{ pendencies, notifications, ... }}` inline sem `useMemo`, handlers sem `useCallback` | Re-renderiza o portal do cliente inteiro (header, sidebar, badges) a cada render do provider |
| `src/hooks/useProviderNotifications.tsx` | 283 | `ProviderNotificationContext.Provider` | `value={{ pendencies, notifications, ... }}` inline sem `useMemo` | Re-renderiza o portal do prestador inteiro a cada render do provider |

*Nota Positiva:* `src/hooks/useAdminNotifications.tsx` (linhas 422–441) já adota a prática recomendada de envolver o valor do contexto em `useMemo` com dependências estáveis. O mesmo padrão deve ser replicado para os 3 arquivos acima.

---

### 2.4. Stale Closures e Instabilidade de Referências

#### [ALTA PRIORIDADE] `useAutoLogout` e `App.tsx`
- **Arquivos:** `src/App.tsx:293-319` e `src/hooks/useAutoLogout.ts:108`
- **Problema:** `App.tsx` define `const handleLogout = async (reason?: string) => { ... }` sem `useCallback`. Em seguida, passa para `useAutoLogout(handleLogout, isSessionActive)`. O `useEffect` de `useAutoLogout` lista `[isSessionActive, onLogout]`.
- **Impacto:** A cada navegação de rota, o componente `App` renderiza, gerando uma nova referência para `handleLogout`. O `useEffect` de `useAutoLogout` executa novamente, removendo e registrando novamente os event listeners de `window` (`focus`, `visibilitychange`, `gsa-session-revoked`), reiniciando o timer de ping de 20s e recriando o canal Supabase `sessao-live-*`.
- **Estratégia de Correção:**
  No `useAutoLogout.ts`, sincronizar `onLogout` via `useRef(onLogout)` e manter no array de dependências do `useEffect` apenas `[isSessionActive]`:
  ```typescript
  const onLogoutRef = useRef(onLogout);
  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);
  ```

#### [MÉDIA PRIORIDADE] `useAppLocation` Retornando Nova Referência a Cada Render
- **Arquivo:** `src/routing/useAppLocation.ts:45`
- **Problema:** A linha `return safeMatchRoute(currentLoc.pathname, currentLoc.search, currentLoc.hash);` gera um novo objeto a cada ciclo de render.
- **Impacto:** Componentes que utilizam `const route = useAppLocation()` e passam `[route]` como dependência de `useEffect` entram em loop de execução.
- **Estratégia de Correção:** Envolver o retorno em `useMemo(() => safeMatchRoute(currentLoc.pathname, currentLoc.search, currentLoc.hash), [currentLoc.pathname, currentLoc.search, currentLoc.hash])`.

---

### 2.5. Performance de Dados & Memória

#### [CRÍTICO] `ProdutosModule.tsx` — Download Ilimitado em Memória
- **Arquivo:** `src/components/admin/ProdutosModule.tsx:247-307`
- **Problema:** `fetchProdutos` itera em um loop `while(hasMore)` baixando de 1000 em 1000 produtos até 20.000 itens direto para o estado `produtos: Produto[]` no React.
- **Impacto:** Em bases de dados com milhares de produtos, essa operação consome dezenas de megabytes de RAM na aba do navegador, gera pausas de Garbage Collection e trava a renderização da interface.
- **Estratégia de Correção:** Migrar para paginação nativa no Supabase utilizando `count: 'exact'`, aplicando `.range(currentPage * pageSize, (currentPage + 1) * pageSize - 1)` diretamente na query SQL.

#### [MÉDIA PRIORIDADE] `OrdensCompraModule.tsx` — Enriquecimento Linear $O(N^2)$
- **Arquivo:** `src/components/admin/OrdensCompraModule.tsx:113-128`
- **Problema:** Para cada ordem de compra retornada, executa `data.find(...)` para localizar faturas do mesmo orçamento dentro do loop `data.map(...)`.
- **Estratégia de Correção:** Indexar `data` previamente com um `Map<orcamentoId, Fatura>` antes do loop de mapeamento, reduzindo a complexidade de $O(N^2)$ para $O(N)$.

#### [BAIXA PRIORIDADE] Memory Leak em `OrderSuccessPage.tsx`
- **Arquivo:** `src/components/client/store/OrderSuccessPage.tsx:21-41`
- **Problema:** O timer de animação de confetes `const interval = setInterval(...)` não é limpo quando o componente é desmontado (falta `return () => clearInterval(interval)`).
- **Estratégia de Correção:** Adicionar a função de cleanup no `useEffect`.

---

### 2.6. Saúde da Compilação TypeScript

#### [BLOQUEADOR DE BUILD] Erro de Sintaxe em `src/lib/whatsappNotificationService.ts`
- **Arquivo:** `src/lib/whatsappNotificationService.ts` (Linha 331)
- **Erro:** `TS1005: ',' expected`, `TS1109: Expression expected`, `TS1490: File appears to be binary`.
- **Causa:** Backtick desbalanceado no template string:
  ```typescript
  // Linha 331:
  `${tipoEmoji} *SEU NOVO PR`MIO*`,
  ```
  O caractere acentuado "Ê" foi corrompido para um backtick `` ` ``, fechando prematuramente a template string e fazendo o TypeScript interpretar o restante do arquivo (linhas 331 a 1360) como tokens de sintaxe inválidos.
- **Estratégia de Correção:**
  Substituir linha 331 por:
  ```typescript
  `${tipoEmoji} *SEU NOVO PRÊMIO*`,
  ```

---

## 3. Matriz Consolidada de Problemas e Recomendações

| ID | Arquivo / Módulo | Severidade | Categoria | Descrição Sucinta | Ação Recomendada |
|---|---|---|---|---|---|
| **TS-01** | `src/lib/whatsappNotificationService.ts:331` | **Bloqueador** | TypeScript | Backtick corrompido em string template (`PR`MIO*`) | Corrigir para `*SEU NOVO PRÊMIO*` |
| **HK-01** | `src/hooks/useRealtime.ts:289,295` | **Crítico** | Rules of Hooks | Hook chamado dentro de bloco `if` | Normalizar configs antes e chamar `useRealtimeSubscription` no topo |
| **RT-01** | 59 módulos (`ProdutosModule.tsx:313`, `AssinaturasModule.tsx:107`, etc.) | **Alto** | Realtime | `deps` passado para `useRealtimeSubscription` recria canais no `search` | Remover `deps` das chamadas de `useRealtimeSubscription` |
| **CTX-01** | `src/contexts/FileViewerContext.tsx:118` | **Alto** | Performance | Provider value inline sem `useMemo` | Envolver em `useMemo` e handlers em `useCallback` |
| **CTX-02** | `src/hooks/useClientNotifications.tsx:420` | **Alto** | Performance | Provider value inline sem `useMemo` | Envolver em `useMemo` e handlers em `useCallback` |
| **CTX-03** | `src/hooks/useProviderNotifications.tsx:283` | **Alto** | Performance | Provider value inline sem `useMemo` | Envolver em `useMemo` |
| **HK-02** | `src/App.tsx:293` & `src/hooks/useAutoLogout.ts:108` | **Alto** | Hooks / Realtime | `handleLogout` instável recriando canal de sessão | Utilizar `useRef` para `onLogout` no hook |
| **RT-02** | `src/components/client/ClientProdutos.tsx:96` | **Médio** | Realtime | Assinatura global na tabela `produtos` sem filtro de cliente | Remover ou filtrar por `cliente_id` |
| **RT-03** | `src/hooks/useVipLevels.ts:48` | **Médio** | Realtime | Canal Supabase manual sem debounce ou unmount seguro | Migrar para `useRealtimeSubscription` |
| **RT-04** | `src/hooks/usePixDiscount.ts:14,82` | **Médio** | Cache / Estado | Cache em módulo nunca invalidado sem realtime | Adicionar inscrição a `system_settings` |
| **ROUT-01**| `src/routing/useAppLocation.ts:45` | **Médio** | Re-render | `safeMatchRoute` cria novo objeto em todo render | Envolver retorno em `useMemo` |
| **MEM-01** | `src/components/admin/ProdutosModule.tsx:247` | **Alto** | Performance | Download de até 20k produtos na RAM do cliente | Migrar para paginação server-side com `.range()` |
| **MEM-02** | `src/components/admin/OrdensCompraModule.tsx:118`| **Médio** | Performance | Linear search $O(N^2)$ `data.find` dentro de `data.map` | Criar `Map` indexado para lookup $O(1)$ |
| **LK-01**  | `src/components/client/store/OrderSuccessPage.tsx:21` | **Baixo** | Memory Leak | `setInterval` sem retorno de cleanup no `useEffect` | Retornar `() => clearInterval(interval)` |
| **KEY-01** | 147 ocorrências (`FaturasList.tsx:1138`, `CartDrawer.tsx:364`, etc.) | **Baixo** | Reconciliação | Uso de `key={index}` em listas dinâmicas mutáveis | Utilizar IDs únicos estáveis (ex: `item.id`) |

---

## 4. Plano de Execução Sugerido para a Fase de Remediação

1. **Sprint 1 — Build & Integridade Imediata:**
   - Corrigir a linha 331 de `src/lib/whatsappNotificationService.ts`.
   - Executar `npm run lint` e `npx tsc --noEmit` para validar a compilação livre de erros.
2. **Sprint 2 — Regras dos Hooks & Resiliência Realtime:**
   - Refatorar `src/hooks/useRealtime.ts` para eliminar a chamada condicional no `useRealtime`.
   - Limpar o parâmetro `deps` nas chamadas de `useRealtimeSubscription` nos 59 módulos para estancar o channel thrashing.
   - Proteger `useAutoLogout.ts` com `useRef(onLogout)`.
3. **Sprint 3 — Otimização de Providers & Re-renderizações:**
   - Aplicar `useMemo` nos `value` de `FileViewerContext`, `ClientNotificationContext` e `ProviderNotificationContext`.
   - Memoizar `useAppLocation.ts`.
4. **Sprint 4 — Performance de Dados & Componentes Monolíticos:**
   - Refatorar a query de `ProdutosModule.tsx` para paginação server-side sob demanda.
   - Adicionar cleanup no timer de `OrderSuccessPage.tsx`.
   - Corrigir os `key={index}` das tabelas financeiras e de pedidos.
