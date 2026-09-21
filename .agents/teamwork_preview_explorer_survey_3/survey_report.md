# GSA HUB — Deep System Audit & Survey Report: Integrations, Evolution API, N8N, & UTF-8 / Character Encoding

**Audit Phase:** Survey Phase  
**Auditor / Specialist:** Explorer 3 (Integrations, Evolution API, N8N, UTF-8 Specialist)  
**Date:** 2026-08-28  
**Scope:** External APIs, WhatsApp Dispatch Systems, Evolution API, n8n Webhooks, Supabase Edge Functions, Character Encoding & Mojibake across codebase, Asynchronous Resilience & Error Handling, Resgates / Recursos (Appeals) Workflow.

---

## 1. Executive Summary

This investigation performed an exhaustive, byte-level and architectural audit across the entire GSA HUB codebase, spanning React frontend components, TypeScript utility libraries, Node.js VPS servers, Supabase Edge Functions (Deno), and PostgreSQL migration scripts.

### Key Discoveries & Critical Vulnerabilities:
1. **Critical UTF-8 Mojibake & Byte Corruption (30 Files Affected):**
   - **Business Logic Corruption:** In `src/components/client/ClientIndiqueGanhe.tsx`, state type definitions and Supabase queries were corrupted to `'concluÃÂÂ­da'` instead of `'concluída'`, directly breaking database filtering for finished referrals.
   - **WhatsApp Notification Template Corruption:** `src/lib/whatsappNotificationService.ts` contains ~237 lines of corrupted template strings (e.g. `INFORMA!ÒO`, `PONTUA!ÒO`, `SERVI!O`, `PR XIMO`, `0 só responder`, `Ótima notícia` corrupted to ` tima notícia`, broken emoji surrogate pairs `x R`, `S&`, `a️`).
   - **Partner & Redemption Workflows:** `src/features/partners/service.ts`, `src/components/public/ProtocolConsultPage.tsx`, and `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx` have over 250 combined lines of broken Portuguese accents and corrupted emojis in customer messages, error handlers, and UI modals.
   - **Edge Functions Triple-Mojibake:** `supabase/functions/gsa-free-tools/index.ts` contains triple-encoded mojibake in user-facing error messages and WhatsApp voucher templates (`Ã°Å¸Â¤â€“ *GSA HUB | SoluÃƒÂ§ÃƒÂµes Digitais*`, `OlÃƒÂ¡!`, `CÃƒÂ³digo:`, `Ã¢Å¡Â¡ *Regra de uso:* VÃƒÂ¡lido para *1 uso completo* (cÃƒÂ¡lculo Pro e emissÃƒÂ£o de 1 relatÃƒÂ³rio PDF detalhado)`).
   - **Corrupted Migration Encoding:** `supabase/migrations/20260320000000_create_blog_posts.sql` was saved in UTF-16 LE with BOM (containing null bytes between every ASCII character), causing standard UTF-8 SQL runners to fail.

2. **Insecure & Broken Direct Browser Calls (Mixed Content & Token Exposure):**
   - `src/lib/whatsappNotificationService.ts` (lines 104, 1216, 1245, 1308, 1333) makes direct browser `fetch()` calls to insecure HTTP endpoints (`http://147.15.43.141:8080` and `http://147.15.43.141:5678`) with hardcoded master API tokens (`gsa_hub_evolution_token_2026`). In production HTTPS environments, modern browsers block these calls immediately due to Mixed Content policies (`Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'`).
   - All WhatsApp message dispatching must occur strictly through secure backend channels (Edge Functions / VPS API).

3. **Dead / Unhandled Fallback Paths in `n8nWhatsApp.ts`:**
   - `src/utils/n8nWhatsApp.ts` retrieves `webhookUrl` from database settings, but never uses it. It invokes the Supabase Edge Function `vps-api`. If `vps-api` fails, the catch block logs that it is falling back to Evolution API, but returns `false` without ever attempting the fallback.

