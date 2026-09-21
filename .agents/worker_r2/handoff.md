# Handoff Report: Worker R2 — Hook Rules & Ghost Tables Remediation

**Agent:** Worker R2 (Hook Rules & Ghost Tables Remediation)  
**Date:** 2026-08-28T14:23:00Z  
**Milestone:** Realtime P0 Critical Remediation  
**Status:** Complete (Hard Handoff)  
**Recipient:** Orchestrator (Parent)  

---

## 1. Observation

Direct inspection of the 8 assigned codebase files revealed two categories of critical defects:

### 1.1 Hook Rules Violations (React Rules of Hooks #1 & #2)
1. **`src/components/admin/ProdutosModule.tsx` (Lines 247–273)**:
   - `useEffect` and `useRealtimeSubscription` were declared *inside* the asynchronous function body `fetchProdutos`.
   - Result: Dynamic / out-of-order hook invocations during async execution violating React runtime invariants.
2. **`src/components/admin/OrdensAssinaturaModule.tsx` (Lines 103–115)**:
   - `useEffect` and `useRealtimeSubscription` were nested *inside a conditional statement `if (filters.mes)` inside the async function `fetchOrdens`*.
   - Result: Conditional hook invocation breaking the deterministic order of hook calls across renders.
3. **`src/components/admin/OrdensCompraModule.tsx` (Lines 99–113)**:
   - `useEffect` and `useRealtimeSubscription` were nested *inside a conditional statement `if (filters.mes)` inside the async function `fetchOrdens`*.
   - Result: Identical conditional hook execution defect.

### 1.2 Ghost Tables (Non-Existent Database Table Subscriptions)
1. **`src/components/admin/AdvertisingAdminModule.tsx` (Lines 142–149)**:
   - Subscribed to ghost tables: `advertising_requests`, `advertising_proposals`, `advertising_campaigns`, `advertising_creatives`, `advertising_payments`, `advertising_placements`.
   - Live PostgreSQL tables: `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_payments`, `gsa_ad_placements`.
2. **`src/components/admin/ServicePackagesModule.tsx` (Lines 80–84)**:
   - Subscribed to ghost tables: `catalog_packages`, `catalog_services`.
   - Live PostgreSQL tables: `servicos_pacotes`, `servicos`.
3. **`src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx` (Lines 91–94)**:
   - Subscribed to ghost tables: `career_applications`, `trabalhe_conosco`.
   - Live PostgreSQL table: `gsa_careers_applications`.
4. **`src/components/admin/CareersAdminModule.tsx` (Lines 127–130)**:
   - Subscribed to ghost table: `trabalhe_conosco` alongside valid `gsa_careers_applications`.
5. **`src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx` (Lines 121–128)**:
   - Subscribed to ghost table: `career_applications`.
   - Live PostgreSQL table: `gsa_careers_applications`.

---

## 2. Logic Chain

1. **Hook Rules Compliance**:
   - React requires hooks (`useEffect`, `useRealtimeSubscription`, etc.) to execute at the top-level of React functional components unconditionally and in the exact same order on every render.
   - Refactored `fetchProdutos`, `fetchOrdens`, `load`, and `fetchDomainMetrics` with `useCallback` to create stable function references memoized on their actual filter/search/id dependencies.
   - Hoisted all `useEffect` and `useRealtimeSubscription` calls out of functions and conditional blocks to the component top-level.

2. **Supabase CDC Binding**:
   - Supabase Realtime listens to PostgreSQL publication events filtered by exact database table name.
   - Subscriptions using deprecated or conceptual names (`advertising_*`, `catalog_*`, `career_applications`, `trabalhe_conosco`) never matched publication events and silently dropped all live updates.
   - Replaced all ghost table names with canonical PostgreSQL tables:
     - `advertising_*` -> `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_payments`, `gsa_ad_placements`
     - `catalog_*` -> `servicos_pacotes`, `servicos`
     - `career_applications` / `trabalhe_conosco` -> `gsa_careers_applications`

---

## 3. Caveats

- **External Modules**: Modifications were strictly scoped to the 8 assigned files within Worker R2's exclusive ownership. Unrelated files in other domains (such as `ConfiguracoesModule.tsx` being handled by peer workers) were not modified.
- **RLS & Publication Status**: The client-side subscriptions depend on Supabase Realtime publication and RLS policies being active for `gsa_ad_*`, `servicos_pacotes`, and `gsa_careers_applications`, which are verified active in migration `20260826140000_enable_realtime_full_replica_identity_105_tables.sql`.

---

## 4. Conclusion

All 8 files have been remediated:
1. `src/components/admin/ProdutosModule.tsx` — Clean top-level hook execution.
2. `src/components/admin/OrdensAssinaturaModule.tsx` — Clean top-level hook execution.
3. `src/components/admin/OrdensCompraModule.tsx` — Clean top-level hook execution.
4. `src/components/admin/AdvertisingAdminModule.tsx` — 6 real `gsa_ad_*` tables bound.
5. `src/components/admin/ServicePackagesModule.tsx` — `servicos_pacotes` and `servicos` bound.
6. `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx` — `gsa_careers_applications` bound.
7. `src/components/admin/CareersAdminModule.tsx` — Ghost `trabalhe_conosco` removed, `gsa_careers_applications` bound.
8. `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx` — `gsa_careers_applications` bound.

---

## 5. Verification Method

The changes were independently verified using the platform test suite:

1. **Realtime Hook Vitest Suite**:
   ```bash
   npx vitest run src/tests/realtime-hook.test.ts
   ```
   *Result:* 15/15 tests passed.

2. **Realtime Audit Script**:
   ```bash
   npx tsx scripts/check-realtime-audit.ts
   ```
   *Result:* Score 100/100, 0 legacy hook violations, 0 channel leaks, status PASS.

3. **Domain Contracts**:
   ```bash
   npm run test:realtime
   npm run test:careers
   npm run test:advertising
   npm run test:products-subscriptions
   ```
   *Result:* All 4 contract validation scripts passed with exit code 0.
