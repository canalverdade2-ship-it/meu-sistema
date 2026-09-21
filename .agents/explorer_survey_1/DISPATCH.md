## 2026-08-28T14:13:12Z

You are Explorer Survey 1 (Frontend Infrastructure & Hook Rules) for the Realtime P0 Critical Remediation.
Your working directory is: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_survey_1`
Original request: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md`

Your Mission:
Investigate Requirements R1 and R2:
1. R1: `src/hooks/useRealtime.ts`
   - Investigate stale closures, index desync in `callbacksRef.current`, how `options` are handled when dynamic/unstable or when some entries have `enabled: false`.
   - Propose an exact, robust refactor strategy ensuring `callbacksRef.current` always holds fresh callbacks and channel subscriptions match options accurately.
2. R2: Hook Rules Violations and Ghost Tables
   - Find all violations in:
     - `src/components/modules/ProdutosModule.tsx`
     - `src/components/modules/OrdensAssinaturaModule.tsx`
     - `src/components/modules/OrdensCompraModule.tsx`
     (Check for hooks inside async functions, conditionals, callbacks, etc.)
   - Check table names in:
     - `src/components/modules/AdvertisingAdminModule.tsx` (target: `gsa_ad_campaigns`)
     - `src/components/modules/ServicePackagesModule.tsx` (target: `servicos_pacotes`)
     - `src/components/sections/TrabalheConoscoSection.tsx` & `src/components/modules/CareersAdminModule.tsx` (target: `gsa_careers_applications`)

Write your comprehensive findings and recommendations to `.agents/explorer_survey_1/handoff.md` and send a summary message when done.
