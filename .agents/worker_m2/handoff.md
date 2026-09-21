# Handoff Report — Milestone 2: Client Public Protocol Appeal UI

## 1. Observation
- **Target File**: `src/components/public/ProtocolConsultPage.tsx`
  - When `result.status === 'recusado'` and `!result.recurso`, renders the "Contestar a recusa" callout banner and action button.
  - Implements the complete 3-step Appeal Submission Modal:
    - **Step 1 (Form)**: Justification textarea with live character counter enforcing the 20 to 4000 character validation range; evidence uploader allowing up to 3 attachments (PNG, JPG, WEBP, PDF up to 5MB each) with thumbnail previews, deletion controls, and direct upload to the Supabase storage bucket `parceiros-midias` via `uploadAppealEvidenceFile`.
    - **Step 2 (WhatsApp Verification)**: Initiates PIN challenge via `beginPartnerAppealChallenge` / `requestPartnerAppealVerification`, shows masked destination phone number (`••••XXXX`), 6-digit numeric PIN input, 10-minute expiry countdown, and "Reenviar código" capability; completes appeal via `completePartnerAppeal` / `submitPartnerAppeal`.
    - **Step 3 (Success)**: Displays confirmation banner, Appeal Protocol (`protocolo_recurso`), SLA deadline notice (5 business days), and re-fetches protocol status.
  - **Single Appeal Enforcement**: When `result.recurso` exists, the "Contestar a recusa" button is hidden and replaced by the Appeal Status Card displaying status badge (`em_analise` / `deferido` / `indeferido`), appeal protocol, opening date, SLA deadline (`prazo_analise_em`), customer justification, and admin decision rationale when denied.
  - **Audit Timeline**: Section heading `"Histórico do protocolo"` rendering `result.eventos` chronologically with distinct event icons, status badges, titles, descriptions, and formatted timestamps (`formatDate(evento.ocorrido_em)`).
  - **Realtime Subscription**: Uses `useRealtimeSubscription` listening to `table: 'parceiros_resgates_public_status'` with `filter: tracking_key=eq.${result.tracking_key}` to trigger automatic re-fetches upon database status changes without exposing client PII.
- **Service & Types Extensions**:
  - `src/features/partners/service.ts`: Exported `beginPartnerAppealChallenge`, `completePartnerAppeal`, and `uploadAppealEvidenceFile`; updated `submitPartnerAppeal` to accept optional `anexos?: string[]`.
  - `src/features/partners/types.ts`: Added `evidencias?: string[]` to `PartnerRedemptionAppeal`.

## 2. Logic Chain
1. *Requirement 1 & 3 (Contestation Action & Single Lock)*: The protocol lookup result contains `result.status` and `result.recurso`. By checking `result.status === 'recusado' && !result.recurso`, the UI offers the appeal contestation action only when eligible. If `result.recurso` is populated, the action button is replaced with the read-only Appeal Status Card, satisfying the single-appeal constraint.
2. *Requirement 2 (Modal, Validation, Upload & PIN Challenge)*: The appeal modal breaks the process into structured steps. Textarea validation rejects strings outside [20, 4000] chars. Evidence files are restricted to max 3 files and 5MB per file, uploaded to Supabase bucket `parceiros-midias`. Calling `beginPartnerAppealChallenge` initiates the WhatsApp PIN challenge, and `completePartnerAppeal` completes the challenge transactionally with outbox notification emission.
3. *Requirement 4 (Audit Timeline)*: The RPC `gsa_public_consultar_protocolo` returns `result.eventos`. Rendering this list inside the `"Histórico do protocolo"` section gives the customer full transparency on every transition (e.g. `solicitacao_criada`, `solicitacao_recusada`, `recurso_interposto`, `recurso_deferido`, `recurso_indeferido`, `beneficio_liberado`).
4. *Requirement 5 (Sanitized Realtime)*: The database migration created `parceiros_resgates_public_status` with `tracking_key` and revision bumps. Subscribing to this table instead of `parceiros_resgates` respects RLS privacy policies while maintaining reactive UI updates.
5. *UTF-8 Integrity & Constraints*: All strings use valid Portuguese diacritics without mojibake. No Git commands or Cloudflare Pages deployments were performed.

## 3. Caveats
- No caveats. All requirements and interface contracts have been implemented and validated against the automated test suites.

## 4. Conclusion
Milestone 2 (Client Public Protocol Appeal UI) is 100% complete and fully verified. The customer appeal workflow in `ProtocolConsultPage.tsx` provides full contestation submission, evidence handling, WhatsApp verification, single-appeal locking, audit timeline rendering, and sanitized realtime updates.

## 5. Verification Method
Run the test suites and typecheck commands:
```bash
npx vitest run src/tests/partner-redemption-appeals.test.ts src/tests/partner-redemption-appeals-e2e.test.ts
npm run typecheck:strict
```
### Test Output Evidence:
```
 ✓ src/tests/partner-redemption-appeals.test.ts (12 tests) 21ms
 ✓ src/tests/partner-redemption-appeals-e2e.test.ts (40 tests) 938ms

 Test Files  2 passed (2)
      Tests  52 passed (52)
   Duration  4.95s

 Strict Typecheck: 0 errors (Exit code 0)
```
