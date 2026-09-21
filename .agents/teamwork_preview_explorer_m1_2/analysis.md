# RELATÓRIO DE AUDITORIA DE PERFORMANCE: QUERIES, RPCS E ÍNDICES

**Autor**: Explorer 2 (Query & RPC Bottleneck Auditor)  
**Data**: 2026-09-11  
**Escopo**: Tabelas Críticas (`saques`, `faturas`, `tickets`, `pontos_movimentacoes`, `vouchers` e tabelas satélites vinculadas)  
**Status**: Concluído — Pronto para Implementação em Migração SQL  

---

## 1. SUMÁRIO EXECUTIVO

Esta auditoria realizou uma varredura estática profunda e análise de padrões de acesso a dados no backend Supabase PostgreSQL (`supabase/migrations/`) e frontend React (`src/`). Foram examinadas todas as chamadas de consulta PostgREST (`.from(...)`, `.select(...)`, `.eq(...)`, `.in(...)`, `.order(...)`) e funções armazenadas (`CREATE OR REPLACE FUNCTION` / RPCs).

### Principais Descobertas e Diagnóstico Crítico:
1. **Descompasso Crônico entre Colunas de Ordenação e Índices Existentes**:
   - Em `saques`, o frontend (`SaquesList.tsx`, `FinanceiroModule.tsx`, `FluxoCaixaView.tsx`) ordena sistematicamente por `data_solicitacao DESC`. No entanto, a migração `20260728050000_add_performance_indexes.sql` indexou apenas `created_at DESC`! Isso força o PostgreSQL a executar um **Sort Explícito em Memória/Disco** para cada cliente ou painel administrativo.
2. **Ausência Absoluta de Índices no Domínio de Suporte (`tickets` e `ticket_mensagens`)**:
   - Nem `tickets` nem `ticket_mensagens` possuem qualquer índice B-Tree além de suas Primary Keys (`id`). O histórico de conversação de suporte (`ticket_mensagens`), que recebe milhares de mensagens e é consultado com `WHERE ticket_id = ... ORDER BY data_envio ASC`, realiza **Full Table Scan sequencial** a cada clique de ticket.
3. **Gargalo no Identificador de Negócio `codigo_fatura`**:
   - O campo `codigo_fatura` em `faturas` é pesquisado dinamicamente via busca textual (`FinanceiroModule.tsx`) e em mais de 8 RPCs transacionais (`close_remaining_client_financial_rpcs`, `client_financial_rpc_more_flows`, `secure_remaining_client_financial_actions`, `gsa_admin_atualizar_solicitacao_loja`). O campo **não possui índice B-Tree nem UNIQUE index**, resultando em varredura sequencial completa em faturamento e pós-venda.
4. **Vulnerabilidade de Performance no Livro-Razão (`extrato_financeiro`)**:
   - A tabela `extrato_financeiro`, que registra cada movimentação contábil (saques, depósitos, estornos, pagamentos, cashback), **não possui nenhum índice na coluna `cliente_id` nem `data`**. O extrato de cada cliente (`ExtratoList.tsx`) executa Full Table Scan.
5. **Loops com Varredura Quadrática em RPCs Batch**:
   - A rotina diária `gerar_faturas_assinaturas_diario()` itera sobre ordens de assinatura executando `SELECT COUNT(*) FROM faturas WHERE codigo_fatura LIKE 'FAT-ASS-' || oa.codigo_ordem || '-%'`. Sem índice em `ordem_assinatura_id` nem em `codigo_fatura`, a rotina executa `N` Full Table Scans sucessivos.
6. **Lookup de Cupons e Vouchers em Operações de Checkout**:
   - Durante a finalização de compras no Marketplace (`gsa_client_checkout_store_base_20260817`), consultas de verificação em `cupons_loja(codigo_cupom)`, `cupons_ativados(cliente_id, cupom_id)` e `loja_credito_solicitacoes(cliente_id, status)` operam sem índices compostos.

---

## 2. AUDITORIA DETALHADA POR TABELA E DOMÍNIO

### 2.1 DOMÍNIO 1: `saques` E `prestador_saques`

#### Consultas Identificadas no Frontend (`src/`):
1. **`src/components/client/financeiro/SaquesList.tsx:86`**:
   ```typescript
   const { data } = await supabase
     .from('saques')
     .select('*')
     .eq('cliente_id', clientId)
     .order('data_solicitacao', { ascending: false });
   ```
   - **Filtro**: `cliente_id = clientId`
   - **Ordenação**: `data_solicitacao DESC`
   - **Índice Existente**: `idx_saques_cliente_id ON saques(cliente_id)` e `idx_saques_created_at ON saques(created_at DESC)`
   - **Gargalo**: O PostgreSQL utiliza o índice em `cliente_id` para filtrar as linhas, mas é forçado a fazer um **Sort in-memory** em `data_solicitacao`. Com o acúmulo de saques do cliente, o custo de CPU aumenta. Falta índice composto `(cliente_id, data_solicitacao DESC)`.

