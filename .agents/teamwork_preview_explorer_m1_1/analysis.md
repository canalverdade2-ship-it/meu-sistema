# RELATÓRIO DE AUDITORIA DE ESQUEMA E ÍNDICES DO BANCO DE DADOS (POSTGRESQL)

**Auditor**: Explorer 1 (Database Schema Auditor)  
**Data**: 2026-09-11  
**Escopo**: `master_supabase_schema.sql` e 398 migrações em `supabase/migrations/`  
**Tabelas Críticas Auditadas**: `saques`, `faturas`, `tickets`, `ticket_mensagens`, `pontos_movimentacoes`, `vouchers`, `gsa_voucher_resgates`, `ordens_assinatura`, `ordens_compra`, `parceiros_resgates`, `parceiros_resgates_recursos`, `parceiros_resgates_eventos`, `carteira_lancamentos`, `prestador_saques`, `prestador_faturas`, `gsa_afiliado_saques`, `loja_credito_saques`, `produto_variantes`, `produtos`, `clientes`.

---

## 1. RESUMO EXECUTIVO

A auditoria exaustiva do esquema relacional do Supabase PostgreSQL revelou que, embora migrações parciais anteriores (`20260723120000_system_db_alignment.sql`, `20260723130000_add_missing_fk_indexes.sql`, `20260728050000_add_performance_indexes.sql`, `20260729120000_optimize_performance_indexes_and_sequences.sql`) tenham adicionado índices isolados em algumas tabelas, **subsistemas inteiros de alto tráfego permanecem sem nenhum índice**, resultando em varreduras sequenciais completas (*Sequential Scans*) e sobrecarga de CPU/memória no PostgreSQL em operações rotineiras de clientes e administradores.

### Principais Descobertas Críticas (P0):
1. **Tabelas com ZERO índices secundários:**
   - **`tickets`**: Tabela central do suporte ao cliente. **Nenhum índice existente** (nem em `cliente_id`, nem em `prestador_id`, nem em `status`, nem em `data_abertura`). Todas as listagens de chamados realizam *Full Table Scan*.
   - **`ticket_mensagens`**: Tabela de mensagens de chat de atendimento. **Nenhum índice existente** (a chave estrangeira `ticket_id` não possui índice). Qualquer abertura de ticket força uma varredura sequencial completa em todas as mensagens do histórico da plataforma.
   - **`ordens_assinatura`**: Tabela de planos e contratos de assinatura recorrente. **Nenhum índice existente** (nem em `cliente_id`, nem em `assinatura_id`, nem em `status`). O cron diário de renovação de faturas e o painel do cliente sofrem degradação contínua.
   - **`gsa_voucher_resgates`**: Tabela de auditoria de consumo e resgate financeiro de vouchers. **Nenhum índice existente** (nem em `voucher_id`, nem em `cliente_id`).
2. **Chaves Estrangeiras (Foreign Keys) Sem Índice:**
   - No PostgreSQL, a declaração `REFERENCES` garante integridade referencial, mas **não cria índice B-Tree automaticamente**.
   - Foram identificadas **14 chaves estrangeiras críticas sem índice** nas tabelas transacionais investigadas (ex: `faturas.ordem_compra_id`, `faturas.ordem_assinatura_id`, `pontos_movimentacoes.fatura_id`, `ordens_compra.produto_id`, `prestador_faturas.demanda_id`, `parceiros_resgates_recursos.resgate_id`, `gsa_afiliado_saques.afiliado_id`).
3. **Ausência de Índices Compostos para Ordenação Temporal:**
   - Consultas frequentes do frontend utilizam padrões como `WHERE cliente_id = ? ORDER BY data_movimentacao DESC` (em `pontos_movimentacoes`) ou `WHERE cliente_id = ? ORDER BY data_lancamento DESC` (em `carteira_lancamentos`). Apenas o índice em `cliente_id` existe, forçando o motor de execução do PostgreSQL a realizar operações pesadas de ordenação em memória (*Sort* / *External Sort*).

---

## 2. METODOLOGIA E INVENTÁRIO DE FONTES

A auditoria processou:
- `master_supabase_schema.sql` (826 linhas - DDL base do ERP/CRM/Fintech)
- **398 arquivos de migração** em `supabase/migrations/`
- Código de consultas do frontend em `src/components/`, `src/features/`, `src/hooks/`, e RPCs em `supabase/migrations/`

Total de Chaves Estrangeiras mapeadas no banco: **361 FKs**.  
Total de Índices em migrações: **285 índices**.

---

## 3. CATÁLOGO DETALHADO POR TABELA CRÍTICA

### 3.1 Tabela `tickets` (Comunicação e Atendimento ao Cliente)
- **Origem da Definição**: `master_supabase_schema.sql:517`
- **Colunas**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `cliente_id`: `UUID REFERENCES clientes(id)` *(NULLABLE)*
  - `prestador_id`: `UUID REFERENCES prestadores(id)` *(NULLABLE)*
  - `assunto`: `TEXT NOT NULL`
  - `descricao`: `TEXT NOT NULL`
  - `status`: `TEXT CHECK (status IN ('aberto', 'em andamento', 'concluido')) DEFAULT 'aberto'`
  - `data_abertura`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `data_fechamento`: `TIMESTAMP WITH TIME ZONE`
- **Chaves Estrangeiras**:
  - `cliente_id -> clientes(id)`
  - `prestador_id -> prestadores(id)`
- **Índices Existentes**: **NENHUM (0 índices)**. Apenas a chave primária `tickets_pkey` existe.
- **Padrões de Acesso Identificados**:
  - `ClientesModule.tsx`: `.from('tickets').select('id, assunto, status').eq('cliente_id', clienteId).in('status', ['aberto', 'em andamento', 'pendente_cliente'])`
  - `AtendimentoTicketsView.tsx`: `.from('tickets').select('*').order('created_at', { ascending: false })`
  - `RelatorioSuporte.tsx`: `.from('tickets').gte('data_abertura', inicio).lte('data_abertura', fim)`
- **Gargalos Diagnosticados**:
  - Toda consulta por cliente dispara `Seq Scan on tickets`.
  - Deleções em cascata de clientes disparam bloqueios e varredura total em `tickets`.
  - Filas de suporte administrativo não possuem índice em `status` ou `data_abertura`.
