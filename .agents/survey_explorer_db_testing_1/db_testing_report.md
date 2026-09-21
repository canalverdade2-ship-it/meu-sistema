# Comprehensive Investigation Report: Database Schema, RPCs, Web Redemption Logic & Test Harness Architecture

**Author**: `survey_explorer_db_testing_1`  
**Date**: 2026-08-27  
**Working Directory**: `.agents/survey_explorer_db_testing_1/`  
**Mission**: Investigate Supabase schema, RPCs, migrations, web redemption parity rules, webhook state machines, and architect `test_whatsapp_redemption.js`.

---

## 1. Executive Summary

This investigation covers the entire technical stack required to implement and verify the **Conversational WhatsApp Benefit Redemption Flow** with 100% parity against the GSA HUB web platform (`PartnerBenefitRedeemModal.tsx` and `src/features/partners/service.ts`).

### Key Findings
1. **Database Schema & Tables**:
   - `public.parceiros`: Stores partner metadata, catalog details, and redemption configurations (`redemption_has_coupon`, `redemption_coupon_code`, `redemption_has_voucher`, `redemption_has_link`, `redemption_link`, `redemption_auto_redirect`, `redemption_instructions`, `redemption_delay_24h`).
   - `public.parceiros_resgates`: Stores benefit redemptions/leads with full status tracking (`pendente`, `analise`, `concluido`, `recusado`, `cancelado`), duplicate alerts (`alerta_duplicidade`, `justificativa_duplicidade`, `motivo_recusa`), protocol keys (`codigo_gerado`), and timestamps (`created_at`, `data_ativacao`, `data_cancelamento`).
2. **Supabase RPC Core**:
   - `gsa_public_resgatar_beneficio_parceiro(p_parceiro_id, p_parceiro_slug, p_nome_completo, p_telefone, p_cliente_id, p_email)` is the authoritative security definer RPC. It generates the unique official protocol `PROT-RES-YYYY-XXXXXX` (or partner static coupon), inserts the redemption record, and returns full partner and redemption details.
   - `gsa_public_consultar_protocolo(p_codigo)` allows public protocol lookup and status consultation.
3. **Duplicate Prevention & Management Protocol**:
   - Web parity rule: Prior to or upon redemption creation, checks if an existing non-rejected redemption (`status != 'recusado'`) exists for that `parceiro_id` matching the customer's `email` OR `telefone`.
   - On duplicate conflict: The system raises a 409 conflict and requests a **justification**.
   - With justification (`forceOverride=true`): The redemption is created/updated with `status = 'analise'`, `alerta_duplicidade = true`, and `justificativa_duplicidade = text` (granting an extended 48h SLA).
4. **Fulfillment Modes**:
   - **Auto-Coupon / Immediate Mode**: When `redemption_delay_24h = false` and coupon/voucher/link is configured, the bot retrieves the coupon code from the RPC response and immediately delivers it with instructions to the customer.
   - **24h SLA Mode**: When `redemption_delay_24h = true` (or no instant coupon/link is configured), the bot confirms the 24h SLA, delivers the protocol `PROT-RES-YYYY-XXXXXX`, and sends an admin notification to Admin Master (`5511971858372`).
5. **Testing Architecture**:
   - Designed a standalone, zero-dependency Node.js test script `test_whatsapp_redemption.js` that simulates incoming Evolution API webhook messages, tests fuzzy partner search, verifies state transitions, checks duplicate rejection -> justification -> `analise` DB status, tests RPC parameter contracts, and validates instant coupon delivery.

---

## 2. Supabase Database Schema & Migration Analysis

### 2.1 Table: `public.parceiros`

Defined across migrations:
- `20260721110000_create_public_partners.sql`
- `20260721120000_partner_benefit_redemption.sql`
- `20260826153000_partner_delay_24h_toggle.sql`
- `20260826190000_consolidate_partner_redemption_system.sql`