4. **Async Promise Handling & Dangling Rejections:**
   - In `src/features/partners/service.ts`, several promises are invoked with `void` without capturing returned status or propagating errors (e.g. background WhatsApp notifications in `redeemPartnerBenefit` lines 312, 317, 345).
   - In `supabase/functions/gsa-auth-session/index.ts`, the Evolution API `fetch()` lacks an `AbortSignal.timeout()`, risking hung serverless invocations if the VPS is slow or unresponsive.

---

## 2. Comprehensive Mojibake & Character Encoding Audit

The table below catalogs the files identified with character corruption, their impact level, and exact remediation requirements:

| File Path | Corrupted Lines | Primary Mojibake / Corrupted Tokens | Root Cause & Business Impact | Required Fix |
|---|---|---|---|---|
| `src/components/client/ClientIndiqueGanhe.tsx` | 14 lines (L29, L165, L166, L195, L200, L219, L272, L273, L327, L334, L391, L547, L562, L571, L613) | `concluÃÂÂ­da`, `dÃÂÂ­gitos`, `prÃÂÂ³prio`, `ºÃ…Â¸ÂÂ¤ÂÂ `, `apÃÂÂ³s`, `BÃÂÂ´nus`, `benefÃÂÂ­cios` | Double UTF-8 decoding during refactoring; broken SQL query filtering on `status = 'concluída'`. | Fix literal types to `'concluída'`, fix toast error messages, format strings, and reward descriptions. |
| `src/lib/whatsappNotificationService.ts` | 237 lines | Broken emojis (`x R`, `S&`, `a️`, `x 9`, `x: `, `x  `, `x`, `x}x️`, `xRx`), `INFORMA!ÒO`, `PONTUA!ÒO`, `PR XIMO`, `SERVI!O`, `0 só responder`, ` tima notícia` | Truncated/corrupted Unicode points and broken CP1252 transcoding. All outgoing WhatsApp messages for 28 module types arrive with broken text. | Re-write all message generators and emoji helper maps with clean, verified UTF-8 strings and emojis. |
| `src/features/partners/service.ts` | 57 lines (L84, L87, L166, L204, L217, L246, L262, L294-310, L327-343, L467-492, L673-679, L751, L771) | `No foi possvel`, `solicitao`, `benefcio`, `condio`, `ativao`, `carncia`, `Cdigo de Acesso`, `Instrues`, `Gesto de Servios` | Corrupted error strings, corrupted WhatsApp welcome messages, corrupted activation messages with invalid emoji bytes (`=>`, `=K`, `<`, `= `). | Replace all templates and error messages with verified UTF-8 Portuguese strings and canonical Unicode emojis. |
| `src/components/public/ProtocolConsultPage.tsx` | 102 lines (L44, L55, L157, L160, L294, L389, L399, L433, L437, L442, L458, L462, L478, L491, L496, L504, L539, L543, L606, L639, L674, L686, L731, L743, L754-757, L778, L819, L837, L849, L861, L870-874, L884, L904, L920, L943, L947, L960, L976, L979, L1016, L1038, L1089, L1098, L1109, L1112, L1134, L1168, L1195-1200, L1207, L1218, L1228, L1233, L1243, L1306, L1334, L1338, L1347, L1353, L1356, L1363, L1380, L1383, L1397, L1420, L1442) | `Em at 24 horas`, `Cabea`, `balanando`, `No concorda com esta recusa?`, `Voc pode contestar esta deciso`, `at 3 documentos comprobatrios`, `Recurso em anlise`, `Prazo Limite de Anlise`, `Parecer da Deciso`, `Sua contestao foi aprovada`, `Benefcio Liberado`, `Histrico do protocolo`, `Auditvel`, `Buscando&`, `Enviando cdigo&`, `Protocolando&` | Corrupted Portuguese strings across public-facing protocol tracking page, timeline events, and appeal submission modals. | Restore all Portuguese accents, buttons, tooltips, and remove corrupted trailing ampersands (`&` -> `...`). |
| `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx` | 98 lines (L166, L190, L209, L211, L220, L221, L229, L247, L249, L300+, L1400+) | `No foi possvel`, `ativao`, `notificao`, `Nenhum link de ativao cadastrado`, `Notificao reenviada`, `informaes`, `endereo`, `CNPJ invlido` | Broken Portuguese strings and corrupted toast feedback in admin procurement & partner management. | Full string remediation to clean UTF-8. |
| `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` | 12 lines (L297, L339, L443, L1100+) | `S& Link de ativação salvo`, `S& Notificação oficial`, `CRON METRO REGRESSIVO` | Corrupted emojis in toasts and section headers. | Replace `S&` with `✅` and `CRON METRO` with `CRONÔMETRO`. |
| `src/utils/n8nWhatsApp.ts` | 6 lines (L20, L62, L82, L97, L101, L104) | `xa`, `x &`, `S&`, `a️`, `R`, `` | Broken em-dash and broken emoji surrogates in admin notifications. | Replace with clean `📢`, `🕒`, `✅`, `⚠️`, `❌`, `—`. |
| `supabase/functions/gsa-free-tools/index.ts` | 5 lines (L135, L154, L266, L290, L294) | `Pedido nÃƒÂ£o informado`, `NÃƒÂ£o foi possÃƒÂ­vel`, `Informe um nÃƒÂºmero de WhatsApp vÃƒÂ¡lido`, `Ã°Å¸Â¤â€“ *GSA HUB | SoluÃƒÂ§ÃƒÂµes Digitais*`, `OlÃƒÂ¡!`, `Ã°Å¸â€˜â€¹`, `CÃƒÂ³digo:`, `Ã¢Å¡Â¡` | Double/triple encoded mojibake in Deno Edge Function response JSON and WhatsApp template message. | Replace with clean UTF-8 string: `🤖 *GSA HUB | Soluções Digitais*\n\nOlá! 👋\nSeu voucher exclusivo para a *${productName}* foi gerado com sucesso:\n\n🎟️ Código: *${voucherCode}*\n\n⚡ *Regra de uso:* Válido para *1 uso completo* (cálculo Pro e emissão de 1 relatório PDF detalhado).\n\nCopie o código acima e valide na tela da calculadora para desbloquear o modo Pro!`. |
| `supabase/migrations/20260320000000_create_blog_posts.sql` | 13 lines | Null bytes `\u0000` between every character (`C R E A T E   T A B L E...`) | File saved as UTF-16 LE with BOM instead of UTF-8. | Re-encode file as standard UTF-8 without BOM. |
| `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx` | 5 lines (L224, L280+) | `header: 'ÃÅ¡ltima Análise do Vacuum'` | Double-encoded `Ú` (`ÃÅ¡`). | Replace with `'Última Análise do Vacuum'`. |
| `src/components/client/StoreHub.tsx` | 4 lines (L1585, L1863, L1869, L2712) | `âœ•`, `âœ“` | Corrupted checkmark `✓` and cross `✗`. | Replace with standard Unicode characters `✓` and `✕`. |
| `src/components/client/store/CheckoutModal.tsx` | 1 line (L1167) | `âœ ï¸  Alterar` | Corrupted pencil icon `✏️`. | Replace with clean `✏️ Alterar`. |
| `src/components/client/store/EcommerceHeader.tsx`, `EcommerceHome.tsx`, `ClientProfile.tsx`, `ScrapingAdminModule.tsx` | ~30 lines | `â”€â”€â”€` | Corrupted box-drawing characters `───`. | Replace with standard ASCII `---` or UTF-8 `───`. |