- **Candidatos a Índices Recomendados**:
  1. `idx_tickets_cliente_id`: `ON public.tickets (cliente_id)` [BTREE] — P0 (FK)
  2. `idx_tickets_prestador_id`: `ON public.tickets (prestador_id)` [BTREE] — P0 (FK)
  3. `idx_tickets_status`: `ON public.tickets (status)` [BTREE] — P1
  4. `idx_tickets_cliente_status`: `ON public.tickets (cliente_id, status)` [BTREE] — P1
  5. `idx_tickets_data_abertura`: `ON public.tickets (data_abertura DESC)` [BTREE] — P1

---

### 3.2 Tabela `ticket_mensagens` (Histórico de Chat do Suporte)
- **Origem da Definição**: `master_supabase_schema.sql:528`
- **Colunas**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `ticket_id`: `UUID REFERENCES tickets(id) ON DELETE CASCADE`
  - `autor_id`: `TEXT NOT NULL`
  - `autor_nome`: `TEXT NOT NULL`
  - `mensagem`: `TEXT NOT NULL`
  - `tipo`: `TEXT CHECK (tipo IN ('cliente', 'admin', 'prestador')) NOT NULL`
  - `data_envio`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `anexo_nome`: `TEXT` *(adicionado em 20260720200500_ticket_attachment_names.sql)*
- **Chaves Estrangeiras**:
  - `ticket_id -> tickets(id) ON DELETE CASCADE`
- **Índices Existentes**: **NENHUM (0 índices)**. Apenas a chave primária `ticket_mensagens_pkey`.
- **Padrões de Acesso Identificados**:
  - `AtendimentoTicketsView.tsx`: `.from('ticket_mensagens').select('*').in('ticket_id', ticketIds).order('data_envio', { ascending: true })`
  - `TicketsModule.tsx`: `.from('ticket_mensagens').update({ lida: true }).eq('ticket_id', ticketId).eq('tipo', 'cliente').eq('lida', false)`
- **Gargalos Diagnosticados**:
  - Abrir um ticket de suporte força o PostgreSQL a varrer linearmente toda a tabela de mensagens da plataforma.
  - Ao fechar ou excluir um ticket, o `ON DELETE CASCADE` executa varredura sequencial para encontrar as mensagens associadas.
- **Candidatos a Índices Recomendados**:
  1. `idx_ticket_mensagens_ticket_id`: `ON public.ticket_mensagens (ticket_id)` [BTREE] — P0 (FK)
  2. `idx_ticket_mensagens_ticket_data`: `ON public.ticket_mensagens (ticket_id, data_envio ASC)` [BTREE] — P0 (Elimina Sort)

---

### 3.3 Tabela `faturas` (Faturas Financeiras do Sistema)
- **Origem da Definição**: `master_supabase_schema.sql:260`
- **Colunas**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `codigo_fatura`: `TEXT UNIQUE`
  - `os_id`: `UUID REFERENCES ordens_servico(id)`
  - `ordem_compra_id`: `UUID REFERENCES ordens_compra(id)`
  - `ordem_assinatura_id`: `UUID REFERENCES ordens_assinatura(id)`
  - `cliente_id`: `UUID REFERENCES clientes(id) NOT NULL`
  - `valor_total`: `DECIMAL(12,2) NOT NULL`
  - `valor_pago`: `DECIMAL(12,2) DEFAULT 0.00`
  - `valor_final_pendente`: `DECIMAL(12,2) NOT NULL`
  - `status`: `TEXT CHECK (status IN ('pendente', 'pago', 'cancelado', 'revisada', 'vencida', 'aguardando_link', 'pendente_pagamento')) DEFAULT 'pendente'`
  - `tipo`: `TEXT CHECK (tipo IN ('servico', 'produto', 'assinatura', 'pacote_nivel'))`
  - `data_vencimento`: `DATE NOT NULL`
  - `data_pagamento`: `TIMESTAMP WITH TIME ZONE`
  - `forma_pagamento_escolhida`: `TEXT`
  - `mes_referencia`: `TEXT`
  - `created_at`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- **Chaves Estrangeiras**:
  - `os_id -> ordens_servico(id)` (Indexado via `faturas_one_per_service_order_uidx`)
  - `ordem_compra_id -> ordens_compra(id)` (**SEM ÍNDICE**)
  - `ordem_assinatura_id -> ordens_assinatura(id)` (**SEM ÍNDICE**)
  - `cliente_id -> clientes(id)` (Indexado via `idx_faturas_cliente_id`)
  - `orcamento_id -> orcamentos(id)` (Indexado via `idx_faturas_orcamento_id`)
- **Índices Existentes**:
  - `faturas_codigo_fatura_key` ON `(codigo_fatura)` [UNIQUE BTREE]
  - `idx_faturas_cliente_id` ON `(cliente_id)` [BTREE] (`20260723120000_system_db_alignment.sql:72`)
  - `idx_faturas_status` ON `(status)` [BTREE] (`20260728050000_add_performance_indexes.sql:5`)
  - `idx_faturas_data_vencimento` ON `(data_vencimento)` [BTREE] (`20260728050000_add_performance_indexes.sql:6`)
  - `idx_faturas_created_at` ON `(created_at DESC)` [BTREE] (`20260728050000_add_performance_indexes.sql:7`)
  - `idx_faturas_cliente_status_venc` ON `(cliente_id, status, data_vencimento)` [BTREE] (`20260729120000_optimize_performance_indexes_and_sequences.sql:145`)
  - `idx_faturas_orcamento_id` ON `(orcamento_id)` [BTREE] (`20260711080000_create_orcamento_timeline_compat.sql`)
  - `idx_faturas_viagem_transacao_metadata` ON `((metadata ->> 'transacao_id'))` [BTREE]
  - `faturas_one_per_service_order_uidx` ON `(os_id)` [UNIQUE BTREE]
  - `faturas_infinitepay_order_nsu_uidx` ON `(infinitepay_order_nsu)` [UNIQUE BTREE]
- **Padrões de Acesso Identificados**:
  - `ClientesModule.tsx`: `.from('faturas').select('*').eq('cliente_id', cliente.id).eq('status', 'pago')`
  - `cron_faturas_assinaturas.sql`: verificação de faturas por `ordem_assinatura_id` e status de vencimento.
  - Queries de pedidos e compras: junções de `ordens_compra` com `faturas.ordem_compra_id`.
  - Rotina de faturas vencidas: `WHERE status = 'pendente' AND data_vencimento < CURRENT_DATE`.
