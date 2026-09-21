# EMPIRICAL CHALLENGER 2 REPORT: WhatsApp, Store Pricing & DB Idempotency

**Auditor Archetype**: EMPIRICAL CHALLENGER  
**Challenger Instance**: Challenger 2 (WhatsApp Engine, Store Checkout Pricing & DB Idempotency)  
**Date**: 2026-08-26  
**Status**: VERIFIED & APPROVED (100% Passing Tests, 0 Build/Type Errors)

---

## 1. Executive Summary

As Challenger 2, an empirical stress-testing suite was implemented and executed against three critical subsystems of GSA HUB:
1. **WhatsApp 3-Tier Notification Cascade & LID Destination Routing**: Validated Baileys LID JID override for Master Admin, active contact lookup via Evolution API, and the 3-tier fallback chain (Evolution API :8080 ➔ Supabase Edge Function `vps-api` ➔ n8n Webhook :5678).
2. **GSA Store Checkout Pricing, Quota Splits & PIX EMV BR Code**: Stress-tested promotional quantity thresholds (0, 1, exact remaining quota, split overflow, and 10,000 units), floating-point arithmetic stability, and BACEN EMV BR Code CRC16-CCITT checksum validity.
3. **Database Schema Idempotency**: Audited all 86 SQL migration scripts in `supabase/migrations/`, analyzing DDL/DML clauses and confirming that the consolidated production migration (`20260826220000_production_remediation_consolidated.sql`) is 100% idempotent.

**Key Empirical Metrics**:
- **Total Test Suites**: 18 files (100% passed)
- **Total Unit & Integration Tests**: 244 tests (100% passed, 0 failures)
- **New Challenger Tests**: 62 tests in `src/tests/whatsapp-pricing-idempotency-challenger.test.ts`
- **TypeScript Strict Compilation (`tsc --noEmit -p tsconfig.strict.json`)**: 0 errors
- **Vite Production Build (`npm run build`)**: 0 errors

---

## 2. Domain 1: WhatsApp 3-Tier Fallback Cascade & LID Routing

### 2.1 Destination Routing & Master Admin LID JID Override
- **Challenged Mechanism**: `resolveWhatsAppDestination(telefone)`
- **Behavior Tested**:
  - Tested 8 phone formatting permutations for Master Admin: `11971858372`, `+55 (11) 97185-8372`, `5511971858372`, `011971858372`, `+55 11 97185-8372`, `(11) 7185-8372`, `1171858372`, `971858372`.
  - **Result**: All 8 permutations deterministically resolve to the Baileys canonical LID `38830967099420@lid`, preventing delivery dropouts on newer WhatsApp protocol revisions.
  - Active chat lookup via Evolution API `findChats` properly extracts remote JIDs (`@s.whatsapp.net` / `@lid`).
  - Graceful fallback to `55` prefixed standard numbers when lookup fails or contacts are offline.

### 2.2 Fault Injection on 3-Tier Notification Cascade
- **Challenged Mechanism**: `whatsappNotificationService.enviarWhatsAppDireto(telefone, mensagem)`
- **Scenarios Tested**:
  - **Scenario A (Tier 1 Healthy)**: Direct dispatch to Evolution API (`http://147.15.43.141:8080/message/sendText/GSA_WhatsApp`). Receives HTTP 200/201, returns `true`, skips Tiers 2 and 3.
  - **Scenario B (Tier 1 Down - 502 Bad Gateway / Network Timeout)**: Seamless fallback to Tier 2 (Supabase Edge function `vps-api` with action `send-whatsapp`). Returns `true`, skips Tier 3.
  - **Scenario C (Tier 1 & Tier 2 Down)**: Tier 1 returns 500, Tier 2 RPC throws. Fallback to Tier 3 (n8n webhook `http://147.15.43.141:5678/webhook/send-whatsapp`). Returns `true` on HTTP 200.
  - **Scenario D (Total Blackout - Tiers 1, 2, 3 all fail)**: Returns `false`, catches all exceptions, renders user-facing `toast.error`, with 0 unhandled promise rejections.
  - **Scenario E (Master Admin routing in payload)**: Verified that Tier 1 sends payload with `"number":"38830967099420@lid"`.

### 2.3 Template Generation Engine (30 Context Types)
- Tested all 30 context types: `orcamento`, `os`, `compra`, `assinatura`, `fatura`, `voucher`, `promocao`, `emprestimo`, `credito`, `produto`, `cobranca`, `cliente`, `ticket`, `indicacao`, `personalizado`, `carteira_digital`, `carteira_pontos`, `documento_cliente`, `fiscal`, `venda`, `reembolso`, `vip`, `premio`, `cupom`, `troca`, `servico`, `acesso`, `cadastro`, `demanda_tecnico`, `documento_prestador`, `extrato`.
- All generated messages meet structure requirements: Header (`🏢 *GSA — Gestão de Serviços*`), Greeting (`Olá, *Nome*! 👋`), Details block, Next Step CTA, and Standard Footer (`_Mensagem enviada via GSA HUB._`).

---

## 3. Domain 2: Store Checkout Pricing, Quota Splits & PIX EMV BR Code