---

## 3. External Integrations Architecture & Resilience Audit

### 3.1 WhatsApp Messaging Infrastructure
The system uses a multi-tier WhatsApp notification topology:
1. **Tier 1 (Evolution API - Direct or via VPS API):** Baileys-based WhatsApp Web connection hosted on Oracle Cloud VPS (`http://147.15.43.141:8080`).
2. **Tier 2 (Supabase Edge Function `vps-api`):** Proxies calls from frontend and edge functions to the VPS, protecting credentials.
3. **Tier 3 (n8n Webhook Fallback):** Webhook dispatcher running on `http://147.15.43.141:5678/webhook/send-whatsapp`.
4. **Anti-Ban Shield Engine (`lib/antiBanEngine.cjs`):** Implements per-contact FIFO queues, dynamic typing emulation (`composing`), Spintax expansion, and exponential backoff retry with jitter.

#### Architectural Flaws Found:
1. **Frontend Mixed Content & Token Leak:**
   - In `src/lib/whatsappNotificationService.ts`, Tier 1 directly fetches `http://147.15.43.141:8080` from the browser. In browser environments loaded via HTTPS, this causes immediate network rejection (`Mixed Content`).
   - **Remediation:** In client environments (`typeof window !== 'undefined'`), message dispatch should route exclusively through `supabase.functions.invoke('vps-api')` or direct database transactional outbox (`parceiros_resgates_notificacoes`). The direct HTTP fetch on port 8080 should only be used in Node.js / server-side environments.

