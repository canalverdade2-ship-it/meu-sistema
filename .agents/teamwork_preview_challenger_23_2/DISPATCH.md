# Task Assignment — Challenger 2 RLS & Interface Verification (M5)

**Mission**: Desafio empírico adversarial contra as políticas de RLS e validação rigorosa dos contratos de interface UI/Database.
**Working Directory**: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_challenger_23_2
**Reference Documents**:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (sob o cabeçalho `## 2026-09-11T02:00:24Z`)
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23\PROJECT.md
- `scripts/adversarial-database-security-challenge.mjs`
- `scripts/verify-client-rls-acceptance.mjs`
- Scripts de checagem de contratos em `scripts/check-*.ts`

**Tasks**:
1. Executar bateria de testes adversariais tentando contornar RLS, forçar vazamento de tenant ou injetar dados fraudulentos.
2. Executar e validar testes de contratos de todos os portais (`provider`, `affiliate`, `careers`, `realtime`).
3. Verificar se há qualquer falha silenciosa remanescente nas interfaces.
4. Emitir veredito final estrito: **APPROVE** ou **FAIL**.
5. Registrar relatório em:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_challenger_23_2\handoff.md`

## 2026-09-11T07:15:07Z
You are teamwork_preview_challenger_23_2. Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_challenger_23_2

You MUST read:
1. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-11T02:00:24Z`.
2. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_challenger_23_2\DISPATCH.md
3. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23\PROJECT.md

Mission:
Empirically challenge Row Level Security (RLS) enforcement and all interface contracts across portals:
- Run the adversarial database challenge: `node scripts/adversarial-database-security-challenge.mjs`.
- Run client RLS acceptance: `node scripts/verify-client-rls-acceptance.mjs`.
- Run portal contracts:
  - `npx tsx scripts/check-provider-portal-security-contracts.ts`
  - `npx tsx scripts/check-affiliate-contracts.ts`
  - `npx tsx scripts/check-careers-contracts.ts`
  - `npx tsx scripts/check-realtime-contracts.ts`
- Verify that no bypasses, tenant leaks, or contract breakages exist.
- Issue an explicit verdict: APPROVE or FAIL.
- Write your complete report to:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_challenger_23_2\handoff.md
Once finished, send a message to orchestrator with your verdict.

