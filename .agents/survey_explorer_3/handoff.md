# Handoff Report: survey_explorer_3

**Author:** `survey_explorer_3` (teamwork_preview_explorer)  
**Date:** 2026-08-28  
**Topic:** Admin Management (`PartnerRedemptionDetailModal.tsx` & `FornecedoresSection.tsx`), Appeal Evaluation, Events Timeline, and WhatsApp Notifications.

---

## 1. Observation

1. **Admin Panel & Redemption Listing (`FornecedoresSection.tsx`):**
   - In `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`, lines 1031–1067 implement the sub-tabs `dados` (partner configuration) and `resgates` (redemptions list).
   - Lines 159–170 define `loadRedemptions(partnerId)` using `listPartnerRedemptions(partnerId)` from `src/features/partners/service.ts`.
   - Lines 1770–1980 render redemption cards with status badges (`Recurso em análise`, `Recusado`, `Em Análise`, `Link Ativado`, `Pendente de Link`), SLA countdowns (24h SLA and appeal SLA deadline `resgate.recurso.prazo_analise_em`), customer data, and action buttons ("Analisar Recurso", "Ver Recusa", "Analisar Duplicidade", "Inserir Link de Ativação").
   - Clicking a redemption sets `selectedRedemptionForModal`, launching `PartnerRedemptionDetailModal.tsx`.

2. **Detail Modal & Appeal Actions (`PartnerRedemptionDetailModal.tsx`):**
   - In `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`, lines 633–717 render appeal details when `resgate.recurso` exists (`protocolo_recurso`, `aberto_em`, `prazo_analise_em`, `contestacao_cliente`, and `motivo_decisao`).
   - Lines 176–196 implement `handleAppealDecision(decision)` calling `decidePartnerAppeal(resgate.recurso.id, decision, reason)`:
     - When `decision === 'deferido'`, calls RPC `gsa_admin_decide_partner_appeal`, sets appeal status to `'deferido'`, resets redemption status to `'pendente'`, and queues WhatsApp notification `recurso_aprovado_cliente`.
     - When `decision === 'indeferido'`, requires at least 10 characters in `appealDecisionReason`, sets appeal status to `'indeferido'`, keeps redemption as `'recusado'`, logs rejection reason, and queues WhatsApp notification `recurso_recusado_cliente`.
   - Currently, `PartnerRedemptionDetailModal.tsx` lacks:
     - A timeline UI section rendering `parceiros_resgates_eventos`.
     - A gallery/preview component for customer attached evidence photos/documents.
     - Proper accentuation on several Portuguese strings (e.g. `solicitao`, `ativao`, `notificao`, `No`, `anlise`, `Fundamentao`, `Visualizao`).

3. **Database Schema & Events Architecture (`20260828170000_partner_redemption_appeals.sql`):**
   - `parceiros_resgates_recursos` stores `resgate_id`, `protocolo_recurso`, `contestacao_cliente`, `status ('em_analise', 'deferido', 'indeferido')`, `aberto_em`, `prazo_analise_em (5 days)`, `analisado_em`, `motivo_decisao`, `analisado_por`, `idempotency_key`.
   - `parceiros_resgates_eventos` stores `resgate_id`, `recurso_id`, `tipo`, `titulo`, `descricao_publica`, `detalhes_privados`, `ator_tipo ('cliente', 'admin', 'colaborador', 'sistema')`, `idempotency_key`, `ocorrido_em`.
   - `parceiros_resgates_notificacoes` manages transactional outbox messages for WhatsApp dispatches.
   - `gsa_public_consultar_protocolo(p_codigo)` returns complete protocol data including `eventos: PartnerRedemptionTimelineEvent[]`.

---

## 2. Logic Chain

1. **Listing & Navigation Flow:**
   - From Observation 1, `FornecedoresSection.tsx` already has the complete UI for navigating to a partner's redemptions and filtering by customer name, phone, protocol code, or redemption type. Realtime updates are active via `useRealtimeSubscription`.
2. **Appeal Evaluation Flow:**
   - From Observation 2 and Observation 3, the RPC `gsa_admin_decide_partner_appeal` and service `decidePartnerAppeal` handle atomic updates, status transitions, event logging, and transactional WhatsApp queuing.
   - For `deferido`: redemption becomes `pendente`, enabling the admin to input the partner activation link.
   - For `indeferido`: redemption stays `recusado`, recording the mandatory explanation reason.
3. **Events History Integration Requirement:**
   - From Observation 2 and Observation 3, `parceiros_resgates_eventos` is fully populated across all lifecycle stages by the SQL RPCs. To display this in `PartnerRedemptionDetailModal.tsx`, the frontend should fetch the events (via `consultarProtocolo` / `gsa_public_consultar_protocolo`) and render a vertical timeline with distinct icons, titles, timestamps, and actor badges.
4. **Evidence / Attachments Requirement:**
   - From Observation 2, customer appeal submissions can attach evidence files. When present, `PartnerRedemptionDetailModal.tsx` should render an evidence preview gallery with click-to-zoom / open in new tab.
5. **UTF-8 Adherence Requirement:**
   - From Observation 2 and Observation 3, SQL functions use pristine UTF-8 strings. The UI components (`PartnerRedemptionDetailModal.tsx` and `FornecedoresSection.tsx`) need their stripped accents restored (`solicitao` ➔ `solicitação`, `ativao` ➔ `ativação`, `notificao` ➔ `notificação`, etc.) to prevent mojibake.

---

## 3. Caveats

- Direct table `SELECT` on `parceiros_resgates_eventos` is restricted by RLS to `service_role`; client-side querying should use the `gsa_public_consultar_protocolo` RPC (via `consultarProtocolo`) or an admin RPC.
- No source code changes or build commands were executed during this investigation, respecting the read-only explorer constraint.

---

## 4. Conclusion

The Admin Management system for partner redemptions and appeals is fundamentally sound and supported by robust database RPCs. To complete the implementation:
1. Integrate the chronological Events Timeline component into `PartnerRedemptionDetailModal.tsx` by querying `consultarProtocolo`.
2. Add an evidence photo/document preview gallery in `PartnerRedemptionDetailModal.tsx` for appeal evidence.
3. Normalize all UI strings across `PartnerRedemptionDetailModal.tsx` and `FornecedoresSection.tsx` with clean, proper Portuguese accents (UTF-8 strict).

---

## 5. Verification Method

- **Files to Inspect:**
  - `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`
  - `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`
  - `src/features/partners/service.ts`
  - `supabase/migrations/20260828170000_partner_redemption_appeals.sql`
  - `.agents/survey_explorer_3/survey_report.md`
- **Verification Tests:**
  - Check test suite `src/tests/partner-redemption-appeals.test.ts` for UTF-8 integrity and RPC contracts.
  - Verify that `consultarProtocolo` returns `eventos` and that `gsa_admin_decide_partner_appeal` transitions statuses correctly.