2. **Missing UTF-8 Headers on Outbound Webhooks & REST Endpoints:**
   - In `supabase/functions/vps-api/index.ts`, lines 133, 276, 292, 312 set `'Content-Type': 'application/json'` without `; charset=utf-8`.
   - In `lib/antiBanEngine.cjs`, line 469 sets `'Content-Type': 'application/json'` without `; charset=utf-8`.
   - **Remediation:** Enforce `'Content-Type': 'application/json; charset=utf-8'` across all HTTP request dispatchers.

3. **Missing Timeout in Serverless Functions:**
   - In `supabase/functions/gsa-auth-session/index.ts` (line 279), `sendWhatsAppMessage` calls Evolution API without `AbortSignal.timeout(...)`. If Evolution API is unresponsive, the serverless request hangs until Deno's global 60s timeout.
   - **Remediation:** Add `signal: AbortSignal.timeout(6000)` to all fetch calls in edge functions.

4. **Incomplete Fallback Cascade in `n8nWhatsApp.ts`:**
   - `sendAdminWhatsAppNotification` queries `system_settings` for `whatsapp_n8n_webhook_url`, but never calls it if `vps-api` fails.
   - **Remediation:** Implement a proper 2-tier fallback in `n8nWhatsApp.ts`: (1) `vps-api` Edge Function -> (2) direct n8n webhook via Edge Function proxy.

---

## 4. Resgates / Recursos (Appeals) & Notification Workflow Audit

### 4.1 Flow Verification

