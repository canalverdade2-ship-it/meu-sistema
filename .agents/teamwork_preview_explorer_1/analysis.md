# Technical Investigation & Architectural Analysis: WhatsApp Webhook & Anti-Ban Subsystem

**Author:** Explorer 1  
**Target Files:** `server_webhook.cjs` & `server_webhook_vps_live.cjs`  
**Workspace:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`  
**Date:** 2026-08-21T23:45:00-03:00  

---

## 1. Executive Summary

The GSA HUB WhatsApp subsystem runs as a standalone Node.js daemon (managed via PM2 inside Docker `n8n` on the production VPS at `163.176.97.152`). It serves as an omni-channel conversational assistant, e-commerce engine, financial portal, quotation generator, and support router for GSA HUB.

### Key Metrics
| Parameter | `server_webhook.cjs` | `server_webhook_vps_live.cjs` |
|---|---|---|
| **Total Lines** | 8,142 lines | 7,880 lines |
| **Total Bytes** | 409,693 bytes (~400 KB) | 395,986 bytes (~386 KB) |
| **Core Architecture** | Native Node.js `http` server (Zero Express dependency) | Native Node.js `http` server (Zero Express dependency) |
| **Listening Port** | `process.env.PORT \|\| 5680` on `0.0.0.0` | `process.env.PORT \|\| 5680` on `0.0.0.0` |
| **WhatsApp Gateway** | Evolution API v2 (`http://127.0.0.1:8080`) | Evolution API v2 (`http://127.0.0.1:8080`) |
| **AI LLM / Vision** | Google Gemini (`gemini-3.5-flash-lite`, `gemini-2.5-flash`) | Google Gemini (`gemini-3.5-flash-lite`, `gemini-2.5-flash`) |
| **Database Backend** | PostgREST / Supabase on `127.0.0.1:3001` | PostgREST / Supabase on `127.0.0.1:3001` |
| **Status / Purpose** | **Active Source / Latest Development & Deployment Source** | **Live VPS Snapshot / Staging Baseline** |

---

## 2. Comprehensive Comparison: `server_webhook_vps_live.cjs` vs `server_webhook.cjs`

`server_webhook.cjs` is the authoritative development file that gets synced and deployed to the VPS container (`n8n:/home/node/server_webhook.cjs`) via `scratch/deploy_webhook.cjs`. `server_webhook_vps_live.cjs` represents an earlier live VPS backup.

There are **23 distinct diff hunks** between them (+605 additions, -343 deletions):

### 1. AI System Prompt & Action Schema Directives (Lines 328–420)
- **Human Support Rule (Rule 7)**: `server_webhook.cjs` added explicit instruction directing the AI to return `action: "menu"` with `target: "10"` when the customer asks for a human agent or support department.
- **Credit & Loan Rule (Rule 8)**: Added instruction directing the AI to return `action: "request_credit"` and extract `credit_amount`, `credit_installments`, `credit_purpose`, and `credit_income`.
- **JSON Action Schema Simplification**: Removed legacy redundant actions (`client_account`, `client_statement`, `client_points`, `client_tickets`, `track_order`) in favor of direct state routing and unified dashboard menus.

### 2. Removal of Redundant Client Overview Functions (Lines 636–1004)
- `server_webhook_vps_live.cjs` contained standalone helper functions (`fetchCategoryTop`, `getFeaturedShowcase`, `handleClientAccountOverview`, `handleClientStatement`, `handleClientPointsStatement`, `handleClientTickets`, `fetchClientRecord`).
- In `server_webhook.cjs`, these were removed or consolidated into the unified Client Dashboard state machine (`CLIENT_DASHBOARD_MENU`), reducing code duplication.

### 3. Dynamic Human Support Department Module (`showHumanSupportSectors`, Lines 2693–2721)
- `server_webhook.cjs` introduces `showHumanSupportSectors(fromPhone, session)`, which queries `/rest/v1/gsa_whatsapp_ramais?ativo=eq.true&order=ordem.asc` dynamically from PostgREST, with fallback to 7 standard departments (Comercial, Financeiro, Dep. Pessoal, Suporte Afiliados, Suporte Parceiros, Suporte Fornecedores, SAC).

