# Relatório de Auditoria Técnica Exaustiva: Infraestrutura Base de Realtime (GSA HUB)

**Data**: 2026-08-28  
**Auditor**: Explorer R1 (Teamwork Explorer / Base Realtime Infrastructure)  
**Escopo**:
1. `src/hooks/useRealtime.ts` (Hook canônico / Subscription engine)
2. `src/hooks/useRealtimeTable.ts` (Hook legado / Deprecated)
3. `src/lib/supabaseRealtime.ts` (Helper imperativo, re-exports e singleton channel management)
4. Configuração do cliente Supabase (`src/lib/supabase.ts`) e suite de testes (`src/tests/realtime-hook.test.ts`)

---

## 1. Sumário Executivo e Quadro Geral de Severidade

A auditoria inspecionou linha a linha os arquivos centrais responsáveis por 100% da conectividade WebSocket e Change Data Capture (CDC) do GSA HUB. O sistema adota o protocolo Supabase Realtime v2 (`postgres_changes`), com políticas de teardown via `supabase.removeChannel` e tratamento de reconexão exponencial configurado no cliente principal.

Contudo, a auditoria identificou **2 falhas críticas (🔴)** no hook canônico `useRealtimeSubscription` relacionadas a fechamento de escopo obsoleto (*stale closure*) e dessincronização de índices em configurações multi-tabela com `enabled: false`, além de **anti-patterns estruturais (🔴)** no hook legado `useRealtimeTable`.

### Resumo das Avaliações por Arquivo:

| Arquivo | Classificação Geral | 🔴 Crítico | 🟡 Alerta | 🟢 OK |
|---|---|:---:|:---:|:---:|
| `src/hooks/useRealtime.ts` | 🟡 Necessita Correção | 2 | 3 | 4 |
| `src/hooks/useRealtimeTable.ts` | 🔴 Obsoleto / Inseguro | 2 | 2 | 1 |
| `src/lib/supabaseRealtime.ts` | 🟢 Adequado (Melhorias) | 0 | 2 | 3 |

---

## 2. Auditoria Linha a Linha: `src/hooks/useRealtime.ts`

### 2.1 Visão Geral do Arquivo
- **Linhas totais**: 272
- **Exportações principais**: `useRealtimeSubscription`, `useRealtime`, tipos (`RealtimePostgresEvent`, `RealtimeSubscriptionStatus`, `RealtimeSubscriptionConfig`, `RealtimeSubscriptionResult`).
- **Padrão arquitetural**: Hook com suporte a multi-tabela, filtros de linha, debounce independente por tabela, separação entre payload síncrono (`onPayload`) e re-fetch assíncrono (`onChange`), e rastreamento de status de conexão (`INITIALIZING`, `SUBSCRIBED`, `TIMED_OUT`, `CLOSED`, `CHANNEL_ERROR`).

---

### 2.2 Problemas Identificados em `src/hooks/useRealtime.ts`

#### 🔴 ISSUE R1-01: Stale Callback Closure no `callbacksRef` devido ao Mapeamento de `rawConfigs` Memoizado
- **Localização**: Linhas 59–61 e Linhas 69–72
- **Trecho de Código**:
```ts
// Linhas 59-61:
const rawConfigs = useMemo(() => {
  return Array.isArray(options) ? options : [options];
}, [Array.isArray(options) ? JSON.stringify(options.map(o => ({ table: o.table, filter: o.filter, schema: o.schema, event: o.event, enabled: o.enabled, debounceMs: o.debounceMs }))) : `${options.table}_${options.filter}_${options.schema}_${options.event}_${options.enabled}_${options.debounceMs}`]);

// Linhas 69-72:
callbacksRef.current = rawConfigs.map((c) => ({
  onPayload: c.onPayload,
  onChange: c.onChange,
}));
```
- **Análise do Mecanismo de Falha**:
  1. O array `rawConfigs` é memoizado com base na serialização de propriedades estáticas (`table`, `filter`, `schema`, `event`, etc.).
  2. Quando um componente pai é re-renderizado com uma nova função inline `onChange` ou `onPayload` (que captura estado ou props atualizados), a string de dependência do `useMemo` **não muda**.
  3. Como consequência, `rawConfigs` retém a referência do objeto `options` do **primeiro render**.
  4. Nas linhas 69–72, `callbacksRef.current` itera sobre `rawConfigs` em vez do argumento `options` fresco recebido no render atual.
  5. Portanto, `callbacksRef.current` continua apontando para a função `onChange` antiga (stale closure), anulando completamente o propósito do `callbacksRef`.
