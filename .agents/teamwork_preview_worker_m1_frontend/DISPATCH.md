# Dispatch for teamwork_preview_worker_m1_frontend

## Role: Worker (Frontend Remediation & Optimization)
Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m1_frontend
Project root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Original request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-11T00:26:34Z`
PROJECT document: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_22\PROJECT.md
Frontend Survey Report: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_frontend\handoff.md

## Exclusive Write Ownership
You exclusively own and may edit the following files:
1. `src/components/client/store/ProductPage.tsx`
2. `src/components/client/store/CheckoutPage.tsx`
3. `src/components/client/store/CartDrawer.tsx`
4. `src/components/admin/LojaTrocasModule.tsx`

Do NOT edit any test files or SQL files.

## Objectives & Detailed Tasks
1. Read `ORIGINAL_REQUEST.md` and `handoff.md` from the frontend explorer.
2. **Fix Variant Overwrite in Cart (`ProductPage.tsx`)**:
   - In authenticated mode (lines ~508-531) and guest mode (lines ~472-484), ensure the cart lookup matches both `item_id` AND `produto_variante_id`. Align with the canonical implementation in `ClientGSAStore.tsx:974-984` so that adding a second variant (e.g. Size G) does not overwrite an existing variant (e.g. Size M).
3. **Variant Stock Pre-Validation (`CheckoutPage.tsx` & `CartDrawer.tsx`)**:
   - In `CheckoutPage.tsx` (lines ~1030-1049) and `CartDrawer.tsx` (lines ~151-160), ensure that when an item has `produto_variante_id`, its specific variant stock is checked, rather than only the parent product's stock.
4. **Auto Cart Resync on RPC Out-of-Stock Exception (`CheckoutPage.tsx`)**:
   - In the catch block of `handleFinalizarCompra` (lines ~1190-1199), when an error occurs, invoke `fetchCartItems()` (or equivalent cart refresh) so that out-of-stock items or updated catalog state are immediately refreshed in the user's UI.
5. **Realtime & Pagination Stabilization (`LojaTrocasModule.tsx`)**:
   - In `LojaTrocasModule.tsx` (lines ~38-51), remove `search` from the Realtime channel subscription dependency array so the WebSocket channel is not destroyed and recreated on every keystroke. Keep search filtering either client-side or debounced.
   - Fix pagination: ensure changing `page` (lines ~362, 372) triggers `fetchSolicitacoes()` to properly reload data.
6. **Dead-Code & Warning Cleanup**:
   - In `CheckoutPage.tsx`, remove unused Lucide icon imports (`ChevronLeft`, `ChevronRight`, `Diamond`, `Lock`, `Building`, `RefreshCw`, `Plus`, `Minus`, `Sparkles`, `ExternalLink`).
   - In `ProductPage.tsx`, remove unused `Eye` icon import.
7. **Verification**:
   - Run `npx tsc --noEmit`
   - Run `npm run typecheck:strict`
   - Run `npm run build`
   - Ensure exit code 0 on all commands without new warnings or errors.
8. Document all edits and verification outputs in `handoff.md` in your working directory.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