2. **`src/components/admin/FinanceiroModule.tsx:320-322` e `src/components/admin/super-domains/financeiro/FluxoCaixaView.tsx:78-80`**:
   ```typescript
   const { data } = await supabase
     .from('saques')
     .select('*, clientes(id, nome, codigo_cliente, cpf, saldo_carteira)')
     .order('data_solicitacao', { ascending: false });
   ```
   - **Filtro**: Nenhum (carrega todos os saques com JOIN em `clientes`)
   - **Ordenação**: `data_solicitacao DESC`
   - **Gargalo**: Como `data_solicitacao` não possui índice, o banco faz **Seq Scan em `saques` + Sort**, e em seguida nested loop com `clientes`.

3. **`src/components/admin/relatorios/RelatorioFinanceiro.tsx:25`**:
   ```typescript
   supabase.from('saques')
     .select('valor, valor_liquido, taxa_aplicada, status, data_solicitacao')
     .gte('data_solicitacao', inicio)
     .lte('data_solicitacao', fim);
   ```
   - **Filtro**: Range scan em `data_solicitacao`
   - **Gargalo**: **Seq Scan completo**. Sem índice B-Tree em `data_solicitacao`, toda a tabela é percorrida para filtrar por data.

4. **`src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx:84-92`**:
   ```typescript
   // 1. Saques pendentes de prestadores
   supabase.from('prestador_saques').select('id', { count: 'exact', head: true })
     .in('status', ['pendente', 'aguardando', 'em_analise']);

   // 2. Saques pendentes de clientes
   supabase.from('saques').select('id', { count: 'exact', head: true })
     .in('status', ['pendente', 'aguardando', 'em_analise']);
   ```
   - **Gargalo em `prestador_saques`**: `prestador_saques` possui APENAS `idx_prestador_saques_prestador_id`. Não tem índice em `status`. Executa **Seq Scan total** de `prestador_saques` para contar pendentes!
   - **Gargalo em `saques`**: O índice `idx_saques_status` existe, mas uma contagem rápida se beneficia fortemente de um **Índice Parcial** cobrindo apenas status pendentes.

5. **`src/components/admin/super-domains/pessoas/SaquesRepassesSection.tsx:45-58`**:
   ```typescript
   supabase.from('prestador_saques').select('*, prestador:prestadores(...)').order('created_at', { ascending: false });
   supabase.from('saques').select('*, cliente:clientes(...)').order('created_at', { ascending: false });
   ```
   - **Gargalo**: `prestador_saques` **NÃO possui índice em `created_at`**! O PostgreSQL realiza Seq Scan + Sort em toda a tabela.

#### Chamadas RPC Críticas no Backend (`supabase/migrations/`):
- **`20260720210000_harden_provider_portal.sql:153-157` (`gsa_provider_financial_snapshot`)**:
  ```sql
  SELECT COALESCE(SUM(valor), 0) INTO v_pending
  FROM public.prestador_saques
  WHERE prestador_id = v_provider_id AND status = 'pendente';
  ```
  - **Gargalo**: Filtro duplo `(prestador_id, status)` sem índice composto. A cada visualização de dashboard pelo técnico, há varredura filtrada.
- **`20260720210000_harden_provider_portal.sql:194-197` (`gsa_provider_request_withdrawal`)**:
  ```sql
  IF EXISTS (SELECT 1 FROM public.prestador_saques WHERE prestador_id = v_provider_id AND status = 'pendente') THEN
  ```
  - **Gargalo**: Falta de índice `(prestador_id, status)` para verificação de existência sob concorrência.

---

### 2.2 DOMÍNIO 2: `faturas` E TABELAS RELACIONADAS (`cobrancas`, `pagamentos`, `loja_pedido_itens`)

