# Project: Client Panel and Database Audit Mission

## Architecture
- **Frontend Architecture**: React 18 with Vite and TypeScript, Tailwind CSS, Lucide icons, and Supabase client SDK (`@supabase/supabase-js`). Client components reside in `src/components/client/`, page entry points in `src/pages/ClientPortal.tsx` and `src/pages/ClientLoginPage.tsx`, and route definitions in `src/routing/routeCatalog.ts`.
- **Backend Architecture**: PostgreSQL (Supabase), managed via versioned migrations in `supabase/migrations/`. Row Level Security (RLS) enforces tenant and role segregation using session JWT claims parsed via helper functions `public.gsa_jwt_actor_type()` and `public.gsa_jwt_actor_id()`.
- **Transaction & Financial Layer**: Stored procedures (PL/pgSQL RPCs) handle sensitive financial balance modifications (withdrawals, points conversion, purchases, transfers) with security definer encapsulation, `FOR UPDATE` row locking, and trigger protection (`prevent_saldo_tampering()`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Frontend UTF-8 Encoding & Query Integrity | Restore clean UTF-8 for 7 client files, eliminate 253 `\uFFFD` tokens, fix broken Supabase ticket queries in `ClientFinanceiro.tsx` | M1 | Survey E1 |
| 2 | Frontend Admin Syntax Cleanup | Clean up 4 residual `= inputMode="numeric">` artifacts in admin modules (`FornecedoresModule.tsx`, `ServicePackagesModule.tsx`, `ConfiguracoesModule.tsx`, `AffiliateAdminModule.tsx`) to preserve clean TypeScript compilation | M1 | Survey E1 |
| 3 | Database RLS Policy on `vouchers` | Add SELECT policy on `public.vouchers` for `authenticated` with `public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()` | M2 | Survey E2, E3 |
| 4 | Database RLS Leak Remediation (`orcamentos`, `ordens_compra`) | Drop leftover `marketplace_orders_read` and `marketplace_purchase_orders_read` (`USING (true)`) to eliminate cross-tenant data leaks | M2 | Survey E2 |
| 5 | Database RLS Hardening (`loja_favoritos`, `loja_carrinhos`, `promocoes_quantidade_ativadas`, `cliente_premios`) | Enable RLS and establish strict client-ownership policies | M2 | Survey E2 |
| 6 | Financial RPC Hardening & Definer Checks | Revoke `anon` grant on `gsa_converter_pontos_carteira`, add `auth.uid()` checks, add `bypass_saldo_check` on admin balance RPCs, and fix credit/debit type comparison | M2 | Survey E3 |
| 7 | Programmatic Frontend Build Validation | Execute `npm run build` and ensure exit code 0 | M3 | Acceptance Criteria |
| 8 | Programmatic Database SQL RLS Verification Script | Execute script validating RLS policies on `saques`, `pontos_movimentacoes`, and `vouchers` for role `authenticated` | M3 | Acceptance Criteria |
| 9 | Independent Review, Challenge & Forensic Audit | Deploy 2 Reviewers, 2 Challengers, and 1 Forensic Auditor for rigorous validation | M4 | Protocol |
| 10 | Realtime Hook in ClientProfile | Add `useRealtimeSubscription` on `cliente_documentos` in `ClientProfile.tsx` | M1 | Survey E1 |
| 11 | Performance Memoization in useClientNotifications | Add `useCallback` / `useMemo` in `useClientNotifications.tsx` | M1 | Survey E1 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Frontend React Remediation | UTF-8 restoration for 7 client files, fix ticket query strings, syntax cleanup | Survey | DONE |
| M2 | Database RLS & RPC Remediation | Write migration hardening vouchers, orcamentos, ordens_compra, and financial RPCs | Survey | DONE |
| M3 | Programmatic Verification | Run `npm run build` and execute SQL RLS verification script | M1, M2 | DONE |
| M4 | Independent Review, Challenge & Audit | 2 Reviewers, 2 Challengers, 1 Forensic Auditor | M3 | DONE |

## Interface Contracts
### Client Panel ↔ PostgreSQL RLS
- All client queries on `saques`, `pontos_movimentacoes`, `vouchers`, `orcamentos`, `ordens_compra`, `carteira_lancamentos` must be filtered by `public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id()`.
- Direct client `INSERT`/`UPDATE`/`DELETE` on `saques`, `pontos_movimentacoes`, and `vouchers` must be rejected by RLS (only modified via authorized RPCs or admin).

### Client Panel ↔ Financial RPCs
- Points to wallet conversion: `public.gsa_converter_pontos_carteira(p_cliente_id uuid, p_pontos integer)` requires authenticated session matching `p_cliente_id` or admin role.
- Balance modifications must set `set_config('my.app.bypass_saldo_check', 'on', true)` inside security definer RPCs to satisfy `prevent_saldo_tampering()`.

## Code Layout
- Frontend client components: `src/components/client/`
- Frontend admin components: `src/components/admin/`
- SQL Migrations: `supabase/migrations/`
- Verification scripts: `scripts/`
- Metadata: `.agents/`
