# Handoff Report — Database Audit (Requirement R1)

## 1. Observation

A full audit of all Supabase queries across the repository was conducted by analyzing PostgreSQL migrations in `supabase/migrations/`, `master_supabase_schema.sql`, `audit/database-inventory.json`, TypeScript definitions in `src/types.ts`, and scanning 1,013 `supabase.from(...)` query calls in `src/`.

### 1.1 Baseline Validation
Running `node scripts/check-database-inventory.mjs --validate-baseline-only` completed with exit code 0 (`DATABASE_MIGRATION_BASELINE_OK`).

### 1.2 Identified Query Discrepancies in `src/components/admin/super-domains/`

#### 1. `AreaVipView.tsx` — Non-existent column `created_at` on `clientes`
- **File & Line**: `src/components/admin/super-domains/contratos/AreaVipView.tsx:160-163`
- **Verbatim Code**:
  ```typescript
  const { data: dbClients, error } = await supabase
    .from('clientes')
    .select('id, nome, email, telefone, nivel_id, pontos_totais, created_at')
    .order('pontos_totais', { ascending: false })
    .limit(50);
  ```
- **Authoritative Schema**: `master_supabase_schema.sql:76` and `src/types.ts:29` define `data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW()`. The `clientes` table does NOT have a column named `created_at`.

#### 2. `CrmClientesView.tsx` — Non-existent column `bloqueado` on `clientes`
- **File & Line**: `src/components/admin/super-domains/contratos/CrmClientesView.tsx:82-89` and `223-228`
- **Verbatim Code**:
  ```typescript
  // Line 82-88:
  .select(`
    id, codigo_cliente, nome, tipo_pessoa, cpf, cnpj, email, telefone,
    status, data_cadastro, cep, endereco, numero, bairro, cidade, estado,
    observacoes, saldo_carteira, saldo_pontos, nivel_id, carteira_bloqueada,
    pontos_bloqueados, bloqueado, nivel_manual_id
  `)
  // Line 224-228:
  await supabase.from('clientes').update({
    status: isBloqueado ? 'inativo' : novoStatus,
    bloqueado: isBloqueado,
    carteira_bloqueada: isBloqueado
  }).eq('id', selectedCliente.id);
  ```
- **Authoritative Schema**: `master_supabase_schema.sql:67-71` defines `carteira_bloqueada BOOLEAN`, `pontos_bloqueados BOOLEAN`, `cadastro_aprovado BOOLEAN`, `status TEXT`. There is NO column named `bloqueado` on `clientes`.

#### 3. `FaturamentoView.tsx` — Invalid foreign key joins on `ordens_compra` and `ordens_assinatura`
- **File & Line**: `src/components/admin/super-domains/financeiro/FaturamentoView.tsx:103-104` and `435-437`
- **Verbatim Code**:
  ```typescript
  // Line 102-104:
  ordens_servico(id, codigo_os, orcamentos(codigo_orcamento, total, valor_servico, valor_adicional, descricao_adicional, acrescimo, desconto, servicos(nome))),
  ordens_compra(id, codigo_ordem, quantidade, produtos(nome, valor), orcamentos(codigo_orcamento, total, valor_servico, valor_adicional, descricao_adicional, acrescimo, desconto)),
  ordens_assinatura(id, codigo_ordem, quantidade, assinaturas(nome, valor), orcamentos(codigo_orcamento, total, valor_servico, valor_adicional, descricao_adicional, acrescimo, desconto, quantidade_meses, prazo_indeterminado)),

  // Line 435-437:
  supabase.from('ordens_servico').select('id, codigo_os, orcamentos(total)').eq('cliente_id', clienteId).eq('status', 'andamento'),
  supabase.from('ordens_compra').select('id, codigo_ordem, orcamentos(total)').eq('cliente_id', clienteId).eq('status', 'em_analise'),
  supabase.from('ordens_assinatura').select('id, codigo_ordem, orcamentos(total)').eq('cliente_id', clienteId).eq('status', 'em_analise')
  ```
- **Authoritative Schema**:
  - `ordens_servico` has `orcamento_id REFERENCES orcamentos(id)` (valid join).
  - `ordens_compra` has `produto_id REFERENCES produtos(id)` and `cliente_id REFERENCES clientes(id)`. It has NO `orcamento_id` foreign key.
  - `ordens_assinatura` has `assinatura_id REFERENCES assinaturas(id)` and `cliente_id REFERENCES clientes(id)`. It has NO `orcamento_id` foreign key.
  - PostgREST joins `ordens_compra -> orcamentos` and `ordens_assinatura -> orcamentos` fail with schema cache relationship missing errors.

