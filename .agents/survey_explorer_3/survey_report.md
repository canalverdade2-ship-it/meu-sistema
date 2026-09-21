# Survey Report: Admin Management (PartnerRedemptionDetailModal & FornecedoresSection) & Events Timeline

**Explorer Agent:** `survey_explorer_3`  
**Date:** 2026-08-28  
**Scope:** Admin Redemption Management, Appeal Evaluation Workflow, Events History Timeline, WhatsApp Integrations, and Strict UTF-8 Adherence.

---

## 1. Executive Summary

This investigation analyzed the Admin Management architecture for partner benefit redemptions (`parceiros_resgates`), customer appeals (`parceiros_resgates_recursos`), and the audit/timeline events log (`parceiros_resgates_eventos`). 

The database migrations (`supabase/migrations/20260828170000_partner_redemption_appeals.sql`) have established a transactional, idempotent schema with RPC functions (`gsa_admin_decide_partner_appeal`, `gsa_admin_set_partner_redemption_status`, `gsa_admin_list_partner_redemptions`, `gsa_public_consultar_protocolo`).

In the frontend:
- `FornecedoresSection.tsx` handles partner management, listing redemptions per partner, filtering, SLA countdowns, and launching the detail modal.
- `PartnerRedemptionDetailModal.tsx` displays redemption details, customer info, 24h SLA counter, activation link submission, and basic appeal details.
- **Identified Gaps to Complete:**
  1. **Events Timeline UI:** `PartnerRedemptionDetailModal.tsx` does not yet render the chronological events timeline (`parceiros_resgates_eventos`).
  2. **Appeal Evidence / Photo Attachments Preview:** Appeal details currently display only the text justification; gallery preview for customer evidence/photo attachments needs to be integrated.
  3. **UTF-8 Accent Normalization:** Several UI strings in `PartnerRedemptionDetailModal.tsx` and `FornecedoresSection.tsx` have stripped accents (e.g. `ativao` instead of `ativação`, `solicitao` instead of `solicitação`, `No` instead of `Não`), which must be corrected to strictly adhere to UTF-8 without mojibake.

---

## 2. Codebase Architecture & File Mapping

| File Path | Role / Functionality | Current State |
|---|---|---|
| `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx` | Main admin panel for Suppliers & Partners (`parceiros` tab). Manages partner listing, CRUD, and displays the "Resgates" sub-tab with search, filters, SLA countdown, and modal launch. | Functional. Realtime subscription active. Needs UTF-8 accent corrections on UI labels. |
| `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` | Detail modal for a single redemption. Handles 24h SLA clock, activation link insertion, WhatsApp re-dispatch, approval/rejection of redemptions, and appeal evaluation. | Functional for basic appeal decision. Needs Timeline component and Evidence Attachment gallery. Needs UTF-8 corrections. |
| `src/features/partners/service.ts` | Frontend service layer wrapping RPCs and direct Supabase calls (`listPartnerRedemptions`, `completePartnerRedemption`, `approveRedemption`, `rejectRedemption`, `decidePartnerAppeal`, `consultarProtocolo`). | Fully implemented with robust error handling and fallback mechanisms. |
| `src/features/partners/types.ts` | TypeScript interfaces for `Partner`, `PartnerRedemption`, `PartnerRedemptionAppeal`, `PartnerRedemptionTimelineEvent`, `ProtocolConsultResult`. | Types defined for appeals and timeline events. |
| `supabase/migrations/20260828170000_partner_redemption_appeals.sql` | Applied database migration defining `parceiros_resgates_recursos`, `parceiros_resgates_eventos`, `parceiros_resgates_notificacoes`, `parceiros_resgates_public_status`, and all secure RPCs. | Fully applied. Implements atomic `FOR UPDATE` transactions and transactional outbox. |
| `src/utils/n8nWhatsApp.ts` & `src/lib/whatsappNotificationService.ts` | WhatsApp messaging services (Evolution API direct on port 8080, Edge Function `vps-api`, n8n webhook fallback on port 5678). | Multi-tier fallback active. Must ensure all outgoing payloads use strict UTF-8. |

---

## 3. Detailed Investigation Findings

### 3.1. Redemption Listing, Filtering, and Modal Launching (`FornecedoresSection.tsx`)

1. **Navigation & Tab Hierarchy:**
   - Within `FornecedoresSection`, when on the `parceiros` main tab, clicking a partner row opens the partner drawer (`isPartnerDrawerOpen = true`).
   - The drawer provides two tabs:
     - `dados`: Partner metadata, contact info, logo/cover upload, redemption mode settings.
     - `resgates`: Redemptions registered for that specific partner (`partnerRedemptions`).
