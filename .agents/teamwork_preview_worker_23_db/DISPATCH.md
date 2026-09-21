# Task Assignment — Worker 23 Database Remediation (M1)

**Mission**: Implementar a migração SQL de remediação de segurança e banco de dados do Grupo GSA.
**Working Directory**: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_db
**Reference Documents**:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (sob o cabeçalho `## 2026-09-11T02:00:24Z`)
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_db\handoff.md
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23\PROJECT.md

**Exclusive File Ownership**:
- `supabase/migrations/20260911030000_comprehensive_database_security_remediation.sql`

**Tasks**:
1. Criar o arquivo `supabase/migrations/20260911030000_comprehensive_database_security_remediation.sql` contendo o script de remediação completo detalhado no laudo do Explorer DB:
   - Revogar e excluir a RPC vulnerável `sync_cliente_pontos_e_saldo`.
   - Atualizar a função de trigger `prevent_saldo_tampering()` para barrar alterações diretas de saldo/pontos também para roles `anon` e `public`.
   - Remover as 8 políticas abertas com `USING (true)` em `faturas`, `ordens_servico`, `saques`, `transferencias`, `contratos`, `orcamento_timeline`, `sistema_logs`, `whatsapp_pendencias_ativas`, e criar políticas restritas baseadas no JWT de ator.
   - Criar políticas de `SELECT` para prestadores autenticados em `prestador_transacoes`, `prestador_saques` e `prestador_vouchers`.
   - Habilitar RLS e criar política de leitura em `promocoes_quantidade` para clientes da loja.
   - Definir `SET search_path = public, pg_temp` em funções `SECURITY DEFINER` e restringir RPCs de saque via webhook exclusivamente a `service_role`.
2. Validar sintaxe SQL.
3. Documentar a execução em `.agents/teamwork_preview_worker_23_db/handoff.md`.

## 2026-09-11T02:24:18Z
You are teamwork_preview_worker_23_db. Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_db

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You MUST read:
1. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-11T02:00:24Z`.
2. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_db\DISPATCH.md
3. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_db\handoff.md
4. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23\PROJECT.md

Exclusive File Ownership:
- `supabase/migrations/20260911030000_comprehensive_database_security_remediation.sql`

Mission:
Implement the complete database security and RLS remediation migration `supabase/migrations/20260911030000_comprehensive_database_security_remediation.sql`:
- Revoke and drop `public.sync_cliente_pontos_e_saldo(UUID, INT, NUMERIC, TEXT)`.
- Update `prevent_saldo_tampering()` to block direct balance/points alterations from `anon`, `authenticated`, or `public`.
- Drop the 8 wildcard `USING (true)` policies (`faturas_public_read`, `ordens_servico_public_read`, `saques_select_public_temp`, `transferencias_select_public_temp`, `contratos_anon_select`, `orcamento_timeline_*`, `sistema_logs_select_public_temp`, `whatsapp_pendencias_auth_read`) and implement strict tenant-scoped policies.
- Add SELECT policies for authenticated providers on `prestador_transacoes`, `prestador_saques`, and `prestador_vouchers`.
- Enable RLS and add active-only policy on `promocoes_quantidade` for store customers.
- Enforce `SET search_path = public, pg_temp` on `gsa_generate_unique_product_code()`, and revoke execution of `gsa_webhook_solicitar_saque_cliente` from authenticated (restrict to service_role).
- Verify SQL syntax and integrity.
- Write your completion handoff report to:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_db\handoff.md
Once finished, send a message to orchestrator.

## 2026-09-11T06:52:01Z
**Context**: Status check do Worker DB
**Content**: Olá worker_23_db, notei que a migração supabase/migrations/20260911030000_comprehensive_database_security_remediation.sql já foi criada no projeto. Você concluiu as validações? Por favor, finalize seu handoff.md e nos envie o relatório de conclusão.
**Action**: Finalizar o relatório handoff.md e enviar mensagem de conclusão.

