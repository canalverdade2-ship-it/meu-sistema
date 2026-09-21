# Handoff Report: WhatsApp Webhook & Anti-Ban Shield Architecture Investigation

**Agent:** Explorer 1 (`teamwork_preview_explorer_1`)  
**Mission:** Investigate `server_webhook.cjs` and `server_webhook_vps_live.cjs` to establish baseline architecture for the WhatsApp Anti-Ban Shield Refactoring.  
**Date:** 2026-08-21T23:45:00-03:00  

---

## 1. Observation

### File Metadata & Structure
- **Target Files Analyzed**:
  - `server_webhook.cjs` (8,142 lines, 409,693 bytes).
  - `server_webhook_vps_live.cjs` (7,880 lines, 395,986 bytes).
  - `scratch/deploy_webhook.cjs` (39 lines) — establishes that `server_webhook.cjs` is uploaded via SCP and copied to Docker container `n8n:/home/node/server_webhook.cjs`.
- **Framework & HTTP Server**:
  - Direct Node.js native `http.createServer` at line 7628 of `server_webhook_vps_live.cjs` and line 7890 of `server_webhook.cjs`.
  - Default Port: `process.env.PORT || 5680` listening on `0.0.0.0` (Lines 7, 7870).

### Inbound Webhook Pipeline
- **Meta Webhook Verification (`GET /webhook`)**: Lines 7719–7733 in `server_webhook_vps_live.cjs` / Lines 7981–7995 in `server_webhook.cjs`:
  ```javascript
  const mode = urlObj.searchParams.get('hub.mode');
  const token = urlObj.searchParams.get('hub.verify_token');
  const challenge = urlObj.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(challenge);
  }
  ```
- **Inbound Event Receiver (`POST /webhook`)**: Lines 7736–7840 in `server_webhook_vps_live.cjs` / Lines 7998–8102 in `server_webhook.cjs`:
  - Returns HTTP 200 `{ status: 'ok' }` synchronously before processing.
  - Evolution API payload extraction:
    - Filters: `data.data.key.fromMe === true` ignored; `data.event !== 'messages.upsert'` ignored.
    - Remote JID & LID resolution:
      ```javascript
      let rawJid = data.data.key.remoteJid || '';
      const altJid = data.data.key.remoteJidAlt || '';
      if (rawJid.includes('@lid') && altJid && !altJid.includes('@lid')) {
        rawJid = altJid;
      } else if (!rawJid || rawJid.includes('@lid')) {
        rawJid = altJid || rawJid;
      }
      fromPhone = rawJid.split('@')[0].split(':')[0].replace(/\D/g, '');
      ```
    - PushName: `data.data.pushName || data.data.key?.pushName || ''`.
    - Media types parsed: `imageMessage`, `audioMessage` / `pttMessage`, `videoMessage`, `documentMessage`, standard text (`conversation`, `extendedTextMessage`).

### Outbound Communication Paths & Endpoints
- **Evolution API Integration**:
  - Base URL: `http://127.0.0.1:8080`
  - Instance Name: `GSA_WhatsApp`
  - Auth Header: `'apikey': 'gsa_hub_evolution_token_2026'`
  - Text: `POST /message/sendText/GSA_WhatsApp` in `sendWhatsAppReply(to, messageText, retryCount)` (Line 2258 in `server_webhook.cjs`).
  - Media/PDF/Images: `POST /message/sendMedia/GSA_WhatsApp` in `sendWhatsAppMedia(to, mediaUrl, fileName, caption, mediaType)` (Line 2625 in `server_webhook.cjs`).
  - Media Fetch: `POST /chat/getBase64FromMediaMessage/GSA_WhatsApp` in `handleAudioMessage` (Lines 737, 751) and `handleClientMediaUpload` (Line 3232).
  - Instance Restart: `POST /instance/restart/GSA_WhatsApp` in `triggerInstanceRestart()` (Line 2208).
  - **Presence Endpoint**: Evolution API's `/chat/sendPresence` **is not present** anywhere in the codebase.

### Message Types & Dispatches
1. **Text**: Transformed via `formatToWhatsAppMarkdown(text)` (Lines 2223–2256) and sent via `sendWhatsAppReply`.
2. **Images**: Dispatched via `sendWhatsAppMedia(..., 'image')` for product photos and dynamic PIX QR Codes generated via `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=...` (Lines 2031, 6116).
3. **PDF Invoices**: `generateInvoicePdfBase64(fatura, client)` (Lines 2397–2491) dynamically creates a raw binary PDF-1.4 buffer and sends via `sendWhatsAppMedia(..., 'document')`.
4. **PDF Calculation Reports**: `generateCalculatorReportPdfBase64(report)` (Lines 2493–2623) dynamically generates PDF-1.4 report for CLT termination, retirement, and benefits.
5. **Audio**: Inbound voice notes are fetched via Base64 and transcribed using Google Gemini Flash 2.5 (`generativelanguage.googleapis.com`). Outbound audio is currently not sent.

### Concurrency, Retries & Error Handling Observations
- **No Outbound Queue**: Outbound requests fire immediately in parallel with zero queuing or rate limiting.
- **Flawed Retry Logic**:
  - `sendWhatsAppReply` calls `triggerInstanceRestart()` on non-200 responses, restarting the entire Evolution instance socket, and waits 2s before retrying.
  - Network timeouts and socket errors (`req.on('error')`, `req.setTimeout`) log to console but do not retry.
  - `sendWhatsAppMedia` has no retry mechanism.