```
[Cliente: ProtocolConsultPage.tsx]
       │
       ├─► Status == 'recusado' (recurso == null)
       │        │
       │        ├─► Clica "Contestar a recusa"
       │        ├─► Preenche justificativa (20-4000 chars) + anexa até 3 fotos/PDFs
       │        ├─► Inicia Desafio: beginPartnerAppealChallenge(protocolo)
       │        │        └─► Edge Function `gsa-auth-session` (action: request_partner_appeal)
       │        │                 └─► RPC `gsa_begin_partner_appeal_challenge`
       │        │                 └─► Envia PIN de 6 dígitos via WhatsApp ao cliente
       │        ├─► Digita PIN de 6 dígitos
       │        ├─► Upload de evidências para bucket `parceiros-midias` (uploadAppealEvidenceFile)
       │        └─► Conclui Recurso: completePartnerAppeal({ challengeId, pin, justificativa, anexos })
       │                 └─► Edge Function `gsa-auth-session` (action: submit_partner_appeal)
       │                          └─► RPC `gsa_complete_partner_appeal`
       │                                   ├─► INSERT INTO parceiros_resgates_recursos (status: 'em_analise')
       │                                   ├─► UPDATE parceiros_resgates (status: 'em_analise', alerta_duplicidade: false)
       │                                   ├─► INSERT INTO parceiros_resgates_eventos (tipo: 'recurso_interposto')
       │                                   └─► INSERT INTO notificacoes (destinatario_tipo: 'admin')
       │
[Administrador: PartnerRedemptionDetailModal.tsx / FornecedoresSection.tsx]
       │
       ├─► Visualiza dados do resgate, SLA 24h, justificativa do cliente, imagens anexadas
       ├─► Consulta histórico de eventos da timeline (`parceiros_resgates_eventos`)
       ├─► Decisão do Administrador:
       │        │
       │        ├─► OPÇÃO A: "Aceitar Recurso"
       │        │        └─► decidePartnerAppeal(recursoId, 'deferido')
       │        │                 └─► RPC `gsa_admin_decide_partner_appeal(p_decisao: 'deferido')`
       │        │                          ├─► UPDATE parceiros_resgates_recursos (status: 'deferido')
       │        │                          ├─► UPDATE parceiros_resgates (status: 'pendente')
       │        │                          ├─► INSERT INTO parceiros_resgates_eventos (tipo: 'recurso_deferido')
       │        │                          └─► INSERT INTO parceiros_resgates_notificacoes (tipo: 'recurso_aprovado_cliente')
       │        │
       │        └─► OPÇÃO B: "Negar Recurso" (exige fundamentação 10-2000 chars)
       │                 └─► decidePartnerAppeal(recursoId, 'indeferido', motivo)
       │                          └─► RPC `gsa_admin_decide_partner_appeal(p_decisao: 'indeferido', p_motivo: motivo)`
       │                                   ├─► UPDATE parceiros_resgates_recursos (status: 'indeferido', motivo_decisao: motivo)
       │                                   ├─► UPDATE parceiros_resgates (status: 'recusado')
       │                                   ├─► INSERT INTO parceiros_resgates_eventos (tipo: 'recurso_indeferido')
       │                                   └─► INSERT INTO parceiros_resgates_notificacoes (tipo: 'recurso_recusado_cliente')
       │
[Outbox Dispatcher: gsa-auth-session (action: process_partner_appeal_outbox)]
       │
       └─► Dispara mensagens formatadas em UTF-8 via WhatsApp para o cliente notificando o veredito.
```

### 4.2 Findings in Resgates / Recursos:
1. **ProtocolConsultPage.tsx**: The user-facing page correctly supports single-appeal enforcement (`!result.recurso`), file attachment previews, 6-digit challenge verification with 10-minute countdown, and Realtime subscription on `parceiros_resgates_public_status`. However, all UI labels and toasts had corrupted character encodings.
2. **PartnerRedemptionDetailModal.tsx**: Admin can view attached evidence images in full preview modal, see appeal justification, and trigger approve/reject decisions. Toasts had corrupted emoji characters (`S&`).
3. **Transactional Integrity**: Database RPCs (`gsa_begin_partner_appeal_challenge`, `gsa_complete_partner_appeal`, `gsa_admin_decide_partner_appeal`) utilize `FOR UPDATE` row-level locks on `parceiros_resgates` and `parceiros_resgates_recursos`, preventing race conditions.

---

## 5. Concrete, Code-Level Actionable Remediation Strategies

### Strategy 1: Systematic UTF-8 & Mojibake Remediation

#### Target File: `src/components/client/ClientIndiqueGanhe.tsx`
- **Line 29:** Replace `useState<'aberta' | 'concluÃÂÂ­da'>` with `useState<'aberta' | 'concluída'>`.
- **Lines 165-166:** Replace `if (activeTab === 'concluÃÂÂ­da') { query = query.in('status', ['concluÃÂÂ­da', 'cancelada']); }` with `if (activeTab === 'concluída') { query = query.in('status', ['concluída', 'cancelada']); }`.
- **Line 195:** Replace `(DDD + 9 dÃÂÂ­gitos)` with `(DDD + 9 dígitos)`.
- **Line 200:** Replace `prÃÂÂ³prio número` with `próprio número`.
- **Line 219:** Replace `['aberta', 'concluÃÂÂ­da']` with `['aberta', 'concluída']`.
- **Lines 272-273:** Replace `ºÃ…Â¸ÂÂ¤ÂÂ ` and `apÃÂÂ³s` with `🎉` and `após`.
- **Lines 327, 334:** Replace `'concluÃÂÂ­da'` and `'ConcluÃÂÂ­da'` with `'concluída'` and `'Concluída'`.
- **Lines 391, 547, 562, 571, 613:** Replace `BÃÂÂ´nus`, `benefÃÂÂ­cios`, `BenefÃÂÂ­cio`, `apÃÂÂ³s`, `bÃÂÂ´nus` with `Bônus`, `benefícios`, `Benefício`, `após`, `bônus`.

