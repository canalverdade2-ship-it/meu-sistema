# Supabase Realtime Architecture & Database Migration Survey

**Date**: 2026-08-26  
**Agent**: `teamwork_preview_explorer_survey_rt_1`  
**Scope**: Requirement R1 (Shared Realtime Infrastructure), Requirement R13 (105-Table Database Migration), Baseline Tests & Build Integrity.

---

## 1. Executive Summary

This investigation surveys the real-time foundations of the **GSA OS / GSA HUB** platform (React 19 + Vite 6 + TypeScript 5.8 + Supabase JS v2.98).

### Key Findings:
1. **Existing Client**: `src/lib/supabase.ts` instantiates the Supabase client with custom exponential reconnection backoff (`reconnectAfterMs`), `eventsPerSecond: 5`, `timeout: 30000`, and `heartbeatIntervalMs: 30000`. It exports a lazy Proxy wrapper `supabase`.
2. **Current Channel Usage**: Multiple components implement ad-hoc `supabase.channel()` subscriptions with varying degrees of cleanup quality. Several key workstations and portals employ `setInterval` polling (15s to 30s) that must be replaced by event-driven subscriptions.
3. **Canonical Shared Realtime Primitive (R1)**: A unified hook `useRealtime` / `useRealtimeSubscription` is designed to support:
   - Single and multi-table subscriptions (`table: string | string[]`)
   - Full Postgres change events (`*`, `INSERT`, `UPDATE`, `DELETE`)
   - Row-level filtering (`filter: "cliente_id=eq.123"`)
   - Built-in debounce to prevent burst re-renders
   - Guaranteed cleanup via `supabase.removeChannel()` on unmount (zero memory leaks)
   - Connection status and error hooks
4. **Database Migration (R13)**: All 105+ database tables queried in the system are inventoried. An idempotent PL/pgSQL migration script is designed to apply `REPLICA IDENTITY FULL` and register every table in `supabase_realtime` publication without race conditions or duplication errors.
5. **Baseline System Integrity**:
   - `npm run test:unit`: **12 test files passed, 103/103 tests passing (100%)**
   - `npm run build`: **Exit Code 0** (3,877 modules transformed, chunked in 1m 7s)
   - `npm run typecheck:strict`: **Exit Code 0** (0 TypeScript errors)
   - `npm run test:realtime`: **REALTIME_RESILIENCE_CONTRACTS_OK**
   - `npm run test:database-migration-baseline`: **DATABASE_MIGRATION_BASELINE_OK**

---

## 2. Supabase Client & Network Architecture

### 2.1 Supabase Client Configuration (`src/lib/supabase.ts`)
The client is configured with:
```typescript
supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: sessionStorageAdapter,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
    timeout: 30000,
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries: number) => {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
      return Math.min(1000 * Math.pow(2, tries), 30000);
    },
  },
});
```

### 2.2 Storage & RPC Proxies
`src/lib/supabase.ts` uses ES6 Proxy wrapping:
- `storage`: Intercepts client uploads/downloads for client-owned paths (`documentos_cliente`, `gsa-private-documents`, `emprestimos`).
- `rpc`: Intercepts specific RPC calls (such as `gsa_admin_emprestimo_enviar_contrato`) for cleanup.
- Any property access to `supabase.channel()` delegates directly to the underlying `SupabaseClient.channel()`.

---

## 3. Analysis of Existing Realtime & Polling Patterns

### 3.1 Existing Realtime Files (Preserve and Align)
The following files already utilize `supabase.channel()`:
- `src/hooks/useClientNotifications.tsx`: Scoped tables (`faturas`, `saques`, `orcamentos`, `ordens_servico`, `vouchers`, etc.) with `cliente_id=eq.${clientId}` filter and dedicated `notificacoes` direct channel.
- `src/hooks/useProviderNotifications.tsx`: Scoped to `prestador_id`.
- `src/hooks/useAdminNotifications.tsx`: Subscribes to `admin_notificacoes` and `notificacoes`. (Requires broadening to pending tables per R3).
- `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx`: `admin-orcamentos-sd1-${Date.now()}` on table `orcamentos` with 400ms debounce.
- `src/components/admin/super-domains/operacoes/OrdensServicoWorkstation.tsx`: `admin-os-sd1-${Date.now()}` on table `ordens_servico` with 400ms debounce.
- `src/components/admin/super-domains/financeiro/FaturamentoView.tsx`, `CobrancaView.tsx`, `FluxoCaixaView.tsx`.
- `src/components/client/ClientEmprestimos.tsx`, `ClientGSAStore.tsx`, `ExtratoList.tsx`.