- **Gargalos Diagnosticados**:
  - Chaves estrangeiras `ordem_compra_id` e `ordem_assinatura_id` causam sequential scans em junções de faturas com pedidos.
  - O índice composto `idx_faturas_cliente_status_venc` inicia por `cliente_id`, não sendo aproveitado por crons globais de faturas vencidas que operam sem filtro de cliente.
- **Candidatos a Índices Recomendados**:
  1. `idx_faturas_ordem_compra_id`: `ON public.faturas (ordem_compra_id)` [BTREE] — P0 (FK)
  2. `idx_faturas_ordem_assinatura_id`: `ON public.faturas (ordem_assinatura_id)` [BTREE] — P0 (FK)
  3. `idx_faturas_status_vencimento`: `ON public.faturas (status, data_vencimento)` [BTREE] — P1 (Cron global)
  4. `idx_faturas_tipo`: `ON public.faturas (tipo)` [BTREE] — P2

---

### 3.4 Tabela `saques` (Saques e Solicitações de PIX de Clientes)
- **Origem da Definição**: `master_supabase_schema.sql:316`
- **Colunas**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `cliente_id`: `UUID REFERENCES clientes(id) NOT NULL`
  - `valor`: `DECIMAL(12,2) NOT NULL`
  - `taxa_aplicada`: `DECIMAL(12,2) DEFAULT 0`
  - `valor_liquido`: `DECIMAL(12,2) DEFAULT 0`
  - `tipo_chave_pix`: `TEXT`
  - `chave_pix`: `TEXT NOT NULL`
  - `status`: `TEXT CHECK (status IN ('pendente', 'aprovado', 'recusado', 'pago', 'cancelado')) DEFAULT 'pendente'`
  - `data_solicitacao`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `data_vencimento`: `TIMESTAMP WITH TIME ZONE`
  - `data_pagamento`: `TIMESTAMP WITH TIME ZONE`
  - `request_id`: `UUID` *(adicionado em 20260714056200)*
  - `created_at`: `TIMESTAMPTZ DEFAULT NOW()`
- **Chaves Estrangeiras**:
  - `cliente_id -> clientes(id)` (Indexado via `idx_saques_cliente_id`)
- **Índices Existentes**:
  - `idx_saques_cliente_id` ON `(cliente_id)` [BTREE] (`20260728050000_add_performance_indexes.sql:10`)
  - `idx_saques_status` ON `(status)` [BTREE] (`20260728050000_add_performance_indexes.sql:11`)
  - `idx_saques_created_at` ON `(created_at DESC)` [BTREE] (`20260728050000_add_performance_indexes.sql:12`)
  - `uq_saques_request_id` ON `(request_id)` [UNIQUE BTREE] (`20260714056200_secure_client_wallet_points_transfers.sql`)
- **Padrões de Acesso Identificados**:
  - `ClientesModule.tsx`: `.from('saques').select('id, valor, status').eq('cliente_id', clienteId).in('status', ['solicitado', 'aprovado'])`
  - `FinanceiroModule.tsx`: `.from('saques').select('*, clientes(...)').order('data_solicitacao', { ascending: false })`
  - `RelatorioExecutivo.tsx`: `.from('saques').select('id', { count: 'exact' }).eq('status', 'pendente')`
- **Gargalos Diagnosticados**:
  - A verificação de saques ativos por cliente (`cliente_id` + `status IN (...)`) obriga o planejador a usar *Bitmap Index Scan* combinando `idx_saques_cliente_id` e `idx_saques_status`.
  - A listagem cronológica do cliente requer reordenação em memória quando combinada com filtros.
- **Candidatos a Índices Recomendados**:
  1. `idx_saques_cliente_status`: `ON public.saques (cliente_id, status)` [BTREE] — P1
  2. `idx_saques_cliente_data_solicitacao`: `ON public.saques (cliente_id, data_solicitacao DESC)` [BTREE] — P1
  3. `idx_saques_fila_pendente`: `ON public.saques (status, data_solicitacao)` WHERE `status IN ('pendente', 'solicitado')` [BTREE parcial] — P1

---

### 3.5 Tabela `pontos_movimentacoes` (Extrato de Gamificação e Fidelidade)
- **Origem da Definição**: `master_supabase_schema.sql:343`
- **Colunas**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `cliente_id`: `UUID REFERENCES clientes(id) NOT NULL`
  - `fatura_id`: `UUID REFERENCES faturas(id)` *(NULLABLE)*
  - `tipo`: `TEXT CHECK (tipo IN ('geracao_fatura', 'conversao_dinheiro', 'uso_fatura', 'ajuste_manual', 'estorno', 'bonus_boas_vindas', 'indicacao', 'bonus', 'resgate')) NOT NULL`
  - `pontos`: `INTEGER NOT NULL`
  - `saldo_apos`: `INTEGER NOT NULL`
  - `descricao`: `TEXT`
  - `valor_convertido`: `DECIMAL(12,2)`
  - `data_movimentacao`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- **Chaves Estrangeiras**:
  - `cliente_id -> clientes(id)` (Indexado via `idx_pontos_movimentacoes_cliente_id`)
  - `fatura_id -> faturas(id)` (**SEM ÍNDICE**)
- **Índices Existentes**:
  - `idx_pontos_movimentacoes_cliente_id` ON `(cliente_id)` [BTREE] (`20260723120000_system_db_alignment.sql:79`)
- **Padrões de Acesso Identificados**:
  - `ClientesModule.tsx`: `.from('pontos_movimentacoes').select('*').eq('cliente_id', cliente.id).order('data_movimentacao', { ascending: false })`
  - `RelatorioGamificacao.tsx`: `.from('pontos_movimentacoes').select('tipo, pontos, valor_convertido, data_movimentacao').gte('data_movimentacao', inicio).lte('data_movimentacao', fim)`
  - `20260910180000_marketplace_acid_concurrency_remediation.sql`: Estorno de pontos busca movimentações vinculadas à fatura/pedido.