#### Target File: `src/lib/whatsappNotificationService.ts`
- **Lines 34-81:** Replace all broken emoji helper mappings with clean Unicode characters:
  - `aprovado`/`pago`: `✅`
  - `recusado`/`cancelado`: `❌`
  - `vencido`/`atraso`: `⚠️`
  - `pendente`: `⏳`
  - `analise`: `🔍`
  - `enviado`: `📤`
- **Lines 155-450:** Replace all corrupted string titles:
  - `INFORMA!ÒO IMPORTANTE` -> `INFORMAÇÃO IMPORTANTE`
  - `PONTUA!ÒO ACUMULADA` -> `PONTUAÇÃO ACUMULADA`
  - `DETALHES DA SOLICITA!ÒO` -> `DETALHES DA SOLICITAÇÃO`
  - `PR XIMO PASSO` -> `PRÓXIMO PASSO`
  - `A!ÒO NECESSÁRIA` -> `AÇÃO NECESSÁRIA`
  - `SOBRE O SERVI!O` -> `SOBRE O SERVIÇO`
  - `_Dúvidas? 0 só responder..._` -> `_Dúvidas? É só responder esta mensagem._`
  - ` tima notícia!` -> `Ótima notícia!`
  - `0 com muita alegria...` -> `É com muita alegria...`
  - `SEU NOVO PR`MIO` -> `SEU NOVO PRÊMIO`
- **Lines 1200-1358:** Secure browser dispatch:
  - In browser contexts, remove direct unauthenticated HTTP `fetch()` to `http://147.15.43.141:8080` (Mixed Content fix). Direct all client notification dispatching through `supabase.functions.invoke('vps-api')`.
  - Add explicit headers: `'Content-Type': 'application/json; charset=utf-8'`.

#### Target File: `supabase/functions/gsa-free-tools/index.ts`
- **Lines 135, 154, 266, 290, 294:** Replace triple-encoded strings:
  ```typescript
  // Line 266
  return json({ success: false, error: 'invalid_phone', message: 'Informe um número de WhatsApp válido com DDD.' }, 400, allowedOrigin);

  // Line 290
  message: data?.message || 'Não foi possível solicitar o voucher para este número.'

  // Line 294
  const messageText = `🤖 *GSA HUB | Soluções Digitais*\n\nOlá! 👋\nSeu voucher exclusivo para a *${productName}* foi gerado com sucesso:\n\n🎟️ Código: *${voucherCode}*\n\n⚡ *Regra de uso:* Válido para *1 uso completo* (cálculo Pro e emissão de 1 relatório PDF detalhado).\n\nCopie o código acima e valide na tela da calculadora para desbloquear o modo Pro!`;
  ```