2. **Data Fetching & Realtime Synchronization:**
   - Opening the "Resgates" tab triggers `loadRedemptions(partner.id)`, which calls `listPartnerRedemptions(partnerId)` from `src/features/partners/service.ts`.
   - `useRealtimeSubscription` listens to `parceiros_resgates` changes and automatically refreshes `loadRedemptions(selectedPartner.id)`.
   - When a redemption is updated while the detail modal is open, a `useEffect` synchronizes `selectedRedemptionForModal` with the latest record from `partnerRedemptions`.
3. **Filtering & Search:**
   - `redemptionSearch` filters in real time across:
     - `nome_completo`
     - `telefone`
     - `codigo_gerado` (Protocol)
     - `tipo_resgate`
4. **Summary Metrics Cards:**
   - *Total de Resgates* (count)
   - *Último Resgate* (timestamp of most recent redemption)
   - *Benefício Oferecido* (partner benefit description)
5. **Card Presentation & Action Triggers:**
   - Each redemption item displays:
     - Avatar circle with customer initials.
     - Status badge (`Recurso em análise`, `Recusado`, `Em Análise`, `Link Ativado`, `Pendente de Link`).
     - SLA badge:
       - For appeals in analysis: shows analysis deadline formatted (`Prazo: DD/MM/YYYY HH:mm`) and alerts if overdue.
       - For standard redemptions: calculates 24h SLA from `created_at`, showing hours/minutes remaining or overdue.
     - Customer name, protocol badge, email, and direct WhatsApp chat launcher (`https://wa.me/55...`).
     - Action button corresponding to state:
       - `resgate.recurso?.status === 'em_analise'` ➔ **"Analisar Recurso"** (`bg-sky-600`)
       - `resgate.status === 'recusado'` ➔ **"Ver Recusa"** (`bg-rose-50`)
       - `resgate.status === 'analise'` or duplicate alert ➔ **"Analisar Duplicidade"**
       - `resgate.link_ativacao` ➔ **"Ver Detalhes / Alterar Link"**
       - Pending link ➔ **"Inserir Link de Ativação"**
   - Clicking any item opens `PartnerRedemptionDetailModal`.

---

### 3.2. Appeal Details Display & Evidence Attachments

#### Current Implementation in `PartnerRedemptionDetailModal.tsx`:
Lines 633–717 render the appeal box when `resgate.recurso` exists:
- Dynamic styling based on appeal status (`em_analise` ➔ Sky-50, `deferido` ➔ Emerald-50, `indeferido` ➔ Rose-50).
- Header with appeal status text and protocol badge (`resgate.recurso.protocolo_recurso`).
- Two-column grid showing `Aberto em` and `Prazo de análise` (turns red if overdue).
- Customer statement box: `resgate.recurso.contestacao_cliente` with `whitespace-pre-wrap`.
- Decision reason (if already judged): `resgate.recurso.motivo_decisao`.

#### Gaps & Requirements for Evidence Attachments:
1. **Evidence / Photo Attachments:**
   - Per requirement R1/R2, customer appeals may include up to 3 attached photos/documents.
   - When evidence URLs exist (e.g. `resgate.recurso.anexos` or within event details), the modal must render an interactive thumbnail gallery:
     - Grid of up to 3 image cards with preview thumbnails.
     - Click to zoom / open full-resolution document in a new tab.
     - Document icons for non-image files (e.g., PDF).

---

### 3.3. Admin Appeal Actions & State Transitions

