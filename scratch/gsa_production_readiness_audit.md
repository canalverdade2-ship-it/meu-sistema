# Relatorio de Auditoria Integral GSA - Production Readiness

Gerado em: 2026-07-14T03:27:04.110Z
Projeto: C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

## Decisao Executiva

**STATUS: NAO APROVADO PARA PRODUCAO.**

A aplicacao compila e a auditoria principal de caracteres nao encontrou mojibake em codigo fonte. Mesmo assim, o sistema nao pode ser liberado para producao porque ainda ha falhas criticas comprovadas no banco real e na arquitetura operacional:

- 91 policies RLS abertas para `public`/`anon` com `true` em `USING` ou `WITH CHECK` no banco real.
- 0 tabelas referenciadas pelo codigo nao existem no schema publico vivo.
- 1 RPCs chamadas pelo codigo/tooling nao existem no banco vivo.
- 0 buckets usados pelo codigo nao existem no storage vivo.
- 211 operacoes diretas sensiveis no frontend/servicos locais ainda escrevem em tabelas criticas.
- Strings de conexao do banco aparecem hardcoded em scripts locais (`get_schema.cjs`, `apply_pg_migration.cjs`).
- Nao ha script formal de teste no `package.json`; existe apenas `src/tests/finance.test.ts` sem runner configurado.
- A auditoria navegada foi bloqueada pela politica do navegador para o host local, logo nenhum botao pode ser certificado como aprovado por execucao visual nesta rodada.

## Evidencias Executadas

- Inventario estatico: `node scratch/production_audit_inventory.cjs`.
- Auditoria de caracteres: `node scratch/character_audit.cjs`.
- Auditoria viva do banco: `node scratch/live_db_audit.cjs --allow-local-fallback`.
- Auditoria de escritas diretas: `node scratch/direct_write_audit.cjs`.
- Build: `npm run build` aprovado.

## Inventario do Projeto

- Arquivos proprios analisados: 332.
- Arquivos em src/: 192.
- Arquivos SQL: 68.
- Migrations: 62.
- Paginas detectadas: 4.
- Componentes detectados: 134.
- Hooks detectados: 9.
- Contextos detectados: 1.
- Rotas detectadas: 12.
- Tabelas usadas via Supabase no codigo: 81.
- RPCs usadas no codigo: 53.
- Canais realtime no codigo: 110.

