# Technical Design & Architectural Specification: WhatsApp Anti-Ban Shield

**Project**: WhatsApp Anti-Ban Shield Refactoring  
**Author**: Explorer 2  
**Target Files**: `server_webhook_vps_live.cjs`, `server_webhook.cjs`, `lib/antiBanEngine.cjs` (or `src/services/whatsapp/antiBanQueue.cjs`)  
**Date**: 2026-08-22  
**Status**: Completed Architectural Blueprint  

---

## 1. Executive Summary & Problem Diagnosis

The GSA WhatsApp Webhook system (`server_webhook_vps_live.cjs` [7,880 LOC] and `server_webhook.cjs` [8,142 LOC]) powers automated customer interactions, AI assistant responses, catalog browsing, and financial transactions (PDF invoices/boletos, PIX generation, vouchers).

### Current Critical Vulnerabilities:
1. **Burst Dispatch Pattern**: In multi-step flows (e.g., Order Confirmation -> PIX Copy-Paste -> Rating Prompt), up to 3-4 messages are fired via `sendWhatsAppReply()` with 0ms delay. This burst pattern is a primary trigger for Meta's automated spam detection and rate-limiting (429/temporary ban).
2. **Absence of Presence Emulation**: Messages are delivered instantly without prior `composing` (typing) or `recording` (audio) presence states, violating natural human messaging heuristics.
3. **Static Text Hashes**: Hundreds of bot responses use identical static strings without lexical variation, causing content-based fingerprinting.
4. **Fragile Error Handling**: Primitive retries with fixed 2s delays and inappropriate instance socket restarts even on non-retriable client errors.
5. **Out-of-Order Delivery**: Because multiple HTTP requests are sent concurrently to Evolution API, network latency differences occasionally cause prompts to arrive before payloads.

---

## 2. Comprehensive Architectural Blueprint (R1 - R4)

```
                                  INCOMING WEBHOOK
                                         │
                                         ▼
                            [ Webhook Router / AI / Flow ]
                                         │
                                         ▼
                        ┌─────────────────────────────────┐
                        │  sendWhatsAppReply() / Media()  │
                        │    (Drop-in Backward Compat)    │
                        └─────────────────────────────────┘
                                         │
                                         ▼
                        ┌─────────────────────────────────┐
                        │        Anti-Ban Shield          │
                        │     (lib/antiBanEngine.cjs)     │
                        ├─────────────────────────────────┤
                        │ 1. Spintax & Variation Parser   │
                        │    - {Olá|Oi|E aí} Expansion   │
                        │    - Markdown Normalization     │
                        ├─────────────────────────────────┤
                        │ 2. Per-Contact FIFO Queue Map   │
                        │    - Map<phone, ContactQueue>   │
                        │    - Concurrency = 1 per phone  │
                        │    - Non-blocking across phones │
                        ├─────────────────────────────────┤
                        │ 3. Presence Simulation Runner   │
                        │    - Dynamic Duration (~35ms/c) │
                        │    - Evolution API /sendPresence│
                        │    - Sleep(duration)            │
                        ├─────────────────────────────────┤
                        │ 4. Randomized Inter-Msg Delay   │
                        │    - 2000ms - 6000ms jitter     │
                        ├─────────────────────────────────┤
                        │ 5. Resilience & Backoff Engine  │
                        │    - Exp Backoff (1s, 2s, 4s)   │
                        │    - Filter 4xx vs 5xx/429/Net  │
                        └─────────────────────────────────┘
                                         │
                                         ▼
                        ┌─────────────────────────────────┐
                        │   Evolution API (Node Service)  │
                        │   http://127.0.0.1:8080         │
                        └─────────────────────────────────┘
```

---

## 3. Requirement Specifications

### R1. Per-Contact FIFO Message Queue

#### Architectural Rules:
- **Per-Contact Isolation**: Each normalized phone number (`cleanPhone`) possesses an independent FIFO queue.
- **Concurrency Model**:
  - Within the *same* contact: strict sequential processing (Concurrency = 1). Message $N+1$ never starts until message $N$ has finished delivery and the post-message randomized delay has elapsed.
  - Across *different* contacts: completely asynchronous and non-blocking (Concurrency = $M$ concurrent active contacts).
- **Randomized Delay ($T_{\text{delay}}$)**:
  - After sending a message to a contact, if there are subsequent messages queued for that same contact, enforce a randomized pause:
    $$\Delta t_{\text{inter}} = \text{random}(\text{minInterval}, \text{maxInterval})$$
    $$\text{Default: } \text{minInterval} = 2000\text{ms}, \quad \text{maxInterval} = 6000\text{ms}$$
