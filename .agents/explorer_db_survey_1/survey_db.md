# Comprehensive Database Integrity & VPS RPC Survey Report — GSA HUB

**Surveyor:** `explorer_db_survey_1`  
**Timestamp:** 2026-08-26T23:36:30Z  
**Environment:** PostgreSQL 15.18 on aarch64 (VPS 147.15.43.141, Port 5433, Database `gsahub`)  
**Scope:** Live PostgreSQL Database Audit, 300 Migration Files, 458 Frontend Source Files (`src/`)

---

## 1. Executive Summary

A comprehensive integrity survey of the GSA HUB database and VPS PostgREST/PostgreSQL RPC infrastructure was conducted via direct SSH connection to the production VPS (`opc@147.15.43.141`). 

### Key Metrics Summary:
- **Live Database Tables:** 239 tables in `public` schema
- **Live Database Columns:** 3,105 columns cataloged
- **Live RPC Functions:** 624 PostgreSQL functions in `public`
- **Live RLS Policies:** 466 Row Level Security policies
- **Live System Settings:** 59 configuration keys in `public.system_settings`
- **Frontend References:** 118 tables and 132 RPC functions across 458 `.ts`/`.tsx` files
- **Automated Test Suite:** 18 test files, 244 tests passing (100%)
- **Production Build:** Vite v6.4.3 compiled cleanly with 0 errors

---

## 2. Structural Schema & Table Audit

### 2.1 Critical Remediated Tables (Consolidated Migration 20260826220000)
All critical tables referenced across frontend modules and recent migrations are fully created with primary keys, indexes, and RLS policies on the VPS:

| Table Name | Super-Domain / Module | Status in DB | RLS Enabled | Policies |
| :--- | :--- | :---: | :---: | :---: |
| `contratos` | SD4 Contratos & Documentos | **Present** | Yes | Admin all, Anon select |
| `blog_posts` | N8N Blog & Curadoria Pública | **Present** | Yes | Public read, Admin write |
| `loja_vaquinhas` | GSA Store / Presente em Grupo | **Present** | Yes | Public all access |
| `loja_vaquinha_contribuicoes` | GSA Store / Vaquinhas Contribuições | **Present** | Yes | Public all access |
| `gsa_hero_banners` | Marketplace Hero Carousel | **Present** | Yes | Public active read, Admin all |
| `whatsapp_pendencias_ativas` | WhatsApp Bidirecional & n8n | **Present** | Yes | Authenticated / Service role |

### 2.2 Partner Commercial & Redemption System (`parceiros` & `parceiros_resgates`)
Audit confirms 100% column parity with migration `20260826190000_consolidate_partner_redemption_system.sql` and `20260826220000_production_remediation_consolidated.sql`:

#### Table `public.parceiros` (Redemption Columns):
- `redemption_has_coupon` (boolean, default: false) — **Present**
- `redemption_coupon_code` (text) — **Present**
- `redemption_has_voucher` (boolean, default: false) — **Present**
- `redemption_has_link` (boolean, default: false) — **Present**
- `redemption_link` (text) — **Present**
- `redemption_auto_redirect` (boolean, default: false) — **Present**
- `redemption_instructions` (text) — **Present**
- `redemption_delay_24h` (boolean, default: false) — **Present**

#### Table `public.parceiros_resgates` (Full Lifecycle Schema):
- `id` (uuid, PK, default `gen_random_uuid()`) — **Present**
- `parceiro_id` (uuid, FK `parceiros(id)`) — **Present**
- `cliente_id` (uuid, nullable) — **Present**
- `nome_completo` (text, not null) — **Present**
- `email` (text, nullable) — **Present**
- `telefone` (text, not null) — **Present**
- `codigo_gerado` (text, e.g. `PROT-RES-YYYY-XXXXXX`) — **Present**
- `tipo_resgate` (text, e.g. `link`, `cupom`, `voucher`, `manual_24h`) — **Present**
- `link_destino` (text) — **Present**
- `link_ativacao` (text) — **Present**
- `status` (text, not null, default: `'pendente'`) — **Present**
- `auto_redirecionado` (boolean, default: false) — **Present**
- `data_ativacao` (timestamptz) — **Present**
- `created_at` (timestamptz, not null, default `now()`) — **Present**

### 2.3 Individual Remediated Columns Audit
| Table | Column | Type | Status | Verified In DB |
| :--- | :--- | :--- | :---: | :---: |
| `cliente_promocoes` | `visualizado` | `boolean` (default false) | **Present** | Yes |
| `viagens_transacoes` | `resposta_admin` | `text` | **Present** | Yes |
| `produtos` | `avaliacao_media` | `numeric(3,2)` (default 0) | **Present** | Yes |
| `produtos` | `total_avaliacoes` | `integer` (default 0) | **Present** | Yes |
| `produtos` | `comentarios_importados` | `jsonb` (default `'[]'::jsonb`) | **Present** | Yes |
| `prestadores` | `nome_completo` | `text` | **Present** | Yes |
| `prestador_documentos`| `updated_at` | `timestamptz` | **Present** | Yes |
| `tickets` | `updated_at` | `timestamptz` | **Present** | Yes |
| `prestador_promocoes` | `data_inicio` | `timestamptz` | **Present** | Yes |