#### Consultas Identificadas no Frontend (`src/`):
1. **`src/components/admin/FinanceiroModule.tsx:257-281`**:
   ```typescript
   let query = supabase.from('faturas').select(`
     *, cobrancas(id), clientes(...), ordens_servico(...), ordens_compra(...), ordens_assinatura(...), pagamentos(...)
   `);
   if (tab === 'pendentes') {
     query = query.in('status', ['pendente', 'revisada', 'vencida', 'pendente_pagamento', 'aguardando_link']);
   }
   if (currentSearch) {
     query = query.ilike('codigo_fatura', `%${currentSearch}%`);
   }
   if (currentFilters.mes) {
     query = query.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
   }
   query.order('created_at', { ascending: false });
   ```
   - **Filtros**: `status IN (...)`, range `data_vencimento`, `ilike('codigo_fatura', ...)`
   - **Ordenação**: `created_at DESC`
   - **JOINs PostgREST**: `cobrancas(id)`, `clientes(...)`, `ordens_servico(...)`, `ordens_compra(...)`, `pagamentos(...)`
   - **Gargalos Críticos**:
     a) `codigo_fatura` não possui índice.
     b) `cobrancas` não possui índice em `fatura_id`. O join PostgREST `cobrancas(id)` executa subplanos caros.
     c) Falta índice composto `(status, created_at DESC)`.

2. **`src/components/admin/super-domains/financeiro/FaturamentoView.tsx:98-116`**:
   ```typescript
   supabase.from('faturas').select('*, cobrancas(id, status), clientes(...), ...')
     .order('created_at', { ascending: false });
   ```
   - Similar a `FinanceiroModule.tsx`: Join recursivo sem índice em `cobrancas(fatura_id)`.

3. **`src/components/admin/relatorios/RelatorioLoja.tsx:20` & `RelatorioExecutivo.tsx:41-49`**:
   ```typescript
   supabase.from('faturas')
     .select('id, valor_pago, status')
     .eq('tipo', 'produto')
     .eq('status', 'pago')
     .gte('data_pagamento', inicio)
     .lte('data_pagamento', fim);
   ```
   - **Gargalo**: `data_pagamento` não é indexado. `tipo` não é indexado. O relatório financeiro e executivo que calcula faturamento mensal por período de pagamento executa **Seq Scan em todas as faturas históricas**.

4. **`src/lib/adminRpc.ts:253-264`, `459-554`**:
   ```typescript
   supabase.from('faturas').select('id').in('ordem_compra_id', ocIds);
   supabase.from('faturas').select('id').in('ordem_assinatura_id', oaIds);
   ```
   - **Gargalo**: As chaves estrangeiras `ordem_compra_id` e `ordem_assinatura_id` em `faturas` **não estão indexadas**.

#### Procedimentos Armazenados e RPCs no Backend (`supabase/migrations/`):
1. **`20260525000001_cron_faturas_assinaturas.sql:12-23` (`gerar_faturas_assinaturas_diario`)**:
   ```sql
   FOR ordem IN 
     SELECT oa.*, a.nome as assinatura_nome, a.valor as valor_assinatura
     FROM ordens_assinatura oa
     JOIN assinaturas a ON a.id = oa.assinatura_id
     WHERE oa.status = 'concluido' OR oa.status = 'pago'
   LOOP
     SELECT COUNT(*) INTO faturas_ja_geradas
     FROM faturas
     WHERE codigo_fatura LIKE 'FAT-ASS-' || oa.codigo_ordem || '-%';
   ...
   ```
   - **Gargalo O(N * M)**: Para cada assinatura ativa (`N`), a função executa um `SELECT COUNT(*)` usando `LIKE 'FAT-ASS-' || ...` em `codigo_fatura`. Como `codigo_fatura` não tem índice e a busca é por prefixo com expressão dinâmica, o PostgreSQL executa um **Seq Scan completo da tabela `faturas` para CADA iteração do loop**! Se houver 200 assinaturas e 50.000 faturas, são 10 milhões de comparações de tuplas em memória.
   - **Correção Recomendada**: Usar `faturas.ordem_assinatura_id = oa.id` com índice B-Tree `idx_faturas_ordem_assinatura_id`.

2. **Rotina de Faturas Vencidas (`fn_marcar_faturas_vencidas`)**:
   - Invocada em `FinanceiroModule.tsx:31` e `FaturamentoView.tsx:92`:
   ```sql
   UPDATE faturas SET status = 'vencida' WHERE status = 'pendente' AND data_vencimento < CURRENT_DATE;
   ```
   - **Gargalo**: O índice `idx_faturas_cliente_status_venc` exige `cliente_id`. A atualização global de vencimento faz varredura de todas as faturas pendentes.
   - **Correção Recomendada**: Índice parcial `CREATE INDEX idx_faturas_pendentes_vencimento ON faturas(data_vencimento) WHERE status = 'pendente';`.

