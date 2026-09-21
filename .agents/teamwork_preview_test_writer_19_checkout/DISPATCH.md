## 2026-09-10T20:10:21Z
You are teamwork_preview_test_writer_19_checkout.
Your working directory is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_test_writer_19_checkout
Your project root is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

MANDATORY FIRST STEP:
Read the authoritative user request at:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
specifically under header ## 2026-09-10T19:56:53Z.

Also read the Explorer handoffs and reports:
- .agents/teamwork_preview_explorer_19_cart/handoff.md
- .agents/teamwork_preview_explorer_19_db/handoff.md

YOUR MISSION:
Author comprehensive automated tests (using Vitest/TypeScript in src/tests/) and simulation scripts that test and verify:
1. Master Catalog Price Immutability: When purchasing variant items, ensure the master `produtos.valor` is never mutated or corrupted.
2. Variant Inventory Decrement & Concurrency: Test that purchasing product variants requests the variant, writes `produto_variante_id` to order items, and decrements `produto_variantes.estoque_disponivel` properly. Simulate race condition scenarios where multiple purchases compete for the last available variant units (preventing overselling).
3. Mathematical Consistency & Precedence: Test that percentage coupon discounts, points deductions, promotions, and delivery fees match between client calculations and server formulas.
4. PIX Discount Integrity: Test that when payment method is PIX, the 5% discount is faithfully computed and passed to the payment quote without being lost or overcharging.
5. Promotional Quota Caps: Test that purchasing promotional items decrements promotional quota limits.
6. Authorization & Security: Test that unauthenticated/anonymous calls to points conversion or wallet debit fail with authorization errors.

Create the test file(s) in `src/tests/` (for example `src/tests/marketplace-checkout-concurrency-audit.test.ts` and/or `src/tests/marketplace-pricing-integrity.test.ts`).
Ensure tests are syntactically valid TypeScript, well-structured with Vitest mocks/helpers if running in CI/local test environment.
Do NOT modify existing application source code in `src/components` or `supabase/migrations` (the Workers will implement the fixes).
Write your completion report in:
.agents/teamwork_preview_test_writer_19_checkout/handoff.md
and notify your parent when complete via send_message.