### 4. Credit & Loan Application Subsystem (Lines 2737–3015 & 5530–5662)
`server_webhook.cjs` introduced a complete, multi-step credit request workflow:
- `parseMoneyAmount(text)`: Parses colloquial Brazilian currency strings (e.g., `"10 mil"`, `"10k"`, `"R$ 15.000,00"`, `"15000"`).
- `maskDocument(doc)`: Masks CPF/CNPJ for LGPD security (`000.***.***-00`).
- `extractCreditDataFromText(text)`: Extracts requested amounts, terms (months/installments), purposes (Capital de Giro, Estoque, Quitação, Pessoal), and documents from natural language.
- `startCreditRequest`, `advanceCreditFlow`, `renderCreditSimulation`, `finalizeCreditSubmission`.
- State Machine States: `CREDIT_REQUEST_DOC`, `CREDIT_REQUEST_NAME`, `CREDIT_REQUEST_VALUE`, `CREDIT_REQUEST_INSTALLMENTS`, `CREDIT_REQUEST_PURPOSE`, `CREDIT_REQUEST_INCOME`, `CREDIT_REQUEST_CONFIRM`.
- Integrated as Option 6️⃣ in `CLIENT_DASHBOARD_MENU`.

---

## 3. Inbound Webhook Pipeline Architecture

```
                                  [Inbound HTTP Request]
                                            │
                                            ▼
                           ┌──────────────────────────────────┐
                           │   Native http.createServer       │
                           │   Listening on 0.0.0.0:5680      │
                           └──────────────────────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      GET /health | /ping           GET /webhook (Meta Verify)     POST /webhook (Events)
      Status 200 UP JSON            hub.verify_token === TOKEN     Respond 200 OK Immediately
                                                                         │
               ┌─────────────────────────────────────────────────────────┴───────────────────────┐
               ▼                                                         ▼                       ▼
   POST /webhook/supabase-update                     POST /webhook/scraping*         POST /webhook (WhatsApp)
   handleSupabaseWebhook()                           handleProductScraping()                     │
                                                                                                 ▼
                                                                                   ┌───────────────────────────┐
                                                                                   │  Payload Parsing Engine   │
                                                                                   └───────────────────────────┘
                                                                                                 │
                                            ┌────────────────────────────────────────────────────┴────────────────────────┐
                                            ▼                                                                             ▼
                               [Evolution API v2 Format]                                                       [Meta Cloud API Format]
                               `data.data.key` present                                                         `data.entry[0]` present
                               - Check `fromMe === false`                                                      - Extract `msg.from`
                               - Check `event === 'messages.upsert'`                                           - Extract `msg.text.body`
                               - JID Extraction & LID resolution:                                                         │
                                 `remoteJid` vs `remoteJidAlt`                                                            │
                               - Phone normalization:                                                                     │
                                 `jid.split('@')[0].split(':')[0].replace(/\D/g, '')`                                     │
                               - PushName extraction                                                                      │
                               - MediaType extraction (image, audio, video, doc, text)                                    │
                                            │                                                                             │
                                            └────────────────────────────────────┬────────────────────────────────────────┘
                                                                                 ▼
                                                                    ┌─────────────────────────┐
                                                                    │ processMessage() Entry  │
                                                                    └─────────────────────────┘
```

### Key Inbound Pipeline Steps (Code Reference: Lines 7628–7852)

1. **HTTP Listener**: Native Node.js `http.createServer`. Zero dependencies (no Express, no Fastify).
2. **Meta Verification (`GET /webhook`)**:
   - Inspects `hub.mode === 'subscribe'` and `hub.verify_token === VERIFY_TOKEN`.
   - Returns `hub.challenge` on match; 403 Forbidden otherwise.
3. **Immediate Acknowledgement (`POST /webhook`)**:
   - Responds HTTP 200 `{ status: 'ok' }` synchronously before parsing the payload to avoid webhook timeouts.
4. **Sub-Route Dispatching**:
   - `/webhook/supabase-update`: Handles Supabase database change webhooks (`handleSupabaseWebhook`).
   - `/webhook/gsa-produtos-scraping`, `/webhook/gsa-viagens-scraping`, `/webhook/scraping`: Handles catalog scraper tasks (`handleProductScraping`).