#### Column Structure & Types
| Column | Type | Default | Nullable | Description / Business Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | `gen_random_uuid()` | `NO` | Primary Key |
| `slug` | `text` | - | `NO` | Unique URL-friendly slug (`CHECK slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`) |
| `name` | `text` | - | `NO` | Partner display name (e.g. "Petlove", "Óticas Carol") |
| `legal_name` | `text` | `NULL` | `YES` | Razão Social |
| `category` | `text` | - | `NO` | Category (e.g. "Veterinária", "Saúde", "Educação") |
| `short_description`| `text` | - | `NO` | Brief description for cards |
| `description` | `text` | `NULL` | `YES` | Full rich description |
| `logo_url` | `text` | `NULL` | `YES` | Partner brand logo |
| `cover_url` | `text` | `NULL` | `YES` | Banner cover image for WhatsApp and cards |
| `phone` | `text` | `NULL` | `YES` | Contact phone |
| `whatsapp` | `text` | `NULL` | `YES` | WhatsApp number |
| `email` | `text` | `NULL` | `YES` | Partner contact email |
| `website` | `text` | `NULL` | `YES` | Partner official website |
| `benefits` | `text` | `NULL` | `YES` | Text description of the exclusive discount/benefit |
| `status` | `text` | `'em_analise'`| `NO` | `'em_analise'`, `'ativo'`, `'inativo'`, `'encerrado'`, `'excluido'` |
| `featured` | `boolean` | `false` | `NO` | Featured partner badge |
| `display_order` | `integer` | `0` | `NO` | Listing sort order |
| **`redemption_has_coupon`** | `boolean` | `false` | `NO` | If true, partner benefits use coupon codes |
| **`redemption_coupon_code`**| `text` | `NULL` | `YES` | Static coupon code (e.g. `PETLOVEGSA100`) or auto-generated if blank |
| **`redemption_has_voucher`**| `boolean` | `false` | `NO` | If true, generates voucher format `VOUCHER-GSA-...` |
| **`redemption_has_link`** | `boolean` | `false` | `NO` | If true, redemption uses partner external link |
| **`redemption_link`** | `text` | `NULL` | `YES` | External landing/affiliate link |
| **`redemption_auto_redirect`**|`boolean` | `false` | `NO` | Auto-redirect browser flag on web |
| **`redemption_instructions`**| `text` | `NULL` | `YES` | Usage instructions presented to user |
| **`redemption_delay_24h`** | `boolean` | `false` | `NO` | If true, redemption requires 24h manual admin provisioning |
| `created_at` | `timestamptz` | `now()` | `NO` | Creation timestamp |
| `updated_at` | `timestamptz` | `now()` | `NO` | Updated timestamp (via trigger `trg_parceiros_updated_at`) |

---

### 2.2 Table: `public.parceiros_resgates`

Defined and enhanced across migrations:
- `20260721120000_partner_benefit_redemption.sql`
- `20260826150000_partner_redemption_email_and_sla.sql`
- `20260826161500_partner_redemption_protocol.sql`
- `20260826190000_consolidate_partner_redemption_system.sql`
- `20260827200000_add_data_cancelamento_to_parceiros_resgates.sql`
- `apply_duplicity_migration.cjs`