- **Impacto**: Se o componente re-renderizar após uma mudança de filtro, paginação ou estado local, o evento do realtime executará a função com o estado congelado do primeiro render.
- **Severidade**: 🔴 **CRÍTICO**
- **Correção Proposta**:
```ts
// Mapear diretamente as opções frescas do render atual para callbacksRef.current:
const currentOptions = Array.isArray(options) ? options : [options];
callbacksRef.current = currentOptions.map((c) => ({
  onPayload: c.onPayload,
  onChange: c.onChange,
}));
```

---

#### 🔴 ISSUE R1-02: Dessincronização de Índices entre `enabledConfigs` e `callbacksRef.current` quando `enabled: false`
- **Localização**: Linhas 104 e Linhas 120–184
- **Trecho de Código**:
```ts
// Linha 104:
const enabledConfigs = rawConfigs.filter((c) => c.enabled !== false);

// Linhas 120-146:
enabledConfigs.forEach((config, idx) => {
  ...
  channel = channel.on(
    'postgres_changes',
    changeOptions as any,
    (payload: RealtimePostgresChangesPayload<any>) => {
      if (!isMountedRef.current) return;

      const activeCallbacks = callbacksRef.current[idx]; // BUG: idx referencia enabledConfigs, não rawConfigs!
      ...
      if (activeCallbacks?.onChange) {
        if (debounceMs > 0) {
          if (debounceTimersRef.current[idx]) { ... }
          debounceTimersRef.current[idx] = setTimeout(() => {
            ...
            callbacksRef.current[idx]!.onChange!();
          }, debounceMs);
        }
      }
    }
  );
});
```
- **Análise do Mecanismo de Falha**:
  1. Considere uma configuração multi-tabela com 2 itens:
     `options = [ { table: 'pedidos', enabled: false, onChange: fnPedidos }, { table: 'faturas', enabled: true, onChange: fnFaturas } ]`
  2. `rawConfigs` tem 2 itens (índice 0 = pedidos, índice 1 = faturas).
  3. `callbacksRef.current` tem 2 itens (índice 0 = fnPedidos, índice 1 = fnFaturas).
  4. `enabledConfigs` contém apenas `[ { table: 'faturas' } ]` (comprimento 1).
  5. No `enabledConfigs.forEach((config, idx) => ...)`, para a tabela `faturas`, `idx` é `0`.
  6. Quando um evento chega para `faturas`, o código executa `callbacksRef.current[0]` (que é `fnPedidos`)!
  7. Adicionalmente, `debounceTimersRef.current[0]` cancelará os timers da tabela errada.
- **Impacto**: Troca silenciosa de callbacks entre tabelas diferentes e corrupção de timers quando qualquer tabela intermediária é desabilitada com `enabled: false`.
- **Severidade**: 🔴 **CRÍTICO**
- **Correção Proposta**:
```ts
// Armazenar índice original ou manter lookup baseado em id estável da subscription:
const enabledConfigsWithOriginalIndex = rawConfigs
  .map((config, originalIndex) => ({ config, originalIndex }))
  .filter(({ config }) => config.enabled !== false);

enabledConfigsWithOriginalIndex.forEach(({ config, originalIndex }) => {
  ...
  channel = channel.on(
    'postgres_changes',
    changeOptions as any,
    (payload: RealtimePostgresChangesPayload<any>) => {
      if (!isMountedRef.current) return;
      const activeCallbacks = callbacksRef.current[originalIndex];
      ...
      if (debounceTimersRef.current[originalIndex]) {
        clearTimeout(debounceTimersRef.current[originalIndex]!);
      }
      debounceTimersRef.current[originalIndex] = setTimeout(() => {
        debounceTimersRef.current[originalIndex] = null;
        if (isMountedRef.current && callbacksRef.current[originalIndex]?.onChange) {
          void callbacksRef.current[originalIndex]!.onChange!();
        }
      }, debounceMs);
    }
  );
});
```

---

#### 🟡 ISSUE R1-03: Condição de Corrida no Callback de `channel.subscribe` em Montagens Rápidas (StrictMode / Fast Route Change)
- **Localização**: Linhas 188–202
- **Trecho de Código**:
```ts
channel.subscribe((subStatus, err) => {
  if (!isMountedRef.current) return;

  if (subStatus === 'SUBSCRIBED') {
    setStatus('SUBSCRIBED');
  } else if (subStatus === 'TIMED_OUT') {
    setStatus('TIMED_OUT');
  ...
```
- **Análise do Mecanismo de Falha**:
  1. Em React 18 StrictMode ou durante transições rápidas de rota, o efeito monta Channel A, executa cleanup desinscrevendo Channel A, e imediatamente monta Channel B.
  2. Quando Channel B monta, `isMountedRef.current` é redefinido para `true`.
  3. Se o callback assíncrono de `subscribe` do Channel A responder tarde com `CHANNEL_ERROR` ou `CLOSED`, a validação `if (!isMountedRef.current) return;` passa como verdadeira.
  4. O status do Channel A sobrescreve o status do Channel B recém-conectado.
