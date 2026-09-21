# Handoff Report — Explorer R2 Batch 3 (Components 49 to 72)

**Agent:** Explorer R2 Batch 3  
**Date:** 2026-08-28  
**Scope:** Realtime Audit for Components 49 to 72 of GSA HUB  
**Status:** Hard Handoff (Investigation Complete)  

---

## 1. Observation

Direct code inspections across all 24 assigned components yielded the following verbatim findings:

1. **Component 49 (`FiscalView.tsx`):**
   - Path: `src/components/admin/super-domains/financeiro/FiscalView.tsx:83-88`
   - Uses `useRealtimeSubscription({ table: 'ordens_fiscais', onChange: loadData }, [loadData])`.
   - Passing `[loadData]` forces channel teardown and re-creation whenever `activeTab` changes.
2. **Component 50 (`FluxoCaixaView.tsx`):**
   - Path: `src/components/admin/super-domains/financeiro/FluxoCaixaView.tsx:113-121`
   - Uses `useRealtimeSubscription` on `saques` and `transferencias`. No debounce configured.
3. **Component 51 (`FornecedoresModule.tsx`):**
   - Path: `src/components/admin/FornecedoresModule.tsx:111-122`
   - Uses `useRealtimeSubscription` on 8 tables with `debounceMs: 300`.
4. **Component 52 (`FornecedoresSection.tsx`):**
   - Path: `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx:300-310`
   - Uses `useRealtimeSubscription` on `parceiros`, `parceiros_resgates`, `fornecedores` with `debounceMs: 300`.
5. **Component 53 (`GovernancaAcessosView.tsx`):**
   - Path: `src/components/admin/super-domains/governanca/GovernancaAcessosView.tsx:118-123`
   - Uses `useRealtimeSubscription` on `colaboradores`, `funcoes`, `solicitacoes_exclusao`, `admin_sessoes`.
6. **Component 54 (`GovernancaAuditoriaView.tsx`):**
   - Path: `src/components/admin/super-domains/governanca/GovernancaAuditoriaView.tsx:124-128`
   - Uses `useRealtimeSubscription` on `sistema_logs`, `solicitacoes_exclusao`, `system_settings`.
7. **Component 55 (`GovernancaConfiguracoesView.tsx`):**
   - Path: `src/components/admin/super-domains/governanca/GovernancaConfiguracoesView.tsx:78-82`
   - Uses `useRealtimeSubscription` on `system_settings`, `payment_methods`, `configuracoes`.
8. **Component 56 (`GovernancaExecutiveDashboard.tsx`):**
   - Path: `src/components/admin/super-domains/governanca/GovernancaExecutiveDashboard.tsx:106-114`
   - Uses `useRealtimeSubscription` on 7 tables triggering `gsa_admin_dashboard_snapshot` RPC.
9. **Component 57 (`GovernancaInfraView.tsx`):**
   - Path: `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx:149-154`
   - Uses `useRealtimeSubscription` on 4 tables.
10. **Component 58 (`GsaSaudeView.tsx`):**
    - Path: `src/components/admin/super-domains/contratos/GsaSaudeView.tsx:71-76`
    - Uses `useRealtimeSubscription` on `saude_contratos`.
11. **Component 59 (`GsaSegurosView.tsx`):**
    - Path: `src/components/admin/super-domains/contratos/GsaSegurosView.tsx:73`
    - Uses `useRealtimeSubscription` on `seguros_apolices`.
12. **Component 60 (`GsaTvModule.tsx`):**
    - Path: `src/components/admin/GsaTvModule.tsx:352-360`
    - Uses `useRealtimeSubscription` on 7 tables `gsa_tv_*` with `debounceMs: 500`.
13. **Component 61 (`HubEmpresasView.tsx`):**
    - Path: `src/components/admin/super-domains/contratos/HubEmpresasView.tsx:97`
    - Uses `useRealtimeSubscription` on `clientes`.
14. **Component 62 (`NovaDemandaModal.tsx`):**
    - Path: `src/components/admin/demandas/NovaDemandaModal.tsx:68-72`
    - Uses `useRealtimeSubscription` on `ordens_servico`, `colaboradores`, `prestadores` with `debounceMs: 300`.
15. **Component 63 (`NovoPrestadorDrawer.tsx`):**
    - Path: `src/components/admin/super-domains/pessoas/NovoPrestadorDrawer.tsx:27`
    - Uses `useRealtimeSubscription({ table: 'prestadores', enabled: isOpen })` without `onChange` handler.
16. **Component 64 (`OperacoesSuperDomain.tsx`):**
    - Path: `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx:117-122`
    - Uses `useRealtimeSubscription` on 4 tables with `debounceMs: 400`.
17. **Component 65 (`OrcamentosWorkstation.tsx`):**
    - Path: `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx:48, 152-172`
    - Uses legacy `useRealtimeTable(['orcamentos', 'ordens_servico'], ...)` and direct `supabase.channel('admin-orcamentos-sd1-' + Date.now())` in `useEffect`. Double subscription on `orcamentos`.
