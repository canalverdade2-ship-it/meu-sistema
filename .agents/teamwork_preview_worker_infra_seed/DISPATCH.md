# Dispatch: Worker 1 — Local Isolated Infrastructure & Deterministic Seed (R1)

## Identity
You are **teamwork_preview_worker_infra_seed**, an implementation and infrastructure worker.
Working directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_infra_seed`

## Authoritative Reference
Read:
1. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md` (specifically `## 2026-09-16T16:21:01Z`).
2. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_1\report.md`
3. `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_survey_1\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective
Implement Requirement R1 (Provisionamento de Infraestrutura Isolada Local):
1. **Deterministic Seed SQL (`supabase/seed.sql`)**:
   - Create `supabase/seed.sql` with valid, deterministic test data representing all 6 personas + partner:
     - Cliente (`CLI-001`, CPF válido via módulo 11 ex: `52998224725` ou novo sintético válido, PIN `1234` com crypt bcrypt)
     - Admin (`ADM-001`, system_settings admin_access_code com crypt hash)
     - Colaborador (`COL-001`, tabela colaboradores com credencial_hash)
     - Prestador (`PRV-001`, prestadores com CPF/CNPJ válido e PIN `1234`)
     - Fornecedor (`FOR-001`, fornecedores com CNPJ válido e PIN `1234`)
     - Afiliado (`AFL-001`, afiliados com slug/código e carteira)
     - Parceiro (`PAR-001`, parceiros_resgates com cupons e protocolos)
   - Include related entities: produtos, categorias, carrinho, pedidos, OS/demandas, agenda, saldo de fidelidade, cupons de desconto.
2. **Seed Application Harness (`scripts/apply-seed.ts` or similar)**:
   - Create a deterministic script that connects to the isolated database and executes the seed cleanly, verifying that each persona exists and can authenticate.
3. **Local Edge Functions Harness**:
   - Create a local server or runner (`scripts/serve-local-functions.ts` or Node/Deno runner) capable of executing the Edge Functions locally (`gsa-auth-session`, `gsa-ad-delivery`, etc.) so they can be invoked via local HTTP requests without requiring remote cloud deployment.
4. **Local Webhook Execution Verification**:
   - Verify that `server_webhook.cjs` can run locally in test/isolated mode with local environment variables.
5. **External Mocks/Sandbox Configuration**:
   - Ensure that external APIs (InfinitePay, Resend, Evolution API / WhatsApp) are safely configured for sandbox or mock mode during tests.

## Verification
- Run the seed application script and verify that all tables and personas are populated.
- Test authentication for each persona via SQL/RPC or local Edge Function request.
- Document exact execution commands and outputs in `handoff.md`.
- Report completion via `send_message`.

## 2026-09-16T17:25:37Z
**Context**: Status check on Worker Infra & Seed
**Content**: Your progress.md has not been updated since 17:06Z. Please provide a status update on the implementation of scripts/apply-seed.ts, Edge Functions runner, and verification suite.
**Action**: Update your progress.md and report your current status.

## 2026-09-16T17:27:30Z
**Context**: Acknowledging Worker Infra & Seed Status Update
**Content**: Understood. Proceed with genuine schema-compliant seed and harness implementation as planned.
**Action**: Continue implementation, run verification, and deliver handoff.md upon completion.
