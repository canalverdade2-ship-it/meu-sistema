## 2026-08-28T14:17:04Z
You are Worker R2 (Hook Rules & Ghost Tables Remediation) for Realtime P0 Critical Remediation.
Your working directory is: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r2`
Original request: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`
Project master: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md`
Explorer Handoff: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_survey_1\handoff.md`

Your Exclusive File Ownership:
- `src/components/admin/ProdutosModule.tsx`
- `src/components/admin/OrdensAssinaturaModule.tsx`
- `src/components/admin/OrdensCompraModule.tsx`
- `src/components/admin/AdvertisingAdminModule.tsx`
- `src/components/admin/ServicePackagesModule.tsx`
- `src/components/sections/TrabalheConoscoSection.tsx`
- `src/components/admin/CareersAdminModule.tsx`
- `src/components/admin/PessoasSuperDomain.tsx`

Your Tasks:
1. Fix Hook Rules Violations:
   - `src/components/admin/ProdutosModule.tsx`: Move `useEffect` and `useRealtimeSubscription` out of async `fetchProdutos` to top-level.
   - `src/components/admin/OrdensAssinaturaModule.tsx`: Move `useEffect` and `useRealtimeSubscription` out of `if (filters.mes)` inside async `fetchOrdens` to top-level.
   - `src/components/admin/OrdensCompraModule.tsx`: Move `useEffect` and `useRealtimeSubscription` out of `if (filters.mes)` inside async `fetchOrdens` to top-level.
2. Fix Ghost Tables:
   - `src/components/admin/AdvertisingAdminModule.tsx`: Replace ghost `advertising_*` tables with real `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_payments`, `gsa_ad_placements`.
   - `src/components/admin/ServicePackagesModule.tsx`: Replace ghost `catalog_packages` and `catalog_services` with real `servicos_pacotes` and `servicos`.
   - `src/components/sections/TrabalheConoscoSection.tsx`: Replace ghost `career_applications` and `trabalhe_conosco` with real `gsa_careers_applications`.
   - `src/components/admin/CareersAdminModule.tsx`: Clean up ghost table references, keeping `gsa_careers_applications`.
   - `src/components/admin/PessoasSuperDomain.tsx`: Replace ghost `career_applications` with `gsa_careers_applications`.
3. Verify syntax and types with `npx tsc --noEmit`.