- **Memory & Lifecycle Management**:
  - Active queues are stored in a `Map<string, ContactQueue>`.
  - When a queue empties, an `idleCleanupTimer` (e.g., 30,000ms) is initiated. If no new messages arrive before expiration, the entry is deleted from the `Map` to guarantee zero memory leaks.
  - Queue depth guard: Maximum 50 pending messages per contact to guard against accidental recursive infinite loops.

```typescript
interface QueueItem {
  id: string;
  type: 'text' | 'media';
  to: string;
  payload: any;
  options: SendOptions;
  createdAt: number;
  retryCount: number;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

interface ContactQueue {
  phone: string;
  items: QueueItem[];
  isProcessing: boolean;
  lastDispatchTime: number;
  idleTimer: NodeJS.Timeout | null;
}
```

---

### R2. Realistic Presence Simulation (Typing / Recording)

#### Architectural Rules:
- **Presence Endpoints**:
  - `POST /chat/sendPresence/GSA_WhatsApp` (Evolution API v1.x / v2.x compatible)
  - Headers: `apikey: gsa_hub_evolution_token_2026`, `Content-Type: application/json`
  - Body:
    ```json
    {
      "number": "5511920857754",
      "presence": "composing"
    }
    ```
- **Presence Types**:
  - Text and PDF/Documents: `"composing"` (shows "digitando...")
  - Audio / Voice notes: `"recording"` (shows "gravando áudio...")
- **Dynamic Duration Calculation Formula**:
  - Natural human typing speed varies between 200 and 300 characters per minute (≈30ms to 50ms per character).
  $$\text{charCount} = \text{text.length}$$
  $$\text{rawDuration} = (\text{charCount} \times 35\text{ms}) + \text{random}(0, 500\text{ms})$$
  $$\text{duration} = \text{clamp}(\text{rawDuration}, 1500\text{ms}, 8000\text{ms})$$
  - For Media/PDFs without long text: baseline presence duration is fixed to $\text{random}(2000\text{ms}, 4000\text{ms})$ (simulating file selection and upload).
  - For Voice Notes: presence duration equals the duration of the audio clip (or $\text{random}(2500\text{ms}, 7000\text{ms})$).
- **Execution Flow**:
  1. Call Evolution API `sendPresence(number, 'composing')`.
  2. Await `sleep(duration)`.
  3. Send the actual text or media payload.
  4. (Optional) Send `sendPresence(number, 'paused')` if no immediate follow-up.

---

### R3. Spintax Engine & Greeting Variation

#### Architectural Rules:
- **Recursive Grammar**:
  - Syntax: `{option1|option2|option3}`.
  - Supports arbitrary nesting: `{Olá|Oi {amigo|amiga|tudo bem?}}, {como posso ajudar|em que posso ser útil hoje}?`
- **Zero-Dependency Fast Regex Parser**:
  - Evaluates innermost `{...}` groups iteratively until no curly braces remain:
  ```javascript
  function parseSpintax(text) {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    const regex = /\{([^{}]+)\}/;
    let match;
    let iterations = 0;
    while ((match = regex.exec(result)) !== null && iterations < 50) {
      iterations++;
      const choices = match[1].split('|');
      const chosen = choices[Math.floor(Math.random() * choices.length)];
      result = result.slice(0, match.index) + chosen + result.slice(match.index + match[0].length);
    }
    return result;
  }
  ```
- **Contextual Greeting Randomizer**:
  - Produces natural Brazilian Portuguese variations conditioned on time-of-day:
    - **Morning (05:00 - 11:59)**: `"{Bom dia|Olá, bom dia|Oi, tudo bem? Bom dia}"`
    - **Afternoon (12:00 - 17:59)**: `"{Boa tarde|Olá, boa tarde|Oi! Boa tarde}"`
    - **Night (18:00 - 04:59)**: `"{Boa noite|Olá, boa noite|Oi! Boa noite}"`
  - Name formatting integration:
    `getRandomGreeting(clientName)` -> `"Olá, *Adriano*! Tudo bem?"` or `"Oi, *Adriano*, como vai?"`

---

### R4. Exponential Backoff & Resilience