#### Column Structure & Types
| Column | Type | Default | Nullable | Description / Business Rule |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | `gen_random_uuid()` | `NO` | Primary Key |
| `parceiro_id` | `uuid` | - | `NO` | FK `public.parceiros(id) ON DELETE CASCADE` |
| `cliente_id` | `uuid` | `NULL` | `YES` | Optional FK `public.clientes(id)` |
| `nome_completo` | `text` | - | `NO` | Full name of the customer |
| `email` | `text` | `NULL` | `YES` | Customer email address |
| `telefone` | `text` | - | `NO` | Customer phone / WhatsApp with DDD |
| `codigo_gerado` | `text` | `NULL` | `YES` | Protocol `PROT-RES-YYYY-XXXXXX` or Coupon Code |
| `tipo_resgate` | `text` | `'link'` | `NO` | `'link'`, `'cupom'`, `'voucher'`, `'combinado'` |
| `link_destino` | `text` | `NULL` | `YES` | Original partner link |
| `link_ativacao` | `text` | `NULL` | `YES` | Provisioned partner activation link (from Admin) |
| `status` | `text` | `'pendente'` | `NO` | `'pendente'`, `'analise'`, `'concluido'`, `'recusado'`, `'cancelado'`, `'usado'`, `'aprovado'`, `'rejeitado'` |
| `auto_redirecionado`|`boolean` | `false` | `NO` | Boolean tracker |
| **`alerta_duplicidade`**|`boolean`| `false` | `NO` | Flagged `true` if duplicate override was submitted |
| **`justificativa_duplicidade`**|`text`| `NULL` | `YES` | User-provided text justification for repeat redemption |
| **`motivo_recusa`** | `text` | `NULL` | `YES` | Administrative rejection reason |
| `cupom` | `text` | `NULL` | `YES` | Manual coupon entered by admin upon completion |
| `voucher` | `text` | `NULL` | `YES` | Manual voucher entered by admin |
| `data_ativacao` | `timestamptz` | `NULL` | `YES` | Timestamp when link/coupon was provisioned |
| `data_cancelamento`|`timestamptz`| `NULL` | `YES` | Timestamp when protocol was cancelled |
| `created_at` | `timestamptz` | `now()` | `NO` | Creation timestamp |

---

### 2.3 Supabase RPC Functions

#### 1. `gsa_public_resgatar_beneficio_parceiro`
- **Location**: `supabase/migrations/20260826161500_partner_redemption_protocol.sql`
- **Security Mode**: `SECURITY DEFINER` (allows public/anon access without granting unrestricted table write)
- **Signature**:
  ```sql
  FUNCTION public.gsa_public_resgatar_beneficio_parceiro(
    p_parceiro_id uuid DEFAULT NULL,
    p_parceiro_slug text DEFAULT NULL,
    p_nome_completo text DEFAULT NULL,
    p_telefone text DEFAULT NULL,
    p_cliente_id uuid DEFAULT NULL,
    p_email text DEFAULT NULL
  ) RETURNS jsonb
  ```
- **Validation Rules**:
  - `p_nome_completo`: Must be trimmed and length >= 2.
  - `p_telefone`: Must have at least 10 numeric digits.
  - Partner lookup: By `p_parceiro_id` or `p_parceiro_slug` where `status = 'ativo'`.
- **Protocol Generation Logic**:
  - `v_rand_suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));`
  - `v_codigo_gerado := 'PROT-RES-' || v_year || '-' || v_rand_suffix;`
  - If partner has static coupon (`redemption_has_coupon` & `redemption_coupon_code` != ''): returns coupon code.
- **Return JSON Structure**:
  ```json
  {
    "success": true,
    "resgate_id": "uuid",
    "partner_name": "Petlove",
    "partner_slug": "petlove",
    "partner_logo": "https://...",
    "benefits": "Primeira Mensalidade 100% Grátis",
    "tipo_resgate": "cupom",
    "codigo_gerado": "PROT-RES-2026-AB12CD",
    "protocolo": "PROT-RES-2026-AB12CD",
    "has_coupon": true,
    "has_voucher": false,
    "has_link": false,
    "link": null,
    "auto_redirect": false,
    "instructions": "Apresente o cupom no checkout",
    "delay_24h": false
  }
  ```

#### 2. `gsa_public_consultar_protocolo`
- **Location**: `supabase/migrations/20260827180000_public_protocol_consultation.sql`
- **Security Mode**: `SECURITY DEFINER`
- **Signature**:
  ```sql
  FUNCTION public.gsa_public_consultar_protocolo(p_codigo text) RETURNS jsonb
  ```
- **Lookup**: Queries `parceiros_resgates` where `upper(trim(codigo_gerado)) = upper(trim(p_codigo))` joined with `parceiros`.

---

## 3. Web Redemption Parity Analysis

### 3.1 Service Implementation: `src/features/partners/service.ts`

Lines 209–356 of `src/features/partners/service.ts` define the web flow for `redeemPartnerBenefit`:

```typescript
// 1. Checar duplicidade caso não seja forçado (override)
if (!payload.forceOverride && payload.parceiroId) {
  const isDupe = await checkDuplicateRedemption(payload.parceiroId, payload.email, payload.telefone);
  if (isDupe) {
    const error: any = new Error('409 - Duplicidade: Cliente já possui um resgate para este parceiro.');
    error.status = 409;
    throw error;
  }
}

// 2. Invocar RPC gsa_public_resgatar_beneficio_parceiro
let { data, error } = await supabase.rpc('gsa_public_resgatar_beneficio_parceiro', rpcParams);

// 3. Se for override com justificativa, atualizar para status 'analise'
if (payload.forceOverride && payload.justificativaDuplicidade && result?.resgate_id) {
  await supabase.from('parceiros_resgates').update({
    alerta_duplicidade: true,
    justificativa_duplicidade: payload.justificativaDuplicidade,
    status: 'analise'
  }).eq('id', result.resgate_id);
  (result as any).status = 'analise';
}
```

### 3.2 Duplicate Detection Function: `checkDuplicateRedemption`

```typescript
export async function checkDuplicateRedemption(parceiroId: string, email?: string, telefone?: string): Promise<boolean> {
  if (!parceiroId || (!email && !telefone)) return false;

  let query = supabase
    .from('parceiros_resgates')
    .select('id')
    .eq('parceiro_id', parceiroId)
    .neq('status', 'recusado'); // Only count non-rejected as duplicates

  if (email && telefone) {
    query = query.or(`email.eq.${email},telefone.eq.${telefone}`);
  } else if (email) {
    query = query.eq('email', email);
  } else if (telefone) {
    query = query.eq('telefone', telefone);
  }

  const { data, error } = await query.limit(1);
  return Boolean(data && data.length > 0);
}
```

### 3.3 Modal Behavior: `PartnerBenefitRedeemModal.tsx`

1. **First Submission**: Collects `nomeCompleto`, `email`, `telefone`. Calls `redeemPartnerBenefit` with `forceOverride: false`.
2. **Duplicate Error (409)**:
   - Catches status `409` or message containing `"duplicidade"`.
   - Opens `showDuplicatePopup`.
   - Prompts user for a text `justificativa`: *"Explique por que precisa resgatar novamente..."*.
3. **Justification Submission**:
   - Submits `redeemPartnerBenefit({ ...payload, forceOverride: true, justificativaDuplicidade: justificativa })`.
   - Backend marks `status = 'analise'`, `alerta_duplicidade = true`.
   - UI shows Success Modal with **48h Analysis SLA** (`Prazo de Análise: Em até 48 Horas`).
4. **Immediate vs 24h Delivery**:
   - If `delay_24h` is false and coupon exists: displays coupon code with copy button, partner link, instructions, and sends WhatsApp confirmation.
   - If `delay_24h` is true: displays 3 animated status stages (`1. Registrado`, `2. Emissão (Até 24h/48h)`, `3. WhatsApp`), displays protocol, and triggers Admin Master WhatsApp alert.

---

## 4. Webhook & Gemini NLU Architecture

### 4.1 Server Files & Communication
- `server_webhook_vps_live.cjs` (active on production VPS port 5680).
- `server_webhook.cjs` (local counterpart).
- Supabase communication: Uses PostgREST REST API over HTTP to `http://127.0.0.1:3001` or `SUPABASE_HOST`:
  - `supabaseGet(path, callback)`
  - `supabasePost(path, body, callback)`
  - `supabasePatch(path, body, callback)`
  - RPC calls: `supabasePost('/rest/v1/rpc/gsa_public_resgatar_beneficio_parceiro', params, callback)`.

### 4.2 State Machine for Partner Benefit Redemption

To implement **R2 (Conversational NLU Intent & State Machine)**, the webhook must support the following conversational state machine:

```
[Incoming WhatsApp Message]
        │
        ▼
[Gemini NLU Intent Detection]
   ├── intent: 'resgatar' ──────► [Fuzzy Partner Search in `parceiros`]
   │                                   ├── 0 matches: return partner list / ask clarify
   │                                   ├── >1 matches: prompt user to pick partner
   │                                   └── 1 match found:
   │                                           ▼
   │                                  [Collect Name, Email, Phone]
   │                                           ▼
   │                                  [Check Duplicate in `parceiros_resgates`]
   │                                           ├── Duplicate Found (no justification)
   │                                           │       ▼
   │                                           │   Prompt User for Justification
   │                                           │   (State: REDEMPTION_AWAITING_JUSTIFICATION)
   │                                           │       ▼
   │                                           │   User sends justification
   │                                           │       ▼
   │                                           │   Call RPC with forceOverride=true
   │                                           │   Update `parceiros_resgates` (status='analise', alerta_duplicidade=true)
   │                                           │   Send 48h Analysis SLA Response + Protocol
   │                                           │
   │                                           └── No Duplicate (or Immediate Partner)
   │                                                   ▼
   │                                               Call RPC `gsa_public_resgatar_beneficio_parceiro`
   │                                                   ▼
   │                                               Check Partner Delivery Type:
   │                                               ├── Auto-Coupon (!delay_24h): Deliver Coupon + Protocol
   │                                               └── 24h SLA (delay_24h): Deliver 24h Notice + Protocol + Alert Admin
```

---

## 5. Architecture & Specification for `test_whatsapp_redemption.js`

### 5.1 Test Framework Design Principles
- **Self-Contained Executable**: Standard CommonJS (`.js`/`.cjs`) runnable directly via `node test_whatsapp_redemption.js`.
- **Zero External Test Runner Dependency**: Works independently with Node.js built-ins (`assert`, `http`, `events`).
- **Comprehensive Assertion & Traceability**: Each test case outputs clear PASS/FAIL diagnostics, timing metrics, and maps to the specification requirements.

### 5.2 Test Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                   test_whatsapp_redemption.js Harness                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Mock PostgREST / Supabase Backend (HTTP Server on Port 3001)        │
│    - Mock /rest/v1/parceiros (Fuzzy search & partner catalog)          │
│    - Mock /rest/v1/parceiros_resgates (Duplicate queries & updates)    │
│    - Mock /rest/v1/rpc/gsa_public_resgatar_beneficio_parceiro          │
│                                                                        │
│ 2. Mock Evolution API & Gemini NLU Dispatcher                          │
│    - Simulated incoming webhook payloads                               │
│    - Mock Gemini response generator for "resgatar" intents             │
│                                                                        │
│ 3. 6 Comprehensive Test Suites:                                       │
│    [Suite 1] Natural Language Intent & Fuzzy Partner Matching          │
│    [Suite 2] Multi-Step Data Collection (Name, Email, Phone)           │
│    [Suite 3] Automatic Instant Coupon Delivery                         │
│    [Suite 4] Duplicate Protection, Justification Prompt & Analise State│
│    [Suite 5] 24h SLA Provisioning & Admin Master Alerts                │
│    [Suite 6] Input Sanitization, XSS Resilience & Security Boundaries │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Acceptance Criteria Traceability Matrix

| Requirement | Test Name in `test_whatsapp_redemption.js` | Verification Method & Assertions |
| :--- | :--- | :--- |
| **R1. Web Parity & RPC Contract** | `TEST-RED-01: RPC Invocation Parity` | Asserts that `gsa_public_resgatar_beneficio_parceiro` is invoked with `{ p_parceiro_id, p_parceiro_slug, p_nome_completo, p_telefone, p_email }`. |
| **R2. Fuzzy Partner Search** | `TEST-RED-02: Fuzzy Partner Identification` | Tests queries like "Quero resgatar Petlove", "desconto na clinica", "beneficio ótica". Verifies exact and ambiguous matching. |
| **R3. Duplicate Detection** | `TEST-RED-03: Duplicate Detection & Rejection` | Simulates existing redemption for user + partner. Proves webhook returns duplicate notice and prompts for justification. |
| **R3. Justification Override** | `TEST-RED-04: Justification Submission to Analise` | User replies with justification. Proves `parceiros_resgates` record is created/updated with `status = 'analise'`, `alerta_duplicidade = true`, and `justificativa_duplicidade`. |
| **R4. Auto-Coupon Delivery** | `TEST-RED-05: Instant Auto-Coupon Delivery` | Proves that for partner with `redemption_has_coupon = true` and `delay_24h = false`, the bot's final reply contains the coupon code and protocol. |
| **R4. 24h SLA & Admin Alert** | `TEST-RED-06: 24h SLA Notice & Admin Master Alert` | Proves that for partner with `delay_24h = true`, bot informs 24h SLA, provides protocol, and sends notification to Admin `5511971858372`. |

