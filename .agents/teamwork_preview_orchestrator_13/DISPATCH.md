## 2026-08-27T21:25:14Z

TASK SUMMARY:
Implement a fully conversational WhatsApp flow (using the existing Gemini integration in the Evolution API webhook) that allows customers to request and redeem partner benefits directly via chat. The entire process must be an exact 1:1 replica of how it is done in the web system, utilizing the same backend functions, duplicate protections, and business rules.

Requirements:
- R1. Exact Parity with Web System Logic: Mirror `PartnerBenefitRedeemModal.tsx` and `redeemPartnerBenefit` (`service.ts`) logic exactly. Use the exact same Supabase RPCs/endpoints, SLA rules (`delay_24h` logic), and partner configurations (coupon vs link vs voucher).
- R2. Conversational NLU Intent & State Machine: Extend Gemini NLU in `server_webhook_vps_live.cjs` and `server_webhook.cjs` to handle a new `"resgatar"` intent with interactive fuzzy search across partners in Supabase.
- R3. Strict Duplicate Protection Enforcement: Collect customer Name, E-mail, Phone. Enforce duplicate redemption rule exactly as the web system (if rejected due to duplicate, prompt user for textual justification and re-submit with `forceOverride=true`, status `analise`).
- R4. Fulfillment & Automatic Coupons: For auto-approval/coupon partners, retrieve coupon from DB response and deliver immediately in chat.
- Acceptance Criteria & Automated Tests: Local test script `test_whatsapp_redemption.js` mocking WhatsApp webhook messages, validating exact Supabase RPC calls, duplicate rejection -> justification flow -> `analise` status, and auto-coupon delivery payload.