3. **RPCs com busca exata por `codigo_fatura`**:
   - `20260711170000_close_remaining_client_financial_rpcs.sql:149`:
     `SELECT id INTO v_fatura_id FROM faturas WHERE codigo_fatura = v_codigo AND cliente_id = p_cliente_id LIMIT 1;`
   - `20260711163000_client_financial_rpc_more_flows.sql:114, 154`:
     `SELECT id INTO v_fatura_id FROM faturas WHERE codigo_fatura = v_codigo AND status <> 'cancelada' LIMIT 1;`
   - `20260714056300_secure_remaining_client_financial_actions.sql:245, 372, 514`:
     `WHERE codigo_fatura = v_code`
   - `20260910180000_marketplace_acid_concurrency_remediation.sql:140, 168`:
     `SELECT id FROM faturas WHERE codigo_fatura = v_codigo_fatura` e `UPDATE faturas WHERE codigo_fatura = v_codigo_fatura`
   - **Gargalo**: Todas estas RPCs realizam **Full Table Scan em `faturas`** por falta de um índice `UNIQUE` em `codigo_fatura`.

---

### 2.3 DOMÍNIO 3: `tickets` E `ticket_mensagens` (E SUPORTE SATÉLITE)

#### Consultas Identificadas no Frontend (`src/`):
1. **`src/components/client/ClientSuporte.tsx:138-154`**:
   ```typescript
   let query = supabase
     .from('tickets')
     .select('*')
     .eq('cliente_id', clientId)
     .order('data_abertura', { ascending: false });

   if (activeTab === 'aberto') {
     query = query.in('status', ['aberto', 'em andamento']);
   } else {
     query = query.in('status', ['concluido', 'cancelado']);
   }
   ```
   - **Gargalo Absoluto**: **Nenhum índice existe na tabela `tickets`**. Nem `cliente_id`, nem `status`, nem `data_abertura`. A consulta faz Seq Scan em todo o histórico de tickets do sistema para filtrar os do cliente.

2. **`src/components/client/ClientSuporte.tsx:163-167`**:
   ```typescript
   const { data } = await supabase
     .from('ticket_mensagens')
     .select('*')
     .eq('ticket_id', ticketId)
     .order('data_envio', { ascending: true });
   ```
   - **Gargalo Extremo**: **Nenhum índice em `ticket_mensagens`**. Ao abrir um ticket no chat, o PostgREST faz Seq Scan em todas as mensagens de todos os tickets já criados na plataforma para encontrar as daquele `ticket_id` e ordená-las por `data_envio`.

3. **`src/components/admin/TicketsModule.tsx:208-245`**:
   ```typescript
   // 1. Tickets do Admin
   let query = supabase.from('tickets').select('*, clientes(nome, codigo_cliente)');
   if (activeTab === 'abertos') query = query.eq('status', 'aberto');
   query.order('data_abertura', { ascending: false });

   // 2. Mensagens não lidas
   const { data: countsData } = await supabase
     .from('ticket_mensagens')
     .select('ticket_id')
     .in('ticket_id', ticketIds)
     .eq('lida', false)
     .eq('tipo', 'cliente');
   ```
   - **Gargalo**: A contagem de não-lidas faz um `IN (ticketIds)` com `lida = false` sem índice, varrendo `ticket_mensagens`.

4. **`src/components/admin/super-domains/contratos/AtendimentoTicketsView.tsx:53-77`**:
   ```typescript
   supabase.from('tickets').select('*').order('created_at', { ascending: false });
   supabase.from('ticket_mensagens').select('*').in('ticket_id', ticketIds).order('data_envio', { ascending: true });
   ```
   - **Gargalo**: Dois Seq Scans massivos simultâneos.

#### Procedimentos Armazenados e RPCs no Backend (`supabase/migrations/`):
- **`20260720233000_provider_portal_audit_hardening.sql:510-516` (`gsa_provider_create_ticket`)**:
  ```sql
  SELECT id INTO v_ticket_id
  FROM public.tickets
  WHERE prestador_id = v_provider_id
    AND assunto = v_subject
    AND status <> 'concluido'
  ORDER BY data_abertura DESC
  LIMIT 1;
  ```
  - **Gargalo**: Verificação anti-duplicidade em `tickets` com filtros em `prestador_id`, `assunto`, `status` e ordenação em `data_abertura DESC`. Sem índices, a abertura de ticket trava sob Seq Scan.
- **Tabelas Satélites**:
  - `suporte_mensagens` (`20260318000001_support_and_adjustments.sql:4`): Chave estrangeira `suporte_id REFERENCES prestador_suporte_demandas(id) ON DELETE CASCADE` sem índice.
  - `os_suporte_mensagens` (`20260602000000_create_os_suporte_mensagens.sql:4`): Chave estrangeira `os_id REFERENCES ordens_servico(id) ON DELETE CASCADE` sem índice.

---

### 2.4 DOMÍNIO 4: `pontos_movimentacoes` E `extrato_financeiro`