- **Gargalos Diagnosticados**:
  - A chave estrangeira `fatura_id` não possui índice, degradando estornos e auditorias por fatura.
  - O extrato de pontos sempre ordena por `data_movimentacao DESC`. O índice existente é apenas em `(cliente_id)`, obrigando o PostgreSQL a buscar todas as linhas do cliente e ordená-las em memória.
- **Candidatos a Índices Recomendados**:
  1. `idx_pontos_movimentacoes_fatura_id`: `ON public.pontos_movimentacoes (fatura_id)` [BTREE] — P0 (FK)
  2. `idx_pontos_movimentacoes_cliente_data`: `ON public.pontos_movimentacoes (cliente_id, data_movimentacao DESC)` [BTREE] — P0 (Elimina Sort)
  3. `idx_pontos_movimentacoes_tipo`: `ON public.pontos_movimentacoes (tipo)` [BTREE] — P2
  4. `idx_pontos_movimentacoes_data`: `ON public.pontos_movimentacoes (data_movimentacao DESC)` [BTREE] — P2

---

### 3.6 Tabelas `vouchers` e `gsa_voucher_resgates` (Cupons e Benefícios de Desconto)
- **Origem da Definição**: `master_supabase_schema.sql:136` e `20260714056300_secure_remaining_client_financial_actions.sql:30`
- **Colunas em `vouchers`**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `codigo_voucher`: `TEXT UNIQUE`
  - `nome`: `TEXT`
  - `tipo`: `TEXT CHECK (tipo IN ('fixo', 'porcentagem', 'valor')) NOT NULL DEFAULT 'valor'`
  - `valor`: `DECIMAL(12,2) NOT NULL`
  - `cliente_id`: `UUID REFERENCES clientes(id)`
  - `prestador_id`: `UUID REFERENCES prestadores(id)`
  - `ordem_servico_id`: `UUID REFERENCES ordens_servico(id)`
  - `validade`: `DATE`
  - `usage_limit`: `INTEGER DEFAULT 1`
  - `usage_count`: `INTEGER DEFAULT 0`
  - `status`: `TEXT CHECK (status IN ('ativo', 'usado', 'expirado', 'cancelado')) DEFAULT 'ativo'`
  - `categoria`: `TEXT CHECK (categoria IN ('desconto', 'saque'))`
  - `data_uso`: `TIMESTAMP WITH TIME ZONE`
  - `tipo_uso`: `TEXT`
  - `motivo_cancelamento`: `TEXT`
  - `data_cancelamento`: `TIMESTAMP WITH TIME ZONE`
  - `created_at`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- **Colunas em `gsa_voucher_resgates`**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `voucher_id`: `uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE`
  - `cliente_id`: `uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE`
  - `valor`: `numeric NOT NULL CHECK (valor > 0)`
  - `created_at`: `timestamptz NOT NULL DEFAULT now()`
- **Índices Existentes em `vouchers`**:
  - `vouchers_codigo_voucher_key` ON `(codigo_voucher)` [UNIQUE BTREE]
  - `idx_vouchers_cliente_id` ON `(cliente_id)` [BTREE] (`20260723130000_add_missing_fk_indexes.sql:42`)
  - `idx_vouchers_prestador_id` ON `(prestador_id)` [BTREE] (`20260723130000_add_missing_fk_indexes.sql:43`)
  - `idx_vouchers_ordem_servico_id` ON `(ordem_servico_id)` [BTREE] (`20260723130000_add_missing_fk_indexes.sql:44`)
- **Índices Existentes em `gsa_voucher_resgates`**: **NENHUM (0 índices)**.
- **Padrões de Acesso Identificados**:
  - Validação de voucher no checkout: `WHERE codigo_voucher = ? AND status = 'ativo' AND (validade IS NULL OR validade >= CURRENT_DATE)`.
  - RPC `gsa_client_redeem_voucher`: `SELECT * FROM public.gsa_voucher_resgates WHERE voucher_id = v_voucher.id AND cliente_id = v_actor.cliente_id`.
  - Listagem do cliente em `FidelidadePromocoesSection.tsx`: `.from('vouchers').select('*, cliente:clientes(...)').order('created_at', { ascending: false })`.
- **Gargalos Diagnosticados**:
  - `gsa_voucher_resgates` não tem índice em `voucher_id` nem em `cliente_id`. A RPC de resgate faz sequential scan na tabela inteira.
  - `vouchers` não tem índice para busca de cupons ativos por status/validade.
- **Candidatos a Índices Recomendados**:
  1. `idx_gsa_voucher_resgates_voucher_id`: `ON public.gsa_voucher_resgates (voucher_id)` [BTREE] — P0 (FK)
  2. `idx_gsa_voucher_resgates_cliente_id`: `ON public.gsa_voucher_resgates (cliente_id)` [BTREE] — P0 (FK)
  3. `idx_gsa_voucher_resgates_voucher_cliente`: `ON public.gsa_voucher_resgates (voucher_id, cliente_id)` [BTREE] — P0 (Idempotência de Resgate)
  4. `idx_vouchers_status`: `ON public.vouchers (status)` [BTREE] — P1
  5. `idx_vouchers_validade`: `ON public.vouchers (validade)` [BTREE] — P1
  6. `idx_vouchers_cliente_status`: `ON public.vouchers (cliente_id, status)` [BTREE] — P1

---

### 3.7 Tabela `ordens_assinatura` (Assinaturas e Mensalidades de Planos)
- **Origem da Definição**: `master_supabase_schema.sql:243`
- **Colunas**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `codigo_ordem`: `TEXT UNIQUE`
  - `assinatura_id`: `UUID REFERENCES assinaturas(id)`
  - `cliente_id`: `UUID REFERENCES clientes(id) NOT NULL`
  - `status`: `TEXT CHECK (status IN ('em_analise', 'aprovado', 'concluido', 'cancelado', 'em_cancelamento')) DEFAULT 'em_analise'`
  - `quantidade`: `INTEGER DEFAULT 1`
  - `prazo_meses`: `INTEGER`
  - `renovacao_automatica`: `BOOLEAN DEFAULT true`
  - `data_vencimento`: `TIMESTAMP WITH TIME ZONE`
  - `data_criacao`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `data_cancelamento`: `TIMESTAMP WITH TIME ZONE`
  - `valor_proporcional_cancelamento`: `DECIMAL(10,2)`
  - `nome_assinatura_contratada`: `TEXT`
  - `valor_mensal_contratado`: `NUMERIC`