- **No Typing Simulation**: Zero presence indicators (`composing`, `recording`) are sent prior to message dispatch.
- **Race Conditions**: `userSessions[fromPhone]` is mutated synchronously in memory across concurrent incoming requests without locking.

### Differences Between Files
- `server_webhook.cjs` vs `server_webhook_vps_live.cjs`: 23 diff hunks (+605 additions, -343 deletions).
- Key additions in `server_webhook.cjs`:
  - AI System prompt rules for human support (Rule 7) and credit requests (Rule 8).
  - Dynamic support department lookup `showHumanSupportSectors` querying `gsa_whatsapp_ramais`.
  - Comprehensive Credit & Loan application module (`parseMoneyAmount`, `maskDocument`, `extractCreditDataFromText`, `startCreditRequest`, `advanceCreditFlow`, `renderCreditSimulation`, `finalizeCreditSubmission`).
  - Consolidation of legacy client account functions.

---

## 2. Logic Chain

1. **Premise**: Meta's anti-spam detection algorithms flag WhatsApp accounts when messages are sent in rapid bursts, without typing indicators, using identical static strings, or with unnatural sub-second response times.
2. **Observation Step 1**: In `server_webhook.cjs`, `sendWhatsAppReply` and `sendWhatsAppMedia` directly execute `http.request` to `http://127.0.0.1:8080/message/sendText/GSA_WhatsApp` without passing through any queue, mutex, or delay scheduler.
3. **Observation Step 2**: Multiple concurrent messages from a single user or automated background triggers fire multiple HTTP requests to Evolution API in parallel within milliseconds.
4. **Observation Step 3**: `server_webhook.cjs` contains zero calls to `/chat/sendPresence/GSA_WhatsApp`, meaning the WhatsApp client never displays "typing..." (`composing`) or "recording audio..." (`recording`).
5. **Observation Step 4**: On delivery failure, `sendWhatsAppReply` invokes `triggerInstanceRestart()`, which restarts the entire Evolution container socket instead of applying exponential backoff to the failed message.
6. **Inference**: The current webhook architecture is vulnerable to Meta anti-spam flags and account bans during high-volume periods or multi-message workflows.
7. **Conclusion**: An Anti-Ban Shield layer consisting of (1) a per-user FIFO queue with 2–6s random jitter, (2) realistic typing presence simulation (`/chat/sendPresence`), (3) Spintax greeting variation, and (4) resilient exponential backoff retry is required.

---

## 3. Caveats

1. **VPS Network Latency**: In production, the Evolution API is running locally on the VPS (`127.0.0.1:8080`) while PostgREST runs on `127.0.0.1:3001`. Delays measured locally on mock environments will differ slightly from production execution times.
2. **Evolution API Version Compatibility**: Evolution API v2 is assumed based on payload structures (`data.data.key`, `/chat/getBase64FromMediaMessage/GSA_WhatsApp`). The presence endpoint payload format for Evolution v2 (`POST /chat/sendPresence/{instance}` with `{ number, presence, delay }`) must be verified against the running container during integration.
3. **Memory Persistence**: The current `userSessions` is an in-memory dictionary. Any in-memory queue will live in Node.js process memory and be cleared on PM2 process restart.

---

## 4. Conclusion

1. **Source of Truth**: `server_webhook.cjs` (8,142 lines) is the authoritative target file to refactor.
2. **Architecture Refactoring Scope**:
   - Centralize all outgoing communications (`sendWhatsAppReply` and `sendWhatsAppMedia`) through a new `enqueueWhatsAppMessage(to, job)` queue engine.
   - Implement `sendWhatsAppPresence(to, presenceType, durationMs)` targeting `http://127.0.0.1:8080/chat/sendPresence/GSA_WhatsApp`.
   - Calculate human typing delays: `clamp(text.length * 40ms, 1500ms, 7000ms)` and audio recording delays: `clamp(audioDurationMs, 2000ms, 8000ms)`.
   - Replace rigid greeting strings with a Spintax randomization engine: `{Olá|Oi|Tudo bem?|Olá, como vai?}`.
   - Replace `triggerInstanceRestart()` with exponential backoff retries (1s, 2s, 4s, up to 3 attempts) handling both HTTP 5xx and network errors.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify File Sizes & Lines**:
   ```powershell
   (Get-Content server_webhook.cjs).Length
   (Get-Content server_webhook_vps_live.cjs).Length
   ```
   *Expected*: ~8,142 lines for `server_webhook.cjs` and ~7,880 lines for `server_webhook_vps_live.cjs`.

2. **Verify Evolution API Endpoints & Absence of Presence**:
   ```powershell
   Select-String -Path server_webhook.cjs -Pattern "sendText|sendMedia|sendPresence|getBase64FromMediaMessage"
   ```
   *Expected*: `sendText`, `sendMedia`, and `getBase64FromMediaMessage` exist; `sendPresence` returns zero matches.

3. **Verify File Diff & Credit Workflow**:
   ```powershell
   git diff --no-index --stat server_webhook_vps_live.cjs server_webhook.cjs
   ```
   *Expected*: ~948 lines diff showing credit application and ramais support additions.

4. **Verify Immediate Inbound Webhook Acknowledgement**:
   Inspect line 8000 of `server_webhook.cjs` to confirm `res.writeHead(200); res.end(JSON.stringify({ status: 'ok' }));` before payload parsing.