#### Consultas Identificadas no Frontend (`src/`):
1. **`src/components/client/ClientPontos.tsx:179-189` e `src/components/admin/ClientesModule.tsx:1439-1453`**:
   ```typescript
   // 1. Tabela legado/canônica de pontos
   supabase.from('pontos_movimentacoes')
     .select('*')
     .eq('cliente_id', clienteId)
     .order('data_movimentacao', { ascending: false });

   // 2. Tabela de transações de pontos
   supabase.from('points_transactions')
     .select('*')
     .eq('cliente_id', clienteId)
     .order('created_at', { ascending: false });
   ```
   - **Índices Existentes**: Apenas `idx_pontos_movimentacoes_cliente_id` e `idx_points_transactions_cliente_id` (coluna única `cliente_id`).
   - **Gargalo**: A cada visualização da carteira de pontos, o banco filtra por `cliente_id` e faz **Sort em memória** por data. Falta índice composto `(cliente_id, data_movimentacao DESC)` e `(cliente_id, created_at DESC)`.

2. **`src/components/client/financeiro/ExtratoList.tsx:45` & `ClientesModule.tsx:1427`**:
   ```typescript
   supabase.from('extrato_financeiro')
     .select('*')
     .eq('cliente_id', clientId)
     .order('data', { ascending: false });
   ```
   - **Gargalo Crítico**: **A tabela `extrato_financeiro` NÃO POSSUI NENHUM ÍNDICE** no banco de dados (apenas PK `id`). O extrato de qualquer cliente causa um Seq Scan completo na tabela inteira.
3. **`src/components/client/ClientVouchers.tsx:100`**:
   ```typescript
   supabase.from('extrato_financeiro')
     .select('referencia_id')
     .eq('cliente_id', clientId)
     .eq('modulo_referencia', 'vouchers')
     .not('referencia_id', 'is', null);
   ```
   - **Gargalo**: Filtro duplo `(cliente_id, modulo_referencia)` executado em Seq Scan.
4. **`src/components/admin/relatorios/RelatorioGamificacao.tsx:23`**:
   ```typescript
   supabase.from('pontos_movimentacoes')
     .select('tipo, pontos, valor_convertido, data_movimentacao')
     .gte('data_movimentacao', inicio)
     .lte('data_movimentacao', fim);
   ```
   - **Gargalo**: Range scan em `data_movimentacao` sem índice de data.

---

### 2.5 DOMÍNIO 5: `vouchers`, `cupons_loja` E CONCORRÊNCIA EM CHECKOUT

#### Consultas Identificadas no Frontend (`src/`):
1. **`src/components/client/financeiro/PaymentModal.tsx:153-158`**:
   ```typescript
   const { data, error } = await supabase
     .from('vouchers')
     .select('*')
     .eq('codigo_voucher', code.toUpperCase())
     .eq('status', 'ativo')
     .single();
   ```
   - **Gargalo**: `codigo_voucher` não possui índice B-Tree nem UNIQUE constraint ativa em migrações. Validação de voucher no modal de pagamento executa Seq Scan.
2. **`src/components/client/ClientVouchers.tsx:81-87`**:
   ```typescript
   supabase.from('vouchers')
     .select('*')
     .order('codigo_voucher', { ascending: false })
     .eq('status', 'ativo')
     .or(`cliente_id.eq.${clientId},cliente_id.is.null`);
   ```
   - **Gargalo**: Falta de índice composto `(status, cliente_id)`.
3. **`src/components/client/store/TravelCheckoutModal.tsx:679`**:
   ```typescript
   supabase.from('cupons_loja').select('*').eq('codigo_cupom', codigo.toUpperCase()).single();
   ```
   - **Gargalo**: `cupons_loja.codigo_cupom` não possui índice.
4. **`src/components/client/store/CheckoutPage.tsx:552-578`**:
   ```typescript
   // 1. Cupons ativados
   supabase.from('cupons_ativados').select('cupom_id').eq('cliente_id', clientId);

   // 2. Cupons loja disponíveis
   supabase.from('cupons_loja').select('*').eq('status', 'ativo').eq('categoria_cupom', category).in('id', ativadosIds);

   // 3. Checagem de uso em orçamentos anteriores
   supabase.from('orcamentos').select('cupom_desconto_id, cupom_entrega_id').eq('cliente_id', clientId).neq('status', 'cancelado');
   ```
   - **Gargalos**:
     - `cupons_ativados(cliente_id, cupom_id)` sem índice.
     - `cupons_loja(status, categoria_cupom)` sem índice composto.
     - `orcamentos` sem índices nas FKs `cupom_desconto_id` e `cupom_entrega_id`.