---

## 6. Implementation Code Snippets & Mock Data

### 6.1 Mock Partners Catalog for Testing
```javascript
const MOCK_PARTNERS = [
  {
    id: '11111111-1111-4111-a111-111111111111',
    slug: 'petlove',
    name: 'Petlove',
    category: 'Veterinária',
    benefits: 'Primeira Mensalidade 100% Grátis pela GSA PET',
    status: 'ativo',
    redemption_has_coupon: true,
    redemption_coupon_code: 'PETLOVEGSA100',
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: 'https://petlove.com.br/convenio-gsa',
    redemption_delay_24h: false,
    redemption_instructions: 'Insira o cupom no carrinho para obter 100% de desconto no 1º mês.'
  },
  {
    id: '22222222-2222-4222-a222-222222222222',
    slug: 'oticas-carol',
    name: 'Óticas Carol',
    category: 'Saúde & Bem-Estar',
    benefits: 'Desconto exclusivo de 20% em armações e lentes',
    status: 'ativo',
    redemption_has_coupon: false,
    redemption_has_voucher: false,
    redemption_has_link: true,
    redemption_link: null,
    redemption_delay_24h: true,
    redemption_instructions: 'Aguarde o link oficial enviado em até 24 horas.'
  }
];
```

### 6.2 Fuzzy Partner Matching Algorithm Specification
```javascript
function fuzzyFindPartner(query, partnersList) {
  if (!query || !query.trim()) return [];
  const clean = query.trim().toLowerCase();
  
  // 1. Exact slug match
  const exactSlug = partnersList.filter(p => p.slug.toLowerCase() === clean);
  if (exactSlug.length > 0) return exactSlug;

  // 2. Exact name match
  const exactName = partnersList.filter(p => p.name.toLowerCase() === clean);
  if (exactName.length > 0) return exactName;

  // 3. Name or category includes query
  const partialMatches = partnersList.filter(p => 
    p.name.toLowerCase().includes(clean) || 
    p.slug.toLowerCase().includes(clean) ||
    (p.category && p.category.toLowerCase().includes(clean))
  );
  if (partialMatches.length > 0) return partialMatches;

  // 4. Token-based overlap
  const tokens = clean.split(/\s+/).filter(t => t.length >= 3);
  const tokenMatches = partnersList.filter(p => {
    const pName = p.name.toLowerCase();
    return tokens.some(t => pName.includes(t));
  });

  return tokenMatches;
}
```

---

## 7. Next Steps for Implementation Team

1. **Server Webhook Updates (`server_webhook_vps_live.cjs` and `server_webhook.cjs`)**:
   - Register `"resgatar"` intent in Gemini system prompt and fallback regex engine.
   - Implement `handlePartnerRedemptionFlow(fromPhone, text, session, partnerQuery)` state machine.
   - Implement fuzzy search endpoint/query against `parceiros`.
   - Implement duplicate pre-check query and justification transition (`REDEMPTION_AWAITING_JUSTIFICATION`).
   - Call RPC `gsa_public_resgatar_beneficio_parceiro` and patch `alerta_duplicidade` / `justificativa_duplicidade` / `status='analise'` upon override.
   - Handle instant coupon delivery vs 24h SLA response formatting.
2. **Execute Test Suite (`test_whatsapp_redemption.js`)**:
   - Run `node test_whatsapp_redemption.js` to ensure all 6 suites pass with 100% assertion success.
3. **Verify Build & Typecheck**:
   - Run `npm run typecheck:strict` and `npm run test:unit`.
