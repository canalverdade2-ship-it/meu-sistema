# Handoff Report: Explorer Survey 1 — Frontend Infrastructure & Hook Rules Remediation (R1 & R2)

**Agent:** Explorer Survey 1 (Frontend Infrastructure & Hook Rules)  
**Date:** 2026-08-28T14:16:00Z  
**Milestone:** Realtime P0 Critical Remediation  
**Status:** Complete (Hard Handoff)  
**Target Scope:** Requirement R1 (`src/hooks/useRealtime.ts`) & Requirement R2 (Hook Rules Violations & Ghost Tables)

---

## 1. Observation

### 1.1 R1 Base Infrastructure: `src/hooks/useRealtime.ts`
Direct inspection of `src/hooks/useRealtime.ts` (272 lines) revealed 5 structural vulnerabilities:

1. **Stale Callback Closures (`callbacksRef.current` Desync)** — Lines 59–72:
   ```typescript
   // Lines 59-61: rawConfigs memoized only on primitive props (table, filter, schema, event, enabled, debounceMs)
   const rawConfigs = useMemo(() => {
     return Array.isArray(options) ? options : [options];
   }, [Array.isArray(options) ? JSON.stringify(options.map(o => ({ table: o.table, filter: o.filter, schema: o.schema, event: o.event, enabled: o.enabled, debounceMs: o.debounceMs }))) : `${options.table}_${options.filter}_${options.schema}_${options.event}_${options.enabled}_${options.debounceMs}`]);

   // Lines 64-72: callbacksRef updated by iterating over stale rawConfigs instead of fresh options
   const callbacksRef = useRef<Array<{
     onPayload?: (payload: RealtimePostgresChangesPayload<any>) => void;
     onChange?: () => void | Promise<void>;
   }>>([]);

   callbacksRef.current = rawConfigs.map((c) => ({
     onPayload: c.onPayload,
     onChange: c.onChange,
   }));
   ```
   *Observation:* When a component re-renders with fresh inline callbacks `onChange` or `onPayload`, `rawConfigs` is NOT recomputed because stringified primitives did not change. As a consequence, `callbacksRef.current` retains functions from the first render containing stale closed-over state/props.

