# DISPATCH

## 2026-08-22T02:39:48Z
- Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_3
- Mission: Refatoração profunda do webhook do WhatsApp (`server_webhook_vps_live.cjs` e `server_webhook.cjs`) para implementar um escudo Anti-Ban robusto. Simular comportamento 100% humano (delays, filas de mensagens, presença e variações de texto) para evitar bloqueios pela Meta.
- Requirements:
  - R1. Fila de Mensagens Inteligente (Message Queue per user/number with random intervals 2-6s)
  - R2. Presença Realista (Typing / Recording presence emitted before sending, dynamic typing duration based on text length)
  - R3. Variação de Respostas (Spintax / Randomization utility for greetings/standard texts)
  - R4. Backoff de Erros (Resilience with exponential backoff on Evolution API failures/timeouts)
- Acceptance Criteria & Testing:
  - Mock test script testing queue delays, typing/composing presence, and error backoff.
  - Zero breakage to existing invoice, PDF, or transactional webhook business logic.
