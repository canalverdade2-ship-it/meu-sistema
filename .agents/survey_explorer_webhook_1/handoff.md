# Handoff Report — survey_explorer_webhook_1

## 1. Observation
1. **Webhook Server Entry Point & Routing:**
   - In `server_webhook_vps_live.cjs` (lines 8234-8470) and `server_webhook.cjs`, `http.createServer` handles GET verification on `/webhook` (`hub.mode`, `hub.verify_token`, `hub.challenge`) and POST on `/webhook` by immediately returning HTTP 200 `{ status: 'ok' }` (lines 8346-8348) before asynchronously parsing payloads.
   - Evolution API payloads are extracted at lines 8371-8428: checks `data.data.key.fromMe`, handles `@lid` and `@s.whatsapp.net` JID routing, registers context via `antiBanEngine.registerContactContext(...)`, and parses media types (`imageMessage`, `audioMessage`, `videoMessage`, `documentMessage`, `conversation`).
   - Meta Cloud API payloads are extracted at lines 8430-8438.
   - Message routing enters `processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData)` (lines 3724-4100).

2. **Gemini AI / NLU & Prompt Configuration:**
   - In `server_webhook_vps_live.cjs` lines 17-21, 263-494, Gemini endpoint is configured using official free endpoint `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}` with `GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'`.
   - Protocol NLU in `callGeminiProtocolNLU` (lines 618-722) uses `temperature: 0.1` and `responseMimeType: 'application/json'` with 10s timeout, falling back to `parseProtocolIntentFallback` (lines 498-616) on failure.
   - Assistant NLU in `callGSAAssistant` (lines 263-494) uses `temperature: 0.3`, 25s timeout, structured actions (`reply`, `search_service`, `search_product`, `track_order`, etc.), dynamic 5-minute catalog caching (`fetchCatalogForAI`, lines 82-143), and WhatsApp single-asterisk markdown rules.

3. **Conversation State Management:**
   - In `server_webhook_vps_live.cjs` line 41, `const userSessions = {}` stores in-memory state keyed by phone number (`fromPhone`).
   - Session stores `state`, `history` (last 6 messages), `protocolState`, `protocolCode`, `protocolRecord`, `targetField`, `profile`, `clientData`, `clientName`, `pushName`.
   - State machine transitions handle `MAIN_MENU`, `PROTOCOL_IDENTIFIED`, `PROTOCOL_AWAITING_FIELD`, `PROTOCOL_AWAITING_NEW_VALUE`, `PROTOCOL_AWAITING_CANCEL_CONFIRM`, `SERVICE_INTEREST`, `MULTIPLE_PRODUCT_INTEREST`, `DROPSHIP_INTEREST`, `AI_TICKET_COLLECT`, `CLIENT_AREA_MENU`, and navigation resets on `0` or `voltar` via `STATE_PARENTS`.

4. **Existing Protocol Tracking Flow (`PROT-RES-...`):**
   - Intercepted by `PROTOCOL_REGEX` (line 3840) or `session.state.startsWith('PROTOCOL_')`.
   - `handleProtocolSelfServiceFlow` (lines 802-1188) queries `parceiros_resgates` by `codigo_gerado`, displays current status card, handles NLU intents `alterar` (validates field via `validateAndSanitizeField`, lines 724-774, updates DB with `supabasePatch`), `cancelar` (prompts SIM/NÃO, updates `status = 'cancelado'`, `data_cancelamento = now()`), and `consultar`.
   - Dispatches admin alerts to `ADMIN_MASTER_PHONE` (`5511971858372`) via `dispatchAdminProtocolAlert` (lines 776-800).

5. **WhatsApp Message Dispatch & Anti-Ban Shield:**
   - In `lib/antiBanEngine.cjs`, `sendWhatsAppReply` routes through `enqueueMessage` and `ContactQueue` (lines 498-632), maintaining per-contact FIFO isolation with 2s-6s inter-message delay.
   - Emulates realistic human typing/recording presence via `/chat/sendPresence/${instance}` (`calculateTypingDelay`, lines 283-299) before sending.
   - Sanitizes markdown formatting via `formatToWhatsAppMarkdown` (lines 250-276).
   - Low-level dispatch uses `dispatchWithRetry` (lines 440-495) with exponential backoff & jitter on 5xx, 429, and network timeouts.