- **Severidade**: 🟡 **ALERTA**
- **Correção Proposta**:
```ts
channel.subscribe((subStatus, err) => {
  // Garantir que o callback pertence ao canal atualmente ativo no ref:
  if (!isMountedRef.current || channelRef.current !== channel) return;
  ...
});
```

---

#### 🟡 ISSUE R1-04: Hook de Conveniência `useRealtime` Descarta Array de Dependências em Assinaturas de Tabela com String
- **Localização**: Linhas 246–271
- **Trecho de Código**:
```ts
export function useRealtime<T = any>(
  tableOrOptions: string | RealtimeSubscriptionConfig<T> | RealtimeSubscriptionConfig<T>[],
  onChangeOrDeps?: (() => void | Promise<void>) | DependencyList,
  optionsOrDeps?: Partial<RealtimeSubscriptionConfig<T>> | DependencyList
): RealtimeSubscriptionResult {
  if (typeof tableOrOptions === 'string') {
    const table = tableOrOptions;
    const onChange = typeof onChangeOrDeps === 'function' ? onChangeOrDeps : undefined;
    const extraOptions = typeof optionsOrDeps === 'object' && !Array.isArray(optionsOrDeps)
      ? (optionsOrDeps as Partial<RealtimeSubscriptionConfig<T>>)
      : {};

    const config: RealtimeSubscriptionConfig<T> = {
      table,
      onChange,
      ...extraOptions,
    };

    return useRealtimeSubscription<T>(config); // O parâmetro deps foi omitido!
  }
  ...
```
- **Análise do Mecanismo de Falha**:
  Quando um desenvolvedor invoca `useRealtime('pedidos', fetchPedidos, [statusFilter])`:
  - `optionsOrDeps` é `[statusFilter]` (um array).
  - `!Array.isArray(optionsOrDeps)` é falso, então `extraOptions` é `{}`.
  - A linha 264 invoca `useRealtimeSubscription<T>(config)` passando **apenas o config** e omitindo `deps`.
  - As dependências passadas são silenciosamente ignoradas.
- **Severidade**: 🟡 **ALERTA**
- **Correção Proposta**:
```ts
  if (typeof tableOrOptions === 'string') {
    const table = tableOrOptions;
    const onChange = typeof onChangeOrDeps === 'function' ? onChangeOrDeps : undefined;
    const isArrayDeps = Array.isArray(optionsOrDeps);
    const extraOptions = typeof optionsOrDeps === 'object' && !isArrayDeps
      ? (optionsOrDeps as Partial<RealtimeSubscriptionConfig<T>>)
      : {};
    const deps = isArrayDeps ? (optionsOrDeps as DependencyList) : (Array.isArray(onChangeOrDeps) ? onChangeOrDeps : undefined);

    const config: RealtimeSubscriptionConfig<T> = {
      table,
      onChange,
      ...extraOptions,
    };

    return useRealtimeSubscription<T>(config, deps);
  }
```

---

#### 🟡 ISSUE R1-05: Chave de Memoização de Objeto Único Omite `channelName`
- **Localização**: Linha 61
- **Trecho de Código**:
```ts
: `${options.table}_${options.filter}_${options.schema}_${options.event}_${options.enabled}_${options.debounceMs}`
```
- **Análise**: Se o consumidor passar um `channelName` customizado que mude dinamicamente, a chave de dependência do `useMemo` não inclui `${options.channelName}`, não re-inicializando a subscrição com o novo canal.
- **Severidade**: 🟡 **ALERTA**
- **Correção**: Incluir `_${options.channelName}` na string de dependência.

---

### 2.3 Aspectos Positivos e Conformidades em `src/hooks/useRealtime.ts` (🟢 OK)
- **🟢 Teardown Garantido com `supabase.removeChannel`**:
  O hook invoca `supabase.removeChannel(chan)` no unmount e no método `unsubscribe()` manual. Isso assegura que o canal é desregistrado da tabela interna de canais do cliente Supabase (`client.realtime.channels`), prevenindo vazamento de conexões WebSocket.
- **🟢 Arquitetura de Callback Duplo (`onPayload` síncrono vs `onChange` debounced)**:
  Permite atualizações granulares imediatas de estado via `onPayload` sem re-fetch, ao mesmo tempo em que protege o banco de dados contra tempestades de re-fetches via `onChange` com `debounceMs`.