#### Architectural Rules:
- **Error Taxonomy**:
  | Category | Error Type / Code | Action | Retry Strategy |
  |---|---|---|---|
  | **Transient Rate Limit** | HTTP 429 | Retry | Exponential Backoff + Jitter |
  | **Server Fault** | HTTP 500, 502, 503, 504 | Retry | Exponential Backoff + Jitter |
  | **Network / Timeout** | `ECONNRESET`, `ETIMEDOUT`, Socket Timeout | Retry | Exponential Backoff + Jitter |
  | **Client Error** | HTTP 400, 401, 403, 404, 422 | Abort | No retry (log error immediately) |
  | **Invalid Target** | Number not registered on WhatsApp / Phone < 8 digits | Abort | No retry (prevent queue jamming) |

- **Backoff Formula**:
  $$\text{Delay}(a) = \min\left(\text{maxBackoff}, \text{baseBackoff} \times 2^a + \text{jitter}\right)$$
  $$\text{where } \text{baseBackoff} = 1000\text{ms}, \quad a \in \{0, 1, 2\}, \quad \text{jitter} = \text{random}(0, 500\text{ms}), \quad \text{maxBackoff} = 8000\text{ms}$$
  - Attempt 1: ~1,000ms - 1,500ms
  - Attempt 2: ~2,000ms - 2,500ms
  - Attempt 3: ~4,000ms - 4,500ms
  - Max Retries: 3 attempts before safe failure resolution.

---

## 4. Modular Architecture & Integration Plan

### Target Module Structure:
Create `lib/antiBanEngine.cjs` (or `src/services/whatsapp/antiBanQueue.cjs`) with:
```
lib/
└── antiBanEngine.cjs
    ├── Config & Defaults (Delays, limits, timeouts)
    ├── Spintax Parser & Greeting Templates
    ├── Presence Simulation Helper (Evolution API /sendPresence)
    ├── HTTP Dispatcher (sendText & sendMedia with native http/https)
    ├── Exponential Backoff Executor
    ├── Per-Contact Queue Manager (FIFO + auto-cleanup)
    └── Public API Exports:
        ├── enqueueMessage(to, text, options)
        ├── enqueueMedia(to, mediaUrl, fileName, caption, mediaType, options)
        ├── parseSpintax(text)
        ├── getRandomGreeting(name)
        ├── calculateTypingDelay(text)
        ├── sendPresence(to, type)
        └── getQueueStats()
```

### Drop-in Replacement in `server_webhook_vps_live.cjs` & `server_webhook.cjs`:
Replace the monolithic inline `sendWhatsAppReply` (lines 2485-2542) with:

```javascript
// ─── ANTI-BAN SHIELD INTEGRATION ─────────────────────────────────────────────
const antiBanEngine = require('./lib/antiBanEngine.cjs');

function sendWhatsAppReply(to, messageText, retryCount = 0) {
  if (!messageText || !to) {
    console.error('❌ sendWhatsAppReply: parâmetros inválidos', { to, messageText: messageText ? 'ok' : 'vazio' });
    return;
  }
  // Enqueues message into per-contact FIFO with presence & spintax handling
  return antiBanEngine.enqueueMessage(to, messageText);
}

async function sendWhatsAppMedia(to, mediaUrl, fileName, caption, mediaType = 'document') {
  if (!mediaUrl || !to) return;
  return antiBanEngine.enqueueMedia(to, mediaUrl, fileName, caption, mediaType);
}
```

### Zero-Regression Guarantees:
1. **Signature Invariance**: Existing function signatures `sendWhatsAppReply(to, text)` and `sendWhatsAppMedia(to, url, name, caption, type)` remain 100% identical.
2. **All 400+ Call Sites Protected**: Every module (Financeiro boletos, OS updates, AI Gemini replies, dropshipping recommendations, calculator PDFs) inherits Anti-Ban protection automatically without touching 7,800 lines of existing flow logic.
3. **No External NPM Dependencies**: Built exclusively on native Node.js core modules (`http`, `https`, `crypto`, `events`), keeping the deployment portable for VPS systemd services.

---

## 5. Risk Assessment & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Large burst of incoming users flooding memory | Memory exhaustion | Automatic queue eviction on idle + maximum queue length clamp per contact (50 items). |
| Evolution API presence endpoint down/unsupported | Message delay or failure | Wrap `/chat/sendPresence` in a non-blocking `try/catch` with 3s timeout. If presence fails, log warning and proceed to message dispatch immediately. |
| Message ordering inversion | Broken customer experience | Strict FIFO queue per contact guarantees order: message 1 resolves before message 2 starts presence/dispatch. |
| Nested spintax causing infinite loop | Node event loop freeze | Loop iteration counter capped at 50 iterations; fallback to raw text if syntax is unparseable. |