#### 1. "Aceitar Recurso" (Aprovar Recurso / Deferir)
- **Trigger:** Admin clicks "Aprovar recurso" in `PartnerRedemptionDetailModal.tsx` (`handleAppealDecision('deferido')`).
- **Service call:** `decidePartnerAppeal(resgate.recurso.id, 'deferido', appealDecisionReason || undefined)`.
- **Database RPC:** `public.gsa_admin_decide_partner_appeal`:
  - Validates `v_decisao = 'deferido'`.
  - Locks appeal and redemption with `FOR UPDATE`.
  - Updates `parceiros_resgates_recursos`:
    - `status = 'deferido'`
    - `motivo_decisao = v_motivo`
    - `analisado_em = now()`
    - `analisado_por = <admin_uuid>`
  - Updates `parceiros_resgates`:
    - `status = 'pendente'` (Restores request to active flow so admin can now assign the partner activation link)
    - `alerta_duplicidade = false`
    - `updated_at = now()`
  - Logs to `parceiros_resgates_eventos`:
    - `tipo = 'recurso_deferido'`
    - `titulo = 'Recurso aprovado'`
    - `descricao_publica = 'O recurso foi aprovado e a solicitação voltou ao fluxo de andamento.'`
    - `ator_tipo = 'admin'` (or `'colaborador'`)
    - `idempotency_key = 'appeal-approved:' || recurso_id`
  - Queues customer notification in `parceiros_resgates_notificacoes`:
    - `tipo = 'recurso_aprovado_cliente'`
    - Message notifying client that the appeal was approved and the redemption is back in progress.
  - Touches `parceiros_resgates_public_status` to notify public Realtime clients.
  - Writes audit record to `gsa_admin_audit`.
- **UI Feedback:** `toast.success('Recurso aprovado. A solicitação voltou ao fluxo de andamento.')`, invokes `onSuccess()` to refresh parent list, and closes modal.

#### 2. "Negar Recurso" (Recusar Recurso / Indeferir)
- **Trigger:** Admin inputs justification (`appealDecisionReason`, minimum 10 characters) and clicks "Recusar recurso" (`handleAppealDecision('indeferido')`).
- **Validation:** Button is disabled if `appealDecisionReason.trim().length < 10`.
- **Service call:** `decidePartnerAppeal(resgate.recurso.id, 'indeferido', appealDecisionReason)`.
- **Database RPC:** `public.gsa_admin_decide_partner_appeal`:
  - Validates `v_decisao = 'indeferido'` and `char_length(motivo) BETWEEN 10 AND 2000`.
  - Locks appeal and redemption with `FOR UPDATE`.
  - Updates `parceiros_resgates_recursos`:
    - `status = 'indeferido'`
    - `motivo_decisao = v_motivo`
    - `analisado_em = now()`
    - `analisado_por = <admin_uuid>`
  - Updates `parceiros_resgates`:
    - `updated_at = now()` (status remains `'recusado'`).
  - Logs to `parceiros_resgates_eventos`:
    - `tipo = 'recurso_indeferido'`
    - `titulo = 'Recurso recusado'`
    - `descricao_publica = v_motivo`
    - `ator_tipo = 'admin'` (or `'colaborador'`)
    - `idempotency_key = 'appeal-denied:' || recurso_id`
  - Queues customer notification in `parceiros_resgates_notificacoes`:
    - `tipo = 'recurso_recusado_cliente'`
    - Message containing the rejection reason and protocol code.
  - Touches `parceiros_resgates_public_status` to notify public Realtime clients.
  - Writes audit record to `gsa_admin_audit`.
- **UI Feedback:** `toast.success('Recurso recusado e decisão registrada.')`, invokes `onSuccess()`, and closes modal.

---

### 3.4. Events History Timeline UI (`parceiros_resgates_eventos`)

