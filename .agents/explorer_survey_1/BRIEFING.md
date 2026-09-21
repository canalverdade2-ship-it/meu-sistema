# BRIEFING — 2026-08-28T14:16:20Z

## Mission
Investigate R1 (useRealtime hook infrastructure, stale closures, subscription lifecycle) and R2 (Hook rules violations and ghost tables) to produce an authoritative remediation plan and handoff.

## 🔒 My Identity
- Archetype: explorer
- Roles: Frontend Infrastructure & Hook Rules Survey Explorer
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_survey_1
- Original parent: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Milestone: Realtime P0 Critical Remediation - Survey 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement source code modifications in project files directly.
- All proposals, diffs, and findings must be written to `.agents/explorer_survey_1/handoff.md`.

## Current Parent
- Conversation ID: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Updated: 2026-08-28T14:16:20Z

## Investigation State
- **Explored paths**:
  - `src/hooks/useRealtime.ts`
  - `src/hooks/useRealtimeTable.ts`
  - `src/lib/supabaseRealtime.ts`
  - `src/components/admin/ProdutosModule.tsx`
  - `src/components/admin/OrdensAssinaturaModule.tsx`
  - `src/components/admin/OrdensCompraModule.tsx`
  - `src/components/admin/AdvertisingAdminModule.tsx`
  - `src/components/admin/ServicePackagesModule.tsx`
  - `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx`
  - `src/components/admin/CareersAdminModule.tsx`
  - `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx`
  - `scripts/check-realtime-audit.ts`
  - `scripts/audit_realtime_report.md`
- **Key findings**:
  - R1: Stale closures in `callbacksRef.current` due to `rawConfigs` memoization omitting function dependencies.
  - R1: Index desync when tables have `enabled: false` because `enabledConfigs` filter resets index `idx` to 0..N-1 while `callbacksRef` holds all raw config indices.
  - R1: `useRealtime` shorthand dropped `deps` parameter on single-table calls.
  - R2: `ProdutosModule.tsx` had `useEffect` and `useRealtimeSubscription` inside async `fetchProdutos`.
  - R2: `OrdensAssinaturaModule.tsx` and `OrdensCompraModule.tsx` had `useEffect` and `useRealtimeSubscription` inside `if (filters.mes)` inside async `fetchOrdens`.
  - R2: Ghost tables mapped in `AdvertisingAdminModule` (6 tables with `advertising_*` -> `gsa_ad_*`), `ServicePackagesModule` (`catalog_*` -> `servicos_pacotes`), `TrabalheConoscoSection` (`career_applications`, `trabalhe_conosco` -> `gsa_careers_applications`), `CareersAdminModule` (`trabalhe_conosco` removed).
- **Unexplored areas**: None for R1 and R2 scope.

## Key Decisions Made
- Fully authored exact drop-in replacement code for `src/hooks/useRealtime.ts` preserving original indices and normalizing incoming options on every render.
- Formulated exact refactoring blueprints for the 3 hook-violating modules and 4 ghost-table components.
- Documented all findings in `.agents/explorer_survey_1/handoff.md`.

## Artifact Index
- `.agents/explorer_survey_1/handoff.md` — Final 5-component handoff report
- `.agents/explorer_survey_1/progress.md` — Liveness and progress tracker
- `.agents/explorer_survey_1/DISPATCH.md` — Inbound instructions log