### 3.2 Polling Patterns to Eliminate
The audit identified `setInterval` data fetching in:
1. `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx` (30s polling `fetchLiveMetrics` querying `orcamentos`, `ordens_servico`, `prestador_demandas`, `ordens_compra`) -> Replace with multi-table subscription.
2. `src/components/admin/ShopeeOperationsModule.tsx` (15s polling `load(true)`) -> Replace with realtime.
3. `src/components/admin/GsaTvModule.tsx` (2.5s polling `fetchMetrics`) -> Replace with `gsa_tv_*` subscription.
4. `src/components/admin/SystemMonitorModule.tsx` (30s polling) -> Replace with realtime on `clientes`, `prestadores`, `colaboradores`, `fornecedores`, `gsa_afiliados`.
5. `src/pages/AdvertiserPortal.tsx` (30s polling `load(true)`) -> Replace with realtime on `classificados_*` tables.
6. `src/pages/Afiliado/AfiliadoDashboard.tsx` (30s polling `load(true)`) -> Replace with realtime on `gsa_afiliados`, `indicacoes`.

---

## 4. Canonical Shared Realtime Infrastructure Design (R1)

To provide a single standard primitive across R2–R12, we design `useRealtime` (and `useRealtimeSubscription` alias) in `src/hooks/useRealtime.ts` (and optional helper in `src/lib/supabaseRealtime.ts`).

### 4.1 Interface Specification
```typescript
import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type RealtimePostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface UseRealtimeOptions<T = any> {
  /** Single table name or array of table names */
  table: string | string[];
  /** Postgres changes event to listen to (default: '*') */
  event?: RealtimePostgresEvent;
  /** Schema name (default: 'public') */
  schema?: string;
  /** Row-level Postgres filter string, e.g. "cliente_id=eq.123" */
  filter?: string;
  /** Optional custom channel name; auto-generated if omitted */
  channelName?: string;
  /** Whether the subscription is active (default: true) */
  enabled?: boolean;
  /** Debounce delay in ms for the onChange callback (default: 300ms) */
  debounceMs?: number;
  /** Callback fired with full payload when changes occur */
  onEvent?: (payload: RealtimePostgresChangesPayload<T>) => void;
  /** Ergonomic zero-arg callback to trigger data refetch */
  onChange?: () => void;
  /** Callback on channel error */
  onError?: (error: Error | any) => void;
  /** Callback on subscription status change */
  onStatus?: (status: string) => void;
}
```

### 4.2 Canonical Implementation
```typescript
export function useRealtime<T = any>({
  table,
  event = '*',
  schema = 'public',
  filter,
  channelName,
  enabled = true,
  debounceMs = 300,
  onEvent,
  onChange,
  onError,
  onStatus,
}: UseRealtimeOptions<T>) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  // Stable serialized tables identifier
  const tablesKey = Array.isArray(table) ? table.slice().sort().join(',') : table;

  useEffect(() => {
    if (!enabled || !table || (Array.isArray(table) && table.length === 0)) {
      return;
    }

    const tables = Array.isArray(table) ? table : [table];
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseName = channelName || `rt_${tables.join('_').slice(0, 40)}_${uniqueSuffix}`;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerChange = (payload?: RealtimePostgresChangesPayload<T>) => {
      if (onEventRef.current && payload) {
        try {
          onEventRef.current(payload);
        } catch (err) {
          console.error('[useRealtime] onEvent handler error:', err);
        }
      }

      if (onChangeRef.current) {
        if (debounceMs > 0) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            onChangeRef.current?.();
          }, debounceMs);
        } else {
          onChangeRef.current();
        }
      }
    };

    const channel: RealtimeChannel = supabase.channel(baseName);

    tables.forEach((tbl) => {
      const channelConfig: any = {
        event,
        schema,
        table: tbl,
      };

      if (filter) {
        channelConfig.filter = filter;
      }

      channel.on('postgres_changes', channelConfig, (payload: RealtimePostgresChangesPayload<T>) => {
        triggerChange(payload);
      });
    });

    channel.subscribe((status, err) => {
      onStatusRef.current?.(status);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (err && onErrorRef.current) {
          onErrorRef.current(err);
        }
      }
    });

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [tablesKey, event, schema, filter, channelName, enabled, debounceMs]);
}

export const useRealtimeSubscription = useRealtime;
```