#### Validação de Cupom e Saldo no Checkout Atômico (`gsa_client_checkout_store_base_20260817`):
- `20260714056000_atomic_session_store_checkout.sql:560-569`:
  ```sql
  OR NOT EXISTS (
    SELECT 1 FROM public.cupons_ativados ca
    WHERE ca.cliente_id = v_actor.cliente_id AND ca.cupom_id = v_coupon.id
  )
  OR EXISTS (
    SELECT 1 FROM public.orcamentos o
    WHERE o.cliente_id = v_actor.cliente_id
      AND o.status <> 'cancelado'
      AND (o.cupom_desconto_id = v_coupon.id OR o.cupom_entrega_id = v_coupon.id)
  )
  ```
  - Executa duas subconsultas para cada checkout com cupom. Sem índices em `cupons_ativados(cliente_id, cupom_id)` e `orcamentos(cliente_id, cupom_desconto_id)`, o checkout adquire travas e aguarda scans adicionais.
- `20260714056000_atomic_session_store_checkout.sql:708-711`:
  ```sql
  SELECT id INTO v_active_credit_request
  FROM public.loja_credito_solicitacoes
  WHERE cliente_id = v_actor.cliente_id AND status = 'liberado'
  ORDER BY created_at DESC LIMIT 1;
  ```
  - **Gargalo**: `loja_credito_solicitacoes` não tem índice em `(cliente_id, status, created_at DESC)`.

---

## 3. MATRIZ CONSOLIDADA DE ÍNDICES RECOMENDADOS

A tabela a seguir consolida todos os índices faltantes identificados, categorizados por prioridade de impacto na produção:

| Prioridade | Tabela Alvo | Nome Proposto do Índice | Definição SQL do Índice | Tipo / Justificativa |
|---|---|---|---|---|
| **P0** | `faturas` | `uq_faturas_codigo_fatura` | `ON faturas(codigo_fatura) WHERE codigo_fatura IS NOT NULL` | **UNIQUE B-Tree**. Elimina Full Scan em 8+ RPCs e busca administrativa. |
| **P0** | `tickets` | `idx_tickets_cliente_status_data` | `ON tickets(cliente_id, status, data_abertura DESC)` | **Composto B-Tree**. Elimina Full Scan no Portal do Cliente. |
| **P0** | `ticket_mensagens`| `idx_ticket_mensagens_ticket_envio` | `ON ticket_mensagens(ticket_id, data_envio ASC)` | **Composto B-Tree**. Elimina Full Scan no chat/histórico do ticket. |
| **P0** | `extrato_financeiro`| `idx_extrato_financeiro_cliente_data` | `ON extrato_financeiro(cliente_id, data DESC)` | **Composto B-Tree**. Corrige ausência total de índices na tabela contábil. |
| **P0** | `saques` | `idx_saques_cliente_data_solicitacao`| `ON saques(cliente_id, data_solicitacao DESC)` | **Composto B-Tree**. Elimina Sort in-memory no extrato de saques do cliente. |
| **P0** | `prestador_saques` | `idx_prestador_saques_provider_status` | `ON prestador_saques(prestador_id, status)` | **Composto B-Tree**. Acelera `gsa_provider_financial_snapshot`. |
| **P0** | `cupons_loja` | `uq_cupons_loja_codigo` | `ON cupons_loja(codigo_cupom) WHERE codigo_cupom IS NOT NULL` | **UNIQUE B-Tree**. Elimina Full Scan na validação de cupom no checkout. |
| **P0** | `vouchers` | `uq_vouchers_codigo_voucher` | `ON vouchers(codigo_voucher) WHERE codigo_voucher IS NOT NULL` | **UNIQUE B-Tree**. Elimina Full Scan na aplicação de voucher no pagamento. |
| **P1** | `saques` | `idx_saques_data_solicitacao` | `ON saques(data_solicitacao DESC)` | **B-Tree**. Acelera consultas administrativas e relatórios de fluxo de caixa. |
| **P1** | `saques` | `idx_saques_pending_queue` | `ON saques(status, data_solicitacao DESC) WHERE status IN ('pendente', 'aguardando', 'em_analise')` | **Índice Parcial**. Otimiza fila de aprovação e contadores de pendências. |
| **P1** | `prestador_saques` | `idx_prestador_saques_created_at` | `ON prestador_saques(created_at DESC)` | **B-Tree**. Elimina Sort no painel de repasses e histórico de prestadores. |
| **P1** | `prestador_saques` | `idx_prestador_saques_pending_queue` | `ON prestador_saques(status, created_at DESC) WHERE status IN ('pendente', 'aguardando', 'em_analise')` | **Índice Parcial**. Otimiza contadores de pendências de prestadores. |
| **P1** | `faturas` | `idx_faturas_status_created_at` | `ON faturas(status, created_at DESC)` | **Composto B-Tree**. Acelera abas Pendentes/Pagos no módulo financeiro. |
| **P1** | `faturas` | `idx_faturas_pendentes_vencimento` | `ON faturas(data_vencimento) WHERE status = 'pendente'` | **Índice Parcial**. Torna `fn_marcar_faturas_vencidas` instantânea. |
| **P1** | `faturas` | `idx_faturas_status_pagamento` | `ON faturas(status, data_pagamento DESC) WHERE status = 'pago'` | **Índice Parcial**. Acelera relatórios de faturamento executivo e loja. |
| **P1** | `faturas` | `idx_faturas_ordem_compra_id` | `ON faturas(ordem_compra_id) WHERE ordem_compra_id IS NOT NULL` | **FK B-Tree**. Acelera joins com pedidos de compra. |
| **P1** | `faturas` | `idx_faturas_ordem_assinatura_id`| `ON faturas(ordem_assinatura_id) WHERE ordem_assinatura_id IS NOT NULL` | **FK B-Tree**. Acelera joins com assinaturas e rotinas batch. |
| **P1** | `cobrancas` | `idx_cobrancas_fatura_id` | `ON cobrancas(fatura_id) WHERE fatura_id IS NOT NULL` | **FK B-Tree**. Elimina subplanos lentos no join `faturas -> cobrancas`. |
| **P1** | `tickets` | `idx_tickets_status_data_abertura` | `ON tickets(status, data_abertura DESC)` | **Composto B-Tree**. Acelera fila de chamados por aba de status no ADM. |
| **P1** | `tickets` | `idx_tickets_prestador_id` | `ON tickets(prestador_id) WHERE prestador_id IS NOT NULL` | **FK B-Tree**. Acelera suporte de prestadores e verificação anti-duplicidade. |
| **P1** | `tickets` | `idx_tickets_created_at` | `ON tickets(created_at DESC)` | **B-Tree**. Acelera ordenação em `AtendimentoTicketsView.tsx`. |
| **P1** | `ticket_mensagens`| `idx_ticket_mensagens_unread` | `ON ticket_mensagens(ticket_id, lida, tipo) WHERE lida = false` | **Índice Parcial**. Acelera contadores de mensagens não lidas. |
| **P1** | `pontos_movimentacoes`| `idx_pontos_mov_cliente_data` | `ON pontos_movimentacoes(cliente_id, data_movimentacao DESC)` | **Composto B-Tree**. Elimina Sort na listagem de pontos do cliente. |
| **P1** | `pontos_movimentacoes`| `idx_pontos_mov_data` | `ON pontos_movimentacoes(data_movimentacao DESC)` | **B-Tree**. Acelera relatórios temporais de gamificação. |
| **P1** | `pontos_movimentacoes`| `idx_pontos_mov_fatura_id` | `ON pontos_movimentacoes(fatura_id) WHERE fatura_id IS NOT NULL` | **FK B-Tree**. Acelera auditoria de pontos por fatura. |
| **P1** | `points_transactions`| `idx_points_trans_cliente_created`| `ON points_transactions(cliente_id, created_at DESC)` | **Composto B-Tree**. Elimina Sort na listagem de transações de fidelidade. |
| **P1** | `carteira_lancamentos`| `idx_carteira_lancamentos_cliente_data`| `ON carteira_lancamentos(cliente_id, data_lancamento DESC)` | **Composto B-Tree**. Elimina Sort no histórico de lançamentos. |
| **P1** | `extrato_financeiro`| `idx_extrato_referencia` | `ON extrato_financeiro(modulo_referencia, referencia_id)` | **Composto B-Tree**. Acelera buscas de uso de vouchers no extrato. |
| **P1** | `vouchers` | `idx_vouchers_status_cliente` | `ON vouchers(status, cliente_id)` | **Composto B-Tree**. Acelera busca de vouchers ativos do cliente. |
| **P1** | `cupons_loja` | `idx_cupons_loja_status_cat` | `ON cupons_loja(status, categoria_cupom)` | **Composto B-Tree**. Acelera seleção de cupons de desconto/frete no checkout. |
| **P1** | `cupons_ativados` | `idx_cupons_ativados_cliente_cupom`| `ON cupons_ativados(cliente_id, cupom_id)` | **Composto B-Tree**. Acelera validação de ativação no checkout. |
| **P1** | `orcamentos` | `idx_orcamentos_cupom_desconto` | `ON orcamentos(cliente_id, cupom_desconto_id) WHERE cupom_desconto_id IS NOT NULL` | **Índice Parcial**. Validação instantânea de cupom já usado por cliente. |
| **P1** | `orcamentos` | `idx_orcamentos_cupom_entrega` | `ON orcamentos(cliente_id, cupom_entrega_id) WHERE cupom_entrega_id IS NOT NULL` | **Índice Parcial**. Validação instantânea de frete grátis usado por cliente. |
| **P1** | `loja_credito_solicitacoes`| `idx_loja_credito_client_status`| `ON loja_credito_solicitacoes(cliente_id, status, created_at DESC)` | **Composto B-Tree**. Acelera aprovação de crédito no checkout. |
| **P1** | `loja_pedido_itens`| `idx_loja_pedido_itens_orcamento` | `ON loja_pedido_itens(orcamento_id, tipo)` | **Composto B-Tree**. Acelera reposição de estoque em estornos de pós-venda. |
| **P2** | `os_suporte_mensagens`| `idx_os_suporte_mensagens_os` | `ON os_suporte_mensagens(os_id, created_at ASC)` | **Composto B-Tree**. Acelera chat de suporte da OS. |
| **P2** | `suporte_mensagens` | `idx_suporte_mensagens_suporte` | `ON suporte_mensagens(suporte_id, created_at ASC)` | **Composto B-Tree**. Acelera chat de demandas de prestadores. |
| **P2** | `prestador_transacoes`| `idx_prestador_transacoes_prov_status`| `ON prestador_transacoes(prestador_id, status)` | **Composto B-Tree**. Acelera consolidação de saldo do prestador. |
| **P2** | `transferencias` | `idx_transferencias_data_solicitacao` | `ON transferencias(data_solicitacao DESC)` | **B-Tree**. Elimina Sort na listagem de transferências financeiras. |
| **P2** | `gsa_afiliado_comissoes`| `idx_afiliado_comissoes_disp` | `ON gsa_afiliado_comissoes(afiliado_id, status, disponivel_em)` | **Composto B-Tree**. Acelera liberação e transferência de comissões. |