- **🟢 Limpeza Completa de Timers de Debounce**:
  Todos os temporizadores ativos em `debounceTimersRef` são cancelados no unmount (`clearTimeout`), evitando chamadas assíncronas em componentes desmontados.
- **🟢 Geração de Nomes Únicos de Canais**:
  `generateChannelName` utiliza prefixo legível da tabela + filtro sanitizado + timestamp + contador global + entropia pseudo-aleatória (`Math.random().toString(36)`), eliminando riscos de colisão acidental entre instâncias de componentes idênticos.

---

## 3. Auditoria Linha a Linha: `src/hooks/useRealtimeTable.ts` (Hook Legado)

### 3.1 Visão Geral do Arquivo
- **Linhas totais**: 21
- **Assinatura**: `export function useRealtimeTable(tables: string | string[], onRefresh: () => void, channelPrefix?: string): void`
- **Status no Sistema**: Marcado para deprecação nos testes (`realtime-hook.test.ts`), porém **ainda presente em 2 componentes ativos**:
  1. `src/components/admin/ConfiguracoesModule.tsx` (linha 27)
  2. `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx` (linha 48)

---

### 3.2 Problemas Identificados em `src/hooks/useRealtimeTable.ts`

#### 🔴 ISSUE R1-06: Ausência Total de Filtros de Linha (Broadcast Indiscriminado)
- **Localização**: Linhas 13–15
- **Trecho de Código**:
```ts
for (const table of tableList) {
  ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => { onRefreshRef.current(); });
}
```
- **Análise**: O hook força `event: '*'` e `schema: 'public'` sem nenhum suporte a parâmetro `filter`. Em uma plataforma SaaS multi-inquilino, qualquer alteração em qualquer linha de `orcamentos` ou `ordens_servico` disparará um re-fetch em todos os clientes conectados.
- **Severidade**: 🔴 **CRÍTICO**

---

#### 🔴 ISSUE R1-07: Ausência de Debounce / Proteção Contra Rajadas de Eventos
- **Localização**: Linha 14
- **Análise**: Se 100 registros forem atualizados em lote no Supabase, `onRefreshRef.current()` será invocado 100 vezes consecutivas sem agrupamento, sobrecarregando a CPU do navegador e gerando 100 requisições HTTP REST concorrentes para a API.
- **Severidade**: 🔴 **CRÍTICO**

---

