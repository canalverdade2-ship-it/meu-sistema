# Architectural Survey & Deep-Dive Analysis: WhatsApp Evolution API Stability & Humanization

**Date**: 2026-08-27  
**Agent**: Survey Explorer 1 (`survey_explorer_1`)  
**Scope**: `src/lib/whatsappNotificationService.ts`, Evolution API v1/v2 Endpoints, Fallback Cascade, Concurrency & Humanization Choreography (R1, R3).

---

## 1. Executive Summary

This report presents a thorough investigation of the WhatsApp notification subsystem in GSA HUB, specifically examining `src/lib/whatsappNotificationService.ts`, its interaction with Evolution API (port 8080), the Supabase Edge Function `vps-api`, the n8n webhook tier (port 5678), and the humanization/anti-ban requirements (R1: Presence Choreography, R3: Concurrency Control & Grouping).

Currently, `whatsappNotificationService.ts` dispatches outgoing messages directly and synchronously with minimal delay (`delay: 500`), without presence indicators (no `composing`, `paused`, `available`, `unavailable`), without initial jitter delays, and without concurrency queues or recipient-level batching. Multiple simultaneous notifications result in immediate bursts of HTTP POST requests to Evolution API, triggering potential rate-limit blocks and unnatural traffic patterns.

This document details the exact endpoints, fallback behaviors, concurrency mechanisms, type signatures, and the blueprint for implementing R1 (Presence Choreography) and R3 (Micro-Jitter & Batching) with 100% backward compatibility and test resilience.

---

## 2. Evolution API Endpoints & Protocol Map

### 2.1 Host & Connection Configuration
- **Server Address**: `http://147.15.43.141:8080` (Primary Oracle Cloud VPS)
- **Fallback / Local Hosts**: `http://127.0.0.1:8080`, `http://localhost:8080`, `http://172.19.0.1:8080` (Docker internal)
- **Instance Identifier**: `GSA_WhatsApp`
- **Global API Token**: `gsa_hub_evolution_token_2026`
- **Headers**:
  ```http
  apikey: gsa_hub_evolution_token_2026
  Content-Type: application/json
  ```

### 2.2 Endpoint Catalog

| Endpoint | Method | Purpose | Payload Specification |
|---|---|---|---|
| `/message/sendText/{instance}` | `POST` | Send text message | `{"number": string, "text": string, "delay"?: number, "linkPreview"?: boolean}` |
| `/message/sendMedia/{instance}` | `POST` | Send image / document / PDF | `{"number": string, "mediatype": string, "mimetype": string, "caption"?: string, "media": string, "fileName"?: string, "delay"?: number}` |
| `/chat/sendPresence/{instance}` | `POST` | Set typing/recording or online/offline status | `{"number"?: string, "presence": "available" \| "unavailable" \| "composing" \| "recording" \| "paused", "delay"?: number}` |
| `/chat/markMessageAsRead/{instance}` | `POST` | Emit read receipt for inbound messages | `{"readMessages": [{"remoteJid": string, "fromMe": false, "id"?: string}]}` |
| `/chat/findChats/{instance}` | `POST` | Query active chats & resolve LIDs / JIDs | `{"where": {}}` |
| `/instance/connectionState/{instance}` | `GET` | Probe instance connection status | Returns `{"instance": {"state": "open" \| "close" \| "connecting"}}` |
| `/instance/connect/{instance}` | `GET` | Retrieve QR code or pairing code | Returns `{"base64": string, "code": string, "pairingCode": string}` |
| `/instance/create` | `POST` | Initialize Baileys instance | `{"instanceName": "GSA_WhatsApp", "qrcode": true, "integration": "WHATSAPP-BAILEYS"}` |

### 2.3 Presence States & Semantics (Evolution API / Baileys)
1. **`available`**: Sets instance state to Online in WhatsApp.
2. **`unavailable`**: Clears online presence / sets Offline.
3. **`composing`**: Emits real-time typing indicator ("digitando...") in the target chat.
4. **`paused`**: Suspends the typing indicator ("digitando..." disappears while remaining in chat).
5. **`recording`**: Emits voice recording indicator ("gravando áudio...").

> ⚠️ **Critical Requirement for Presence Calls**: All calls to `/chat/sendPresence` must be non-blocking and guarded with a strict timeout (e.g., 2.5s) and `try/catch`. If presence fails due to temporary network glitch or endpoint mismatch, the system must log a warning and proceed directly to message delivery without failing the notification.

---

## 3. Fallback Cascade Architecture (3-Tier Delivery)

Every message dispatched through `whatsappNotificationService.enviarWhatsAppDireto` must traverse the standardized 3-tier cascade:

```
                  ┌─────────────────────────────────────┐
                  │ whatsappNotificationService.send()  │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │ Tier 1: Evolution API Direct (Port 8080)│
                │ http://147.15.43.141:8080               │
                └────────────────────┬────────────────────┘
                                     │ (On Failure / Timeout)
                                     ▼
                ┌─────────────────────────────────────────┐
                │ Tier 2: Edge Function "vps-api"         │
                │ supabase.functions.invoke('vps-api')    │
                └────────────────────┬────────────────────┘
                                     │ (On Failure / Error)
                                     ▼
                ┌─────────────────────────────────────────┐
                │ Tier 3: n8n Webhook Direct (Port 5678)  │
                │ http://147.15.43.141:5678/webhook/send  │
                └────────────────────┬────────────────────┘
                                     │ (On Failure)
                                     ▼
                        [Toast Error & Return False]
```

### 3.1 Tier 1: Evolution API Direct (`http://147.15.43.141:8080`)
- **Transport**: Direct `fetch()` over HTTP.
- **Endpoints**: `/message/sendText/GSA_WhatsApp` or `/message/sendMedia/GSA_WhatsApp`.
- **Payload Format**:
  - Text: `{ number: resolvedDestination, text: mensagem, delay: 500, linkPreview: options?.linkPreview ?? false }`
  - Media: `{ number: resolvedDestination, mediatype: 'image', mimetype: 'image/png', caption: mensagem, media: options.mediaUrl || options.mediaBase64, fileName: options.fileName || 'logo-parceiro.png', delay: 500 }`
- **Timeout**: 6,000ms (text) / 8,000ms (media).
- **Success Criteria**: HTTP status `200` or `201`, or response body containing `key.id` or `status: 'PENDING'`.

### 3.2 Tier 2: Supabase Edge Function (`vps-api`)
- **Transport**: `supabase.functions.invoke('vps-api', { body: ... })`.
- **Payload Format**:
  ```json
  {
    "action": "send-whatsapp",
    "phone": "5511999999999",
    "message": "Texto da notificação",
    "title": "Notificação GSA HUB",
    "category": "CLIENTE",
    "targetIp": "147.15.43.141"
  }
  ```
- **Internal Behavior**: `vps-api` attempts Evolution API over Docker internal network (`172.19.0.1:8080`, `host.docker.internal:8080`, `147.15.43.141:8080`), falling back to local n8n (`:5678`).
- **Success Criteria**: `!error && data?.success === true`.

### 3.3 Tier 3: n8n Webhook (`http://147.15.43.141:5678/webhook/send-whatsapp`)
- **Transport**: Direct `fetch()` to n8n webhook workflow.
- **Payload Format**:
  ```json
  {
    "phone": "5511999999999",
    "message": "Texto da notificação",
    "title": "Notificação GSA HUB",
    "category": "CLIENTE"
  }
  ```
- **Timeout**: 5,000ms.
- **Success Criteria**: `n8nRes.ok` (HTTP 200).

---

## 4. Requirement R1: Presence Choreography Deep-Dive

### 4.1 Required Step Sequence
When a notification is prepared for dispatch to recipient $R$:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Initial Random Delay                                         │
│ • Random sleep between 4,000ms and 12,000ms                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Read Receipt (if reply context exists)                       │
│ • POST /chat/markMessageAsRead/GSA_WhatsApp                           │
│   readMessages: [{ remoteJid: R, fromMe: false, id: msgId }]          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Available Status                                             │
│ • POST /chat/sendPresence/GSA_WhatsApp { number: R, presence: 'available' }
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Typing Indicator Choreography                                 │
│ 1. POST /chat/sendPresence { number: R, presence: 'composing' }       │
│    └── Wait 4,000ms                                                   │
│ 2. POST /chat/sendPresence { number: R, presence: 'paused' }          │
│    └── Wait 2,000ms                                                   │
│ 3. POST /chat/sendPresence { number: R, presence: 'composing' }       │
│    └── Wait 3,000ms                                                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Message Dispatch & Unavailable Cleanup                       │
│ 1. Execute 3-Tier Fallback Cascade (Evolution API -> Edge -> n8n)      │
│ 2. POST /chat/sendPresence { number: R, presence: 'unavailable' }     │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Time Scaling & Test Mode Support
To ensure automated test suites (`vitest run src/tests`) execute within milliseconds without timing out, the engine must support configurable time scaling:
- In production: `timeScale = 1.0` (delays: 4-12s initial, 4s composing, 2s pause, 3s composing).
- In test environments (`process.env.NODE_ENV === 'test'` or `options.skipPresence` or `options.timeScale`): scaled down to instantaneous / ~1ms.

---

## 5. Requirement R3: Concurrency Control & Grouping Deep-Dive