5. **Evolution API Inbound Normalization (Lines 7764–7810)**:
   - **Self-message Filter**: Ignores `data.data.key.fromMe === true`.
   - **Event Filter**: Only processes `data.event === 'messages.upsert'`. Ignores presence and receipt status events.
   - **LID / JID Resolution**:
     - Evolution v2 sometimes provides Linked Device IDs (`@lid`) instead of Phone JIDs (`@s.whatsapp.net`).
     - Normalizes: `if (rawJid.includes('@lid') && altJid && !altJid.includes('@lid')) rawJid = altJid;`.
     - Strips non-digits: `fromPhone = rawJid.split('@')[0].split(':')[0].replace(/\D/g, '')`.
   - **Push Name**: `data.data.pushName || data.data.key?.pushName || ''`.
   - **Media Classification**:
     - `msgData.imageMessage` → `mediaType = 'image'`, `textBody = caption`
     - `msgData.audioMessage || msgData.pttMessage` → `mediaType = 'audio'`, `textBody = ''`
     - `msgData.videoMessage` → `mediaType = 'video'`, `textBody = caption`
     - `msgData.documentMessage` → `mediaType = 'document'`, `textBody = fileName`
     - `msgData.conversation || msgData.extendedTextMessage?.text` → `textBody = text`

---

## 4. Outgoing Communication Paths & Integration Endpoints

### 1. Evolution API v2 Integration

| Purpose | Function | HTTP Endpoint | HTTP Method | Payload Schema |
|---|---|---|---|---|
| **Text Reply** | `sendWhatsAppReply(to, messageText, retryCount)` (Line 2258) | `http://127.0.0.1:8080/message/sendText/GSA_WhatsApp` | `POST` | `{"number": "5511999999999", "text": "formatted text"}` |
| **Media / PDF / Image** | `sendWhatsAppMedia(to, mediaUrl, fileName, caption, mediaType)` (Line 2625) | `http://127.0.0.1:8080/message/sendMedia/GSA_WhatsApp` | `POST` | `{"number": "...", "mediatype": "document\|image", "mimetype": "application/pdf\|image/jpeg", "media": "base64...", "fileName": "...", "caption": "..."}` |
| **Inbound Media Fetch** | `handleAudioMessage`, `handleClientMediaUpload` (Lines 737, 3232) | `http://127.0.0.1:8080/chat/getBase64FromMediaMessage/GSA_WhatsApp` | `POST` | `{"message": {"key": {...}, "message": {...}}, "convertToMp4": false}` |
| **Socket Restart** | `triggerInstanceRestart()` (Line 2208) | `http://127.0.0.1:8080/instance/restart/GSA_WhatsApp` | `POST` | Empty payload |

**Authentication Header:** `'apikey': 'gsa_hub_evolution_token_2026'`  
**Instance Name:** `GSA_WhatsApp`  

> ⚠️ **Critical Discovery**: Evolution API presence endpoints (such as `POST /chat/sendPresence/GSA_WhatsApp` with `composing` / `recording`) and dedicated audio endpoints (`POST /message/sendWhatsAppAudio`) **are NOT currently called anywhere in the codebase**.

### 2. External AI & Database Integrations

- **Google Gemini 2.5 Flash / 3.5 Flash Lite**:
  - `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`: Used for audio transcription and visual product search from customer images.
  - `callGSAAssistant`: Used for conversational intent classification and response generation.
- **PostgREST Backend (`127.0.0.1:3001`)**:
  - Interacts via `supabaseGet`, `supabasePost`, `supabasePatch`, `supabaseUpsertProduct` with `SUPABASE_SERVICE_ROLE_KEY`.
  - Tables accessed: `clientes`, `gsa_afiliados`, `fornecedores`, `prestadores`, `servicos`, `produtos`, `orcamentos`, `faturas`, `os_servicos`, `tickets`, `gsa_whatsapp_ramais`, `gsa_calculator_pro_vouchers`, `gsa_admin_settings`, `gsa_credito_solicitacoes`.
- **Administrative WhatsApp Alerts (`notifyAdmin`)**:
  - Dynamically fetches the active admin phone number from `gsa_admin_settings` (defaulting to `5511920857754`) and dispatches formatted alerts via `sendWhatsAppReply`.

---

## 5. Enumeration of All Message Types & Dispatches

