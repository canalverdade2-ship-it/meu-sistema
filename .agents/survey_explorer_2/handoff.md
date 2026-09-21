# Handoff Report — survey_explorer_2

## 1. Observation
- **`src/components/public/ProtocolConsultPage.tsx`**:
  - Contains consultation input and queries redemption via `consultarProtocolo` (lines 221-237).
  - Lines 403-418: When `result.status === 'recusado'`, only displays the static rejection alert and `motivo_recusa`. Does NOT provide the "Entrar com recurso" / "Contestar a recusa" button or submission modal.
  - Lines 247-255: Subscribes directly to `table: 'parceiros_resgates'` for realtime updates, which fails for public anonymous visitors due to RLS revocation.
  - Does NOT display the audit timeline ("Histórico do protocolo") from `result.eventos`.
  - Does NOT display the appeal status card when `result.recurso` is present.
- **`supabase/migrations/20260828170000_partner_redemption_appeals.sql`**:
  - Lines 4-29: Defines `parceiros_resgates_recursos` with `CONSTRAINT parceiros_resgates_recursos_unico_por_resgate UNIQUE (resgate_id)` and check constraint `char_length(trim(contestacao_cliente)) BETWEEN 20 AND 4000`.
  - Lines 35-49: Defines `parceiros_resgates_eventos` with audit trail (`solicitacao_criada`, `solicitacao_recusada`, `recurso_interposto`, `recurso_deferido`, `recurso_indeferido`, `beneficio_liberado`).
  - Lines 55-60: Defines `parceiros_resgates_public_status` (`resgate_id`, `tracking_key`, `revision`, `updated_at`) for sanitized anonymous Realtime events.
  - Lines 781-855: Defines RPC `gsa_public_consultar_protocolo(p_codigo text)` returning `recurso` object, `eventos` array, and `tracking_key`.
- **`src/tests/partner-redemption-appeals.test.ts`**:
  - Line 40: Expects `publicPage` to contain `'Histórico do protocolo'`.
  - Lines 44-45: Expects `publicPage` to contain `"table: 'parceiros_resgates_public_status'"` and `'tracking_key=eq.'`.
  - Line 69: Expects `publicPage` to contain `'Contestar a recusa'`.
  - Line 70: Expects `adminModal` to contain `'Fundamentação da decisão'`.
  - Lines 65-68: Validates that no file contains corrupted UTF-8 sequences (`\uFFFD` or `Ã[§£¡©ª³µ]|Â[°º]`).
- **`src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`**:
  - Contains UTF-8 corruptions on lines 548 (`No informado`), 621 (`Solicitao`), 649 (`No foi possível`), 663 (`anlise`), 671 (`Contestao`), 685 (`Fundamentao`).

## 2. Logic Chain
1. *Observation*: The client requirement R1 mandates that rejected redemptions allow a single appeal submission with justification (20-4000 chars) and up to 3 evidence attachments.
2. *Observation*: `ProtocolConsultPage.tsx` currently lacks the appeal button, the submission modal/drawer, the single-appeal lock state, and the audit timeline.
3. *Observation*: The database schema in `20260828170000_partner_redemption_appeals.sql` and the RPC `gsa_public_consultar_protocolo` already supply `recurso`, `eventos`, and `tracking_key`.
4. *Observation*: The Realtime channel in `ProtocolConsultPage.tsx` must subscribe to `parceiros_resgates_public_status` with `tracking_key` to avoid RLS permission errors and protect PII.
5. *Observation*: The test suite requires exact strings (`"Contestar a recusa"`, `"Histórico do protocolo"`, `"Fundamentação da decisão"`) and strict UTF-8 validity without mangled characters.
6. *Conclusion*: Implementing the appeal flow in `ProtocolConsultPage.tsx` and fixing UTF-8 encoding in `PartnerRedemptionDetailModal.tsx` will satisfy R1, R2, and all contract tests.

## 3. Caveats
- No direct source modifications were made by this explorer agent (read-only mode).
- Supabase storage bucket `parceiros-midias` exists with public read access and 5MB per-file limits, making it suitable for evidence uploads. If a dedicated bucket `parceiros-recursos` is desired, it can be created or `parceiros-midias` can be used.

## 4. Conclusion
The frontend builder agent should:
1. Update `src/components/public/ProtocolConsultPage.tsx`:
   - Add the "Contestar a recusa" action button inside the rejected status card when no appeal exists (`!result.recurso`).
   - Implement the Appeal Submission Modal with textarea justification (20–4000 chars), up to 3 file uploads with preview/removal, and idempotent submission.
   - Render the Appeal Status Card ("Recurso em análise", "Recurso aprovado", "Recurso negado") with deadline and justification when `result.recurso` exists.
   - Render the timeline section `"Histórico do protocolo"` mapping `result.eventos`.
   - Update Realtime subscription to `table: 'parceiros_resgates_public_status'` with `filter: tracking_key=eq.${result.tracking_key}`.
2. Fix UTF-8 character encoding in `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` (`"Fundamentação da decisão"`, `"Solicitação Recusada"`, `"Contestação apresentada"`, `"Não informado"`).

## 5. Verification Method
- **File Inspection**:
  - Confirm `src/components/public/ProtocolConsultPage.tsx` contains `'Contestar a recusa'`, `'Histórico do protocolo'`, `"table: 'parceiros_resgates_public_status'"`, and `'tracking_key=eq.'`.
  - Confirm `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` contains `'Fundamentação da decisão'`.
  - Run text scans for corrupted UTF-8 characters (`grep_search` for `\uFFFD` and regex `Ã[§£¡©ª³µ]|Â[°º]`).
- **Contract Tests**:
  - Run `npx vitest run src/tests/partner-redemption-appeals.test.ts`.