### 5.1 Problem Statement
Currently, calling `enviarWhatsAppDireto` from multiple UI components or background triggers fires simultaneous requests without throttling. Sending multiple messages to different numbers in the same millisecond alerts WhatsApp spam heuristics. Furthermore, generating multiple alerts for the *same recipient* (e.g., an invoice + a receipt + an OS update in the same second) produces multiple noisy WhatsApp notifications.

### 5.2 Micro-Jitter (Cross-Recipient Isolation)
- When dispatches for **different phone numbers** are enqueued concurrently:
  - Enforce an asynchronous micro-jitter delay (e.g., 300ms to 1,200ms) between starting their processing pipelines.
  - Prevents burst requests hitting the Evolution API port in the exact same millisecond.

### 5.3 Message Grouping / Batching (Same Recipient)
- When multiple messages are enqueued for the **same phone number** within the initial delay window:
  - Coalesce the message bodies into a single composite message separated by clean newline dividers:
    ```
    🏢 *GSA — Gestão de Serviços*
    
    [Conteúdo da Notificação 1]
    
    ══════════════════════════════
    
    [Conteúdo da Notificação 2]
    
    _Mensagem enviada via GSA HUB._
    ```
  - Both promises resolve with `true` when the single composite message is delivered.
  - Reduces recipient notification fatigue and WhatsApp message count.

### 5.4 Global Dispatch Pause Support (R5 Hook)
- The queue manager must expose `setDispatchPaused(boolean)` and `isDispatchPaused(): boolean`.
- When paused from the admin monitor (`WhatsAppHealthMonitor.tsx`), messages accumulate in the local memory queue without being discarded.
- When unpaused, the queue resumes processing seamlessly.

---

## 6. Type Signatures & Interfaces

### 6.1 Extended `SendDirectOptions` Interface
```typescript
export interface SendDirectOptions {
  clienteNome?: string;
  codigoFatura?: string;
  mediaBase64?: string;
  mediaUrl?: string;
  pdfUrl?: string;
  pdfPath?: string;
  fileName?: string;
  linkPreview?: boolean;

  // Humanization & Choreography Options (R1 & R3)
  isReply?: boolean;
  quotedMessageId?: string;
  skipPresence?: boolean;
  timeScale?: number;
  customInitialDelayMs?: number;
}
```

### 6.2 Queue Item & Grouping Structure
```typescript
export interface QueuedWhatsAppItem {
  id: string;
  phone: string;
  resolvedDestination: string;
  message: string;
  options?: SendDirectOptions;
  enqueuedAt: number;
  resolve: (value: boolean) => void;
  reject: (reason?: any) => void;
}
```

---

## 7. Technical Risks & Mitigation Plan

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Presence endpoint network hang** | Delays message dispatch or blocks queue | Enforce strict 2.5s AbortSignal timeout on all `/chat/sendPresence` and `/chat/markMessageAsRead` calls. Treat presence as optional enhancement (swallow errors, never fail message dispatch). |
| **Unit test timeouts due to delays** | `npm run test:unit` fails due to 20s+ delay | Implement dynamic `timeScale` that defaults to `0.001` or checks `process.env.NODE_ENV === 'test'`, reducing delays to ~1ms during testing while maintaining 100% logic execution. |
| **Memory accumulation on pause** | Unbounded queue if left paused for days | Set maximum queue depth per contact (e.g. 50 items) with eviction policy and queue depth telemetry for `WhatsAppHealthMonitor`. |
| **PDF buffer hash uniqueness (R2)** | Spam detection on identical PDF attachments | Append a non-destructive randomized comment byte (e.g. `\n%GSA-RANDOM-[timestamp]-[random]\n`) to the end of generated PDF buffers before Base64 encoding. |
| **Spam detection on repetitive texts (R2)** | Meta spam filter flags identical string hashes | Inject dynamic zero-width space characters (`\u200B`) and randomized Spintax greetings/footers with dynamic URL query params (`?t=...&ref=...`). |

---

## 8. Verification & Test Plan

1. **Unit Test Verification**:
   - `npx vitest run src/tests/whatsapp-notification-engine.test.ts`
   - `npx vitest run src/tests/empirical-stress-partner-whatsapp.test.ts`
   - `npx vitest run src/tests/whatsapp-pricing-idempotency-challenger.test.ts`
2. **Type Safety**:
   - `npm run typecheck:strict`
3. **Choreography Order Assertion**:
   - Verify spy calls observe: (1) `/chat/markMessageAsRead` (if reply) -> (2) `/chat/sendPresence` (`available`) -> (3) `/chat/sendPresence` (`composing`) -> (4) `/chat/sendPresence` (`paused`) -> (5) `/chat/sendPresence` (`composing`) -> (6) `/message/sendText` -> (7) `/chat/sendPresence` (`unavailable`).