### A. Formatted Text Messages
- **Dispatch Function**: `sendWhatsAppReply(to, messageText)`
- **Markdown Transformer**: `formatToWhatsAppMarkdown(text)` (Lines 2223–2256):
  - Converts Markdown headers (`# Header`) to WhatsApp bold (`*Header*`).
  - Converts markdown list asterisks (`* item`) to safe bullet points (`• item`), preventing nested asterisk collisions (`* **bold**`).
  - Converts double asterisks (`**bold**`) to single asterisk (`*bold*`).
  - Converts markdown links `[label](url)` to `label (url)`.
- **Content Types**:
  - Main Menus (Options 1–10).
  - Multi-step wizards (Credit request, Service requests, Partner registration).
  - AI natural conversational responses.
  - Order tracking status updates.
  - Supabase table change notifications (Order paid, OS updated, Document approved/rejected).

### B. Image Messages
- **Dispatch Function**: `sendWhatsAppMedia(to, mediaUrl, fileName, caption, 'image')`
- **Use Cases & Dispatches**:
  - **Product Visual Search & Catalog Recommendations**:
    - Lines 854, 1099, 1145, 1893, 1924, 4208, 4245, 4328.
    - Sends product photography with pricing, title, and GSA product code in the caption.
  - **PIX QR Code Images**:
    - Lines 2031, 6116: Generates dynamic PIX QR Code image via `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCopiaECola)}` and sends it as `image/png`.

### C. PDF Documents
- **Dispatch Function**: `sendWhatsAppMedia(to, pdfBase64, fileName, caption, 'document')`
- **Use Cases & Binary PDF Generators**:
  1. **Invoice PDF (`generateInvoicePdfBase64`)** (Lines 2397–2491):
     - Dynamically synthesizes a complete **PDF-1.4 raw binary buffer** (without external PDF libraries like PDFKit).
     - Constructs PDF objects (`Catalog`, `Pages`, `Page`, `stream`, `Font: Helvetica`, `Font: Helvetica-Bold`, `xref` table, `trailer`).
     - Layout: Dark Navy header (`0.06 0.09 0.16 rg`), company CNPJ/email, Invoice Number, Client details, Items table, Subtotal, Total, and Legal footer.
     - Dispatched on invoice queries (Lines 5858, 6061).
  2. **Calculator Report PDF (`generateCalculatorReportPdfBase64`)** (Lines 2493–2623):
     - Dynamically constructs a PDF-1.4 document for labor termination, retirement, 13th salary, vacation, or BPC/LOAS calculation.
     - Layout: Header with Protocol number, Mode (PRO/FREE), Beneficiary name, Table of calculated items/verbas, Total Box, and Legal grounds.
     - Dispatched when AI returns `action: "generate_calculator_pdf"` (Line 1247).

### D. Audio Messages
- **Inbound**: Received via webhook (`audioMessage` / `pttMessage`), base64 fetched from Evolution API, transcribed via Gemini 2.5 Flash, and injected into `processMessage`.
- **Outbound**: Currently **none**. Voice replies are rendered as text.

### E. Interactive Buttons / Lists
- WhatsApp interactive buttons (`interactiveMessage`) and section lists are **not utilized**. All interactive flows use formatted text with emoji numbers (1️⃣, 2️⃣, etc.) and state machine parser logic.

---

## 6. Error Handling, Timeouts, Retries & Concurrency Analysis

### 1. Existing Timeouts
- `sendWhatsAppReply`: HTTP socket timeout of `10,000ms` (10 seconds).
- `sendWhatsAppMedia`: HTTP socket timeout of `15,000ms` (15 seconds).
- PostgREST Supabase requests: HTTP socket timeout of `5,000ms` (5 seconds).
- Google Gemini AI Assistant: `AI_TIMEOUT_MS = 25,000ms` (25 seconds).
- `fetchText` utility: `60,000ms` (60 seconds).

### 2. Flaws in Existing Retry Logic
- In `sendWhatsAppReply` (Lines 2294–2300):
  ```javascript
  if (res.statusCode !== 200 && res.statusCode !== 201) {
    if (retryCount < 2) {
      triggerInstanceRestart(); // ⚠️ DANGEROUS: Restarts the entire WhatsApp Evolution socket!
      setTimeout(() => sendWhatsAppReply(to, messageText, retryCount + 1), 2000);
    }
  }
  ```
  - **Issue A (Socket Thrashing)**: Triggering `triggerInstanceRestart()` on a message send error restarts the entire Baileys WhatsApp connection, disconnecting active sessions and triggering reconnection storms if multiple messages fail.
  - **Issue B (Network Drops Ignored)**: In `req.on('error')` and `req.setTimeout`, no retry is scheduled at all—it simply logs an error and drops the message.
  - **Issue C (`sendWhatsAppMedia`)**: Has **zero** retry logic. Any timeout or network hiccup silently drops invoice PDFs or product images.