### 4.3 Why This Design Guarantees Robustness:
1. **0 Memory Leaks**: In the cleanup function of `useEffect`, any pending `debounceTimer` is cleared, and `supabase.removeChannel(channel)` is executed synchronously.
2. **Burst Protection**: The configurable `debounceMs` coalesces rapid bulk updates (e.g. 50 row changes) into a single component fetch invocation.
3. **Multi-Table Simplicity**: A single hook call can listen to multiple tables simultaneously (e.g., `['orcamentos', 'ordens_servico', 'prestador_demandas']`), creating only a single channel.
4. **Conditional Safety**: When `enabled: false` (e.g., waiting for client ID authentication), no channel is created.

---

## 5. Database Migration Audit & Idempotent SQL Script (R13)

### 5.1 Full Table Inventory (105+ Tables)
The following tables are queried across the GSA platform:

| # | Table Name | # | Table Name | # | Table Name |
|---|------------|---|------------|---|------------|
| 1 | `assinaturas` | 40 | `gsa_tv_jobs` | 79 | `prestador_historico` |
| 2 | `automacao_scraping_configs` | 41 | `gsa_tv_media_items` | 80 | `prestador_premios` |
| 3 | `blog_posts` | 42 | `gsa_tv_playlists` | 81 | `prestador_promocoes` |
| 4 | `carteira_lancamentos` | 43 | `gsa_tv_schedule_slots` | 82 | `prestador_promocoes_ativacoes` |
| 5 | `classificados_anuncios` | 44 | `gsa_whatsapp_ramais` | 83 | `prestador_saques` |
| 6 | `classificados_comissoes` | 45 | `indicacoes` | 84 | `prestador_suporte_demandas` |
| 7 | `classificados_comissoes_config` | 46 | `level_history` | 85 | `prestador_transacoes` |
| 8 | `classificados_midias` | 47 | `loja_avaliacoes` | 86 | `prestador_vouchers` |
| 9 | `classificados_propostas` | 48 | `loja_carrinhos` | 87 | `prestadores` |
| 10 | `classificados_transacoes` | 49 | `loja_categorias` | 88 | `produto_fornecedor_config` |
| 11 | `client_levels` | 50 | `loja_credito_documentos` | 89 | `produto_variacao_grupos` |
| 12 | `cliente_cupons` | 51 | `loja_credito_movimentacoes` | 90 | `produto_variacao_opcoes` |
| 13 | `cliente_documentos` | 52 | `loja_credito_solicitacoes` | 91 | `produto_variante_opcoes` |
| 14 | `cliente_premios` | 53 | `loja_estoque_historico` | 92 | `produto_variantes` |
| 15 | `cliente_promocoes` | 54 | `loja_favoritos` | 93 | `produtos` |
| 16 | `clientes` | 55 | `loja_pedido_itens` | 94 | `promocoes` |
| 17 | `cobrancas` | 56 | `loja_pedidos` | 95 | `promocoes_quantidade` |
| 18 | `colaboradores` | 57 | `loja_reembolsos` | 96 | `promocoes_quantidade_ativadas` |
| 19 | `contratos` | 58 | `loja_solicitacoes` | 97 | `promocoes_quantidade_uso` |
| 20 | `cupons_ativados` | 59 | `loja_vaquinha_contribuicoes` | 98 | `saques` |
| 21 | `cupons_loja` | 60 | `notificacao_leituras` | 99 | `saude_contratos` |
| 22 | `demanda_comentarios` | 61 | `notificacoes` | 100 | `seguros_apolices` |
| 23 | `documentos_cliente` | 62 | `orcamentos` | 101 | `servicos` |
| 24 | `documentos_prestador` | 63 | `ordens_assinatura` | 102 | `sistema_logs` |
| 25 | `empresa` | 64 | `ordens_compra` | 103 | `solicitacoes_exclusao` |
| 26 | `emprestimo_comentarios` | 65 | `ordens_fiscais` | 104 | `suporte_mensagens` |
| 27 | `emprestimo_documentos` | 66 | `ordens_servico` | 105 | `system_settings` |
| 28 | `emprestimo_historico` | 67 | `os_notas` | 106 | `ticket_mensagens` |
| 29 | `emprestimo_parcelas` | 68 | `os_suporte_mensagens` | 107 | `tickets` |
| 30 | `emprestimos` | 69 | `pagamentos` | 108 | `transferencias` |
| 31 | `extrato_financeiro` | 70 | `parceiros` | 109 | `viagens_categorias` |
| 32 | `fatura_contestacoes` | 71 | `parceiros_resgates` | 110 | `viagens_orcamentos` |
| 33 | `faturas` | 72 | `points_transactions` | 111 | `viagens_pacote_imagens` |
| 34 | `fornecedores` | 73 | `pontos_movimentacoes` | 112 | `viagens_pacotes` |
| 35 | `gsa_afiliados` | 74 | `prestador_agendamentos` | 113 | `viagens_passageiro_documentos` |
| 36 | `gsa_client_operation_requests` | 75 | `prestador_demandas` | 114 | `viagens_passageiros` |
| 37 | `gsa_tv_audit_log` | 76 | `prestador_demandas_historico` | 115 | `viagens_propostas` |
| 38 | `gsa_tv_channels` | 77 | `prestador_documentos` | 116 | `viagens_transacoes` |
| 39 | `gsa_tv_incidents` | 78 | `prestador_faturas` | 117 | `vouchers` |