- **Chaves Estrangeiras**:
  - `assinatura_id -> assinaturas(id)` (**SEM ÍNDICE**)
  - `cliente_id -> clientes(id)` (**SEM ÍNDICE**)
- **Índices Existentes**: **NENHUM (0 índices)**. Apenas a chave primária e a constraint unique em `codigo_ordem`.
- **Padrões de Acesso Identificados**:
  - `ClientesModule.tsx`: `.from('ordens_assinatura').select('*, orcamentos(total), assinaturas(nome)').eq('cliente_id', cliente.id).order('data_criacao', { ascending: false })`
  - `FinanceiroModule.tsx`: `.from('ordens_assinatura').select('id, codigo_ordem, orcamentos(total)').eq('cliente_id', cliente_id).eq('status', 'em_analise')`
  - `cron_faturas_assinaturas.sql`: Varredura periódica de assinaturas ativas com renovação habilitada.
- **Gargalos Diagnosticados**:
  - Tabela crítica de faturamento sem qualquer índice secundário.
  - Todas as chamadas do painel do cliente e do admin executam `Seq Scan on ordens_assinatura`.
- **Candidatos a Índices Recomendados**:
  1. `idx_ordens_assinatura_cliente_id`: `ON public.ordens_assinatura (cliente_id)` [BTREE] — P0 (FK)
  2. `idx_ordens_assinatura_assinatura_id`: `ON public.ordens_assinatura (assinatura_id)` [BTREE] — P0 (FK)
  3. `idx_ordens_assinatura_status`: `ON public.ordens_assinatura (status)` [BTREE] — P1
  4. `idx_ordens_assinatura_cliente_status`: `ON public.ordens_assinatura (cliente_id, status)` [BTREE] — P1
  5. `idx_ordens_assinatura_cliente_data`: `ON public.ordens_assinatura (cliente_id, data_criacao DESC)` [BTREE] — P1
  6. `idx_ordens_assinatura_renovacao_cron`: `ON public.ordens_assinatura (data_vencimento)` WHERE `renovacao_automatica = true AND status = 'aprovado'` [BTREE parcial] — P1

---

### 3.8 Tabela `ordens_compra` (Pedidos de Compra no Marketplace)
- **Origem da Definição**: `master_supabase_schema.sql:233`
- **Colunas**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `codigo_ordem`: `TEXT UNIQUE`
  - `produto_id`: `UUID REFERENCES produtos(id)`
  - `cliente_id`: `UUID REFERENCES clientes(id) NOT NULL`
  - `status`: `TEXT CHECK (status IN ('em_analise', 'aprovado', 'concluido', 'cancelado')) DEFAULT 'em_analise'`
  - `quantidade`: `INTEGER DEFAULT 1`
  - `data_criacao`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `produto_variante_id`: `UUID REFERENCES produto_variantes(id) ON DELETE SET NULL`
  - `variacao_selecionada`: `JSONB`
- **Chaves Estrangeiras**:
  - `produto_id -> produtos(id)` (**SEM ÍNDICE**)
  - `cliente_id -> clientes(id)` (Indexado via `idx_ordens_compra_cliente_id`)
  - `produto_variante_id -> produto_variantes(id)` (Indexado via `idx_ordens_compra_produto_variante`)
- **Índices Existentes**:
  - `idx_ordens_compra_cliente_id` ON `(cliente_id)` [BTREE] (`20260723120000_system_db_alignment.sql:73`)
  - `idx_ordens_compra_produto_variante` ON `(produto_variante_id)` [BTREE] (`20260817120000_product_variations_marketplace.sql:59`)
- **Padrões de Acesso Identificados**:
  - `ClientesModule.tsx`: `.from('ordens_compra').select('*, orcamentos(total), produtos(nome)').eq('cliente_id', cliente.id).order('data_criacao', { ascending: false })`
  - `FinanceiroModule.tsx`: `.from('ordens_compra').eq('cliente_id', cliente_id).eq('status', 'em_analise')`
  - Junções de estoque por produto em auditorias de venda.
- **Gargalos Diagnosticados**:
  - A chave estrangeira `produto_id` não possui índice.
  - A filtragem combinada `(cliente_id, status)` não possui índice composto.
- **Candidatos a Índices Recomendados**:
  1. `idx_ordens_compra_produto_id`: `ON public.ordens_compra (produto_id)` [BTREE] — P0 (FK)
  2. `idx_ordens_compra_status`: `ON public.ordens_compra (status)` [BTREE] — P1
  3. `idx_ordens_compra_cliente_status`: `ON public.ordens_compra (cliente_id, status)` [BTREE] — P1
  4. `idx_ordens_compra_cliente_data`: `ON public.ordens_compra (cliente_id, data_criacao DESC)` [BTREE] — P1

---

### 3.9 Tabelas de Resgates de Parceiros (`parceiros_resgates`, `recursos`, `eventos`)
- **Origem da Definição**: `20260721120000_partner_benefit_redemption.sql` e `20260828170000_partner_redemption_appeals.sql`
- **Colunas em `parceiros_resgates`**:
  - `id`, `parceiro_id`, `cliente_id`, `nome_completo`, `telefone`, `codigo_gerado`, `tipo_resgate`, `status`, `created_at`
- **Colunas em `parceiros_resgates_recursos`**:
  - `id`, `resgate_id REFERENCES parceiros_resgates(id) ON DELETE CASCADE`, `protocolo_recurso`, `contestacao_cliente`, `status`, `aberto_em`, `prazo_analise_em`, `analisado_em`, `motivo_decisao`
- **Colunas em `parceiros_resgates_eventos`**:
  - `id`, `resgate_id REFERENCES parceiros_resgates(id) ON DELETE CASCADE`, `recurso_id REFERENCES parceiros_resgates_recursos(id) ON DELETE SET NULL`, `tipo`, `titulo`, `ocorrido_em`
- **Índices Existentes**:
  - `parceiros_resgates_parceiro_idx` ON `(parceiro_id, created_at DESC)`
  - `parceiros_resgates_cliente_idx` ON `(cliente_id, created_at DESC)`
  - `idx_parceiros_resgates_recursos_status_prazo` ON `(status, prazo_analise_em)`
  - `idx_parceiros_resgates_eventos_timeline` ON `(resgate_id, ocorrido_em, id)`