#### 🟡 ISSUE R1-08: Nenhuma Visibilidade de Status de Conexão nem Retorno de Unsubscribe
- **Localização**: Linhas 4 e 16
- **Análise**: O hook retorna `void`. A interface não consegue exibir badge de status (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`), nem o componente consegue pausar ou forçar reconexão.
- **Severidade**: 🟡 **ALERTA**

---

#### 🟡 ISSUE R1-09: Risco de Colisão de Nome de Canal em Montagens Concorrentes
- **Localização**: Linhas 10–11
```ts
const prefix = channelPrefix ?? tableList.join('-');
const channelName = `rt-${prefix}-${Date.now()}`;
```
- **Análise**: Se dois componentes montarem no mesmo milissegundo com a mesma tabela e sem prefixo diferenciado, ambos requisitarão o mesmo canal `channelName` ao cliente Supabase.
- **Severidade**: 🟡 **ALERTA**

---

### 3.3 Plano Exato de Migração para Eliminação de `useRealtimeTable`

#### Componente 1: `src/components/admin/ConfiguracoesModule.tsx`
- **Código Atual (Linhas 4 e 27)**:
```ts
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
...
useRealtimeTable('system_settings', () => setRtRefreshKey(k => k + 1));
```
- **Migração Canônica Equivalente**:
```ts
import { useRealtimeSubscription } from '../../hooks/useRealtime';
...
useRealtimeSubscription({
  table: 'system_settings',
  onChange: () => setRtRefreshKey((k) => k + 1),
  debounceMs: 300,
});
```

#### Componente 2: `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx`
- **Código Atual (Linhas 8 e 48)**:
```ts
import { useRealtimeTable } from '../../../../hooks/useRealtimeTable';
...
useRealtimeTable(['orcamentos', 'ordens_servico'], () => setRtRefreshKey(k => k + 1));
```
- **Migração Canônica Equivalente**:
```ts
import { useRealtimeSubscription } from '../../../../hooks/useRealtime';
...
useRealtimeSubscription([
  { table: 'orcamentos', onChange: () => setRtRefreshKey((k) => k + 1), debounceMs: 300 },
  { table: 'ordens_servico', onChange: () => setRtRefreshKey((k) => k + 1), debounceMs: 300 },
]);
```

Após a aplicação dessas duas alterações, o arquivo `src/hooks/useRealtimeTable.ts` poderá ser substituído por um wrapper de compatibilidade com `@deprecated` ou totalmente removido.

---

## 4. Auditoria Linha a Linha: `src/lib/supabaseRealtime.ts`

### 4.1 Visão Geral do Arquivo
- **Linhas totais**: 69
- **Exportações**: Re-exports do `useRealtime` e helper imperativo `subscribeToTable`.
- **Objetivo**: Fornecer subscrições fora do ciclo de vida do React (ex: workers de background, serviços de notificação, scripts de teste).

---

### 4.2 Problemas Identificados em `src/lib/supabaseRealtime.ts`

#### 🟡 ISSUE R1-10: Inscrição Silenciosa sem Tratamento de Falhas (`subscribe()` sem callback)
- **Localização**: Linhas 52–61
- **Trecho de Código**:
```ts
  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on('postgres_changes', changeConfig as any, (payload: RealtimePostgresChangesPayload<T>) => {
      try {
        onChange(payload);
      } catch (err) {
        console.error(`[subscribeToTable] Error handling payload for ${table}:`, err);
      }
    })
    .subscribe();
```
- **Análise**: O método `.subscribe()` é invocado sem callback de status. Caso ocorra erro de autenticação, violação de RLS ou timeout de conexão, nenhuma mensagem é registrada e o chamador não tem como saber que a inscrição falhou.
- **Severidade**: 🟡 **ALERTA**
- **Correção Proposta**:
```ts
  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on('postgres_changes', changeConfig as any, (payload: RealtimePostgresChangesPayload<T>) => {
      try {
        onChange(payload);
      } catch (err) {
        console.error(`[subscribeToTable] Error handling payload for ${table}:`, err);
      }
    })
    .subscribe((status, err) => {
      if (err || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[subscribeToTable] Subscription status on ${channelName} (${table}): ${status}`, err);
      }
    });
```

---

#### 🟡 ISSUE R1-11: Falta de Suporte a Debounce Opcional no Helper Imperativo
- **Localização**: Linhas 25–30
- **Análise**: O helper aceita `schema`, `filter`, `event`, `channelName`, mas não possui opção `debounceMs`. Serviços que escutam tabelas com alto volume de escrita seriam beneficiados por suporte a debounce nativo.
- **Severidade**: 🟡 **ALERTA**

---

### 4.3 Aspectos Positivos em `src/lib/supabaseRealtime.ts` (🟢 OK)
- **🟢 Teardown Garantido com `supabase.removeChannel`**: A função retornada desfaz a inscrição e remove o canal do registro do cliente Supabase.
- **🟢 Tratamento Seguro de Erros no Callback**: O `onChange(payload)` é encapsulado em bloco `try/catch` para evitar que exceções não tratadas travem o worker WebSocket.
- **🟢 Entropia no Nome do Canal**: Canal gerado com `sub_${table}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.

---

## 5. Matriz Comparativa: Canônico vs Legado vs Imperativo

| Critério Técnico | Canônico `useRealtimeSubscription` | Canônico `useRealtime` | Legado `useRealtimeTable` | Imperativo `subscribeToTable` |
|---|:---:|:---:|:---:|:---:|
| **Suporte Multi-Tabela** | ✅ Sim (Canal Composto) | ✅ Sim (Array de Configs) | ✅ Sim (Loop for) | ❌ Não (Tabela única) |
| **Filtro de Linha (`filter`)** | ✅ Sim (`id=eq.123`) | ✅ Sim | ❌ Não (Sem filtro) | ✅ Sim |
| **Evento Granular (`INSERT`/`UPDATE`...)** | ✅ Sim (`*`, `INSERT`, etc.) | ✅ Sim | ❌ Não (`*` obrigatório) | ✅ Sim |
| **Proteção de Debounce (`debounceMs`)** | ✅ Sim (por tabela) | ✅ Sim | ❌ Não | ❌ Não |
| **Acesso a Payload (`onPayload`)** | ✅ Sim (Tipado `T`) | ✅ Sim | ❌ Não (`() => void`) | ✅ Sim (Tipado `T`) |
| **Rastreamento de Status de Conexão** | ✅ Sim (5 estados) | ✅ Sim | ❌ Não (`void`) | ❌ Não |
| **Flag de Desativação (`enabled`)** | ✅ Sim (`enabled: false`) | ✅ Sim | ❌ Não | ❌ Não |
| **Desinscrição Manual (`unsubscribe()`)** | ✅ Sim | ✅ Sim | ❌ Não | ✅ Sim |
| **Limpeza com `removeChannel`** | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim |
| **Prevenção de Re-render Infinito** | ✅ Sim (Memoização estática) | ✅ Sim | ⚠️ Depende de JSON.stringify | N/A |
| **Resiliência a Stale Closure** | 🔴 Requer Correção (R1-01/R1-02) | 🔴 Requer Correção (R1-01/R1-02) | ✅ Sim (Usa ref simples) | N/A |

---

## 6. Proposta de Código Corrigido Completo (Drop-in Replacements)

### 6.1 Proposta Corrigida: `src/hooks/useRealtime.ts`
```ts
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { DependencyList } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type RealtimePostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type RealtimeSubscriptionStatus =
  | 'INITIALIZING'
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR';

export interface RealtimeSubscriptionConfig<T = any> {
  table: string;
  schema?: string;
  filter?: string; // e.g. "cliente_id=eq.123" or "status=eq.ativo"
  event?: RealtimePostgresEvent;
  debounceMs?: number;
  channelName?: string;
  onPayload?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onChange?: () => void | Promise<void>;
  enabled?: boolean;
}

export type RealtimeSubscriptionOptions<T = any> = RealtimeSubscriptionConfig<T>;

export interface RealtimeSubscriptionResult {
  status: RealtimeSubscriptionStatus;
  channel: RealtimeChannel | null;
  unsubscribe: () => void;
}

let channelCounter = 0;

function generateChannelName(configs: RealtimeSubscriptionConfig[]): string {
  channelCounter += 1;
  const tablePart = configs.map((c) => c.table).slice(0, 3).join('-');
  const filterPart = configs[0]?.filter ? `_${configs[0].filter.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20)}` : '';
  return `rt_${tablePart}${filterPart}_${Date.now()}_${channelCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Canonical hook for Supabase Realtime subscriptions across the GSA HUB platform.
 * Fully resilient against stale closures, index desynchronization, and channel leaks.
 */
export function useRealtimeSubscription<T = any>(
  options: RealtimeSubscriptionConfig<T> | RealtimeSubscriptionConfig<T>[],
  deps?: DependencyList
): RealtimeSubscriptionResult {
  const [status, setStatus] = useState<RealtimeSubscriptionStatus>('INITIALIZING');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimersRef = useRef<{ [key: number]: ReturnType<typeof setTimeout> | null }>({});
  const isMountedRef = useRef(true);

  // Normalize incoming options directly for callbacks without caching stale function references
  const incomingConfigs = Array.isArray(options) ? options : [options];

  // Keep latest callbacks in refs so changing function references doesn't tear down WebSocket connections
  // and does NOT get locked into stale closures from useMemo
  const callbacksRef = useRef<Array<{
    onPayload?: (payload: RealtimePostgresChangesPayload<any>) => void;
    onChange?: () => void | Promise<void>;
  }>>([]);

  callbacksRef.current = incomingConfigs.map((c) => ({
    onPayload: c.onPayload,
    onChange: c.onChange,
  }));

  // Stable memoized config list for subscription setup
  const rawConfigs = useMemo(() => {
    return Array.isArray(options) ? options : [options];
  }, [
    Array.isArray(options)
      ? JSON.stringify(options.map((o) => ({
          table: o.table,
          filter: o.filter,
          schema: o.schema,
          event: o.event,
          enabled: o.enabled,
          debounceMs: o.debounceMs,
          channelName: o.channelName,
        })))
      : `${options.table}_${options.filter}_${options.schema}_${options.event}_${options.enabled}_${options.debounceMs}_${options.channelName}`
  ]);

  // Determine if subscription should be active
  const isEnabled = rawConfigs.length > 0 && rawConfigs.some((c) => c.enabled !== false);

  const unsubscribe = useCallback(() => {
    // Clear debounce timers
    Object.values(debounceTimersRef.current).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
    debounceTimersRef.current = {};

    if (channelRef.current) {
      const activeChannel = channelRef.current;
      channelRef.current = null;
      setStatus('CLOSED');
      supabase.removeChannel(activeChannel).catch((err) => {
        console.warn('[useRealtime] Error removing channel during manual unsubscribe:', err);
      });
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (!isEnabled) {
      setStatus('CLOSED');
      return () => {
        isMountedRef.current = false;
      };
    }

    // Retain original indices from rawConfigs to guarantee callbacks and timers never misalign
    const enabledConfigsWithIdx = rawConfigs
      .map((config, originalIdx) => ({ config, originalIdx }))
      .filter(({ config }) => config.enabled !== false);

    if (enabledConfigsWithIdx.length === 0) {
      setStatus('CLOSED');
      return () => {
        isMountedRef.current = false;
      };
    }

    setStatus('INITIALIZING');

    // Use custom channel name if provided, otherwise generate a unique deterministic channel name
    const customName = enabledConfigsWithIdx.find(({ config }) => config.channelName)?.config.channelName;
    const channelName = customName || generateChannelName(enabledConfigsWithIdx.map(({ config }) => config));

    let channel = supabase.channel(channelName);

    enabledConfigsWithIdx.forEach(({ config, originalIdx }) => {
      const eventType = config.event || '*';
      const schemaName = config.schema || 'public';
      const filterStr = config.filter;

      const changeOptions: {
        event: RealtimePostgresEvent;
        schema: string;
        table: string;
        filter?: string;
      } = {
        event: eventType,
        schema: schemaName,
        table: config.table,
      };

      if (filterStr) {
        changeOptions.filter = filterStr;
      }

      channel = channel.on(
        'postgres_changes',
        changeOptions as any,
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (!isMountedRef.current) return;

          const activeCallbacks = callbacksRef.current[originalIdx];

          // 1. Fire onPayload immediately if defined
          if (activeCallbacks?.onPayload) {
            try {
              activeCallbacks.onPayload(payload);
            } catch (payloadErr) {
              console.error(`[useRealtime] Error in onPayload handler for table ${config.table}:`, payloadErr);
            }
          }

          // 2. Fire onChange (with optional debounce)
          if (activeCallbacks?.onChange) {
            const debounceMs = config.debounceMs ?? 0;
            if (debounceMs > 0) {
              if (debounceTimersRef.current[originalIdx]) {
                clearTimeout(debounceTimersRef.current[originalIdx]!);
              }
              debounceTimersRef.current[originalIdx] = setTimeout(() => {
                debounceTimersRef.current[originalIdx] = null;
                if (isMountedRef.current && callbacksRef.current[originalIdx]?.onChange) {
                  try {
                    void callbacksRef.current[originalIdx]!.onChange!();
                  } catch (changeErr) {
                    console.error(`[useRealtime] Error in debounced onChange for table ${config.table}:`, changeErr);
                  }
                }
              }, debounceMs);
            } else {
              try {
                void activeCallbacks.onChange();
              } catch (changeErr) {
                console.error(`[useRealtime] Error in onChange for table ${config.table}:`, changeErr);
              }
            }
          }
        }
      );
    });

    channelRef.current = channel;

    channel.subscribe((subStatus, err) => {
      // Protect against stale channel callbacks in fast remounts / StrictMode
      if (!isMountedRef.current || channelRef.current !== channel) return;

      if (subStatus === 'SUBSCRIBED') {
        setStatus('SUBSCRIBED');
      } else if (subStatus === 'TIMED_OUT') {
        setStatus('TIMED_OUT');
        console.warn(`[useRealtime] Channel subscription timed out: ${channelName}`);
      } else if (subStatus === 'CLOSED') {
        setStatus('CLOSED');
      } else if (subStatus === 'CHANNEL_ERROR') {
        setStatus('CHANNEL_ERROR');
        console.warn(`[useRealtime] Channel error on ${channelName}:`, err);
      }
    });

    return () => {
      isMountedRef.current = false;

      // Clear any pending debounce timers
      Object.values(debounceTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      debounceTimersRef.current = {};

      if (channelRef.current) {
        const chan = channelRef.current;
        channelRef.current = null;
        supabase.removeChannel(chan).catch((err) => {
          console.warn(`[useRealtime] Cleanup error removing channel ${channelName}:`, err);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps ? deps : [isEnabled, JSON.stringify(rawConfigs.map(c => ({
    t: c.table,
    s: c.schema || 'public',
    f: c.filter,
    e: c.event || '*',
    d: c.debounceMs,
    c: c.channelName
  })))]);

  return {
    status,
    channel: channelRef.current,
    unsubscribe,
  };
}

/**
 * Overloaded helper hook supporting both shorthand syntax and object/array syntax.
 */
export function useRealtime<T = any>(
  tableOrOptions: string | RealtimeSubscriptionConfig<T> | RealtimeSubscriptionConfig<T>[],
  onChangeOrDeps?: (() => void | Promise<void>) | DependencyList,
  optionsOrDeps?: Partial<RealtimeSubscriptionConfig<T>> | DependencyList
): RealtimeSubscriptionResult {
  if (typeof tableOrOptions === 'string') {
    const table = tableOrOptions;
    const onChange = typeof onChangeOrDeps === 'function' ? onChangeOrDeps : undefined;
    const isArrayDeps = Array.isArray(optionsOrDeps);
    const extraOptions = typeof optionsOrDeps === 'object' && !isArrayDeps
      ? (optionsOrDeps as Partial<RealtimeSubscriptionConfig<T>>)
      : {};
    const deps = isArrayDeps
      ? (optionsOrDeps as DependencyList)
      : (Array.isArray(onChangeOrDeps) ? onChangeOrDeps : undefined);

    const config: RealtimeSubscriptionConfig<T> = {
      table,
      onChange,
      ...extraOptions,
    };

    return useRealtimeSubscription<T>(config, deps);
  }

  const options = tableOrOptions;
  const deps = Array.isArray(onChangeOrDeps) ? onChangeOrDeps : (Array.isArray(optionsOrDeps) ? optionsOrDeps : undefined);

  return useRealtimeSubscription<T>(options, deps);
}
```

---

### 6.2 Proposta Corrigida: `src/hooks/useRealtimeTable.ts` (Compatibility / Deprecation Bridge)
```ts
import { useRealtimeSubscription } from './useRealtime';

/**
 * @deprecated Este hook está obsoleto e marcado para remoção.
 * Use `useRealtimeSubscription` ou `useRealtime` do pacote canonical `src/hooks/useRealtime`.
 */
export function useRealtimeTable(
  tables: string | string[],
  onRefresh: () => void,
  channelPrefix?: string
): void {
  const tableList = Array.isArray(tables) ? tables : [tables];
  const configs = tableList.map((table) => ({
    table,
    onChange: onRefresh,
    debounceMs: 300,
    channelName: channelPrefix ? `legacy_${channelPrefix}_${table}` : undefined,
  }));

  useRealtimeSubscription(configs);
}
```

---

### 6.3 Proposta Corrigida: `src/lib/supabaseRealtime.ts`
```ts
/**
 * Re-exports and realtime helper utilities for the GSA HUB platform.
 */
export {
  useRealtime,
  useRealtimeSubscription,
  type RealtimePostgresEvent,
  type RealtimeSubscriptionStatus,
  type RealtimeSubscriptionConfig,
  type RealtimeSubscriptionOptions,
  type RealtimeSubscriptionResult,
} from '../hooks/useRealtime';

import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { RealtimeSubscriptionConfig, RealtimePostgresEvent } from '../hooks/useRealtime';

/**
 * Imperative helper to subscribe to database changes outside of React component lifecycle.
 * Returns an unsubscribe function.
 */
export function subscribeToTable<T = any>(
  table: string,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
  options?: {
    schema?: string;
    filter?: string;
    event?: RealtimePostgresEvent;
    channelName?: string;
    debounceMs?: number;
  }
): () => void {
  const schema = options?.schema || 'public';
  const event = options?.event || '*';
  const filter = options?.filter;
  const channelName = options?.channelName || `sub_${table}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const debounceMs = options?.debounceMs ?? 0;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const changeConfig: {
    event: RealtimePostgresEvent;
    schema: string;
    table: string;
    filter?: string;
  } = {
    event,
    schema,
    table,
  };

  if (filter) {
    changeConfig.filter = filter;
  }

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on('postgres_changes', changeConfig as any, (payload: RealtimePostgresChangesPayload<T>) => {
      if (debounceMs > 0) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          try {
            onChange(payload);
          } catch (err) {
            console.error(`[subscribeToTable] Error handling debounced payload for ${table}:`, err);
          }
        }, debounceMs);
      } else {
        try {
          onChange(payload);
        } catch (err) {
          console.error(`[subscribeToTable] Error handling payload for ${table}:`, err);
        }
      }
    })
    .subscribe((status, err) => {
      if (err || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[subscribeToTable] Status on ${channelName} (${table}): ${status}`, err);
      }
    });

  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    supabase.removeChannel(channel).catch((err) => {
      console.warn(`[subscribeToTable] Cleanup error on channel ${channelName}:`, err);
    });
  };
}
```

---

## 7. Conclusões e Recomendações Prioritárias

1. **P0 (Imediato)**:
   - Aplicar a correção no `callbacksRef.current` de `useRealtime.ts` para evitar execuções com referências defasadas de estado (*stale closures*).
   - Corrigir o alinhamento de índices entre `rawConfigs` e `enabledConfigs` no `forEach` do `channel.on`.
2. **P1 (Curto Prazo)**:
   - Migrar os 2 componentes restantes que usam `useRealtimeTable` (`ConfiguracoesModule.tsx` e `OrcamentosWorkstation.tsx`) para `useRealtimeSubscription`.
   - Adicionar verificação `channelRef.current === channel` no callback de status do `channel.subscribe`.
3. **P2 (Evolução / Hardening)**:
   - Adicionar tratamento de status e debounce opcional em `subscribeToTable` de `supabaseRealtime.ts`.