---

## 4. PROPOSTAS DE OTIMIZAÇÃO DE RPCS

### 4.1 Refatoração de `gerar_faturas_assinaturas_diario` (Eliminação do Loop N*SeqScan)

**Problema**:
Na migration `20260525000001_cron_faturas_assinaturas.sql`, a verificação de quantas faturas já foram emitidas é realizada através de um `LIKE` textual em `codigo_fatura` dentro de um loop cursor:
```sql
SELECT COUNT(*) INTO faturas_ja_geradas
FROM faturas
WHERE codigo_fatura LIKE 'FAT-ASS-' || oa.codigo_ordem || '-%';
```

**Solução Proposta**:
Utilizar a chave estrangeira relacional direta `faturas.ordem_assinatura_id`, indexada via `idx_faturas_ordem_assinatura_id`:
```sql
-- Otimização: Substituição de string LIKE por busca relacional indexada
SELECT COUNT(*) INTO faturas_ja_geradas
FROM faturas
WHERE ordem_assinatura_id = oa.id;
```
**Ganho de Performance**: De Seq Scan O(N) por iteração para Index Scan O(log M), reduzindo o tempo de execução do cron de segundos para milissegundos.

### 4.2 Otimização de `gsa_provider_create_ticket`

**Problema**:
A checagem anti-duplicidade em `20260720233000_provider_portal_audit_hardening.sql:510` realiza:
```sql
SELECT id INTO v_ticket_id
FROM public.tickets
WHERE prestador_id = v_provider_id
  AND assunto = v_subject
  AND status <> 'concluido'
ORDER BY data_abertura DESC
LIMIT 1;
```
Com o índice composto proposto `idx_tickets_prestador_id` ou `idx_tickets_cliente_status_data`, a busca se torna um Index Scan direto com corte de LIMIT 1, eliminando qualquer risco de contenção sob concorrência.

---

## 5. CONCLUSÃO TÉCNICA E PRÓXIMOS PASSOS

A criação dos índices catalogados na Matriz Consolidada eliminará todos os pontos de estrangulamento identificados nas consultas frontend e procedimentos armazenados. As consultas passarão de planos de execução com custo elevado baseados em `Seq Scan` e `Sort Method: quicksort` para planos eficientes baseados em `Index Scan` e `Bitmap Index Scan`.

As recomendações estão formalizadas no relatório de handoff para que o arquiteto/engenheiro de banco de dados possa gerar a migração de performance (`supabase/migrations/xxxx_performance_indexes.sql`) de forma segura e idempotente.
