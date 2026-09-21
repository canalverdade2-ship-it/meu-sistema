# DISPATCH — Explorer 2

## 2026-08-22T02:40:36Z

### Mission
Investigate the technical design and architectural specifications for the Anti-Ban Shield (R1, R2, R3, R4):
1. R1: Per-contact FIFO message queue with randomized delay (2000ms - 6000ms) between messages to the same contact, non-blocking across distinct contacts.
2. R2: Realistic Presence simulation via Evolution API (`/chat/sendPresence/` or `/chat/presence/`). Calculate dynamic presence duration: e.g. ~35ms per character (min 1500ms, max 8000ms) for text/pdf, or audio duration for voice notes. Send 'composing' / 'recording', wait the duration, then 'paused' or dispatch message.
3. R3: Spintax Engine & Greeting Variation. Parse `{Olá|Oi|E aí}` syntax, nested spintax support, random greeting templates for automated bot replies to prevent hash/content spam filters.
4. R4: Exponential Backoff & Resilience. Retry on 5xx errors, 429 rate limits, and network/timeout failures with exponential backoff + jitter (e.g. 1s, 2s, 4s, up to maxRetries=3). Do not retry 400 Bad Request or invalid number errors.
5. Modular design: Recommend creating a dedicated anti-ban module (e.g., `src/services/whatsapp/antiBanQueue.cjs` or `lib/antiBanEngine.cjs`) and clean integration hooks into `server_webhook_vps_live.cjs` and `server_webhook.cjs` that guarantee zero regression for boletos/PDFs and transactional replies.

Write detailed findings and architectural blueprint to:
- `.agents/teamwork_preview_explorer_2/analysis.md`
- `.agents/teamwork_preview_explorer_2/handoff.md`