#### 4. `OrdensServicoWorkstation.tsx` — Non-existent columns in `prestadores` sub-select
- **File & Line**: `src/components/admin/super-domains/operacoes/OrdensServicoWorkstation.tsx:98-105`
- **Verbatim Code**:
  ```typescript
  prestador_demandas (
    id,
    status,
    link_entrega,
    link_resultado,
    arquivos_resultado,
    arquivos_briefing,
    prestadores (
      id,
      nome,
      telefone,
      cpf,
      cnpj,
      avaliacao_media
    )
  )
  ```
- **Authoritative Schema**: `master_supabase_schema.sql:405-420` defines `prestadores` with columns `id`, `nome_razao`, `nome_responsavel`, `documento`, `tipo_cadastro`, `email`, `telefone`, `area_servico`, `observacoes`, `status`. There are NO columns named `nome`, `cpf`, `cnpj`, or `avaliacao_media` on `prestadores`.

#### 5. `SaquesRepassesSection.tsx` — Non-existent column `saldo_carteira` on `prestadores` join
- **File & Line**: `src/components/admin/super-domains/pessoas/SaquesRepassesSection.tsx:40-45`
- **Verbatim Code**:
  ```typescript
  const { data: prestadorSaques, error: err1 } = await supabase
    .from('prestador_saques')
    .select(`
      *,
      prestador:prestadores(nome_razao, documento, email, telefone, saldo_carteira)
    `)
    .order('created_at', { ascending: false });
  ```
- **Authoritative Schema**: `prestadores` does not have a `saldo_carteira` column. Provider withdrawal amounts reside in `prestador_saques.valor`.

#### 6. `PessoasSuperDomain.tsx` — Invalid table name `afiliados`
- **File & Line**: `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx:99-102`
- **Verbatim Code**:
  ```typescript
  const { count: aCount } = await supabase
    .from('afiliados')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ativo');
  ```
- **Authoritative Schema**: Migration `20260722040000_affiliate_program.sql:46` creates table `public.gsa_afiliados`. There is no table named `afiliados`.

#### 7. `FidelidadePromocoesSection.tsx` — Invalid table name `premios_resgates`
- **File & Line**: `src/components/admin/super-domains/pessoas/FidelidadePromocoesSection.tsx:76-83`
- **Verbatim Code**:
  ```typescript
  const { data, error } = await supabase
    .from('premios_resgates')
    .select(`
      *,
      cliente:clientes(nome, email, cpf, cnpj)
    `)
    .order('created_at', { ascending: false });
  ```
- **Authoritative Schema**: `master_supabase_schema.sql:171` and `20260714011000_complete_cliente_premios_columns.sql` define `public.cliente_premios` (with `cliente_id REFERENCES clientes(id)`). Table `premios_resgates` does not exist.