6. **Web System Parity & Supabase Backend Logic:**
   - In `src/features/partners/service.ts` lines 209-355 (`redeemPartnerBenefit`), duplicate check is run via `checkDuplicateRedemption(parceiroId, email, telefone)` (lines 617-641).
   - Calls public RPC `gsa_public_resgatar_beneficio_parceiro` with parameters `(p_parceiro_id, p_parceiro_slug, p_nome_completo, p_telefone, p_cliente_id, p_email)`.
   - Duplicate override flow: When `forceOverride` and `justificativaDuplicidade` are provided, it updates `parceiros_resgates` with `alerta_duplicidade = true`, `justificativa_duplicidade = justificativa`, `status = 'analise'`.
   - Automatic coupon vs 24h delay: If `redemption_has_coupon = true` and `delay_24h = false`, delivers coupon directly; otherwise routes via 24h SLA message and alerts Admin Master.
   - In `src/components/public/PartnerBenefitRedeemModal.tsx` lines 120-129, a 409 duplicate status activates the duplicate popup asking the user for a text justification.

---

## 2. Logic Chain
1. *From Observation 1 & 5:* The webhook server is already built on an asynchronous, non-blocking architecture that receives Evolution API / Meta payloads, registers contact contexts, and dispatches messages through an Anti-Ban FIFO queue with presence emulation.
2. *From Observation 2 & 4:* The existing Gemini NLU and state machine (`handleProtocolSelfServiceFlow`) already support protocol extraction, conversational field validation, database updates on `parceiros_resgates`, and admin notifications.
3. *From Observation 3 & 6:* To implement benefit redemption via chat, we can add a new NLU intent `"resgatar"` and partner search term extraction. When detected, the bot queries `parceiros` in Supabase using an in-memory cached fuzzy search.
4. *From Observation 6:* To achieve 100% parity with the web system (`redeemPartnerBenefit` and `PartnerBenefitRedeemModal.tsx`):
   - The bot must collect and validate Name, Email, and Phone.
   - It must execute `checkDuplicateRedemption` prior to final creation.
   - If a duplicate is found, the bot must prompt the user for a textual justification (rather than erroring out).
   - Once justified, the bot re-submits with `forceOverride: true`, setting `alerta_duplicidade = true`, `justificativa_duplicidade = justificativa`, and `status = 'analise'`.
   - If the partner has an immediate coupon (`redemption_has_coupon = true` and `delay_24h = false`), the bot returns the coupon code immediately in the chat.
   - If `delay_24h = true` or `status = 'analise'`, the bot returns the 24h SLA message and sends an admin notification to `5511971858372`.

---

## 3. Caveats
- No direct source code modifications were performed in this turn as this was a read-only investigation mission.
- The webhook server communicates with Supabase via local PostgREST (port 3001) using `SERVICE_ROLE_JWT` as well as remote Supabase endpoints; `supabaseRpc` helper should be added to `server_webhook_vps_live.cjs` to call RPC functions uniformly.
- High concurrency stress testing should be conducted with the scripted interaction test suite (`test_whatsapp_redemption.js`).

---

## 4. Conclusion
The webhook and NLU architecture is completely mapped, robust, and ready for the implementation of the conversational `"resgatar"` intent. The implementation blueprint detailed in `webhook_report.md` guarantees 1:1 business logic parity with `PartnerBenefitRedeemModal.tsx` and `redeemPartnerBenefit`, covering fuzzy partner matching, duplicate protection with justification override, automatic coupon fulfillment, and administrative notifications.

---

## 5. Verification Method
1. Inspect the comprehensive architecture report in `.agents/survey_explorer_webhook_1/webhook_report.md`.
2. Verify code references in:
   - `server_webhook_vps_live.cjs` (lines 802-1188, 3724-4100, 8234-8470)
   - `lib/antiBanEngine.cjs` (lines 498-632, 283-299)
   - `src/features/partners/service.ts` (lines 209-355, 617-641)
   - `src/components/public/PartnerBenefitRedeemModal.tsx` (lines 72-141)
   - `supabase/migrations/20260826220000_production_remediation_consolidated.sql` (lines 270-386)
3. Invalidation condition: If `gsa_public_resgatar_beneficio_parceiro` or `checkDuplicateRedemption` is modified with incompatible parameter signatures or tables.