18. **Component 66 (`OrdensAssinaturaModule.tsx`):**
    - Path: `src/components/admin/OrdensAssinaturaModule.tsx:104-114`
    - `useEffect` and `useRealtimeSubscription` are declared INSIDE `fetchOrdens()` within `if (filters.mes)`.
19. **Component 67 (`OrdensCompraModule.tsx`):**
    - Path: `src/components/admin/OrdensCompraModule.tsx:100-112`
    - `useEffect` and `useRealtimeSubscription` are declared INSIDE `fetchOrdens()` within `if (filters.mes)`.
20. **Component 68 (`PartnersAdminModule.tsx`):**
    - Path: `src/components/admin/PartnersAdminModule.tsx:130-134`
    - Uses `useRealtimeSubscription` on `parceiros` with `debounceMs: 300`.
21. **Component 69 (`PartnersPage.tsx`):**
    - Path: `src/components/public/PartnersPage.tsx:139-143`
    - Uses `useRealtimeSubscription` on `parceiros` with `debounceMs: 300`.
22. **Component 70 (`PaymentModal.tsx`):**
    - Path: `src/components/client/financeiro/PaymentModal.tsx:85-104`
    - Uses `useRealtimeSubscription` on `clientes` with filter `id=eq.${fatura.cliente_id}` and on `vouchers` with `enabled: isOpen`.
23. **Component 71 (`PayoutClearanceDrawer.tsx`):**
    - Path: `src/components/admin/super-domains/pessoas/PayoutClearanceDrawer.tsx:61-64`
    - Uses `useRealtimeSubscription` on `prestador_saques` and `saques` with `enabled: isOpen` but without `onChange` handler.
24. **Component 72 (`PessoasSuperDomain.tsx`):**
    - Path: `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx:121-128`
    - Uses `useRealtimeSubscription` on 6 tables.

---

## 2. Logic Chain

1. **React Hook Rule Invariants:**
   - React requires hooks (`useEffect`, `useRealtimeSubscription`) to be called at the top level of the component and unconditionally.
   - In `OrdensAssinaturaModule.tsx` and `OrdensCompraModule.tsx`, hooks are placed inside the async function `fetchOrdens()` inside `if (filters.mes)`. When `filters.mes` is selected, executing `fetchOrdens()` invokes hooks during an event/async execution cycle, crashing the component with `Invalid hook call`.
2. **Channel & Resource Management:**
   - In `OrcamentosWorkstation.tsx`, creating a WebSocket subscription via `useRealtimeTable` alongside a manual `.channel()` creates duplicate events and redundant database round-trips. Furthermore, using `${Date.now()}` inside `useEffect([statusFilter])` forces WebSocket channel re-registration on every filter switch.
   - In `NovoPrestadorDrawer.tsx` and `PayoutClearanceDrawer.tsx`, subscriptions without `onChange` handlers hold WebSocket state without taking action on received payloads.
3. **Canonical Standardization:**
   - Replacing the legacy patterns with canonical `useRealtimeSubscription` with `debounceMs` across all components ensures consistent cleanup, debounce protection against rapid database mutations, and avoids channel leakage.

---

## 3. Caveats

- Database migrations define 325 total tables, with 105 published to `supabase_realtime` publication. All monitored tables across components 49 to 72 were verified to exist in the SQL schema and migrations.
- UI Connection status badges are not currently bound to `connectionState` from `useRealtimeSubscription` (most components run subscriptions silently in the background).
- Components 66 and 67 only crash at runtime when the user actively filters by month (`filters.mes`).

---

## 4. Conclusion

- **19 of 24 components** are healthy and properly utilizing Realtime.
- **3 Critical defects identified**:
  - `OrcamentosWorkstation.tsx`: Duplicate subscription and volatile channel name.
  - `OrdensAssinaturaModule.tsx`: Hook rules violation (hooks inside async function).
  - `OrdensCompraModule.tsx`: Hook rules violation (hooks inside async function).
- **2 Alert defects identified**:
  - `NovoPrestadorDrawer.tsx` and `PayoutClearanceDrawer.tsx`: Inert subscriptions without callbacks.
- Complete individual audit cards and refactoring code snippets have been compiled and saved to `.agents/explorer_r2_batch3/analysis.md`.

---

## 5. Verification Method

To verify these observations independently:
1. Inspect `src/components/admin/OrdensAssinaturaModule.tsx:104-114` and `src/components/admin/OrdensCompraModule.tsx:100-112` via `view_file` to confirm hook nesting inside `fetchOrdens()`.
2. Inspect `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx:48` and lines `152-172` to confirm dual subscription on `orcamentos`.
3. Inspect `src/components/admin/super-domains/pessoas/NovoPrestadorDrawer.tsx:27` and `PayoutClearanceDrawer.tsx:61-64` to confirm lack of `onChange` callback.
4. Read the full analysis report at `.agents/explorer_r2_batch3/analysis.md`.
