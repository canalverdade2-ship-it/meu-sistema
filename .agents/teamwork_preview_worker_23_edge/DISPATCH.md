## 2026-09-11T02:24:20Z

# Task Assignment — Worker 23 Edge Functions Remediation (M3-edge)

**Mission**: Implementar as correções de segurança, tratamento de erros e integridade nas Edge Functions do Supabase.
**Working Directory**: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_edge
**Reference Documents**:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (sob o cabeçalho `## 2026-09-11T02:00:24Z`)
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_integ\handoff.md
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23\PROJECT.md

**Exclusive File Ownership**:
- `supabase/functions/gsa-transactional-email/index.ts`
- `supabase/functions/vps-api/index.ts`
- `supabase/functions/cloudflare-api/index.ts`
- `supabase/functions/ssh-proxy/index.ts`
- `supabase/functions/gsa-payments/index.ts`

**Tasks**:
1. `supabase/functions/gsa-transactional-email/index.ts`:
   - Corrigir a query SQL trocando `clientes_pf` pela tabela correta `clientes` (`.from("clientes").select("nome, email")`).
   - Adicionar validação de autorização (Bearer token com `SUPABASE_SERVICE_ROLE_KEY` ou secret webhook `WEBHOOK_SECRET`) para que a função não opere como open relay não autenticado.
2. `supabase/functions/vps-api/index.ts`:
   - Remover `const isAuthorized = true;`. Implementar validação rigorosa de autenticação admin/service_role.
   - Substituir chaves e IPs hardcoded (`'apikey': 'gsa_hub_evolution_token_2026'`, `147.15.43.141`) por variáveis de ambiente (`Deno.env.get('EVOLUTION_API_KEY')`, `Deno.env.get('VPS_HOST_IP')`).
   - Bloquear SSRF restringindo chamadas apenas a hosts/endpoints da whitelist autorizada.
3. `supabase/functions/cloudflare-api/index.ts` & `supabase/functions/ssh-proxy/index.ts`:
   - Adicionar checagem de RBAC para garantir que o usuário autenticado possua papel de `admin` ou `colaborador` antes de executar comandos privilegiados.
4. `supabase/functions/gsa-payments/index.ts`:
   - Ler `INFINITEPAY_HANDLE` a partir de `Deno.env.get('INFINITEPAY_HANDLE') || 'getsemani-gsa'`.
   - Limpar código morto/comentado não utilizado (`procesarPagamento`).
5. Validar a sintaxe TypeScript/Deno de todos os arquivos modificados.
6. Documentar a execução em `.agents/teamwork_preview_worker_23_edge/handoff.md`.

## 2026-09-11T06:20:41Z
You are teamwork_preview_worker_23_edge. Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_edge

Exclusive File Ownership:
- `supabase/functions/gsa-transactional-email/index.ts`
- `supabase/functions/vps-api/index.ts`
- `supabase/functions/cloudflare-api/index.ts`
- `supabase/functions/ssh-proxy/index.ts`
- `supabase/functions/gsa-payments/index.ts`

Mission:
Implement all Edge Function fixes and security hardening:
1. `supabase/functions/gsa-transactional-email/index.ts`:
   - Replace non-existent table `clientes_pf` with `clientes` (`.from("clientes").select("nome, email")`).
   - Implement authentication check (require Authorization Bearer matching service_role key or webhook secret) to prevent open relay abuse.
2. `supabase/functions/vps-api/index.ts`:
   - Remove `isAuthorized = true;`. Require valid admin/service_role authentication.
   - Replace hardcoded API keys and IPs with `Deno.env.get()`.
   - Restrict destination targets to whitelist to prevent SSRF.
3. `supabase/functions/cloudflare-api/index.ts` & `supabase/functions/ssh-proxy/index.ts`:
   - Add RBAC verification ensuring calling user has `admin` or `colaborador` role before executing infrastructure/DNS operations.
4. `supabase/functions/gsa-payments/index.ts`:
   - Use `Deno.env.get('INFINITEPAY_HANDLE') || 'getsemani-gsa'`.
   - Clean up dead unused functions (`procesarPagamento`).
5. Verify syntax and TypeScript validity of all modified functions.
6. Write your completion handoff report to:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_edge\handoff.md
Once finished, send a message to orchestrator.
