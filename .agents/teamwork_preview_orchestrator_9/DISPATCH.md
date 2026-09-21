# Dispatch Log

## 2026-08-27T15:21:00Z

Implement a fully automated WhatsApp self-service flow for benefit redemption protocols using Gemini AI for natural language understanding.

### Requirements:
1. **R1. AI-Driven Protocol Flow**:
   - Integrate Gemini AI into `server_webhook_vps_live.cjs` (and `server_webhook.cjs` if applicable) to handle messages containing a protocol code (e.g. `PROT-RES-xxxx` / `PROT-RES-YYYY-XXXXXX`).
   - The AI must interpret natural language intents ("alterar", "cancelar") and extract specific fields (`nome_completo`, `email`, `telefone`) and their new values without requiring the user to type strict menu numbers.
   - Re-use the existing `GEMINI_API_KEY` and AI infrastructure logic in the project.

2. **R2. State Management & Database Updates**:
   - Implement a conversational state machine (`IDENTIFIED`, `AWAITING_ACTION`, `AWAITING_FIELD`, `AWAITING_NEW_VALUE`, `AWAITING_CANCEL_CONFIRM`).
   - Execute Supabase updates to modify `parceiros_resgates` (updating name, email, or phone) or to cancel the request (setting `status='cancelado'` and `data_cancelamento=now()`).
   - Ensure the `data_cancelamento` column exists in `parceiros_resgates` via SQL migration before updating (provide migration in `supabase/migrations/` and apply if needed/idempotent).

3. **R3. Notifications & Hardcoded Fixes**:
   - Fix the typo in the file: change `whatsapp_atendimento` from `5511920857754` to the correct `5511920857756`.
   - Send automated WhatsApp alerts to the Admin Master `5511971858372` upon any data alteration or cancellation, containing the protocol and changed data.

### Acceptance Criteria:
- Sending a message with a valid protocol code to the webhook successfully triggers the AI-generated welcome message.
- Sending a natural language request like "quero mudar meu email para novo@email.com" successfully extracts the field and value via AI.
- The Supabase database (`parceiros_resgates`) reflects the updated data or the `cancelado` status correctly.
- The WhatsApp Master number (`5511971858372`) receives a well-formatted notification message detailing the change or cancellation.
- All existing tests continue to pass and build passes. Add comprehensive automated tests validating this flow.
