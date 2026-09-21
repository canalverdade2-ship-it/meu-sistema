## 2026-09-10T20:19:37Z
MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
specifically under header ## 2026-09-10T19:56:53Z.

Also read:
- .agents/teamwork_preview_explorer_19_cart/analysis.md
- .agents/teamwork_preview_explorer_19_returns/analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You exclusively own and may edit:
- src/components/client/store/CheckoutPage.tsx
- src/components/client/store/ProductPage.tsx
- src/components/client/ClientGSAStore.tsx
- src/components/admin/LojaTrocasModule.tsx
- src/components/admin/ReembolsosModule.tsx
- src/lib/pixService.ts
- src/utils/referral.ts
DO NOT modify any files in supabase/migrations/ (Worker 1 owns migrations).

IMPLEMENTATION TASKS:
1. `src/components/client/store/CheckoutPage.tsx`:
   - Match server discount precedence: percentage coupon applies to merchandise subtotal before points, delivery fee added, points deducted up to balance, wallet deducted.
   - When PIX is selected, pass PIX payment indicators / discount in checkout payload so the order is registered with the 5% discount.
2. `src/lib/pixService.ts`:
   - Ensure `createInfinitePayOrderCheckout` quotes and charges the actual PIX discounted amount rather than the un-discounted gross total.
3. `src/components/client/store/ProductPage.tsx`:
   - Fix cart item lookup and insertion when adding variants: ensure items are differentiated by `variant_id` / `variante_id` so adding multiple variants of the same product creates distinct line items rather than overwriting.
4. `src/components/client/ClientGSAStore.tsx`:
   - In coupon limit validation, treat `limite_usos = null` or `undefined` as unlimited rather than 0 so guests are not locked out of valid coupons.
5. `src/components/admin/LojaTrocasModule.tsx`:
   - Update "Concluir Devolução & Liberar Estorno" to invoke the secure RPC `gsa_admin_atualizar_solicitacao_loja` (with targetStatus 'concluido') rather than executing direct raw SQL updates on `loja_solicitacoes`.
6. `src/components/admin/ReembolsosModule.tsx`:
   - When approving or processing store refunds, invoke the secure RPC `gsa_admin_process_store_refund` so wallet crediting and financial ledger entries occur atomically.
7. `src/utils/referral.ts`:
   - Route wallet balance updates through the secure atomic RPC instead of direct `clientes.update`.
8. Run build/type check:
   Verify your changes with `npm test` or `npx vitest` on affected tests.
9. Document all implemented changes, commands run, and results in your `handoff.md`, and notify your parent via send_message.