---

## 3. RPC Signatures, Security & Privilege Survey

All 132 RPC functions invoked by the frontend exist in the PostgreSQL database. Security definer status and role execution grants were audited:

### 3.1 Public RPCs (Audited for `anon`, `authenticated`, `service_role` Execution)
- `gsa_public_resgatar_beneficio_parceiro(uuid, text, text, text, uuid, text)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_criar_vaquinha(jsonb)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_obter_vaquinha(text)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_confirmar_contribuicao_vaquinha(uuid, text)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_registrar_pendencia_whatsapp(uuid, text, text, text, text, text)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_public_register_client(jsonb, text)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_public_register_provider(jsonb)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_public_register_supplier(jsonb)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_validate_session(uuid, text)` -> `TABLE`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_ping_session(uuid, text)` -> `boolean`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`
- `gsa_end_session(uuid, text)` -> `boolean`
  - **Security Definer:** `true` | **Grants:** `anon`, `authenticated`, `service_role`

### 3.2 Admin RPCs (Audited for Session Verification & `authenticated`, `service_role` Execution)
- `gsa_admin_complete_partner_redemption(uuid, text, uuid, text)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `authenticated`, `service_role` (Public/anon revoked)
- `gsa_admin_approve_budget(uuid, text, uuid, uuid, text)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `authenticated`, `service_role` (Public/anon revoked)
- `gsa_admin_process_travel_refund(uuid, text, uuid, uuid, text, numeric, numeric, text, text)` -> `jsonb`
  - **Security Definer:** `true` | **Grants:** `authenticated`, `service_role` (Public/anon revoked)

---

## 4. `system_settings` Configuration Keys Audit

The `public.system_settings` table contains 59 active configuration records on the VPS. Key settings verified:
- `whatsapp_n8n_webhook_url`: `http://147.15.43.141:5678/webhook/send-whatsapp`
- `n8n_base_url`: `http://127.0.0.1:5678`
- `whatsapp_admin_notificacoes`: `5511971858372`
- `whatsapp_float_telefone`: `11920857756`
- `afiliado_bonus_boas_vindas_ativo`: `true` | `afiliado_bonus_boas_vindas_valor`: `100`
- `afiliado_pontos_minimo_resgate`: `1` | `afiliado_pontos_resgate_taxa`: `0.01`
- `afiliado_saque_minimo`: `1.00` | `valor_minimo_saque`: `15`
- `desconto_indicado_porcentagem`: `10` | `bonus_indicador`: `20`
- `emprestimo_limite_simultaneos`: `1` | `emprestimo_desconto_vip_percentual`: `10`
- `modal_indicacao_ativo`: `true` | `modal_indicacao_url_botao`: `https://getsemani-gsa.netlify.app/`

---

## 5. Live Programmatic E2E Verification Results

Direct execution tests against the VPS database returned exact required payload schemas:

### Test 1: Partner Redemption RPC Execution
```sql
SELECT public.gsa_public_resgatar_beneficio_parceiro(
  NULL, 
  'cuidados-com-seu-pet', 
  'Auditoria E2E Explorer', 
  '11999998888', 
  NULL, 
  'auditoria.e2e@gsa.com.br'
);
```
**Output Returned:**
```json
{
  "success": true,
  "resgate_id": "39b0b196-d769-46e5-be14-05e23a859256",
  "partner_name": "CUIDADOS COM SEU PET",
  "partner_slug": "cuidados-com-seu-pet",
  "partner_logo": "https://marcaspelomundo.com.br/wp-content/uploads/2022/06/handler-1.jpg",
  "benefits": "Ganhe a 1ª Mensalidade 100% Grátis e Carência ZERO.",
  "tipo_resgate": "manual_24h",
  "codigo_gerado": "PROT-RES-2026-1B529F",
  "protocolo": "PROT-RES-2026-1B529F",
  "email": "auditoria.e2e@gsa.com.br",
  "telefone": "11999998888",
  "nome_completo": "Auditoria E2E Explorer",
  "has_coupon": false,
  "has_voucher": false,
  "has_link": false,
  "link": null,
  "auto_redirect": false,
  "instructions": null,
  "delay_24h": true
}
```

### Test 2: Database Record Persistence
Querying `parceiros_resgates` confirmed proper persistence with protocol and email:
`39b0b196-d769-46e5-be14-05e23a859256 | f7e268c2-6a6b-4c1c-a31c-249790556f5a | Auditoria E2E Explorer | auditoria.e2e@gsa.com.br | 11999998888 | PROT-RES-2026-1B529F | manual_24h | pendente | 2026-08-26 23:33:53.437+00`

---

## 6. Conclusion & Recommendations

The PostgreSQL database on VPS `147.15.43.141` is in full structural integrity and complete alignment with frontend requirements. All tables, columns, RPC definitions, permissions, and RLS policies are healthy and operational.