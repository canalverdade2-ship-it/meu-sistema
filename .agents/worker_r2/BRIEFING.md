# BRIEFING — 2026-08-28T14:23:00Z

## Mission
Fix Hook Rules Violations and Ghost Table references across 8 assigned React components in the admin and sections domains.

## 🔒 My Identity
- Archetype: implementer / qa
- Roles: implementer, qa
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r2
- Original parent: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Milestone: Realtime P0 Critical Remediation - Worker R2

## 🔒 Key Constraints
- Exclusive file ownership strictly enforced:
  - `src/components/admin/ProdutosModule.tsx`
  - `src/components/admin/OrdensAssinaturaModule.tsx`
  - `src/components/admin/OrdensCompraModule.tsx`
  - `src/components/admin/AdvertisingAdminModule.tsx`
  - `src/components/admin/ServicePackagesModule.tsx`
  - `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx`
  - `src/components/admin/CareersAdminModule.tsx`
  - `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx`
- Do not edit any files outside this exclusive list.
- Integrity mandate: genuine implementation, zero cheats.

## Current Parent
- Conversation ID: 32a3dc27-e36c-44d7-8ed4-458cfaac60fb
- Updated: 2026-08-28T14:23:00Z

## Task Summary
- **What to build**:
  1. Fix hook rules violations in ProdutosModule, OrdensAssinaturaModule, OrdensCompraModule (move `useEffect` and `useRealtimeSubscription` to top-level).
  2. Fix ghost tables in AdvertisingAdminModule, ServicePackagesModule, TrabalheConoscoSection, CareersAdminModule, PessoasSuperDomain.
  3. Verify clean compilation and contract tests pass.
- **Success criteria**: Zero hook rule errors, correct database table bindings, all realtime contracts and unit tests pass.

## Change Tracker
- **Files modified**:
  - `src/components/admin/ProdutosModule.tsx`: Moved `useEffect` and `useRealtimeSubscription` out of async `fetchProdutos` to component top-level; wrapped `fetchProdutos` in `useCallback`.
  - `src/components/admin/OrdensAssinaturaModule.tsx`: Moved `useEffect` and `useRealtimeSubscription` out of `if (filters.mes)` inside `fetchOrdens` to component top-level; wrapped `fetchOrdens` in `useCallback`.
  - `src/components/admin/OrdensCompraModule.tsx`: Moved `useEffect` and `useRealtimeSubscription` out of `if (filters.mes)` inside `fetchOrdens` to component top-level; wrapped `fetchOrdens` in `useCallback`.
  - `src/components/admin/AdvertisingAdminModule.tsx`: Replaced ghost `advertising_*` tables with real `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_payments`, `gsa_ad_placements`.
  - `src/components/admin/ServicePackagesModule.tsx`: Replaced ghost `catalog_packages` and `catalog_services` with real `servicos_pacotes` and `servicos`; wrapped `load` in `useCallback`.
  - `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx`: Replaced ghost `career_applications` and `trabalhe_conosco` with real `gsa_careers_applications`.
  - `src/components/admin/CareersAdminModule.tsx`: Cleaned up ghost table `trabalhe_conosco`, maintaining `gsa_careers_applications`.
  - `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx`: Replaced ghost `career_applications` with real `gsa_careers_applications`; wrapped `fetchDomainMetrics` in `useCallback`.
- **Build status**: Pass (`check-realtime-audit.ts` score 100/100, `realtime-hook.test.ts` 15/15 pass, `test:realtime` OK, `test:careers` OK, `test:advertising` OK, `test:products-subscriptions` OK).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: All 15 Realtime Hook unit tests and domain contracts passed.
- **Lint status**: Zero hook rule errors in all 8 owned components.
- **Tests added/modified**: Verified against `src/tests/realtime-hook.test.ts` and automated audit scripts.