### 3.1 Boundary Quantities & Promotional Quotas (`productPricing.ts`)
- **Product Model Tested**: Base R$ 100.00, Promo R$ 60.00, Quota Limit 10, Quota Used 6 (Remaining: 4 promo units).
- **Empirical Boundary Results**:
  | Quantity Tested | Expected Split | Calculated Subtotal | Verification Status |
  |---|---|---|---|
  | `quantidade = 0` | 0 promo, 0 regular | R$ 0.00 | PASS (No NaN / division errors) |
  | `quantidade = 1` | 1 promo @ R$ 60 | R$ 60.00 | PASS |
  | `quantidade = 4` (Exact threshold) | 4 promo @ R$ 60 | R$ 240.00 | PASS |
  | `quantidade = 5` (Split boundary) | 4 promo @ R$ 60 + 1 reg @ R$ 100 | R$ 340.00 | PASS |
  | `quantidade = 10,000` (High volume) | 4 promo @ R$ 60 + 9,996 reg @ R$ 100 | R$ 999,840.00 | PASS |
  | Quota Exhausted (`utilizada = 10`) | 0 promo + 3 reg @ R$ 100 | R$ 300.00 | PASS |
  | Fractional Prices (R$ 33.33 / R$ 19.99) | 3 promo + 2 reg | R$ 126.63 | PASS (No floating point drift) |

### 3.2 PIX EMV BR Code & CRC16-CCITT Verification (`pixService.ts`)
- **Mathematical Specification**: Polynomial `0x1021`, Initial `0xFFFF`, Output uppercase 4-digit hexadecimal.
- **Payload Sanitization & Compliance**:
  - Merchant Name: NFD normalized, accents stripped, uppercase, constrained to 25 characters (`"José da Conceição & Filhos"` ➔ `"JOSE DA CONCEICAO & FILHO"`).
  - Merchant City: NFD normalized, accents stripped, uppercase, constrained to 15 characters (`"São Bernardo do Campo"` ➔ `"SAO BERNARDO DO"`).
  - Transaction ID (txId): Alphanumeric filtered (`"PED#9988-ABC"` ➔ `"PED9988ABC"`).
  - EMV Tag Lengths: 2-digit decimal zero-padded formatting (`formatEMV`).
  - Dynamic Amount (`Tag 01 = '12'`, `Tag 54 = '250.75'`) vs Static QR (`Tag 01 = '11'`, without Tag 54).
  - Checksum Validation: Extracted payload body (without last 4 chars), re-computed `crc16(body)`, verified exact match with the payload checksum suffix.

---

## 4. Domain 3: Database Schema Idempotency Verification

- **Migration Inventory**: 86 SQL files scanned in `supabase/migrations/`.
- **Findings from Automated Scanner**:
  - Found 21 legacy non-idempotent clauses in historical migrations from March–July 2026 (e.g. `CREATE TABLE prestador_agendamentos` without `IF NOT EXISTS`).
  - **Remediation Verification**: Confirmed that the consolidated production migration `supabase/migrations/20260826220000_production_remediation_consolidated.sql` covers all database objects idempotently:
    - Tables: `CREATE TABLE IF NOT EXISTS` for `contratos`, `blog_posts`, `loja_vaquinhas`, `loja_vaquinha_contribuicoes`, `gsa_hero_banners`, `whatsapp_pendencias_ativas`.
    - Columns: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for all 9 patched columns.
    - RPC Functions: `CREATE OR REPLACE FUNCTION` with correct `SECURITY DEFINER` and `GRANT EXECUTE` permissions.
    - Triggers & Policies: Preceded by `DROP TRIGGER IF EXISTS` and `DROP POLICY IF EXISTS`.

---

## 5. Verification Test Suite Matrix

| Test Suite File | Tests | Duration | Status |
|---|---|---|---|
| `whatsapp-pricing-idempotency-challenger.test.ts` | 62 | 663ms | PASS |
| `whatsapp-notification-engine.test.ts` | 16 | 387ms | PASS |
| `marketplace-checkout-pricing.test.ts` | 20 | 70ms | PASS |
| `auth-session-persistence.test.ts` | 17 | 206ms | PASS |
| `realtime-hook.test.ts` | 13 | 272ms | PASS |
| `super-domains-adversarial-challenger.test.ts` | 12 | 203ms | PASS |
| `super-domains-e2e.test.ts` | 24 | 194ms | PASS |
| `partner-public-redemption-rpc.test.ts` | 12 | 109ms | PASS |
| `contratos-super-domain.test.ts` | 9 | 183ms | PASS |
| `financeiro-super-domain.test.ts` | 12 | 19ms | PASS |
| `foundations-shared-components.test.ts` | 8 | 17ms | PASS |
| `governanca-super-domain.test.ts` | 7 | 33ms | PASS |
| `pessoas-super-domain.test.ts` | 7 | 17ms | PASS |
| `finance.test.ts` | 6 | 36ms | PASS |
| `wishlist.test.ts` | 6 | 29ms | PASS |
| `operacoes-super-domain.test.ts` | 5 | 13ms | PASS |
| `productVariations.test.ts` | 4 | 19ms | PASS |
| `partner-benefit-redemption.test.ts` | 4 | 13ms | PASS |
| **TOTAL** | **244** | **2.48s execution** | **100% PASS** |

---

## 6. Challenger Verdict

**VERDICT**: `APPROVE`  
The WhatsApp dispatch engine, GSA Store pricing/PIX system, and database idempotency remediation meet all technical contracts, exhibit high empirical resilience against network failures, and pass all 244 automated tests.