### 3. Concurrency & Anti-Ban Vulnerabilities

1. **No Outbound Message Queue**:
   - Outbound requests fire immediately as unthrottled HTTP calls.
   - If an automated flow or Supabase trigger generates 3 messages (e.g. status update + admin alert + client receipt), they are dispatched within milliseconds.
   - Meta spam filters detect sub-second multi-message bursts from non-verified numbers as automated bot activity, leading to temporary or permanent bans.

2. **No Presence / Typing Simulation**:
   - Messages are delivered instantaneously without prior `composing` (typing...) or `recording` indicators.
   - Evolution API supports `POST /chat/sendPresence/{instance}` (`composing`, `recording`, `paused`), but it is not called.

3. **Static Greetings & Repetitive Templates**:
   - Static strings (e.g. `"Olá! Seja bem-vindo ao GSA HUB..."`, `"❌ Opção inválida..."`, `"🎙️ Recebi seu áudio! Deixa eu ouvir aqui..."`) are sent with zero linguistic variation. Repeated identical strings to hundreds of numbers trigger Meta hash-based spam signatures.

4. **In-Memory Session Race Conditions**:
   - `userSessions[fromPhone]` is a plain JavaScript dictionary without per-user mutexes or job locks.
   - If a user sends 2 messages in 500ms (e.g. audio + text clarification), two parallel `processMessage` instances execute concurrently, mutating `session.state` and `session.history` simultaneously and sending duplicate conflicting replies.

---

## 7. Anti-Ban Shield Architectural Recommendations

To satisfy Requirements R1–R4 from the project specification, the refactored architecture should introduce a dedicated **Anti-Ban Shield Module** layered between the business logic and the Evolution API:

```
┌────────────────────────────────────────────────────────┐
│                   Business Logic                       │
│    processMessage / handleAIResponse / Webhooks        │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│          WhatsApp Anti-Ban Shield Subsystem            │
│                                                        │
│  1. Spintax & Variation Generator                      │
│     - Randomizes greetings ("Olá", "Oi", "Tudo bem?") │
│     - Adds micro-variations to system messages         │
│                                                        │
│  2. Per-User FIFO Message Queue (Mutex/Lock)           │
│     - Serializes all messages per `fromPhone`          │
│     - Inter-message jitter delay (2.0s – 6.0s)         │
│                                                        │
│  3. Realistic Presence Controller                      │
│     - Calculates typing time: ~30-50ms per character   │
│     - Emits `composing` or `recording` via Evolution   │
│     - Dynamic duration cap (e.g., 1.5s min, 7.0s max)  │
│                                                        │
│  4. Resilient Backoff & Retry Engine                   │
│     - Exponential backoff (1s, 2s, 4s)                 │
│     - Eliminates reckless `triggerInstanceRestart()`   │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                Evolution API Gateway                   │
│        /message/sendText, /message/sendMedia           │
│        /chat/sendPresence                              │
└────────────────────────────────────────────────────────┘
```

---

## 8. Summary of Findings for Implementation Team

1. **Target File for Refactoring**: `server_webhook.cjs` is the primary authoritative source (8,142 lines). `server_webhook_vps_live.cjs` should be kept in sync or updated after testing.
2. **Central Dispatch Points**:
   - `sendWhatsAppReply(to, messageText)` (Line 2258)
   - `sendWhatsAppMedia(to, mediaUrl, fileName, caption, mediaType)` (Line 2625)
3. **Presence Endpoint to Integrate**:
   - `POST http://127.0.0.1:8080/chat/sendPresence/GSA_WhatsApp` with `{ "number": cleanPhone, "presence": "composing" | "recording", "delay": typingDelayMs }`.
4. **Queue Architecture**:
   - Must be in-memory, keyed by phone number (`fromPhone`), ensuring that multiple calls to `sendWhatsAppReply` for the same user wait for the previous message + typing delay + randomized human delay (2–6s) before firing the next request.