### Rotas encontradas
- /cliente (src/App.tsx:32)
- /loja-gsa-store (src/App.tsx:36)
- /loja (src/App.tsx:36)
- /login (src/App.tsx:40)
- /acesso (src/App.tsx:40)
- /servicos-e-assinaturas (src/App.tsx:44)
- /servicos (src/App.tsx:44)
- /criacao-de-site-e-sistemas (src/App.tsx:48)
- /sistemas (src/App.tsx:48)
- /cliente/* (src/App.tsx:32)
- /cliente/ (src/App.tsx:32)
- /cliente/dashboard (src/App.tsx:168)

### Paginas
- src/pages/AdminPanel.tsx
- src/pages/ClientPortal.tsx
- src/pages/Home.tsx
- src/pages/Prestador/PrestadorDashboard.tsx

### Modulos do Portal Cliente
- Meu Perfil (741)
- Dashboard (742)
- GSA Store Hub (743)
- Meu Crédito (744)
- Serviços e Assinaturas (745)
- Meus Orçamentos (746)
- Meus Serviços (747)
- Meus Produtos (748)
- Minhas Assinaturas (749)
- Meus Empréstimos (750)
- Transferências (751)
- Financeiro (752)
- Fidelidade (753)
- Promoções (754)
- Meus Prêmios (755)
- Vouchers (756)
- Indique e Ganhe (757)
- Meus Pontos (758)
- Área VIP (760)
- Suporte (761)

### Modulos do Admin
- Principal (73)
- Dashboard (75)
- Cadastro (76)
- Vendas (77)
- Gestão Interna (78)
- Financeiro (82)
- Financeiro (84)
- Cobrança (85)
- Fiscal (86)
- Suporte (90)
- Tickets (92)
- Gestão VIP (93)
- Administração (97)
- Relatórios (99)
- Promoções VIP (100)
- Configurações (101)
- Acesso (105)
- Gerenciar Acessos (107)
- Infraestrutura (111)
- Saúde do Sistema (113)
- Principal (120)
- Dashboard (122)
- Cadastros (123)
- Catalogo (124)
- Operacoes (125)
- Loja GSA Store (126)
- Financeiro (130)
- Financeiro (132)
- Relacionamento (136)
- Fidelidade (138)
- Atendimento (139)
- Gestao (143)
- Relatorios (145)
- Configuracoes (146)
- Acesso (150)
- Gerenciar Acessos (152)
- Infraestrutura (156)
- Saude do Sistema (158)

## Banco Real

- Tabelas totais consultadas: 135.
- Tabelas publicas: 85.
- Colunas: 1544.
- Constraints: 1175.
- Indices: 334.
- Policies: 149.
- Tabelas com estado RLS consultado: 132.
- Functions totais: 232.
- Functions publicas: 115.
- Triggers: 43.
- Views: 3.
- Buckets: 8.
- Publicacoes realtime: 77.

### Tabelas publicas encontradas
- admin_notificacoes
- assinaturas
- carteira_lancamentos
- client_levels
- cliente_documentos
- cliente_notas_admin
- cliente_premios
- cliente_promocoes
- clientes
- cobranca_acordo_parcelas
- cobranca_historico
- cobrancas
- colaborador_modulos
- colaboradores
- cupons_ativados
- cupons_loja
- debug_admin_rpc
- demanda_comentarios
- empresa
- emprestimo_comentarios
- emprestimo_documentos
- emprestimo_historico
- emprestimo_parcelas
- emprestimo_templates_contrato
- emprestimos
- extrato_financeiro
- fatura_contestacoes
- faturas
- formas_pagamento
- funcoes
- indicacoes
- level_history
- loja_avaliacoes
- loja_avisos_estoque
- loja_carrinhos
- loja_categorias
- loja_credito_documentos
- loja_credito_movimentacoes
- loja_credito_solicitacoes
- loja_estoque_historico
- loja_favoritos
- loja_reembolsos
- loja_solicitacoes
- notificacoes
- orcamento_timeline
- orcamentos
- ordens_assinatura
- ordens_compra
- ordens_fiscais
- ordens_servico
- os_notas
- os_suporte_mensagens
- pagamentos
- points_transactions
- pontos_movimentacoes
- prestador_agendamentos
- prestador_demandas
- prestador_demandas_historico
- prestador_documentos
- prestador_faturas
- prestador_historico
- prestador_premios
- prestador_promocoes
- prestador_promocoes_ativacoes
- prestador_saques
- prestador_suporte_demandas
- prestador_transacoes
- prestador_vouchers
- prestadores
- produtos
- promocoes
- promocoes_quantidade
- promocoes_quantidade_ativadas
- promocoes_quantidade_uso
- saques
- servicos
- sistema_logs
- sistema_sessoes
- solicitacoes_exclusao
- suporte_mensagens
- system_settings
- ticket_mensagens
- tickets
- transferencias
- vouchers

### Buckets encontrados
- documentos_cliente (public=true, limite=10485760)
- documentos_prestador (public=true, limite=sem limite)
- emprestimos (public=true, limite=sem limite)
- entregas_demandas (public=true, limite=sem limite)
- fiscal_docs (public=true, limite=20971520)
- gsa-store-images (public=true, limite=sem limite)
- gsa-store-returns (public=true, limite=sem limite)
- orcamentos (public=true, limite=sem limite)

## Divergencias Codigo x Banco Real

### Tabelas referenciadas no codigo e ausentes no banco vivo
- Nenhum item.

### RPCs chamadas no codigo e ausentes no banco vivo
- execute_sql

### Buckets usados no codigo e ausentes no banco vivo
- Nenhum item.

## RLS e Seguranca

Policies abertas encontradas no banco real: 91.

### Tabelas afetadas por policies abertas
- admin_notificacoes
- assinaturas
- carteira_lancamentos
- client_levels
- cliente_documentos
- cliente_notas_admin
- cliente_promocoes
- clientes
- cobranca_historico
- cobrancas
- colaborador_modulos
- colaboradores
- cupons_ativados
- cupons_loja
- debug_admin_rpc
- demanda_comentarios
- empresa
- emprestimo_comentarios
- emprestimo_documentos
- emprestimo_historico
- emprestimo_parcelas
- emprestimo_templates_contrato
- emprestimos
- extrato_financeiro
- fatura_contestacoes
- faturas
- formas_pagamento
- funcoes
- indicacoes
- level_history
- loja_avaliacoes
- loja_categorias
- loja_credito_documentos
- loja_credito_movimentacoes
- loja_credito_solicitacoes
- loja_estoque_historico
- loja_reembolsos
- loja_solicitacoes
- notificacoes
- orcamento_timeline
- orcamentos
- ordens_assinatura
- ordens_compra
- ordens_fiscais
- ordens_servico
- os_notas
- os_suporte_mensagens
- pagamentos
- points_transactions
- pontos_movimentacoes
- prestador_agendamentos
- prestador_demandas
- prestador_demandas_historico
- prestador_documentos
- prestador_faturas
- prestador_historico
- prestador_premios
- prestador_promocoes
- prestador_promocoes_ativacoes
- prestador_saques
- prestador_suporte_demandas
- prestador_transacoes
- prestador_vouchers
- prestadores
- produtos
- promocoes
- promocoes_quantidade
- promocoes_quantidade_uso
- saques
- servicos
- sistema_logs
- sistema_sessoes
- solicitacoes_exclusao
- suporte_mensagens
- ticket_mensagens
- tickets
- transferencias
- vouchers

Impacto: qualquer policy `public`/`anon` com condicao `true` enfraquece ou anula isolamento de dados. Em tabelas financeiras, clientes, pagamentos, notificacoes, documentos, logs, sessoes e suporte isso e bloqueador de producao.

## Realtime

Tabelas publicadas em supabase_realtime: 70.

- public.admin_notificacoes
- public.assinaturas
- public.carteira_lancamentos
- public.client_levels
- public.cliente_documentos
- public.cliente_notas_admin
- public.cliente_premios
- public.cliente_promocoes
- public.clientes
- public.cobranca_acordo_parcelas
- public.cobranca_historico
- public.cobrancas
- public.colaborador_modulos
- public.colaboradores
- public.demanda_comentarios
- public.empresa
- public.emprestimo_comentarios
- public.emprestimo_documentos
- public.emprestimo_historico
- public.emprestimo_parcelas
- public.emprestimos
- public.extrato_financeiro
- public.faturas
- public.formas_pagamento
- public.funcoes
- public.indicacoes
- public.level_history
- public.loja_categorias
- public.loja_credito_documentos
- public.loja_credito_movimentacoes
- public.loja_credito_solicitacoes
- public.notificacoes
- public.orcamentos
- public.ordens_assinatura
- public.ordens_compra
- public.ordens_fiscais
- public.ordens_servico
- public.os_notas
- public.os_suporte_mensagens
- public.pagamentos
- public.points_transactions
- public.pontos_movimentacoes
- public.prestador_agendamentos
- public.prestador_demandas
- public.prestador_documentos
- public.prestador_faturas
- public.prestador_historico
- public.prestador_premios
- public.prestador_promocoes
- public.prestador_promocoes_ativacoes
- public.prestador_saques
- public.prestador_suporte_demandas
- public.prestador_transacoes
- public.prestador_vouchers
- public.prestadores
- public.produtos
- public.promocoes
- public.promocoes_quantidade
- public.promocoes_quantidade_uso
- public.saques
- public.servicos
- public.sistema_logs
- public.sistema_sessoes
- public.solicitacoes_exclusao
- public.suporte_mensagens
- public.system_settings
- public.ticket_mensagens
- public.tickets
- public.transferencias
- public.vouchers

Risco: realtime amplo com RLS aberta pode expor eventos indevidos e dificulta provar que nenhum evento duplica ou vaza entre usuarios.

## Escritas Diretas Sensíveis

Operacoes diretas encontradas: 431.
Operacoes diretas sensiveis: 211.

### Maiores grupos sensiveis
| alvo | operacao | quantidade | areas | arquivos |
| --- | --- | --- | --- | --- |
| clientes | update | 24 | admin, servico_util, validacao | src/components/admin/ClientesModule.tsx, src/components/admin/CreditoModule.tsx, src/components/admin/LojaTrocasModule.tsx, src/components/admin/OrdensCompraModule.tsx, src/utils/paymentPropagation.ts, src/utils/referral.ts, src/validation/master_block2.ts, src/validation/step1_referral.ts |
| faturas | insert | 14 | admin, outro, validacao | src/components/admin/EmprestimosModule.tsx, src/components/admin/FinanceiroModule.tsx, src/components/admin/LojaTrocasModule.tsx, src/components/admin/OrcamentosModule.tsx, src/components/admin/OrdensAssinaturaModule.tsx, src/components/admin/OrdensServicoModule.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/validation/master_block2.ts, src/validation/step2_sales_flow.ts, src/validation/step6_subscriptions.ts, test.ts |
| orcamentos | update | 14 | admin, servico_util, validacao | src/components/admin/CreditoModule.tsx, src/components/admin/EmprestimosModule.tsx, src/components/admin/OrcamentosModule.tsx, src/components/admin/OrdensCompraModule.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/utils/paymentPropagation.ts, src/validation/step2_sales_flow.ts |
| entregas_demandas | upload | 11 | admin, cliente, prestador | src/components/admin/demandas/DemandasComentarios.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/components/admin/demandas/NovaDemandaModal.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/components/client/ClientServicos.tsx, src/components/prestador/PrestadorDemandas.tsx |
| emprestimos | update | 10 | admin | src/components/admin/CreditoModule.tsx, src/components/admin/EmprestimosModule.tsx |
| documentos_cliente | upload | 9 | admin, cliente | src/components/admin/ReembolsosModule.tsx, src/components/admin/clientes/AdminClienteDocumentos.tsx, src/components/client/ClientMeuCredito.tsx, src/components/client/ClientOrcamentos.tsx, src/components/client/ClientProfile.tsx, src/components/client/ClientSuporte.tsx |
| ordens_assinatura | update | 7 | admin, servico_util, validacao | src/components/admin/OrdensAssinaturaModule.tsx, src/utils/paymentPropagation.ts, src/validation/step6_subscriptions.ts |
| ordens_servico | update | 7 | admin, servico_util, validacao | src/components/admin/OrdensServicoModule.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/utils/paymentPropagation.ts, src/validation/step2_sales_flow.ts |
| prestador_transacoes | insert | 7 | admin, prestador, validacao | src/components/admin/prestadores/PrestadoresCadastro.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/components/admin/prestadores/PrestadoresFinanceiro.tsx, src/components/prestador/PrestadorFinanceiro.tsx, src/components/prestador/PrestadorVouchers.tsx, src/validation/step2_sales_flow.ts |
| clientes | insert | 6 | admin, publico, validacao | src/components/admin/ClientesModule.tsx, src/components/admin/prestadores/PrestadoresDemandas.tsx, src/pages/Home.tsx, src/validation/step1_referral.ts, src/validation/step4_integrity_audit.ts |
| emprestimos | upload | 6 | admin, cliente | src/components/admin/CreditoModule.tsx, src/components/admin/EmprestimosModule.tsx, src/components/client/ClientEmprestimos.tsx, src/components/client/ClientOrcamentos.tsx |
| faturas | update | 6 | admin, validacao | src/components/admin/FinanceiroModule.tsx, src/components/admin/LojaTrocasModule.tsx, src/components/admin/OrdensCompraModule.tsx, src/components/admin/demandas/DemandasDetalhesModal.tsx, src/validation/step3_finance_gamification.ts |
| gsa-store-images | upload | 6 | admin | src/components/admin/AssinaturasModule.tsx, src/components/admin/ProdutosModule.tsx, src/components/admin/ServicosModule.tsx |
| loja_credito_movimentacoes | insert | 6 | admin, servico_util | src/components/admin/CreditoModule.tsx, src/components/admin/LojaTrocasModule.tsx, src/components/admin/OrdensCompraModule.tsx, src/utils/paymentPropagation.ts |
| loja_credito_solicitacoes | update | 5 | admin | src/components/admin/CreditoModule.tsx |
| ordens_assinatura | insert | 4 | admin, validacao | src/components/admin/OrcamentosModule.tsx, src/validation/master_block2.ts, src/validation/step6_subscriptions.ts |
| ordens_compra | update | 4 | admin, servico_util | src/components/admin/OrdensCompraModule.tsx, src/utils/paymentPropagation.ts |
| prestador_saques | update | 4 | admin, prestador | src/components/admin/prestadores/PrestadoresFinanceiro.tsx, src/components/prestador/PrestadorFinanceiro.tsx |
| system_settings | update | 4 | admin | src/components/admin/ClientesModule.tsx, src/components/admin/OrcamentosModule.tsx, src/pages/AdminPanel.tsx |
| cliente_promocoes | update | 3 | admin, servico_util | src/components/admin/OrcamentosModule.tsx, src/utils/promotions.ts |
| documentos_prestador | upload | 3 | admin, prestador, servico_util | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx, src/components/prestador/PrestadorDocumentos.tsx, src/lib/pdfSharingService.ts |
| orcamentos | insert | 3 | admin, publico, validacao | src/components/admin/OrcamentosModule.tsx, src/components/public/GSAEnterpriseHome.tsx, src/validation/step2_sales_flow.ts |
| ordens_servico | insert | 3 | admin, validacao | src/components/admin/OrcamentosModule.tsx, src/validation/step2_sales_flow.ts |
| promocoes | update | 3 | admin | src/components/admin/OrcamentosModule.tsx, src/components/admin/PromocoesModule.tsx |
| vouchers | update | 3 | admin, publico, validacao | src/components/admin/VouchersModule.tsx, src/pages/Home.tsx, src/validation/step1_referral.ts |
| documentos_cliente | remove | 2 | admin, cliente | src/components/admin/clientes/AdminClienteDocumentos.tsx, src/components/client/ClientProfile.tsx |
| documentos_prestador | remove | 2 | admin, servico_util | src/components/admin/prestadores/AdminPrestadorDocumentos.tsx, src/lib/pdfSharingService.ts |
| fiscal_docs | upload | 2 | admin | src/components/admin/FiscalModule.tsx |
| orcamentos | upload | 2 | cliente | src/components/client/ClientOrcamentos.tsx, src/components/client/ClientServicos.tsx |
| ordens_compra | insert | 2 | admin | src/components/admin/OrcamentosModule.tsx |
| promocoes | insert | 2 | admin, validacao | src/components/admin/PromocoesModule.tsx, src/validation/master_block2.ts |
| sistema_logs | insert | 2 | validacao | src/validation/master_block3.ts, src/validation/master_block4.ts |
| table | delete | 2 | admin, validacao | src/components/admin/prestadores/PrestadoresCadastro.tsx, src/validation/base.ts |
| vouchers | insert | 2 | admin | src/components/admin/IndicacoesModule.tsx, src/components/admin/VouchersModule.tsx |
| bucketName | insert | 1 | admin | src/components/admin/TicketsModule.tsx |
| carteira_lancamentos | insert | 1 | servico_util | src/utils/referral.ts |
| carteira_lancamentos | delete | 1 | servico_util | src/utils/referral.ts |
| cupons_loja | insert | 1 | admin | src/components/admin/CuponsLojaModule.tsx |
| cupons_loja | update | 1 | admin | src/components/admin/CuponsLojaModule.tsx |
| cupons_loja | delete | 1 | admin | src/components/admin/CuponsLojaModule.tsx |

Impacto: fluxos financeiros/operacionais ainda dependem de multiplas escritas no frontend ou em utilitarios locais. Isso permite inconsistencias em clique duplo, falha no meio do fluxo, manipulacao de payload, IDOR e divergencia entre tela e banco. A correcao definitiva e migrar esses grupos para RPCs transacionais com validacao e RLS fechada.

## Caracteres e Encoding

Resultado da auditoria principal de caracteres: 0 achado(s).

Observacao: uma checagem agressiva gerou falsos positivos em letras validas do portugues, como `Ã` maiusculo em palavras acentuadas. Por isso a decisao de encoding foi baseada no scanner principal, que detecta sequencias reais de mojibake, C1 invisivel e caractere de substituicao.

## Build, TypeScript e Performance

- `npm run build`: aprovado.
- Aviso de performance: bundle principal `index-Cg_Z1wal.js` com aproximadamente 4,134.61 kB minificado e 1,002.03 kB gzip.
- Aviso de chunking: `src/utils/referralHelpers.ts` e importado estaticamente e dinamicamente, impedindo isolamento em chunk separado.

## Testes

- `package.json` nao possui script `test`.
- Existe `src/tests/finance.test.ts`, mas sem runner configurado no projeto.
- Existem scripts de validacao em `src/validation`, porem eles executam escritas reais em Supabase e nao sao uma suite segura/repetivel de CI.
- Nenhum fluxo de botao, modal, upload, pagamento, saque, transferencia, notificacao ou realtime foi aprovado por E2E nesta rodada.

## Auditoria Navegada

A tentativa de navegar para o host local foi bloqueada pela politica do Browser desta sessao. Resultado: nao ha evidencia navegada suficiente para aprovar botoes, formularios, modais e estados visuais. Isso permanece pendente.

## Achados Criticos

| severidade | achado | impacto | evidencia |
| --- | --- | --- | --- |
| Critica | RLS aberta no banco real | Vazamento/alteracao indevida de dados entre usuarios e roles. | 91 policies public/anon true em live_db_audit.json |
| Baixa | Codigo/tooling chama estruturas ausentes | Fluxos quebram em runtime quando a chamada faz parte da aplicacao. | 0 tabelas, 1 RPCs e 0 buckets ausentes no banco vivo |
| Critica | Escritas sensiveis diretas | Inconsistencia financeira e operacional, clique duplo, falha parcial e manipulacao de payload. | 211 operacoes sensiveis em direct_write_audit.json |
| Critica | Credencial de banco hardcoded em scripts | Vazamento de acesso privilegiado ao banco. | get_schema.cjs e apply_pg_migration.cjs contem connection string hardcoded |
| Alta | Realtime amplo | Superficie grande de vazamento/duplicacao de eventos. | 70 tabelas em supabase_realtime |
| Alta | Ausencia de suite formal de testes | Nao ha regressao automatizada para liberar producao. | package.json sem script test |
| Media | Bundle principal grande | Carregamento lento em mobile e redes ruins. | build Vite reportou chunk > 500 kB; principal ~1 MB gzip |

## Correcoes Recomendadas Antes de Producao

1. Rotacionar imediatamente a credencial de banco exposta nos scripts locais.
2. Remover connection strings hardcoded e exigir `SUPABASE_DB_URL` apenas via ambiente seguro.
3. Fechar RLS por tabela com policies especificas por role/usuario, com testes de anon/auth/admin/cliente/prestador.
4. Criar migrations para estruturas ausentes ou remover referencias mortas do codigo.
5. Migrar escritas sensiveis diretas para RPCs transacionais com `SECURITY DEFINER`, validacao interna, idempotencia e logs.
6. Reduzir realtime para tabelas/eventos realmente necessarios e validar permissao por usuario.
7. Configurar runner de testes (unit, integracao e E2E) e CI.
8. Criar testes E2E autenticados para cliente, admin e prestador.
9. Quebrar bundle por modulo com lazy loading real e revisar import dinamico/estatico misto.
10. Manter auditoria de caracteres como gate antes de build.

## Checklist de Producao

- [x] Inventario estatico inicial gerado.
- [x] Banco real consultado.
- [x] Build aprovado.
- [x] TypeScript aprovado.
- [x] Auditoria principal de caracteres aprovada.
- [ ] RLS segura.
- [ ] Credenciais fora do codigo.
- [ ] Tabelas/RPCs/buckets consistentes entre codigo e banco.
- [ ] Escritas sensiveis centralizadas no backend/RPC.
- [ ] Realtime minimizado e testado.
- [ ] Notificacoes testadas por permissao/destinatario/deduplicacao.
- [ ] Suite de testes configurada.
- [ ] E2E navegada de todos os botoes e fluxos criticos.
- [ ] Performance mobile validada.
- [ ] Backup/restore/rollback/monitoramento documentados e testados.

## Conclusao

Com base nas evidencias coletadas, o Sistema GSA ainda nao esta pronto para producao real. A prioridade nao e visual neste momento; os bloqueadores estao em seguranca do banco, consistencia entre codigo e schema, centralizacao de regras sensiveis e ausencia de testes formais.