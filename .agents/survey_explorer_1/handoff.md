# Handoff Report — WhatsApp Notifications & UTF-8 Remediation Survey

## 1. Observation

1. **`src/utils/n8nWhatsApp.ts` (lines 71-107)**:
   Dispatches admin notifications via Supabase Edge Function `vps-api`:
   ```ts
   const { data, error } = await supabase.functions.invoke('vps-api', {
     body: {
       action: 'send-whatsapp',
       phone,
       message: textBody,
       title: payload.title,
       category: payload.category || 'ADMIN',
       targetIp: '147.15.43.141'
     }
   });
   ```
2. **`supabase/functions/vps-api/index.ts` (lines 309-328)**:
   Contains a runtime bug when falling back to n8n webhook:
   ```ts
   // 2. Fallback via n8n webhook na porta 5678 da VPS
   const n8nRes = await fetch(`http://${targetHost}:5678/webhook/send-whatsapp`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       phone: formattedPhone, // ReferenceError: formattedPhone is not defined!
       message,
       title: body.title || 'Notificação GSA HUB',
       category: body.category || 'SISTEMA',
       timestamp: new Date().toISOString()
     }),
     signal: AbortSignal.timeout(4000)
   }).catch(() => null);
   ```
3. **`src/lib/whatsappNotificationService.ts` (lines 1200-1358)**:
   Implements a 3-tier cascade:
   - Tier 1: Evolution API direct on port 8080 (`/message/sendText/GSA_WhatsApp`, `/message/sendMedia/GSA_WhatsApp`).
   - Tier 2: Edge Function `vps-api` (`action: 'send-whatsapp'`).
   - Tier 3: n8n webhook on port 5678 (`http://147.15.43.141:5678/webhook/send-whatsapp`).
   - Uses UTF-8 string templates and variations (`applyDynamicGreetingAndFooter`, `randomizeMessageUrls`, `injectZeroWidthEntropy`).
4. **UTF-8 Corruption in UI Files**:
   - `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`:
     * Line 187: `'Recurso aprovado. A solicitao voltou ao fluxo de andamento.'`
     * Line 192: `'No foi possível registrar a decisão do recurso.'`
     * Line 202: `'Informe o link de ativao gerado no site do parceiro.'`
     * Line 225: `'✅ Link de ativao salvo e enviado para o WhatsApp de ${resgate.nome_completo}!'`
     * Line 267: `'✅ Notificao oficial de WhatsApp reenviada para ${maskPhone(resgate.telefone)}!'`
     * Line 663: `'Prazo de anlise'`
     * Line 671: `'Contestao apresentada'`
     * Line 685: `'Fundamentao da decisão'`
   - `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`:
     * Multiple stripped accents: `liberao`, `ativao`, `notificao`, `No`, `benefcio`, `informaes`, `anlise`.
5. **Database Appeal Contract & Realtime Schema (`supabase/migrations/20260828170000_partner_redemption_appeals.sql`)**:
   - Tables: `parceiros_resgates_recursos`, `parceiros_resgates_eventos`, `parceiros_resgates_public_status`, `parceiros_resgates_recurso_desafios`, `parceiros_resgates_notificacoes`.
   - RPCs: `gsa_begin_partner_appeal_challenge`, `gsa_complete_partner_appeal`, `gsa_admin_decide_partner_appeal`, `gsa_schedule_partner_appeal_sla_notifications`, `gsa_claim_partner_appeal_notifications`, `gsa_finish_partner_appeal_notification`, `gsa_public_consultar_protocolo`.
   - Outbox worker endpoint in `supabase/functions/gsa-auth-session/index.ts` lines 365-401 (`process_partner_appeal_outbox`).
6. **Frontend UI State for Appeals (`src/components/public/ProtocolConsultPage.tsx`)**:
   - Currently lacks the "Entrar com recurso" button, WhatsApp verification challenge modal, justification submission form, and timeline events list.

---

## 2. Logic Chain

1. From **Observation 2**, when `vps-api` falls back to n8n, `formattedPhone` is undeclared, causing the edge function to crash. Fixing this variable reference will restore Tier 2/3 fallback reliability.
2. From **Observation 4**, previous refactorings or encoding mismatches stripped Portuguese accents in TSX component files (e.g., `ativao` instead of `ativação`), causing degraded user experience and test failures in `src/tests/partner-redemption-appeals.test.ts`.
3. From **Observation 5 & 6**, while the backend tables, RPCs and Edge Functions for appeals are fully established, the client-facing page `ProtocolConsultPage.tsx` does not yet render the appeal initiation and submission flow (R1), and the admin modal `PartnerRedemptionDetailModal.tsx` requires accent restoration and evidence/timeline integration (R2).
4. From **Observations 1, 3 & 5**, WhatsApp message triggers for redemptions and appeals are cleanly separated between direct client cascade (`whatsappNotificationService.ts`), admin direct alerts (`n8nWhatsApp.ts`), and asynchronous database outbox notifications (`parceiros_resgates_notificacoes`).

---

## 3. Caveats

- VPS runtime status (Evolution API and n8n services on `147.15.43.141`) was investigated via codebase configurations and scripts, not via live external network probes (exploration is read-only).
- File upload for up to 3 evidence files during appeal submission can store URLs in `detalhes_privados` or bucket storage if required by R1.

---

## 4. Conclusion

The WhatsApp notification infrastructure and appeal backend architecture are solid, with clear requirements for implementation:
1. **Remediate UTF-8 & Mojibake**: Correct all truncated/corrupted Portuguese strings in `PartnerRedemptionDetailModal.tsx` and `FornecedoresSection.tsx`.
2. **Fix `vps-api`**: Correct `formattedPhone` to `targetDestination` on line 314 of `supabase/functions/vps-api/index.ts`.
3. **Implement Client Appeal Flow (R1)**: Add appeal button, WhatsApp PIN challenge modal, contestation form and timeline view to `src/components/public/ProtocolConsultPage.tsx`.
4. **Finalize Admin Redemption Review (R2)**: Polish `PartnerRedemptionDetailModal.tsx` and `FornecedoresSection.tsx` with clean UTF-8 text and event timeline view.
5. **Ensure WhatsApp Delivery (R3)**: Maintain strict UTF-8 JSON payloads across all 3 dispatch tiers.

---

## 5. Verification Method

To verify findings independently:
1. Check `src/utils/n8nWhatsApp.ts` and `src/lib/whatsappNotificationService.ts` for WhatsApp dispatch methods.
2. Inspect `supabase/functions/vps-api/index.ts` line 314 for the `formattedPhone` reference.
3. Search for corrupted strings in `PartnerRedemptionDetailModal.tsx` (`ativao`, `No`, `solicitao`).
4. Inspect `src/tests/partner-redemption-appeals.test.ts` for the exact test contracts expected.
5. Review the complete report at `.agents/survey_explorer_1/survey_report.md`.