- **Gargalos Diagnosticados**:
  - `parceiros_resgates_recursos.resgate_id` (**SEM ÍNDICE**): Carregar os detalhes do resgate no modal do admin (`PartnerRedemptionDetailModal.tsx`) para verificar se há recurso aberto dispara sequential scan em recursos.
  - `parceiros_resgates_eventos.recurso_id` (**SEM ÍNDICE**): Histórico de eventos associados a um recurso específico.
  - `parceiros_resgates.codigo_gerado`: Validação no balcão do parceiro físico via código.
- **Candidatos a Índices Recomendados**:
  1. `idx_parceiros_resgates_recursos_resgate_id`: `ON public.parceiros_resgates_recursos (resgate_id)` [BTREE] — P0 (FK)
  2. `idx_parceiros_resgates_eventos_recurso_id`: `ON public.parceiros_resgates_eventos (recurso_id)` [BTREE] — P1 (FK)
  3. `idx_parceiros_resgates_status`: `ON public.parceiros_resgates (status)` [BTREE] — P1
  4. `idx_parceiros_resgates_codigo_gerado`: `ON public.parceiros_resgates (codigo_gerado)` [BTREE] — P1

---

### 3.10 Tabela `carteira_lancamentos` (Extrato de Saldo da Carteira do Cliente)
- **Origem da Definição**: `master_supabase_schema.sql:297`
- **Colunas**:
  - `id`: `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `cliente_id`: `UUID REFERENCES clientes(id) NOT NULL`
  - `valor`: `DECIMAL(12,2) NOT NULL`
  - `tipo`: `TEXT CHECK (tipo IN ('credito', 'debito')) NOT NULL`
  - `descricao`: `TEXT`
  - `data_lancamento`: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- **Chaves Estrangeiras**:
  - `cliente_id -> clientes(id)` (Indexado via `idx_carteira_lancamentos_cliente_id`)
- **Índices Existentes**:
  - `idx_carteira_lancamentos_cliente_id` ON `(cliente_id)` [BTREE] (`20260723120000_system_db_alignment.sql:81`)
- **Padrões de Acesso Identificados**:
  - `ClientFinanceiro.tsx` e `step5_reports_consolidation.ts`: `.from('carteira_lancamentos').select('*').eq('cliente_id', clienteId).order('data_lancamento', { ascending: false })`
- **Gargalos Diagnosticados**:
  - A consulta do extrato financeiro ordena obrigatoriamente por `data_lancamento DESC`. O índice atual contém apenas `cliente_id`, exigindo classificação em memória para todos os lançamentos do usuário.
- **Candidatos a Índices Recomendados**:
  1. `idx_carteira_lancamentos_cliente_data`: `ON public.carteira_lancamentos (cliente_id, data_lancamento DESC)` [BTREE] — P0 (Elimina Sort)
  2. `idx_carteira_lancamentos_tipo`: `ON public.carteira_lancamentos (tipo)` [BTREE] — P2

---

### 3.11 Tabelas de Prestadores (`prestador_saques` e `prestador_faturas`)
- **Origem da Definição**: `master_supabase_schema.sql:443, 454` e `20260317000002_create_prestadores_schema.sql`
- **Colunas em `prestador_faturas`**:
  - `id`, `prestador_id REFERENCES prestadores(id)`, `demanda_id REFERENCES prestador_demandas(id)`, `valor`, `status`, `data_vencimento`, `data_pagamento`, `created_at`
- **Colunas em `prestador_saques`**:
  - `id`, `prestador_id REFERENCES prestadores(id)`, `valor`, `status`, `dados_bancarios`, `created_at`
- **Índices Existentes**:
  - `idx_prestador_faturas_prestador_id` ON `(prestador_id)` [BTREE] (`20260728050000_add_performance_indexes.sql:28`)
  - `idx_prestador_saques_prestador_id` ON `(prestador_id)` [BTREE] (`20260728050000_add_performance_indexes.sql:29`)
- **Gargalos Diagnosticados**:
  - `prestador_faturas.demanda_id` (**SEM ÍNDICE**): Chave estrangeira que vincula a fatura do prestador à ordem de serviço/demanda executada.
  - `prestador_saques.status` e `prestador_faturas.status`: Consultas administrativas de pagamentos pendentes operam via sequential scan.
- **Candidatos a Índices Recomendados**:
  1. `idx_prestador_faturas_demanda_id`: `ON public.prestador_faturas (demanda_id)` [BTREE] — P0 (FK)
  2. `idx_prestador_faturas_status`: `ON public.prestador_faturas (status)` [BTREE] — P1
  3. `idx_prestador_saques_status`: `ON public.prestador_saques (status)` [BTREE] — P1
  4. `idx_prestador_saques_prestador_created`: `ON public.prestador_saques (prestador_id, created_at DESC)` [BTREE] — P1

---

### 3.12 Tabela `gsa_afiliado_saques` (Saques e Comissões de Afiliados)
- **Origem da Definição**: `20260722040000_affiliate_program.sql:64`
- **Colunas**:
  - `id`, `afiliado_id REFERENCES gsa_afiliados(id) ON DELETE RESTRICT`, `request_id`, `valor`, `status`, `solicitado_em`, `pago_em`, `rejeitado_em`, `created_at`
- **Índices Existentes**:
  - `ix_gsa_afiliado_saques_fila` ON `(status, solicitado_em)` [BTREE]
- **Gargalos Diagnosticados**:
  - A chave estrangeira `afiliado_id` não possui índice iniciado por `afiliado_id`. A consulta do extrato de saques do afiliado (`WHERE afiliado_id = ? ORDER BY solicitado_em DESC LIMIT 200` em `complete_affiliate_flow.sql:395`) não consegue aproveitar o índice da fila cujo primeiro campo é `status`.
- **Candidatos a Índices Recomendados**:
  1. `idx_gsa_afiliado_saques_afiliado_id`: `ON public.gsa_afiliado_saques (afiliado_id)` [BTREE] — P0 (FK)
  2. `idx_gsa_afiliado_saques_afiliado_data`: `ON public.gsa_afiliado_saques (afiliado_id, solicitado_em DESC)` [BTREE] — P0 (Extrato do Afiliado)

---

### 3.13 Tabela `loja_credito_saques` (Saques de Limite de Crédito da Loja)
- **Origem da Definição**: `20260829133000_credit_available_withdrawals.sql:15`
- **Colunas**:
  - `id`, `protocolo`, `cliente_id REFERENCES clientes(id)`, `valor_solicitado`, `status`, `fatura_id REFERENCES faturas(id)`, `movimentacao_id REFERENCES loja_credito_movimentacoes(id)`, `created_at`
- **Índices Existentes**:
  - `loja_credito_saques_ativo_uidx` ON `(cliente_id)` WHERE `status IN ('aguardando_documentos','em_analise','analise_reforcada','aprovado')` [UNIQUE BTREE]
  - `loja_credito_saques_status_data_idx` ON `(status, created_at DESC)` [BTREE]
- **Gargalos Diagnosticados**:
  - Chaves estrangeiras `fatura_id` e `movimentacao_id` não possuem índice.
  - Consultas gerais de histórico do cliente (`WHERE cliente_id = ?`) não podem utilizar o índice parcial `loja_credito_saques_ativo_uidx` caso o status seja concluído ou cancelado.
- **Candidatos a Índices Recomendados**:
  1. `idx_loja_credito_saques_fatura_id`: `ON public.loja_credito_saques (fatura_id)` [BTREE] — P0 (FK)
  2. `idx_loja_credito_saques_movimentacao_id`: `ON public.loja_credito_saques (movimentacao_id)` [BTREE] — P0 (FK)
  3. `idx_loja_credito_saques_cliente_data`: `ON public.loja_credito_saques (cliente_id, created_at DESC)` [BTREE] — P1

---

### 3.14 Tabelas de Produtos e Variações (`produtos` e `produto_variantes`)
- **Origem da Definição**: `master_supabase_schema.sql:102` e `20260817120000_product_variations_marketplace.sql:10`
- **Colunas em `produto_variantes`**:
  - `id`, `produto_id REFERENCES produtos(id)`, `chave`, `nome`, `sku`, `codigo_barras`, `valor`, `estoque_disponivel`, `ativo`, `created_at`
- **Índices Existentes**:
  - `idx_produto_variantes_produto` ON `(produto_id, ativo, id)` [BTREE]
  - `produtos_codigo_barras_key` ON `(codigo_barras)` [UNIQUE BTREE]
- **Gargalos Diagnosticados**:
  - Buscas de variações no checkout/leitor de código de barras por `sku` ou `codigo_barras` executam sequential scans na tabela de variações.
  - A vitrine de produtos filtra frequentemente por `status = 'ativo' ORDER BY created_at DESC`.
- **Candidatos a Índices Recomendados**:
  1. `idx_produto_variantes_sku`: `ON public.produto_variantes (sku)` [BTREE] — P1
  2. `idx_produto_variantes_codigo_barras`: `ON public.produto_variantes (codigo_barras)` [BTREE] — P1
  3. `idx_produtos_status_created`: `ON public.produtos (status, created_at DESC)` [BTREE] — P1

---

## 4. MATRIZ CONSOLIDADA DE ÍNDICES AUSENTES (CATÁLOGO DDL)

Abaixo está o catálogo unificado de todos os índices candidatos recomendados para implementação na migração de performance:

```sql
-- ====================================================================================
-- PERFORMANCE INDEXES MIGRATION — CRITICAL HIGH-VOLUME TABLES
-- GSA HUB POSTGRESQL OPTIMIZATION
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. TICKETS & TICKET MENSAGENS (SUPPORT WORKFLOW) — P0
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tickets_cliente_id 
  ON public.tickets (cliente_id);

