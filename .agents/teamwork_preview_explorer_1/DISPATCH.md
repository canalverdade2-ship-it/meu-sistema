# DISPATCH — Explorer 1

## Mission
Investigate `server_webhook_vps_live.cjs` and `server_webhook.cjs` in the workspace root.
- Examine how incoming WhatsApp webhook events are handled.
- Analyze all outgoing message dispatch points (`sendWhatsAppReply`, Evolution API calls, `/message/sendText`, `/message/sendMedia`, `/chat/sendPresence`, etc.).
- Document all message types currently supported (text, PDF/documents, media/audio, location, buttons, etc.) and their payload structures.
- Identify how contacts/numbers are identified (`remoteJid`, `sender`, phone number parsing).
- Document current error handling and timeout behaviors.
- Write your comprehensive findings to `.agents/teamwork_preview_explorer_1/handoff.md` and `analysis.md`.

## 2026-08-21T23:40:36-03:00
Investigate `server_webhook_vps_live.cjs` and `server_webhook.cjs` in the workspace root:
1. Trace the incoming webhook pipeline (Express app, endpoints, signature/token validation, payload extraction, jid/phone normalization).
2. Trace all outgoing communication paths (Evolution API URLs, HTTP methods, headers, auth tokens, `sendWhatsAppReply`, sendText, sendMedia, sendAudio, sendPresence endpoints).
3. Enumerate all message types (text, pdf, invoice document, audio, buttons, etc.) and where and how they are dispatched in the codebase.
4. Identify existing error handling, timeouts, retry logic (or lack thereof), and concurrency behaviors.
5. Identify any differences between `server_webhook_vps_live.cjs` and `server_webhook.cjs` (is one a staging/local copy and the other production live, or are they paired?).