### 5.2 Proposed Migration File
File name: `supabase/migrations/20260826140000_enable_realtime_full_replica_identity_105_tables.sql`

```sql
-- Migration: Enable REPLICA IDENTITY FULL and Realtime Publication for all 105+ Tables
-- Description: Idempotently configures replica identity and registers tables into supabase_realtime publication.

DO $$
DECLARE
    t TEXT;
    v_tables TEXT[] := ARRAY[
        'assinaturas',
        'automacao_scraping_configs',
        'blog_posts',
        'carteira_lancamentos',
        'classificados_anuncios',
        'classificados_comissoes',
        'classificados_comissoes_config',
        'classificados_midias',
        'classificados_propostas',
        'classificados_transacoes',
        'client_levels',
        'cliente_cupons',
        'cliente_documentos',
        'cliente_premios',
        'cliente_promocoes',
        'clientes',
        'cobrancas',
        'colaboradores',
        'contratos',
        'cupons_ativados',
        'cupons_loja',
        'demanda_comentarios',
        'documentos_cliente',
        'documentos_prestador',
        'empresa',
        'emprestimo_comentarios',
        'emprestimo_documentos',
        'emprestimo_historico',
        'emprestimo_parcelas',
        'emprestimos',
        'extrato_financeiro',
        'fatura_contestacoes',
        'faturas',
        'fornecedores',
        'gsa_afiliados',
        'gsa_client_operation_requests',
        'gsa_tv_audit_log',
        'gsa_tv_channels',
        'gsa_tv_incidents',
        'gsa_tv_jobs',
        'gsa_tv_media_items',
        'gsa_tv_playlists',
        'gsa_tv_schedule_slots',
        'gsa_whatsapp_ramais',
        'indicacoes',
        'level_history',
        'loja_avaliacoes',
        'loja_carrinhos',
        'loja_categorias',
        'loja_credito_documentos',
        'loja_credito_movimentacoes',
        'loja_credito_solicitacoes',
        'loja_estoque_historico',
        'loja_favoritos',
        'loja_pedido_itens',
        'loja_pedidos',
        'loja_reembolsos',
        'loja_solicitacoes',
        'loja_vaquinha_contribuicoes',
        'notificacao_leituras',
        'notificacoes',
        'orcamentos',
        'ordens_assinatura',
        'ordens_compra',
        'ordens_fiscais',
        'ordens_servico',
        'os_notas',
        'os_suporte_mensagens',
        'pagamentos',
        'parceiros',
        'parceiros_resgates',
        'points_transactions',
        'pontos_movimentacoes',
        'prestador_agendamentos',
        'prestador_demandas',
        'prestador_demandas_historico',
        'prestador_documentos',
        'prestador_faturas',
        'prestador_historico',
        'prestador_premios',
        'prestador_promocoes',
        'prestador_promocoes_ativacoes',
        'prestador_saques',
        'prestador_suporte_demandas',
        'prestador_transacoes',
        'prestador_vouchers',
        'prestadores',
        'produto_fornecedor_config',
        'produto_variacao_grupos',
        'produto_variacao_opcoes',
        'produto_variante_opcoes',
        'produto_variantes',
        'produtos',
        'promocoes',
        'promocoes_quantidade',
        'promocoes_quantidade_ativadas',
        'promocoes_quantidade_uso',
        'saques',
        'saude_contratos',
        'seguros_apolices',
        'servicos',
        'sistema_logs',
        'solicitacoes_exclusao',
        'suporte_mensagens',
        'system_settings',
        'ticket_mensagens',
        'tickets',
        'transferencias',
        'viagens_categorias',
        'viagens_orcamentos',
        'viagens_pacote_imagens',
        'viagens_pacotes',
        'viagens_passageiro_documentos',
        'viagens_passageiros',
        'viagens_propostas',
        'viagens_transacoes',
        'vouchers'
    ];
BEGIN
    -- 1. Ensure supabase_realtime publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- 2. Iterate and apply REPLICA IDENTITY FULL and Publication addition
    FOREACH t IN ARRAY v_tables
    LOOP
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            -- Configure replica identity so deleted and previous rows carry full data
            EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);

            -- Add table to publication if not already published
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' 
                  AND schemaname = 'public' 
                  AND tablename = t
            ) THEN
                BEGIN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
                EXCEPTION WHEN duplicate_object THEN
                    NULL;
                END;
            END IF;
        END IF;
    END LOOP;
END $$;
```