#### Database Schema & Types:
The events table records every lifecycle change:
```sql
CREATE TABLE public.parceiros_resgates_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resgate_id uuid NOT NULL REFERENCES public.parceiros_resgates(id) ON DELETE CASCADE,
  recurso_id uuid REFERENCES public.parceiros_resgates_recursos(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao_publica text,
  detalhes_privados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ator_tipo text NOT NULL DEFAULT 'sistema' CHECK (ator_tipo IN ('cliente', 'admin', 'colaborador', 'sistema')),
  ator_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

#### Event Types in the System:
| Event Type (`tipo`) | Default Title (`titulo`) | Description / Details | Color / Visual Tone |
|---|---|---|---|
| `solicitacao_criada` | Solicitação registrada | "A solicitação de benefício foi recebida pelo Grupo GSA." | Slate / Neutral (Step 1) |
| `situacao_importada` | Solicitação em andamento / em análise | Legacy migration backfill record | Slate / Amber |
| `solicitacao_recusada` | Solicitação recusada | Motivo da recusa | Rose / Red |
| `solicitacao_em_analise`| Solicitação em análise | "A solicitação está em análise." | Amber / Yellow |
| `solicitacao_aprovada` | Solicitação aprovada | "A solicitação seguirá para emissão do benefício." | Emerald / Green |
| `recurso_interposto` | Recurso apresentado | "O recurso foi recebido e será analisado em até cinco dias." | Sky / Blue |
| `recurso_deferido` | Recurso aprovado | "O recurso foi aprovado e a solicitação voltou ao fluxo de andamento." | Emerald / Green |
| `recurso_indeferido` | Recurso recusado | Motivo da decisão do admin | Rose / Red |
| `beneficio_liberado` | Benefício liberado | "O benefício foi liberado e já está disponível para ativação." | Emerald / Green |

#### Timeline Query Method:
- `consultarProtocolo(resgate.codigo_gerado)` executes the `STABLE SECURITY DEFINER` function `gsa_public_consultar_protocolo`, which returns the sorted array `eventos: PartnerRedemptionTimelineEvent[]`.
- Alternatively, direct RPC or authenticated helper can query events for the open modal.

#### Timeline UI Component Design:
- Vertical connected timeline container inside `PartnerRedemptionDetailModal.tsx`:
  - Each item displays:
    - Node icon styled by event type (e.g. `CheckCircle2`, `XCircle`, `Clock`, `FileText`, `Gift`).
    - Title (`titulo`) in bold text.
    - Timestamp (`ocorrido_em` formatted: `DD/MM/YYYY às HH:mm`).
    - Actor badge: `Cliente`, `Administrador`, `Colaborador`, `Sistema`.
    - Description (`descricao_publica` or `descricao`).
  - Loading skeleton and empty state ("Nenhum evento registrado").

---

### 3.5. WhatsApp Notifications & Strict UTF-8 Integrity

1. **Transactional Outbox (`parceiros_resgates_notificacoes`):**
   - Automatically populated by RPCs on events (`solicitacao_recusada_cliente`, `recurso_recebido_cliente`, `recurso_aberto_admin`, `recurso_aprovado_cliente`, `recurso_recusado_cliente`, `recurso_sla_24h_admin`, `recurso_sla_vencido_admin`).
   - Claimed and processed by Edge Function `gsa-auth-session` action `process_partner_appeal_outbox`.
2. **Direct WhatsApp Dispatches:**
   - Handled via `whatsappNotificationService.enviarWhatsAppDireto` (e.g., initial 24h SLA notice, immediate coupon dispatch, activation link delivery, manual re-send).
3. **UTF-8 Encoding Audit:**
   - **SQL Migration & RPCs:** All SQL triggers and RPC functions in `20260828170000_partner_redemption_appeals.sql` are encoded in strict UTF-8 with proper Portuguese accents (`Solicitação`, `Benefício`, `Decisão`, `Não pôde ser aprovada`).
   - **Frontend UI String Corrections Needed:**
     In `PartnerRedemptionDetailModal.tsx` and `FornecedoresSection.tsx`, several strings have stripped accents that should be corrected:
     - `solicitao` ➔ `solicitação`
     - `ativao` ➔ `ativação`
     - `notificao` ➔ `notificação`
     - `No` ➔ `Não`
     - `anlise` ➔ `análise`
     - `Contestao` ➔ `Contestação`
     - `Fundamentao` ➔ `Fundamentação`
     - `Visualizao` ➔ `Visualização`
     - `liberao` ➔ `liberação`
     - `alterao` ➔ `alteração`
     - `informaes` ➔ `informações`
     - `benefcio` ➔ `benefício`
     - `Cdigo` ➔ `Código`
     - `Opo` ➔ `Opção`

---

## 4. Synthesis & Recommendations for Implementation

1. **Events Timeline Integration:**
   - In `PartnerRedemptionDetailModal.tsx`:
     - Add a state `const [timelineEvents, setTimelineEvents] = useState<PartnerRedemptionTimelineEvent[]>([])` and `isLoadingEvents`.
     - When `isOpen` and `resgate.codigo_gerado` change, fetch events via `consultarProtocolo(resgate.codigo_gerado)` or direct query.
     - Render a structured vertical timeline card in the modal body below the appeal/redemption details.
2. **Evidence / Photo Attachments Preview:**
   - If `resgate.recurso` includes attached photo URLs (or if passed via `anexos` / event metadata), render a responsive image grid with clickable previews.
3. **Admin Actions Polish:**
   - Keep "Aprovar Recurso" and "Recusar Recurso" as the primary decision actions.
   - Maintain the requirement that refusal requires at least 10 characters of explanation.
   - After decision, automatically refresh the events timeline and call `onSuccess()`.
4. **UTF-8 String Sanitization:**
   - Perform a clean sweep of `PartnerRedemptionDetailModal.tsx` and `FornecedoresSection.tsx` to restore all missing Portuguese accents and ensure 100% UTF-8 compliance without mojibake.