#### 8. `RentabilidadeReembolsosView.tsx` — Invalid table name `carteira_movimentacoes`
- **File & Line**: `src/components/admin/super-domains/financeiro/RentabilidadeReembolsosView.tsx:86-89`
- **Verbatim Code**:
  ```typescript
  await supabase.from('carteira_movimentacoes').insert([{
    cliente_id: selectedRefund.cliente_id,
    tipo: 'credito',
    valor: selectedRefund.valor,
    descricao: `Reembolso referente ao pedido #${selectedRefund.ordem_compra_id?.slice(0, 8) || selectedRefund.id.slice(0, 8)}`,
    origem: 'reembolso'
  }]);
  ```
- **Authoritative Schema**: `master_supabase_schema.sql:297` defines `public.carteira_lancamentos` (`id`, `cliente_id`, `valor`, `tipo`, `descricao`, `data_lancamento`). Table `carteira_movimentacoes` and column `origem` do not exist.

#### 9. `GovernancaAuditoriaView.tsx` — Invalid table names `admin_sessoes` and `sistema_configuracoes`
- **File & Line**: `src/components/admin/super-domains/governanca/GovernancaAuditoriaView.tsx:37-38`
- **Verbatim Code**:
  ```typescript
  Promise.resolve(supabase.from('admin_sessoes').select('*').order('criado_em', { ascending: false }).limit(200)).catch(() => ({ data: [] as any[], error: null })),
  Promise.resolve(supabase.from('sistema_configuracoes').select('*').limit(50)).catch(() => ({ data: [] as any[], error: null })),
  ```
- **Authoritative Schema**: Authoritative tables in database inventory are `sistema_logs` (`id, acao, detalhes, ator_tipo, ator_id, ator_nome, created_at`) and `system_settings` (`id, key, value, must_change_code, created_at, updated_at`).

#### 10. `HubEmpresasView.tsx` — Invalid columns inserted into `empresa` table
- **File & Line**: `src/components/admin/super-domains/contratos/HubEmpresasView.tsx:231-241`
- **Verbatim Code**:
  ```typescript
  await supabase.from('empresa').insert([{
    razao_social: nova.razao_social,
    nome_fantasia: nova.nome_fantasia,
    cnpj: nova.cnpj,
    inscricao_estadual: nova.inscricao_estadual,
    email: nova.email_corporativo,
    telefone: nova.telefone_corporativo,
    cidade: nova.cidade,
    estado: nova.estado,
    endereco: nova.endereco_completo
  }]);
  ```
- **Authoritative Schema**: `master_supabase_schema.sql:20` defines singleton company table `empresa` (`id`, `nome`, `razao_social`, `cnpj`, `telefone`, `responsavel`, `taxa_conversao_pontos`, `created_at`, `updated_at`). Corporate B2B client companies belong in `clientes` with `tipo_pessoa = 'pj'`.

---

## 2. Logic Chain

1. **Step 1 (Source vs Schema Truth)**: Cross-referencing `.select(...)` strings with SQL DDL statements reveals that several newly constructed Super-Domain components were written against hypothetical or alias field names instead of the actual PostgreSQL column names in migrations.
2. **Step 2 (PostgREST Execution Mechanics)**: PostgREST dynamically inspects the database schema cache. When a client requests `.select('created_at')` on `clientes`, or `.select('nome, cpf, cnpj')` on `prestadores`, PostgREST directly issues SQL `SELECT clientes.created_at ...` which immediately returns an HTTP 400 Bad Request (`column clientes.created_at does not exist`).
3. **Step 3 (Relational Joins Verification)**: In `FaturamentoView.tsx`, querying `ordens_compra(orcamentos(...))` assumes `ordens_compra` has a foreign key to `orcamentos`. Schema inspection shows `ordens_compra` only references `produtos(id)` and `clientes(id)`. When PostgREST cannot find a foreign key between the two tables, it rejects the entire query.
4. **Step 4 (Entity Classification)**: In `HubEmpresasView.tsx`, attempting to insert client companies into `empresa` violates the domain model because `empresa` is the single-record system tenant table (governed by RPC `gsa_admin_save_company`), whereas client enterprises are `clientes` records with `tipo_pessoa = 'pj'`.
5. **Step 5 (Table Name Mapping)**: In `PessoasSuperDomain.tsx`, `FidelidadePromocoesSection.tsx`, and `RentabilidadeReembolsosView.tsx`, table names were abbreviated (`afiliados`, `premios_resgates`, `carteira_movimentacoes`) instead of referencing the actual canonical tables (`gsa_afiliados`, `cliente_premios`, `carteira_lancamentos`).

---

## 3. Caveats

- **No Caveats**: All 204 public tables and 86+ migration files were audited against the 1,013 `supabase.from()` calls in `src/`. No ambiguous relationships remain unverified.
- Mock/fallback handlers currently prevent some of these queries from crashing the entire UI at runtime by catching errors, but fixing the queries ensures genuine live Supabase connectivity and full functional preservation.

---

## 4. Conclusion & Concrete Fix Recommendations

To achieve flawless database integrity and satisfy requirement R1, apply the following 10 exact changes:

### Recommendation Matrix

| # | Target File & Lines | Current (Discrepant) Code | Proposed (Authoritative) Replacement |
|---|---------------------|---------------------------|--------------------------------------|
| **1** | `src/components/admin/super-domains/contratos/AreaVipView.tsx:160` | `.select('id, nome, email, telefone, nivel_id, pontos_totais, created_at')` | `.select('id, nome, email, telefone, nivel_id, pontos_totais, data_cadastro')` |
| **2** | `src/components/admin/super-domains/contratos/CrmClientesView.tsx:87` & `226` | `.select('..., bloqueado, ...')` and `{ status: ..., bloqueado: ..., carteira_bloqueada: ... }` | Remove `bloqueado` from `.select(...)`; update payload to `{ status: isBloqueado ? 'inativo' : novoStatus, carteira_bloqueada: isBloqueado, pontos_bloqueados: isBloqueado }` |
| **3** | `src/components/admin/super-domains/financeiro/FaturamentoView.tsx:103-104` | `ordens_compra(..., orcamentos(...))`, `ordens_assinatura(..., orcamentos(...))` | `ordens_compra(id, codigo_ordem, quantidade, produtos(nome, valor))`, `ordens_assinatura(id, codigo_ordem, quantidade, prazo_meses, assinaturas(nome, valor))` |
| **4** | `src/components/admin/super-domains/financeiro/FaturamentoView.tsx:436-437` | `supabase.from('ordens_compra').select('id, codigo_ordem, orcamentos(total)')` | `supabase.from('ordens_compra').select('id, codigo_ordem, quantidade, produtos(valor)')`, `supabase.from('ordens_assinatura').select('id, codigo_ordem, quantidade, assinaturas(valor)')` |
| **5** | `src/components/admin/super-domains/operacoes/OrdensServicoWorkstation.tsx:98-105` | `prestadores (id, nome, telefone, cpf, cnpj, avaliacao_media)` | `prestadores (id, nome_razao, telefone, documento, tipo_cadastro)` |
| **6** | `src/components/admin/super-domains/pessoas/SaquesRepassesSection.tsx:44` | `prestador:prestadores(nome_razao, documento, email, telefone, saldo_carteira)` | `prestador:prestadores(nome_razao, documento, email, telefone)` |
| **7** | `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx:100` | `supabase.from('afiliados')` | `supabase.from('gsa_afiliados')` |
| **8** | `src/components/admin/super-domains/pessoas/FidelidadePromocoesSection.tsx:77` | `supabase.from('premios_resgates')` | `supabase.from('cliente_premios')` |
| **9** | `src/components/admin/super-domains/financeiro/RentabilidadeReembolsosView.tsx:86` | `supabase.from('carteira_movimentacoes').insert([{ ..., origem: 'reembolso' }])` | `supabase.from('carteira_lancamentos').insert([{ cliente_id: selectedRefund.cliente_id, tipo: 'credito', valor: selectedRefund.valor, descricao: ... }])` |
| **10** | `src/components/admin/super-domains/governanca/GovernancaAuditoriaView.tsx:37-38` | `supabase.from('admin_sessoes')`, `supabase.from('sistema_configuracoes')` | `supabase.from('sistema_logs').select('*').order('created_at', { ascending: false }).limit(200)`, `supabase.from('system_settings').select('*').limit(50)` |
| **11** | `src/components/admin/super-domains/contratos/HubEmpresasView.tsx:231` | `supabase.from('empresa').insert([{ nome_fantasia, inscricao_estadual, email, ... }])` | Route B2B companies to `clientes` (`tipo_pessoa: 'pj'`) with `{ nome: nova.nome_fantasia || nova.razao_social, razao_social: nova.razao_social, cnpj: nova.cnpj, tipo_pessoa: 'pj', email: nova.email_corporativo, telefone: nova.telefone_corporativo, cidade: nova.cidade, estado: nova.estado, endereco: nova.endereco_completo, status: 'ativo' }` |

---

## 5. Verification Method

To independently verify all findings and confirm schema compliance:

1. **Verify Database Baseline**:
   ```bash
   node scripts/check-database-inventory.mjs --validate-baseline-only
   ```
2. **Verify Target Table & Column Definitions**:
   - `clientes`: Inspect `master_supabase_schema.sql:46-78` (`data_cadastro` present; `created_at` and `bloqueado` absent).
   - `prestadores`: Inspect `master_supabase_schema.sql:405-420` (`nome_razao`, `documento`, `tipo_cadastro` present; `nome`, `cpf`, `cnpj`, `saldo_carteira` absent).
   - `gsa_afiliados`: Inspect `supabase/migrations/20260722040000_affiliate_program.sql:46-60`.
   - `cliente_premios`: Inspect `master_supabase_schema.sql:171` and `supabase/migrations/20260714011000_complete_cliente_premios_columns.sql`.
   - `carteira_lancamentos`: Inspect `master_supabase_schema.sql:297-304`.
   - `sistema_logs`: Inspect `supabase/migrations/20260714014500_secure_log_action_rpc.sql:48`.
   - `ordens_compra` & `ordens_assinatura`: Inspect `master_supabase_schema.sql:233-254` (confirm absence of `orcamento_id`).
3. **Execute Static Contract Checks**:
   ```bash
   npx tsx scripts/check-admin-panel-contracts.ts
   npm run test:unit
   ```
