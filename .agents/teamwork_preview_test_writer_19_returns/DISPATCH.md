## 2026-09-10T20:10:21Z

You are teamwork_preview_test_writer_19_returns.
Your working directory is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_test_writer_19_returns
Your project root is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
specifically under header ## 2026-09-10T19:56:53Z.

Also read the Explorer handoffs and reports:
- .agents/teamwork_preview_explorer_19_returns/handoff.md
- .agents/teamwork_preview_explorer_19_db/handoff.md

YOUR MISSION:
Author comprehensive automated tests (using Vitest/TypeScript in src/tests/) and simulation scripts that test and verify:
1. Restocking on Returns & Cancellations:
   - When orders are cancelled, both parent `produtos` AND child `produto_variantes` must have their `estoque_disponivel` restored.
   - When returns reach 'concluido', the returned goods must be returned to inventory (`produtos` and `produto_variantes`).
2. Exchange Item Reservation & Stock Balance:
   - When an exchange is requested and approved, the substitute item must be deducted/reserved from inventory.
3. Atomic Refund Flow:
   - Verifying that marking a return as 'concluido' generates a refund record in `loja_reembolsos` or credits `clientes.saldo_carteira` atomically.
4. Loyalty & Referral Bonus Reversal:
   - Verifying that upon order cancellation or return, earned points and referral bonuses granted for the purchase are reversed/clawed back, preventing buy-and-cancel exploit loops.
5. Partial Return Proportional Apportionment:
   - Verifying that returning a single item from an order with coupons, promotions, or points apportions the discount proportionally rather than refunding full gross price.
6. Authorization & RLS:
   - Verifying that non-admin clients cannot directly forge `loja_solicitacoes.status = 'concluido'`.

Create the test file(s) in `src/tests/` (for example `src/tests/marketplace-returns-exchanges-atomicity.test.ts`).
Ensure tests are syntactically valid TypeScript and well-structured with Vitest.
Do NOT modify existing application source code in `src/components` or `supabase/migrations` (the Workers will implement the fixes).
Write your completion report in:
.agents/teamwork_preview_test_writer_19_returns/handoff.md
and notify your parent when complete via send_message.
