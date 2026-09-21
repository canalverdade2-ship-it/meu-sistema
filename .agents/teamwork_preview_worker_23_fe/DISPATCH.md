# Task Assignment — Worker 23 Frontend & Contracts Remediation (M2 & M3-contracts)

**Mission**: Implementar as correções nos painéis de papéis (Anunciante, Prestador, Parceiro, Afiliado), rotas, contratos de UI e linter.
**Working Directory**: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_23_fe
**Reference Documents**:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (sob o cabeçalho `## 2026-09-11T02:00:24Z`)
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_fe\handoff.md
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_integ\handoff.md
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_23\PROJECT.md

**Exclusive File Ownership**:
- `src/routes/routeSecurity.ts`
- `src/routes/routeCatalog.ts`
- `src/components/prestador/PrestadorFinanceiro.tsx`
- `src/pages/ProviderAccessPage.tsx`
- `src/features/partners/service.ts`
- `src/components/prestador/PrestadorDemandas.tsx`
- `src/components/admin/prestadores/PrestadoresFinanceiro.tsx`
- `src/components/afiliado/AfiliadoDashboard.tsx`
- `src/pages/CareersLandingPage.tsx`
- `scripts/audit-production-real.mjs`

**Tasks**:
1. `src/routes/routeSecurity.ts`: desbloquear área `'advertiser'` retornando `true` para que anunciantes não autenticados possam acessar `/anuncios/login` e gerenciar sua própria autenticação.
2. `src/components/prestador/PrestadorFinanceiro.tsx`: corrigir query SQL na linha 198 trocando `nome_completo` por `nome_razao` (coluna real da tabela `prestadores`).
3. `src/routes/routeCatalog.ts`: registrar `profile: '/prestador/perfil'` sob `routes.provider`.
4. `src/pages/ProviderAccessPage.tsx`:
   - Corrigir a chamada RPC `gsa_public_register_provider` para passar obrigatoriamente `(p_payload, p_verification_token)` conforme migração `20260830123000`.
   - Chamar `setRegistrationStage('success')` e renderizar o card de sucesso/boas-vindas para o prestador.
5. `src/features/partners/service.ts` & `src/components/prestador/PrestadorDemandas.tsx`: substituir catches vazios por logging explícito (`console.warn` / feedback).
6. `src/components/admin/prestadores/PrestadoresFinanceiro.tsx`: remover `searchTerm` das dependências do hook WebSocket ou aplicar debounce para evitar recriação excessiva do canal.
7. `src/components/afiliado/AfiliadoDashboard.tsx`: integrar o contrato de ativação de perfil de cliente (`activateClientProfileFromAffiliate`) para satisfazer o teste `check-affiliate-contracts.ts`.
8. `src/pages/CareersLandingPage.tsx`: alinhar com a listagem de vagas ativas via RPC `gsa_public_list_career_vacancies` para satisfazer `check-careers-contracts.ts`.
9. `scripts/audit-production-real.mjs`: ajustar regex ou ignorar comentários de código contendo "dados fictícios" para evitar falsos-positivos no linter.
10. Executar `npx tsc --noEmit` e os scripts de teste correspondentes para verificar que tudo passa com código 0.
11. Documentar em `.agents/teamwork_preview_worker_23_fe/handoff.md`.

## 2026-09-11T06:52:12Z
**Context**: Status check do Worker Front-end
**Content**: Olá worker_23_fe, como está o progresso das correções nos painéis, rotas e testes de contrato?
**Action**: Envie uma atualização de status ou finalize seu handoff.md quando concluir os testes.

## 2026-09-11T06:56:01Z
**Context**: Detalhe de caminhos de arquivos para testes de contrato
**Content**: Olá worker_23_fe, atente-se para os caminhos exatos verificados pelos scripts de teste:
1. `src/pages/Afiliado/AfiliadoDashboard.tsx` (e não src/components/...) para `activateClientProfileFromAffiliate` e `Ativar perfil de cliente` (verificado por `scripts/check-affiliate-contracts.ts`).
2. `src/pages/CareersLandingPage.tsx` para `gsa_public_list_career_vacancies` (verificado por `scripts/check-careers-contracts.ts`).
3. `scripts/audit-production-real.mjs` para desconsiderar comentários que contenham 'dados ficticios' ou 'mocked'.
**Action**: Assegure-se de que os testes `npx tsx scripts/check-affiliate-contracts.ts`, `npx tsx scripts/check-careers-contracts.ts`, `npx tsx scripts/check-provider-portal-security-contracts.ts` e `npm run lint` passem com código de saída 0.