2. **Index Desynchronization Under `enabled: false`** — Lines 104 & 120–147:
   ```typescript
   // Line 104: enabledConfigs filters out disabled entries
   const enabledConfigs = rawConfigs.filter((c) => c.enabled !== false);
   
   // Line 120: idx is the index in enabledConfigs (0..N-1), NOT the index in rawConfigs/callbacksRef
   enabledConfigs.forEach((config, idx) => {
     ...
     channel = channel.on('postgres_changes', changeOptions as any, (payload) => {
       const activeCallbacks = callbacksRef.current[idx]; // <-- BUG: accesses wrong callback index!
       if (activeCallbacks?.onChange) {
         if (debounceTimersRef.current[idx]) { ... } // <-- BUG: clears wrong debounce timer!
   ```
   *Observation:* In multi-table subscriptions where table 0 has `enabled: false` and table 1 has `enabled: true`, `enabledConfigs[0]` is table 1. When an event fires for table 1, `idx === 0`, causing it to execute `callbacksRef.current[0]` (table 0's callback!) and mutate table 0's debounce timer.

3. **Channel Status Race Condition on Fast Mount/Teardown** — Lines 188–202:
   ```typescript
   channel.subscribe((subStatus, err) => {
     if (!isMountedRef.current) return;
     if (subStatus === 'SUBSCRIBED') setStatus('SUBSCRIBED');
   ```
   *Observation:* In React 18 StrictMode or rapid remounting, `channel.subscribe` from an old/teardown channel can resolve after a new channel has already been created, erroneously updating `status`.

4. **Ignored Dependency Array in `useRealtime` Shorthand** — Lines 246–271:
   ```typescript
   export function useRealtime<T = any>(
     tableOrOptions: string | RealtimeSubscriptionConfig<T> | RealtimeSubscriptionConfig<T>[],
     onChangeOrDeps?: (() => void | Promise<void>) | DependencyList,
     optionsOrDeps?: Partial<RealtimeSubscriptionConfig<T>> | DependencyList
   ): RealtimeSubscriptionResult {
     if (typeof tableOrOptions === 'string') {
       ...
       return useRealtimeSubscription<T>(config); // <-- BUG: deps parameter is never passed!
     }
   ```
   *Observation:* In `useRealtime('table', callback, [dep1, dep2])` or `useRealtime('table', callback, { debounceMs: 300 })`, the dependency list is dropped.

5. **Memoization Key Omits `channelName`** — Line 61:
   *Observation:* The serialized string key omits `o.channelName`, preventing re-subscription if a custom channel name changes dynamically.

---

### 1.2 R2 Hook Rules Violations (React Rules of Hooks #1 & #2)

1. **`src/components/admin/ProdutosModule.tsx` (Lines 247–272)**:
   ```typescript
   247: const fetchProdutos = async () => {
   248:   let allData: Produto[] = [];
   249:   let from = 0;
   250:   useEffect(() => {
   251:     fetchProdutos();
   252:   }, [activeTab, search, tipoClienteFilter, categoriaFilter]);
   253: 
   254:   useRealtimeSubscription([
   255:     { table: 'produtos', onChange: fetchProdutos, ... },
   256:     ...
   271:   ], [activeTab, search, tipoClienteFilter, categoriaFilter, selectedProduto?.id]);
   272: 
   273:   const step = 1000;
   ```
   *Observation:* `useEffect` and `useRealtimeSubscription` are declared *inside* the async function `fetchProdutos`.

2. **`src/components/admin/OrdensAssinaturaModule.tsx` (Lines 103–115)**:
   ```typescript
   103: if (filters.mes) {
   104:   useEffect(() => {
   105:     fetchOrdens();
   106:   }, [activeTab, search, filters]);
   107: 
   108:   useRealtimeSubscription([
   109:     { table: 'ordens_assinatura', onChange: fetchOrdens, debounceMs: 300 },
   110:     { table: 'assinaturas', onChange: fetchOrdens, debounceMs: 300 },
   111:     { table: 'faturas', onChange: fetchOrdens, debounceMs: 300 },
   112:     { table: 'orcamentos', onChange: fetchOrdens, debounceMs: 300 },
   113:     { table: 'clientes', onChange: fetchOrdens, debounceMs: 300 },
   114:   ], [activeTab, search, filters]);
   ```
   *Observation:* `useEffect` and `useRealtimeSubscription` are declared *inside a conditional block (`if (filters.mes)`)* *inside the async function `fetchOrdens`*. If `filters.mes` is empty, the hooks are never registered; when set, hooks are called dynamically during async execution.

3. **`src/components/admin/OrdensCompraModule.tsx` (Lines 99–113)**:
   ```typescript
   99:  if (filters.mes) {
   100:   useEffect(() => {
   101:     fetchOrdens();
   102:   }, [activeTab, search, filters]);
   103: 
   104:   useRealtimeSubscription([
   105:     { table: 'ordens_compra', onChange: fetchOrdens, debounceMs: 300 },
   106:     { table: 'produtos', onChange: fetchOrdens, debounceMs: 300 },
   107:     { table: 'faturas', onChange: fetchOrdens, debounceMs: 300 },
   108:     { table: 'cupons_loja', onChange: fetchOrdens, debounceMs: 300 },
   109:     { table: 'orcamentos', onChange: fetchOrdens, debounceMs: 300 },
   110:     { table: 'clientes', onChange: fetchOrdens, debounceMs: 300 },
   111:     { table: 'pagamentos', onChange: fetchOrdens, debounceMs: 300 },
   112:   ], [activeTab, search, filters]);
   ```
   *Observation:* Identical violation as `OrdensAssinaturaModule.tsx` (`useEffect` and `useRealtimeSubscription` inside `if (filters.mes)` inside async `fetchOrdens`).

---

### 1.3 R2 Ghost Tables (Non-Existent Database Table Subscriptions)

1. **`src/components/admin/AdvertisingAdminModule.tsx` (Lines 142–149)**:
   - Subscribed tables: `advertising_requests`, `advertising_proposals`, `advertising_campaigns`, `advertising_creatives`, `advertising_payments`, `advertising_placements`.
   - Real PostgreSQL tables (Migration `20260721210100_create_advertising_foundation.sql` & `20260721223100_complete_advertising_platform.sql`): `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_payments`, `gsa_ad_placements`.
   - *Impact:* WebSocket subscriptions were registered to 6 ghost tables; Realtime updates NEVER arrived.

2. **`src/components/admin/ServicePackagesModule.tsx` (Lines 80–84)**:
   - Subscribed tables: `servicos`, `catalog_packages` (GHOST), `catalog_services` (GHOST).
   - Real PostgreSQL tables (Migration `20260722030000_service_catalog_packages.sql`): `servicos_pacotes`, `servicos`.
   - *Impact:* Package modifications never triggered UI refreshes.

3. **`src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx` (Lines 91–94)**:
   - Subscribed tables: `career_applications` (GHOST), `trabalhe_conosco` (GHOST).
   - Real PostgreSQL table (Migration `20260722180000_create_gsa_careers_foundation.sql`): `gsa_careers_applications`.
   - *Impact:* New job applications never refreshed the recruitment pipeline in real time.

4. **`src/components/admin/CareersAdminModule.tsx` (Lines 127–130)**:
   - Subscribed tables: `gsa_careers_applications` (Valid), `trabalhe_conosco` (GHOST).
   - *Impact:* Unnecessary subscription to deleted table `trabalhe_conosco`.

5. **`src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx` (Line 127)**:
   - Subscribed table: `career_applications` (GHOST).
   - Real table: `gsa_careers_applications`.

---

## 2. Logic Chain

```
[Observation 1.1: callbacksRef mapped from memoized rawConfigs]
       │
       ▼ (Logic Step 1)
rawConfigs memo string ignores function refs -> rawConfigs is frozen across standard renders -> callbacksRef retains first-render closure -> STALE CLOSURE BUG CONFIRMED.
       │
       ▼ (Solution 1)
Extract callbacks directly from fresh incoming options on every render before effects run.

[Observation 1.1: enabledConfigs filters rawConfigs with new index idx]
       │
       ▼ (Logic Step 2)
enabledConfigs[idx] has idx != originalIdx when any preceding table is enabled: false -> listener accesses callbacksRef.current[idx] -> WRONG CALLBACK & WRONG TIMER FIRED.
       │
       ▼ (Solution 2)
Preserve original index: rawConfigs.map((config, originalIdx) => ({ config, originalIdx })).filter(...). Listener indexes callbacksRef.current[originalIdx].

[Observation 1.2: Hooks declared inside async functions / conditionals]
       │
       ▼ (Logic Step 3)
React Hook rules dictate hooks must execute unconditionally at top-level on every render.
Calling hooks in async functions or `if (filters.mes)` creates undefined execution order, violates React runtime invariant, and prevents cleanup from being tied to component lifecycle.
       │
       ▼ (Solution 3)
Move hooks to the component function root level. Pass state/filters via dependency arrays.

[Observation 1.3: Table names in realtime subscriptions do not match PostgreSQL schema]
       │
       ▼ (Logic Step 4)
Supabase Realtime PostgreSQL replication matches publication tables by exact name.
Subscriptions to `advertising_*`, `catalog_packages`, `trabalhe_conosco`, `career_applications` receive 0 CDC events.
       │
       ▼ (Solution 4)
Replace ghost names with exact table names: `gsa_ad_*`, `servicos_pacotes`, `gsa_careers_applications`.
```

---

## 3. Caveats

1. **Server-Side CDC vs Client-Side Direct Channels**: This report addresses frontend React hooks (`useRealtime.ts`) and React modules. Backend VPS webhook concurrency and JWT fallbacks are handled by Survey 2 / Survey 3.
2. **`subscribeToTable` in Non-React Modules**: `src/lib/supabaseRealtime.ts` helper `subscribeToTable` is imperative and does not use React hooks, but is used in test suites. Its cleanup via `removeChannel` is verified.
3. **Database RLS Policies**: For `gsa_ad_*`, `servicos_pacotes`, and `gsa_careers_applications`, realtime events will only be received by clients if RLS policies allow SELECT or if the publication has `REPLICA IDENTITY FULL` configured (already verified in migration `20260826140000_enable_realtime_full_replica_identity_105_tables.sql`).

---

## 4. Conclusion & Actionable Remediation Plans

### 4.1 Canonical Replacement Code: `src/hooks/useRealtime.ts`

```typescript
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
 * Supports single or multi-table subscriptions, row-level filters, debounced callbacks,
 * status tracking, and guaranteed unmount cleanup via supabase.removeChannel.
 */
export function useRealtimeSubscription<T = any>(
  options: RealtimeSubscriptionConfig<T> | RealtimeSubscriptionConfig<T>[],
  deps?: DependencyList
): RealtimeSubscriptionResult {
  const [status, setStatus] = useState<RealtimeSubscriptionStatus>('INITIALIZING');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimersRef = useRef<{ [key: number]: ReturnType<typeof setTimeout> | null }>({});
  const isMountedRef = useRef(true);

  // 1. Direct normalization of incoming configs on every render (Fixes R1-01 Stale Closures)
  const incomingConfigs = Array.isArray(options) ? options : [options];

  const callbacksRef = useRef<Array<{
    onPayload?: (payload: RealtimePostgresChangesPayload<any>) => void;
    onChange?: () => void | Promise<void>;
  }>>([]);

  // Always sync fresh callback references on every render pass
  callbacksRef.current = incomingConfigs.map((c) => ({
    onPayload: c.onPayload,
    onChange: c.onChange,
  }));

  // 2. Structural memoization for channel topic subscription
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

  const isEnabled = rawConfigs.length > 0 && rawConfigs.some((c) => c.enabled !== false);

  const unsubscribe = useCallback(() => {
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

    // 3. Preserve original indices to prevent index desync when enabled: false is present (Fixes R1-02)
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

          // Access callbacks via originalIdx
          const activeCallbacks = callbacksRef.current[originalIdx];

          // A. onPayload execution
          if (activeCallbacks?.onPayload) {
            try {
              activeCallbacks.onPayload(payload);
            } catch (payloadErr) {
              console.error(`[useRealtime] Error in onPayload for ${config.table}:`, payloadErr);
            }
          }

          // B. onChange execution with debouncing
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
                    console.error(`[useRealtime] Error in debounced onChange for ${config.table}:`, changeErr);
                  }
                }
              }, debounceMs);
            } else {
              try {
                void activeCallbacks.onChange();
              } catch (changeErr) {
                console.error(`[useRealtime] Error in onChange for ${config.table}:`, changeErr);
              }
            }
          }
        }
      );
    });

    channelRef.current = channel;

    channel.subscribe((subStatus, err) => {
      // Guard against superseded channels during fast remounts (Fixes R1-03)
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

      Object.values(debounceTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      debounceTimersRef.current = {};

      if (channelRef.current) {
        const chan = channelRef.current;
        channelRef.current = null;
        supabase.removeChannel(chan).catch((err) => {
          console.warn(`[useRealtime] Cleanup error on channel ${channelName}:`, err);
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
 * Overloaded helper hook supporting both shorthand syntax and config objects.
 * (Fixes R1-04 Dependency List forwarding).
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

### 4.2 Exact Refactoring for Hook Violations (R2)

#### A. `src/components/admin/ProdutosModule.tsx`
**Action:** Move `useEffect` and `useRealtimeSubscription` out of `fetchProdutos` to the component root body.

```typescript
// --- BEFORE (Lines 247-273) ---
  const fetchProdutos = async () => {
    let allData: Produto[] = [];
    let from = 0;
  useEffect(() => {
    fetchProdutos();
  }, [activeTab, search, tipoClienteFilter, categoriaFilter]);

  useRealtimeSubscription([
    {
      table: 'produtos',
      onChange: fetchProdutos,
      onPayload: (payload) => {
        if (payload.new && selectedProduto && (payload.new as any).id === selectedProduto.id) {
          setSelectedProduto(prev => prev ? { ...prev, ...payload.new } as Produto : null);
        }
      },
      debounceMs: 300,
    },
    { table: 'loja_categorias', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'loja_estoque_historico', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'produto_fornecedor_config', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'produto_variantes', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'produto_variacao_grupos', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'produto_variacao_opcoes', onChange: fetchProdutos, debounceMs: 300 },
  ], [activeTab, search, tipoClienteFilter, categoriaFilter, selectedProduto?.id]);

    const step = 1000;
    ...

// --- AFTER (Refactored Structure) ---
  const fetchProdutos = useCallback(async () => {
    let allData: Produto[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('produtos')
        .select('*')
        .eq('status', activeTab === 'ativos' ? 'ativo' : 'inativo');
      ...
    }
  }, [activeTab, search, tipoClienteFilter, categoriaFilter]);

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  useRealtimeSubscription([
    {
      table: 'produtos',
      onChange: fetchProdutos,
      onPayload: (payload) => {
        if (payload.new && selectedProduto && (payload.new as any).id === selectedProduto.id) {
          setSelectedProduto(prev => prev ? { ...prev, ...payload.new } as Produto : null);
        }
      },
      debounceMs: 300,
    },
    { table: 'loja_categorias', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'loja_estoque_historico', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'produto_fornecedor_config', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'produto_variantes', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'produto_variacao_grupos', onChange: fetchProdutos, debounceMs: 300 },
    { table: 'produto_variacao_opcoes', onChange: fetchProdutos, debounceMs: 300 },
  ], [fetchProdutos, selectedProduto?.id]);
```

#### B. `src/components/admin/OrdensAssinaturaModule.tsx`
**Action:** Move `useEffect` and `useRealtimeSubscription` out of `if (filters.mes)` / `fetchOrdens` to the component root body.

```typescript
// --- BEFORE (Lines 103-116) ---
    if (filters.mes) {
  useEffect(() => {
    fetchOrdens();
  }, [activeTab, search, filters]);

  useRealtimeSubscription([
    { table: 'ordens_assinatura', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'assinaturas', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'faturas', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'orcamentos', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'clientes', onChange: fetchOrdens, debounceMs: 300 },
  ], [activeTab, search, filters]);

      const year = filters.ano || new Date().getFullYear();
      const startDate = `${year}-${filters.mes}-01`;
      const endDate = `${year}-${filters.mes}-${String(new Date(Number(year), Number(filters.mes), 0).getDate()).padStart(2, '0')}`;
      query = query.gte('data_criacao', startDate).lte('data_criacao', endDate);
    }

// --- AFTER (Refactored Structure) ---
  const fetchOrdens = useCallback(async () => {
    let selectStr = '*, assinaturas(nome, valor), clientes(nome), faturas(*), orcamentos(*)';
    if (search) {
      selectStr = '*, assinaturas!inner(nome, valor), clientes(nome), faturas(*), orcamentos(*)';
    }

    let query = supabase.from('ordens_assinatura').select(selectStr);

    if (activeTab === 'processamento') {
      query = query.in('status', ['em_analise', 'pendente', 'pago']);
    } else if (activeTab === 'concluido') {
      query = query.in('status', ['concluido', 'em_cancelamento']);
    } else {
      query = query.eq('status', 'cancelado');
    }
    
    if (search) {
      query = query.ilike('assinaturas.nome', `%${search}%`);
    }

    if (filters.mes) {
      const year = filters.ano || new Date().getFullYear();
      const startDate = `${year}-${filters.mes}-01`;
      const endDate = `${year}-${filters.mes}-${String(new Date(Number(year), Number(filters.mes), 0).getDate()).padStart(2, '0')}`;
      query = query.gte('data_criacao', startDate).lte('data_criacao', endDate);
    }

    const { data, error } = await query.order('data_criacao', { ascending: false });
    if (error) {
      console.error('Error fetching ordens_assinatura:', error);
      toast.error('Erro ao carregar ordens de assinatura.');
    }
    if (data) {
      setOrdens(data);
    }
  }, [activeTab, search, filters]);

  useEffect(() => {
    void fetchOrdens();
  }, [fetchOrdens]);

  useRealtimeSubscription([
    { table: 'ordens_assinatura', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'assinaturas', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'faturas', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'orcamentos', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'clientes', onChange: fetchOrdens, debounceMs: 300 },
  ], [fetchOrdens]);
```

#### C. `src/components/admin/OrdensCompraModule.tsx`
**Action:** Move `useEffect` and `useRealtimeSubscription` out of `if (filters.mes)` / `fetchOrdens` to the component root body.

```typescript
// --- AFTER (Refactored Structure) ---
  const fetchOrdens = useCallback(async () => {
    let selectStr = '*, produtos(nome, valor, codigo_produto, codigo_barras, identificador_preferencial, tipo_codigo_barras, imagem_url), clientes(nome, email, telefone), orcamentos(id, codigo_orcamento, desconto, taxa_entrega, cupom_desconto_id, cupom_entrega_id, endereco_entrega, total, quantidade), faturas(id, status, codigo_fatura, desconto_voucher_aplicado, desconto_pontos_aplicado, abatimento_carteira_aplicado, valor_total, pagamentos(metodo, valor, data_pagamento))';
    if (search) {
      selectStr = '*, produtos!inner(nome, valor, codigo_produto, codigo_barras, identificador_preferencial, tipo_codigo_barras, imagem_url), clientes(nome, email, telefone), orcamentos(id, codigo_orcamento, desconto, taxa_entrega, cupom_desconto_id, cupom_entrega_id, endereco_entrega, total, quantidade), faturas(id, status, codigo_fatura, desconto_voucher_aplicado, desconto_pontos_aplicado, abatimento_carteira_aplicado, valor_total, pagamentos(metodo, valor, data_pagamento))';
    }

    let query = supabase.from('ordens_compra').select(selectStr);
    
    if (activeTab === 'processamento') {
      query = query.in('status', ['em_analise', 'pago', 'aprovado', 'em_expedicao', 'em_transporte']);
    } else if (activeTab === 'concluido') {
      query = query.eq('status', 'concluido');
    } else if (activeTab === 'cancelado') {
      query = query.eq('status', 'cancelado');
    }
    
    if (search) {
      query = query.ilike('produtos.nome', `%${search}%`);
    }

    if (filters.mes) {
      const year = filters.ano || new Date().getFullYear();
      const startDate = `${year}-${filters.mes}-01`;
      const endDate = `${year}-${filters.mes}-${String(new Date(Number(year), Number(filters.mes), 0).getDate()).padStart(2, '0')}`;
      query = query.gte('data_criacao', startDate).lte('data_criacao', endDate);
    }

    const { data, error } = (await query.order('data_criacao', { ascending: false })) as any;
    if (error) {
      console.error('Error fetching ordens_compra:', error);
      toast.error('Erro ao carregar ordens de compra.');
    }
    if (data) {
      const enriched = data.map((ordem: any) => {
        if (ordem.faturas && ordem.faturas.length > 0) return ordem;
        if (ordem.orcamento_id) {
          const outraOrdemComFatura = data.find((o: any) => o.orcamento_id === ordem.orcamento_id && o.faturas && o.faturas.length > 0);
          if (outraOrdemComFatura) return { ...ordem, faturas: outraOrdemComFatura.faturas };
        }
        return ordem;
      });

      setOrdens(enriched);
      if (selectedOrdem) {
        const updated = enriched.find((o: any) => o.id === selectedOrdem.id);
        if (updated) setSelectedOrdem(updated);
      }
    }
  }, [activeTab, search, filters, selectedOrdem?.id]);

  useEffect(() => {
    void fetchOrdens();
  }, [fetchOrdens]);

  useRealtimeSubscription([
    { table: 'ordens_compra', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'produtos', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'faturas', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'cupons_loja', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'orcamentos', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'clientes', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'pagamentos', onChange: fetchOrdens, debounceMs: 300 },
  ], [fetchOrdens]);
```

---

### 4.3 Exact Replacement Code for Ghost Tables (R2)

#### A. `src/components/admin/AdvertisingAdminModule.tsx` (Lines 142–149)
```typescript
  useRealtimeSubscription([
    { table: 'gsa_ad_requests', onChange: load, debounceMs: 300 },
    { table: 'gsa_ad_proposals', onChange: load, debounceMs: 300 },
    { table: 'gsa_ad_campaigns', onChange: load, debounceMs: 300 },
    { table: 'gsa_ad_creatives', onChange: load, debounceMs: 300 },
    { table: 'gsa_ad_payments', onChange: load, debounceMs: 300 },
    { table: 'gsa_ad_placements', onChange: load, debounceMs: 300 },
  ], [load]);
```

#### B. `src/components/admin/ServicePackagesModule.tsx` (Lines 80–84)
```typescript
  useRealtimeSubscription([
    { table: 'servicos', onChange: load, debounceMs: 300 },
    { table: 'servicos_pacotes', onChange: load, debounceMs: 300 },
  ], [load]);
```

#### C. `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx` (Lines 91–94)
```typescript
  useRealtimeSubscription([
    { table: 'gsa_careers_applications', onChange: () => fetchApplications(true), debounceMs: 500 }
  ], [fetchApplications]);
```

#### D. `src/components/admin/CareersAdminModule.tsx` (Lines 127–130)
```typescript
  useRealtimeSubscription([
    { table: 'gsa_careers_applications', onChange: () => void fetchApplications(true), debounceMs: 500 },
  ], [fetchApplications]);
```

#### E. `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx` (Lines 121–128)
```typescript
  useRealtimeSubscription([
    { table: 'prestadores', onChange: fetchDomainMetrics },
    { table: 'prestador_saques', onChange: fetchDomainMetrics },
    { table: 'saques', onChange: fetchDomainMetrics },
    { table: 'fornecedores', onChange: fetchDomainMetrics },
    { table: 'gsa_afiliados', onChange: fetchDomainMetrics },
    { table: 'gsa_careers_applications', onChange: fetchDomainMetrics }
  ]);
```

---

## 5. Verification Method

To independently verify these findings and the subsequent implementation:

1. **Static Analysis & Realtime Audit Script**:
   ```bash
   npx tsx scripts/check-realtime-audit.ts
   ```
   *Expected result:* Validates canonical hooks, verifies table names against the catalog, and checks channel cleanup across all 94 components.

2. **Hook Rules Static Inspection**:
   - Check AST / ESLint on `src/components/admin/ProdutosModule.tsx`, `src/components/admin/OrdensAssinaturaModule.tsx`, and `src/components/admin/OrdensCompraModule.tsx` to ensure 0 hooks nested inside functions or conditionals.

3. **Database Table Verification**:
   - Query PostgreSQL information schema or verify against migrations `20260721210100`, `20260722030000`, and `20260722180000` to confirm all subscription table strings match live database tables.

4. **Vitest Realtime Infrastructure Test Suite**:
   ```bash
   npm run test -- src/tests/realtime-hook.test.ts
   ```
