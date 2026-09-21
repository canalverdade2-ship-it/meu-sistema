## 2026-08-21T22:28:04Z
You are a teamwork_preview_worker.
Your working directory is: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\worker_r1_db_1
Project root: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Authoritative User Request: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\ORIGINAL_REQUEST.md (READ THIS FIRST).
PROJECT state: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md.
Explorer Database Report: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_diag_db_1\handoff.md.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive Write Ownership:
- src/components/admin/super-domains/contratos/AreaVipView.tsx
- src/components/admin/super-domains/contratos/CrmClientesView.tsx
- src/components/admin/super-domains/contratos/HubEmpresasView.tsx
- src/components/admin/super-domains/financeiro/FaturamentoView.tsx
- src/components/admin/super-domains/financeiro/RentabilidadeReembolsosView.tsx
- src/components/admin/super-domains/governanca/GovernancaAuditoriaView.tsx
- src/components/admin/super-domains/operacoes/OrdensServicoWorkstation.tsx
- src/components/admin/super-domains/pessoas/FidelidadePromocoesSection.tsx
- src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx
- src/components/admin/super-domains/pessoas/SaquesRepassesSection.tsx

Your Task:
Implement the 10 database schema alignment fixes identified in explorer_diag_db_1/handoff.md:
1. AreaVipView.tsx: Replace created_at with data_cadastro in clientes select.
2. CrmClientesView.tsx: Remove bloqueado from .select(...); update mutation payload to { status: isBloqueado ? 'inativo' : novoStatus, carteira_bloqueada: isBloqueado, pontos_bloqueados: isBloqueado }.
3. FaturamentoView.tsx: Remove invalid orcamentos(...) join on ordens_compra and ordens_assinatura; query ordens_compra(id, codigo_ordem, quantidade, produtos(nome, valor)) and ordens_assinatura(id, codigo_ordem, quantidade, prazo_meses, assinaturas(nome, valor)).
4. FaturamentoView.tsx: Query produtos(valor) and assinaturas(valor) instead of non-existent orcamentos(total).
5. OrdensServicoWorkstation.tsx: Select prestadores (id, nome_razao, telefone, documento, tipo_cadastro) instead of non-existent columns.
6. SaquesRepassesSection.tsx: Remove saldo_carteira from prestadores join in prestador_saques.
7. PessoasSuperDomain.tsx: Use canonical table gsa_afiliados instead of afiliados.
8. FidelidadePromocoesSection.tsx: Use canonical table cliente_premios instead of premios_resgates.
9. RentabilidadeReembolsosView.tsx: Insert into canonical table carteira_lancamentos with { cliente_id, tipo, valor, descricao, data_lancamento }.
10. GovernancaAuditoriaView.tsx: Query sistema_logs (order('created_at')) and system_settings.
11. HubEmpresasView.tsx: Create corporate B2B client companies in clientes with tipo_pessoa: 'pj' and appropriate fields.

After making edits, run `npm run typecheck:strict` and `npm run test:unit` to verify everything builds and passes.
Write handoff.md with your verification proof and send a completion message to parent.