#### Target File: `src/features/partners/service.ts`
- **Lines 84, 87, 204, 217, 246, 262:** Fix all error and description strings to clean UTF-8.
- **Lines 294-310 (24h welcome message):**
  ```typescript
  const clientWelcomeMessage = [
    `📋 *SOLICITAÇÃO DE BENEFÍCIO REGISTRADA!*`,
    ``,
    `Olá, *${firstName}*! 👋`,
    ``,
    `Recebemos seu pedido de resgate do benefício exclusivo da parceria *${partnerName}*.`,
    ``,
    `🎁 *Benefício:*`,
    `${benefitDesc}`,
    ``,
    `⏳ *PRAZO DE ATIVAÇÃO (EM ATÉ 24 HORAS):*`,
    `Nossa equipe já está processando sua liberação junto ao parceiro. Em até *24 horas*, você receberá por aqui, no seu WhatsApp, o seu *link oficial de ativação* com carência zero.`,
    ``,
    `📄 *Protocolo:* \`${protocolo}\``,
    ``,
    `_Grupo GSA — Gestão de Serviços & Benefícios_`
  ].filter(Boolean).join('\n');
  ```
- **Lines 327-343 (Immediate activation message):**
  ```typescript
  const clientImmediateMessage = [
    `🎉 *BENEFÍCIO RESGATADO COM SUCESSO!* 🚀`,
    ``,
    `Olá, *${firstName}*! 👋`,
    ``,
    `O seu benefício na parceria *${partnerName}* foi liberado com sucesso!`,
    ``,
    `🎁 *Benefício:*`,
    `${benefitDesc}`,
    ``,
    result?.codigo_gerado ? `🔑 *Código de Acesso:* \`${result.codigo_gerado}\`` : null,
    result?.link ? `🔗 *Link da Parceria:*\n${result.link}` : null,
    result?.instructions ? `📌 *Instruções:* ${result.instructions}` : null,
    ``,
    `📄 *Protocolo:* \`${protocolo}\``,
    ``,
    `_Grupo GSA — Gestão de Serviços & Benefícios_`
  ].filter(Boolean).join('\n');
  ```
- **Lines 467-492 (Admin complete partner redemption activation message):**
  ```typescript
  const lines = [
    `🎉 *SEU BENEFÍCIO JÁ ESTÁ DISPONÍVEL!* 🚀`,
    ``,
    `Olá, *${customerFirstName}*! 👋`,
    ``,
    `O seu link oficial de ativação para a parceria com a *${partnerTitle}* já foi liberado com sucesso!`,
    ``,
    `🎁 *Benefício Exclusivo:*`,
    `${benefitDesc}`,
    ``,
    `🔗 *LINK OFICIAL DE ATIVAÇÃO:*`,
    `${cleanLink}`,
    ``,
    payload.cupom?.trim() ? `🎟️ *CUPOM DE DESCONTO:*\n\`${payload.cupom.trim()}\`\n` : null,
    payload.voucher?.trim() ? `🎫 *VOUCHER EXCLUSIVO:*\n\`${payload.voucher.trim()}\`\n` : null,
    `📋 *Como ativar:*`,
    ``,
    `1️⃣ Clique no link oficial acima`,
    ``,
    `2️⃣ Conclua o seu cadastro no site`,
    ``,
    `3️⃣ Aproveite o benefício com carência zero!`,
    ``,
    payload.protocolo ? `📄 *Protocolo:* \`${payload.protocolo}\`` : null,
    payload.protocolo ? `` : null,
    `_Grupo GSA — Gestão de Serviços & Benefícios_`
  ];
  ```

#### Target File: `src/components/public/ProtocolConsultPage.tsx`
- Replace all corrupted strings across the 102 lines (e.g. `Em até 24 horas`, `Cabeça do Cachorrinho`, `Orelha fofa balançando`, `Você já atingiu o limite de 3 anexos de evidência.`, `A justificativa deve conter no mínimo 20 caracteres.`, `Buscando...`, `Enviando código...`, `Protocolando...`, `Solicitação Recusada`, `Não concorda com esta recusa?`, `Histórico do protocolo`, `Auditável`).

#### Target File: `supabase/migrations/20260320000000_create_blog_posts.sql`
- Re-save the file with clean UTF-8 encoding (without UTF-16 LE BOM).

---

## 6. Summary of Deliverables & Next Phase Handoff

| Artifact | Purpose |
|---|---|
| `.agents/teamwork_preview_explorer_survey_3/survey_report.md` | Authoritative comprehensive survey report (this file). |
| `.agents/teamwork_preview_explorer_survey_3/handoff.md` | Self-contained 5-component handoff report for the Teamwork orchestrator. |
| `.agents/teamwork_preview_explorer_survey_3/mojibake_findings.json` | Complete machine-readable catalog of all corrupted files and line numbers. |
