# Handoff Report — survey_spec_miner_1

## 1. Observation
1. **Frontend Modal (`src/components/public/PartnerBenefitRedeemModal.tsx`)**:
   - Lines 75–93: Validates inputs (`nomeCompleto.length >= 3`, `emailRegex`, `cleanPhone.length >= 10`).
   - Lines 96–105: Calls `redeemPartnerBenefit` with `parceiroId`, `parceiroSlug`, `nomeCompleto`, `email`, `telefone`, `clienteId`, `justificativaDuplicidade`, `forceOverride`.
   - Lines 117–129: Catches 409 duplicate errors (`err?.status === 409`, `'duplicidade'`, `'já resgatou'`), setting `showDuplicatePopup = true`.
   - Lines 177–237: Displays the duplicate justification UI and collects `justificativa`, resubmitting with `forceOverride: !!justificativa`.
   - Lines 431–649: Displays 24h SLA / 48h analysis screen (`status === 'analise'` or `isDelay24h`), protocol code `PROT-RES-YYYY-XXXXXX`, 3-step progress (1. Registrado, 2. Emissão, 3. WhatsApp), and links to `/consulta-protocolo?codigo=...`.
   - Lines 651–773: Displays immediate fulfillment screen (coupon code with copy button, partner link, instructions).

2. **Service Layer (`src/features/partners/service.ts`)**:
   - Lines 212–220: When `!payload.forceOverride && payload.parceiroId`, invokes `checkDuplicateRedemption(payload.parceiroId, payload.email, payload.telefone)`. If duplicate exists, throws `new Error('409 - Duplicidade: Cliente já possui um resgate para este parceiro.')` with `error.status = 409`.
   - Lines 222–246: Calls `supabase.rpc('gsa_public_resgatar_beneficio_parceiro', rpcParams)`. If legacy signature error `PGRST202` occurs, automatically retries without `p_email`.
   - Lines 251–258: If `payload.forceOverride && payload.justificativaDuplicidade && result?.resgate_id`, executes `supabase.from('parceiros_resgates').update({ alerta_duplicidade: true, justificativa_duplicidade: payload.justificativaDuplicidade, status: 'analise' })` and sets `result.status = 'analise'`.
   - Lines 263–277: Calculates `isDelay24h = Boolean(result?.delay_24h || (!has_coupon && !has_voucher && !has_link))`.
   - Lines 279–287: Generates or confirms protocol `PROT-RES-YYYY-XXXXXX` and updates `parceiros_resgates`.
   - Lines 289–347: Dispatches WhatsApp messages to customer and admin notification (`sendAdminWhatsAppNotification`) when `isDelay24h = true`, or immediate WhatsApp when `isDelay24h = false`.
   - Lines 617–641: `checkDuplicateRedemption` checks `parceiros_resgates` for matching `parceiro_id` and (`email` or `telefone`), filtering out `.neq('status', 'recusado')`.
   - Lines 376–498: `completePartnerRedemption` validates `linkAtivacao`, updates status to `'concluido'`, records `data_ativacao`, and sends activation WhatsApp with media image.
   - Lines 643–679: `approveRedemption` updates status to `'pendente'`, and `rejectRedemption` updates status to `'recusado'` with `motivo_recusa` and sends WhatsApp explanation to customer.

3. **Database Migrations & RPCs (`supabase/migrations/20260826220000_production_remediation_consolidated.sql` & `20260827180000_public_protocol_consultation.sql`)**:
   - Lines 272–386: `gsa_public_resgatar_beneficio_parceiro(p_parceiro_id, p_parceiro_slug, p_nome_completo, p_telefone, p_cliente_id, p_email)` validates `v_nome >= 2`, `v_clean_phone >= 10`, generates protocol `PROT-RES-YYYY-XXXXXX` using `md5(random() || clock_timestamp())`, inserts into `parceiros_resgates` with status `'pendente'`, and returns JSONB with all partner and redemption fields.
   - Granted to `anon`, `authenticated`, and `service_role`.

4. **Automated Test Suites**:
   - `src/tests/partner-public-redemption-rpc.test.ts`, `src/tests/partner-redemption-edge-cases.test.ts`, `src/tests/adversarial-business-logic-challenger.test.ts`.

## 2. Logic Chain
- Step 1: In the web system, partner redemption begins with `PartnerBenefitRedeemModal.tsx` capturing client inputs (`nomeCompleto`, `email`, `telefone`) and dispatching to `redeemPartnerBenefit`.
- Step 2: `service.ts:redeemPartnerBenefit` protects against duplicate requests by querying `parceiros_resgates` for active non-rejected records with the same `parceiro_id` and `email` or `telefone`.
- Step 3: When a duplicate is detected and `forceOverride` is not set, a 409 error triggers the duplicate popup in the modal, prompting the user for an explanation (`justificativa`).
- Step 4: Resubmitting with a justification sets `forceOverride: true`. The backend inserts the record via `gsa_public_resgatar_beneficio_parceiro`, after which `service.ts` updates the record to `status = 'analise'`, `alerta_duplicidade = true`, and stores `justificativa_duplicidade`.
- Step 5: For partners configured with `redemption_delay_24h = true` (or when in `analise` status), a 24h SLA notice is sent to the client and an alert is sent to Admin Master (`5511971858372`). For immediate coupon/link partners without delay, fulfillment data is delivered instantly.
- Step 6: The conversational WhatsApp bot must replicate this exact flow step-by-step to maintain 1:1 behavioral parity with the web application.

## 3. Caveats
- No caveats. The entire frontend modal, service layer, RPC definitions, schema migrations, and test cases were thoroughly inspected and verified directly in the project codebase.

## 4. Conclusion
The web partner benefit redemption system is completely mapped and documented in `.agents/survey_spec_miner_1/spec_report.md`. The WhatsApp conversational agent can achieve exact 1:1 parity by adopting the canonical 6-parameter RPC signature (`gsa_public_resgatar_beneficio_parceiro`), replicating the duplicate check with justification override to `'analise'`, applying the identical SLA routing rules (`isDelay24h`), and delivering immediate coupon/link payloads when `delay_24h = false`.

## 5. Verification Method
1. Inspect the full specification report:
   `view_file` on `.agents/survey_spec_miner_1/spec_report.md`
2. Run existing automated redemption tests:
   `npm run test -- src/tests/partner-public-redemption-rpc.test.ts src/tests/partner-redemption-edge-cases.test.ts`
