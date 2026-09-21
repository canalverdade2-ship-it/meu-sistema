## 2026-08-28T19:41:55Z
You are worker_m2, a teamwork_preview_worker.
Your working directory is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_m2
Your original request path is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
Read PROJECT.md, TEST_INFRA.md, and TEST_READY.md at project root.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CONSTRAINTS:
1. NÃO usar Git ou GitHub (sem commits, sem pushes).
2. NÃO publicar no Cloudflare Pages.
3. UTF-8 ESTRITO: Todos os arquivos editados devem respeitar a codificação UTF-8 para evitar caracteres quebrados (ex: "Notificação").

YOUR ASSIGNED SCOPE (Milestone 2 - Client Public Protocol Appeal UI):
Implement the complete customer appeal flow in `src/components/public/ProtocolConsultPage.tsx`:
1. When `result.status === 'recusado'` and no appeal has been submitted yet (`!result.recurso`), display the "Contestar a recusa" (or "Entrar com recurso") action button clearly.
2. Implement the Appeal Submission Modal / Drawer containing:
   - Clear guidance that an appeal can only be submitted once per protocol.
   - Textarea for contestation / justification with validation (minimum 20 characters, maximum 4000 characters).
   - Evidence file upload supporting up to 3 photos/documents (with preview, file removal, size limits, and uploading to Supabase storage bucket `parceiros-midias`).
   - If WhatsApp PIN challenge is configured via `beginPartnerAppealChallenge`, handle the challenge/PIN step; or submit via `completePartnerAppeal` / `gsa_complete_partner_appeal` cleanly.
   - Show loading states, validation error messages, and success toasts.
3. Single appeal enforcement:
   - When `result.recurso` exists, hide the submission button and display the Appeal Status Card (e.g. "Recurso em análise", "Recurso aprovado", "Recurso negado") with opening date, SLA deadline (`prazo_analise_em`), and submitted justification.
4. Render the audit timeline section:
   - Section heading: "Histórico do protocolo".
   - Render `result.eventos` chronologically with distinct icons, titles, timestamps, and details.
5. Update Realtime subscription:
   - Ensure subscription listens to `table: 'parceiros_resgates_public_status'` with `filter: tracking_key=eq.${result.tracking_key}` (or falls back cleanly).
6. Run tests (`npx vitest run src/tests/partner-redemption-appeals.test.ts src/tests/partner-redemption-appeals-e2e.test.ts`) and typecheck to verify 100% pass rate.
7. Write your self-contained `handoff.md` in your working directory and notify the parent orchestrator via `send_message`.