CREATE INDEX IF NOT EXISTS idx_tickets_prestador_id 
  ON public.tickets (prestador_id);

CREATE INDEX IF NOT EXISTS idx_tickets_status 
  ON public.tickets (status);

CREATE INDEX IF NOT EXISTS idx_tickets_cliente_status 
  ON public.tickets (cliente_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_data_abertura 
  ON public.tickets (data_abertura DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_ticket_id 
  ON public.ticket_mensagens (ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_mensagens_ticket_data 
  ON public.ticket_mensagens (ticket_id, data_envio ASC);

-- ------------------------------------------------------------------------------------
-- 2. ORDENS ASSINATURA (RECURRING BILLING & PLANS) — P0
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_cliente_id 
  ON public.ordens_assinatura (cliente_id);

CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_assinatura_id 
  ON public.ordens_assinatura (assinatura_id);

CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_status 
  ON public.ordens_assinatura (status);

CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_cliente_status 
  ON public.ordens_assinatura (cliente_id, status);

CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_cliente_data 
  ON public.ordens_assinatura (cliente_id, data_criacao DESC);

CREATE INDEX IF NOT EXISTS idx_ordens_assinatura_renovacao_cron 
  ON public.ordens_assinatura (data_vencimento) 
  WHERE renovacao_automatica = true AND status = 'aprovado';

-- ------------------------------------------------------------------------------------
-- 3. FATURAS (FINANCIAL INVOICES & RECONCILIATION) — P0 & P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_faturas_ordem_compra_id 
  ON public.faturas (ordem_compra_id);

CREATE INDEX IF NOT EXISTS idx_faturas_ordem_assinatura_id 
  ON public.faturas (ordem_assinatura_id);

CREATE INDEX IF NOT EXISTS idx_faturas_status_vencimento 
  ON public.faturas (status, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_faturas_tipo 
  ON public.faturas (tipo);

-- ------------------------------------------------------------------------------------
-- 4. PONTOS MOVIMENTACOES (LOYALTY & GAMIFICATION) — P0 & P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_fatura_id 
  ON public.pontos_movimentacoes (fatura_id);

CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_cliente_data 
  ON public.pontos_movimentacoes (cliente_id, data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_tipo 
  ON public.pontos_movimentacoes (tipo);

CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_data 
  ON public.pontos_movimentacoes (data_movimentacao DESC);

-- ------------------------------------------------------------------------------------
-- 5. VOUCHERS & RESGATES — P0 & P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_gsa_voucher_resgates_voucher_id 
  ON public.gsa_voucher_resgates (voucher_id);

CREATE INDEX IF NOT EXISTS idx_gsa_voucher_resgates_cliente_id 
  ON public.gsa_voucher_resgates (cliente_id);

CREATE INDEX IF NOT EXISTS idx_gsa_voucher_resgates_voucher_cliente 
  ON public.gsa_voucher_resgates (voucher_id, cliente_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_status 
  ON public.vouchers (status);

CREATE INDEX IF NOT EXISTS idx_vouchers_validade 
  ON public.vouchers (validade);

CREATE INDEX IF NOT EXISTS idx_vouchers_cliente_status 
  ON public.vouchers (cliente_id, status);

-- ------------------------------------------------------------------------------------
-- 6. SAQUES (CLIENT WITHDRAWALS) — P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_saques_cliente_status 
  ON public.saques (cliente_id, status);

CREATE INDEX IF NOT EXISTS idx_saques_cliente_data_solicitacao 
  ON public.saques (cliente_id, data_solicitacao DESC);

CREATE INDEX IF NOT EXISTS idx_saques_fila_pendente 
  ON public.saques (status, data_solicitacao) 
  WHERE status IN ('pendente', 'solicitado');

-- ------------------------------------------------------------------------------------
-- 7. ORDENS COMPRA (MARKETPLACE PURCHASE ORDERS) — P0 & P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ordens_compra_produto_id 
  ON public.ordens_compra (produto_id);

CREATE INDEX IF NOT EXISTS idx_ordens_compra_status 
  ON public.ordens_compra (status);

CREATE INDEX IF NOT EXISTS idx_ordens_compra_cliente_status 
  ON public.ordens_compra (cliente_id, status);

CREATE INDEX IF NOT EXISTS idx_ordens_compra_cliente_data 
  ON public.ordens_compra (cliente_id, data_criacao DESC);

-- ------------------------------------------------------------------------------------
-- 8. CARTEIRA LANCAMENTOS (WALLET LEDGER) — P0 (Sort Elimination)
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_carteira_lancamentos_cliente_data 
  ON public.carteira_lancamentos (cliente_id, data_lancamento DESC);

CREATE INDEX IF NOT EXISTS idx_carteira_lancamentos_tipo 
  ON public.carteira_lancamentos (tipo);

-- ------------------------------------------------------------------------------------
-- 9. PARCEIROS RESGATES & RECURSOS — P0 & P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_recursos_resgate_id 
  ON public.parceiros_resgates_recursos (resgate_id);

CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_eventos_recurso_id 
  ON public.parceiros_resgates_eventos (recurso_id);

CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_status 
  ON public.parceiros_resgates (status);

CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_codigo_gerado 
  ON public.parceiros_resgates (codigo_gerado);

-- ------------------------------------------------------------------------------------
-- 10. PRESTADORES (FATURAS E SAQUES) — P0 & P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prestador_faturas_demanda_id 
  ON public.prestador_faturas (demanda_id);

CREATE INDEX IF NOT EXISTS idx_prestador_faturas_status 
  ON public.prestador_faturas (status);

CREATE INDEX IF NOT EXISTS idx_prestador_saques_status 
  ON public.prestador_saques (status);

CREATE INDEX IF NOT EXISTS idx_prestador_saques_prestador_created 
  ON public.prestador_saques (prestador_id, created_at DESC);

-- ------------------------------------------------------------------------------------
-- 11. AFILIADOS (SAQUES) — P0 & P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_gsa_afiliado_saques_afiliado_id 
  ON public.gsa_afiliado_saques (afiliado_id);

CREATE INDEX IF NOT EXISTS idx_gsa_afiliado_saques_afiliado_data 
  ON public.gsa_afiliado_saques (afiliado_id, solicitado_em DESC);

-- ------------------------------------------------------------------------------------
-- 12. LOJA CREDITO (SAQUES DE LIMITE) — P0 & P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_loja_credito_saques_fatura_id 
  ON public.loja_credito_saques (fatura_id);

CREATE INDEX IF NOT EXISTS idx_loja_credito_saques_movimentacao_id 
  ON public.loja_credito_saques (movimentacao_id);

CREATE INDEX IF NOT EXISTS idx_loja_credito_saques_cliente_data 
  ON public.loja_credito_saques (cliente_id, created_at DESC);

-- ------------------------------------------------------------------------------------
-- 13. PRODUTOS E VARIANTES (MARKETPLACE CATALOG) — P1
-- ------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_produto_variantes_sku 
  ON public.produto_variantes (sku);

CREATE INDEX IF NOT EXISTS idx_produto_variantes_codigo_barras 
  ON public.produto_variantes (codigo_barras);

CREATE INDEX IF NOT EXISTS idx_produtos_status_created 
  ON public.produtos (status, created_at DESC);
```

---

## 5. IMPACTO ESTIMADO DE PERFORMANCE

| Cenário de Operação | Sem os Índices (Estado Atual) | Com os Índices (Estado Alvo) | Ganho Estimado |
|---|---|---|---|
| **Abertura de Chamado / Chat de Suporte** | `Seq Scan on ticket_mensagens` (O(N)) | `Index Scan via idx_ticket_mensagens_ticket_data` (O(log N)) | **90% a 99% redução de I/O** |
| **Listagem de Chamados do Cliente** | `Seq Scan on tickets` | `Index Scan via idx_tickets_cliente_status` | **Eliminação de Seq Scan** |
| **Extrato de Pontos do Cliente** | `Index Scan` + `Sort: data_movimentacao DESC` | `Index Scan via idx_pontos_movimentacoes_cliente_data` | **Eliminação da fase de Sort** |
| **Extrato Financeiro da Carteira** | `Index Scan` + `Sort: data_lancamento DESC` | `Index Scan via idx_carteira_lancamentos_cliente_data` | **Eliminação da fase de Sort** |
| **Renovação Noturna de Assinaturas (Cron)** | `Seq Scan on ordens_assinatura` | `Index Scan via idx_ordens_assinatura_renovacao_cron` | **Redução de tempo de execução no cron** |
| **Resgate de Vouchers (RPC)** | `Seq Scan on gsa_voucher_resgates` | `Index Scan via idx_gsa_voucher_resgates_voucher_cliente` | **Latência sub-milissegundo** |
| **Exclusão/Cascata de Clientes/Faturas** | Locks demorados por varredura reversa de FKs | Resolução direta de integridade referencial via índices de FK | **Prevenção de Deadlocks** |