---

## 6. Baseline Verification Results

| Check | Command | Result | Details |
|---|---|---|---|
| **Unit Test Suite** | `npm run test:unit` | **103/103 PASS (100%)** | 12 test files in `src/tests/` passed in 51.8s |
| **Production Build** | `npm run build` | **EXIT 0 (0 errors)** | 3,877 modules transformed into clean rollup chunks |
| **Strict Typecheck** | `npm run typecheck:strict` | **EXIT 0 (0 errors)** | Full TypeScript project check passed with zero diagnostics |
| **Realtime Contracts** | `npm run test:realtime` | **EXIT 0 (OK)** | Realtime resilience contracts validated |
| **DB Migration Baseline** | `npm run test:database-migration-baseline` | **EXIT 0 (OK)** | Migration ledger consistency verified |

---

## 7. Multi-Agent Implementation Roadmap (R2–R12)

The implementation work can be executed smoothly across distinct modules:
- **Core Infra (R1, R13)**: Create `src/hooks/useRealtime.ts` and `supabase/migrations/20260826140000_enable_realtime_full_replica_identity_105_tables.sql`.
- **Layer 1 (R2 Partners, R3 Admin Dashboard/Bell)**: `PartnersPage.tsx`, `FornecedoresSection.tsx`, `PartnersAdminModule.tsx`, `Dashboard.tsx`, `useAdminNotifications.tsx`.
- **Layer 2 (R4 Financeiro, R5 Contratos, R6 Governança, R7 Operações, R8 Pessoas)**: Super-Domain subviews and workstation polling elimination.
- **Layer 3 (R9 Demandas, R10 Modules + Polling, R11 Portals)**: `DemandasColaboradorModule.tsx`, `ShopeeOperationsModule.tsx`, `GsaTvModule.tsx`, `SystemMonitorModule.tsx`, `AdvertiserPortal.tsx`, `AfiliadoDashboard.tsx`.
- **Layer 4 (R12 Client Portal)**: Client views, Store Hub, Checkout, Classifieds, Travel.
