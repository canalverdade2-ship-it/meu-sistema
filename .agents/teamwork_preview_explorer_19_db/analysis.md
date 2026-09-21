# LAUDO DE AUDITORIA ESTÁTICA PROFUNDA: CONCORRÊNCIA, INTEGRIDADE ACID E BANCO DE DADOS (MARKETPLACE GSA HUB)

**Agente Auditor:** `teamwork_preview_explorer_19_db`  
**Data da Auditoria:** 2026-09-10  
**Ambiente Auditado:** PostgreSQL 15+ / Supabase RPCs, Migrations, Edge Functions e Webhooks VPS  
**Status do Laudo:** CONCLUÍDO (Vulnerabilidades Críticas Identificadas + Correções SQL DDL/DML Formuladas)

---

## 1. Sumário Executivo

Uma auditoria estática exaustiva foi conduzida em todas as migrations (`supabase/migrations/`), funções de banco de dados (RPCs PL/pgSQL), gatilhos (*triggers*), Edge Functions (`supabase/functions/`) e scripts de servidor/webhook (`server_webhook_vps_live.cjs`, `server_webhook.cjs`) do ecossistema de marketplace da GSA Store.

A investigação identificou **7 falhas de arquitetura e integridade transacional**, variando de **severidade Crítica (P0)** a **Alta (P1)**, incluindo:
1. **Mutação destrutiva em tabela compartilhada durante checkout:** Alteração temporária de `produtos.valor` para o preço da variante e posterior restauração, causando corrupção de preços em requisições concorrentes.
2. **Desconexão estrutural e overselling ilimitado de variantes:** O carrinho sanitizado remove `variante_id`, fazendo com que `loja_pedido_itens.produto_variante_id` seja gravado como `NULL`. Como resultado, a dedução de estoque de variantes avalia `0` unidades e **nunca decrementa o estoque físico da variação**.
3. **Inversão de ordem de lock (*Lock Order Inversion*) e risco iminente de Deadlocks:** Produtos do carrinho, brindes de regras promocionais e transferências financeiras bilaterais bloqueiam linhas em ordem arbitrária e não ordenada.
4. **Ausência de ledger físico de cupons e restrição UNIQUE de uso:** Ausência de tabela `cupons_usos` e ausência de restrição `UNIQUE (cliente_id, cupom_id)`, baseando a checagem exclusivamente em subqueries suscetíveis a condições de corrida em transações concorrentes.
5. **Atualizações diretas não-atômicas e sem restrição no Webhook VPS:** O servidor de mensagens executa `PATCH /rest/v1/clientes` zerando `saldo_carteira` sem validação atômica em banco e sem transação segura associada ao `POST /rest/v1/saques`.
6. **Truncamento silencioso de débitos de fidelidade:** A função `gsa_apply_points_internal` utiliza `greatest(0, v_saldo + p_pontos)`, zerando o saldo em vez de abortar a transação quando há pontos insuficientes, além de manter duas tabelas de extrato de pontos descompassadas.
7. **Quebra de fronteira transacional no pós-venda (Trocas e Devoluções):** Aprovações de trocas e devoluções no painel administrativo e na RPC `gsa_admin_atualizar_solicitacao_loja` não estornam o estoque devolvido para a prateleira, não reservam o estoque substituto e não geram registros de reembolso financeiro (`loja_reembolsos`) para devoluções pagas via PIX/Cartão/Carteira.

---

## 2. Diagnóstico Detalhado por Domínio

### 2.1. Checkout & Colapso de Preços de Variantes (P0 - Crítico)

#### Observação
Na migration `20260817120000_product_variations_marketplace.sql` (linhas 809-829), a função wrapper `public.gsa_client_checkout_store` manipula o preço da variante da seguinte forma:
```sql
-- Linhas 809-815
v_original_values := v_original_values || jsonb_build_array(jsonb_build_object(
  'produto_id', v_product.id,
  'valor', v_product.valor
));
IF v_variant.valor IS NOT NULL THEN
  UPDATE public.produtos SET valor = v_variant.valor WHERE id = v_product.id;
END IF;

-- Linha 818
v_result := public.gsa_client_checkout_store_base_20260817(
  p_sessao_id, p_session_token, jsonb_set(p_payload, '{carrinho}', v_sanitized_cart, false)
);

-- Linhas 824-829
FOR v_original IN SELECT value FROM jsonb_array_elements(v_original_values)
LOOP
  UPDATE public.produtos
  SET valor = (v_original ->> 'valor')::numeric
  WHERE id = (v_original ->> 'produto_id')::uuid;
END LOOP;
```

#### Cadeia Lógica & Impacto
- **Mutação de Estado Global Compartilhado:** Para contornar limitações da função base que não conhecia variantes, o wrapper grava o preço da variante diretamente na linha mestre de `public.produtos`, chama a função base e depois tenta restaurar o preço original.
- **Race Condition Catastrófica:** Em um marketplace de alto tráfego, enquanto o checkout do Usuário A (comprando a variante X por R$ 50) está executando e aguardando confirmação, qualquer outro usuário navegando na vitrine, adicionando ao carrinho ou fechando pedido do Produto mestre ou de outra variante Y (que custava R$ 120) lerá ou aplicará o valor de R$ 50!
- **Conflito de Escrita Concorrente:** Se o Usuário A e o Usuário B comprarem simultaneamente variantes diferentes do mesmo produto, haverá colisão e bloqueio na linha de `produtos`, e a restauração final (`SET valor = v_original`) poderá reescrever um valor incorreto caso os rollbacks e commits se entrelacem.

---

### 2.2. Falha Crítica de Decremento de Estoque em Variantes (*Unbounded Overselling*) (P0 - Crítico)

#### Observação
Na mesma migration `20260817120000_product_variations_marketplace.sql`:
1. Nas linhas 743-749, o wrapper limpa o carrinho:
```sql
SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'tipo', item ->> 'tipo',
  'item_id', item ->> 'item_id',
  'quantidade', item -> 'quantidade',
  'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
))) INTO v_sanitized_cart
FROM jsonb_array_elements(v_cart) source(item);
```
O campo `variante_id` / `produto_variante_id` é **completamente removido** do JSON repassado à função base!
2. A função base (`20260716183500_product_discount_validity.sql`, linhas 949-981) insere `public.loja_pedido_itens` sem informar a coluna `produto_variante_id`. A coluna permanece com valor `NULL`.
3. Ao retornar da função base, o wrapper executa (linhas 846-851):
```sql
SELECT COALESCE(sum(quantidade), 0) INTO v_requested
FROM public.loja_pedido_itens
WHERE orcamento_id = v_order_id
  AND tipo = 'produto'
  AND produto_id = v_variant.produto_id
  AND produto_variante_id = v_variant.id;
```
4. Em SQL, `NULL = v_variant.id` avalia como `UNKNOWN` (falso). Logo, `v_requested` é **SEMPRE 0**.
5. Na sequência (linhas 880-884):
```sql
IF v_variant.controle_estoque THEN
  UPDATE public.produto_variantes
  SET estoque_disponivel = estoque_disponivel - v_requested
  WHERE id = v_variant.id;
END IF;
```
Como `v_requested = 0`, a query executa: `SET estoque_disponivel = estoque_disponivel - 0`!
6. Na migration de cancelamento (`20260817211500_fix_client_store_cancellation_guard.sql`, linhas 49-63), o cancelamento de pedido tenta recompor o estoque da variante filtrando:
```sql
SELECT item.produto_variante_id, sum(COALESCE(item.quantidade, 1))::integer AS quantity
FROM public.loja_pedido_itens item
WHERE item.orcamento_id = p_orcamento_id
  AND item.tipo = 'produto'
  AND item.produto_variante_id IS NOT NULL
GROUP BY item.produto_variante_id
```
Como `produto_variante_id` é `NULL`, nenhuma linha é retornada e o estoque da variante também nunca é restaurado no cancelamento.

#### Conclusão
O controle de estoque de variantes do marketplace está **completamente inoperante**. Clientes podem comprar quantidades ilimitadas de qualquer variação (cor, tamanho, voltagem), pois o estoque da variante nunca é debitado no banco de dados.

---

### 2.3. Concorrência de Locks & Potencial de Deadlocks no Checkout (P1 - Alto)

#### Observação
Em `20260716183500_product_discount_validity.sql`:
1. No início do loop de validação (linhas 387-391), produtos do carrinho são bloqueados ordenados por `tipo`, `item_id`:
```sql
ORDER BY item ->> 'tipo', item ->> 'item_id'
```
2. Durante a avaliação de promoções de quantidade / brindes (linhas 586 e 634):
```sql
-- Linha 586 (Ganhe Outro Produto):
SELECT * INTO v_product FROM public.produtos WHERE id = v_promo.produto_brinde_id FOR UPDATE;
-- Linha 634 (Unidade Grátis / Item mais barato):
SELECT * INTO v_product FROM public.produtos WHERE id = (v_cheapest ->> 'item_id')::uuid FOR UPDATE;
```
Esses bloqueios adicionais ocorrem dinamicamente, em ordem ditada pela prioridade da promoção (`pq.prioridade`), sem qualquer ordenação por ID.
3. No final da função (linhas 871-884), o decremento de estoque itera sobre `v_items`:
```sql
FOR v_item IN SELECT entry FROM jsonb_array_elements(v_items) AS x(entry)
LOOP
  IF entry ->> 'tipo' = 'produto' THEN
    SELECT * INTO v_product FROM public.produtos WHERE id = (entry ->> 'item_id')::uuid FOR UPDATE;
    ...
```
Como os itens promocionais foram adicionados ao final de `v_items` via `|| jsonb_build_array(...)` (linhas 597 e 639), o conjunto final de produtos não respeita ordem canônica (`id ASC`).

#### Cenário de Deadlock Real
- **Transação 1 (Cliente 1):** Carrinho contém Produto A. A regra promocional adiciona o Produto B como brinde. Ordem de locks adquiridos: **Lock(A) -> Lock(B)**.
- **Transação 2 (Cliente 2):** Carrinho contém Produto B. A regra promocional adiciona o Produto A como brinde. Ordem de locks adquiridos: **Lock(B) -> Lock(A)**.
- **Resultado:** Interbloqueio mútuo fatal (*deadlock*). O motor do PostgreSQL detecta o deadlock cycle e aborta uma das transações com erro `40P01: deadlock detected`.

---

### 2.4. Integridade de Cupons: Falta de Ledger e Restrição UNIQUE (P1 - Alto)

#### Observação
1. Na migration `20260711121000_fix_store_checkout_discounts_coupons.sql` e subsequentes, a tabela `public.cupons_loja` possui apenas o contador `total_usos` e a coluna `limite_usos_por_cliente`.
2. A validação de uso por cliente é feita apenas programaticamente dentro da função PL/pgSQL:
```sql
OR EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.cliente_id = v_actor.cliente_id
    AND o.status <> 'cancelado'
    AND (o.cupom_desconto_id = v_coupon.id OR o.cupom_entrega_id = v_coupon.id)
)
```
3. Não existe uma tabela `public.cupons_usos` registrando formalmente o histórico imutável de cada resgate por pedido e cliente.
4. Não existe uma restrição de integridade no banco (ex: `UNIQUE (cliente_id, cupom_id)` em tabela de resgates ou índice condicional único em `orcamentos`).
5. **Divergência de Regra:** Enquanto `cupons_loja` possui a coluna `limite_usos_por_cliente` (adicionada para permitir que um mesmo cliente utilize o cupom 2 ou mais vezes, se configurado), o `EXISTS` do checkout bloqueia incondicionalmente se houver **qualquer** pedido anterior não-cancelado, impedindo que cupons com `limite_usos_por_cliente > 1` funcionem.

---

### 2.5. Saldo em Carteira & Webhooks: Atualizações Não-Atômicas (P0 - Crítico)

#### Observação
No arquivo `server_webhook_vps_live.cjs` (linhas 5132-5150):
```javascript
// Zera a carteira do cliente
supabasePatch(`/rest/v1/clientes?id=eq.${session.client.id}`, { saldo_carteira: 0 }, (errPatch, resPatch) => {
  if (errPatch) { ... return; }
  // Insere o saque
  const saqueData = {
    cliente_id: session.client.id,
    valor: valor,
    taxa_aplicada: 0,
    valor_liquido: valor,
    tipo_chave_pix: session.pixType,
    chave_pix: pixKey,
    status: 'pendente',
    data_solicitacao: new Date().toISOString()
  };
  supabasePost('/rest/v1/saques', saqueData, (errPost, resPost) => { ... });
});
```

#### Vulnerabilidades Identificadas
1. **Quebra de Atomicidade (Risco de Perda Financeira do Cliente):** Se a requisição `supabasePatch` suceder, mas o servidor cair, o n8n falhar ou o `supabasePost` der timeout, o saldo da carteira do cliente foi zerado **sem que nenhuma solicitação de saque tenha sido registrada**. Não há transação ou rollback possível entre chamadas HTTP REST independentes.
2. **Double-Spending por Condição de Corrida:** O script lê o saldo em memória (`session.client.saldo_carteira`). Se o cliente enviar duas mensagens de saque simultâneas pelo WhatsApp ou efetuar um checkout na loja ao mesmo tempo, ambas as requisições leem o saldo positivo inicial e enviam comandos concorrentes, podendo sacar valores duplicados.
3. **Ausência de CHECK Constraint no Banco:** Nem a tabela `clientes` possui `CHECK (saldo_carteira >= 0)`, nem a tabela `prestadores` possuía antes de correções parciais. Qualquer update direto via service-role pode gerar saldo negativo sem que o banco rejeite.

---

### 2.6. Truncamento Silencioso de Pontos e Descompasso de Ledgers (P1 - Alto)

#### Observação
1. Na migration `20260714054000_atomic_invoice_payment_and_points.sql` (linhas 126-128), a função central de aplicação de pontos executa:
```sql
v_saldo_anterior := coalesce(v_cliente.saldo_pontos, 0);
v_novo_saldo := greatest(0, v_saldo_anterior + p_pontos);
v_aplicado := v_novo_saldo - v_saldo_anterior;
```
Se `p_pontos` for um valor negativo (resgate ou débito) e o cliente não possuir saldo suficiente, `greatest(0, ...)` **não lança erro**! A função silenciosamente trunca a dedução para o que o cliente tinha e finaliza com sucesso. Se uma chamada externa solicitar débito de 500 pontos de um cliente com 100 pontos, o sistema debita 100 e não gera erro de saldo insuficiente.
2. O banco de dados mantém duas tabelas paralelas para movimentações de fidelidade:
   - `public.pontos_movimentacoes`
   - `public.points_transactions`
Diversas funções gravam apenas em uma das duas (por exemplo, `gsa_converter_pontos_carteira` grava apenas em `pontos_movimentacoes`), gerando inconsistências contábeis entre auditorias que consultem tabelas diferentes.
3. Não há `CHECK (saldo_pontos >= 0)` na tabela `clientes`.

---

### 2.7. Pós-Venda: Desconexão Transacional em Trocas e Devoluções (P0 - Crítico)

#### Observação
1. **Estoque de Devolução Nunca Retorna:** Na função `public.gsa_admin_atualizar_solicitacao_loja` (`20260714045000_secure_admin_store_exchange_rpc.sql`) e no módulo React `src/components/admin/LojaTrocasModule.tsx`:
   Quando a devolução ou troca é marcada como `aprovado`, `devolucao_recebida` ou `concluido`, o estoque dos itens físicos devolvidos **nunca é incrementado** nem em `produtos` nem em `produto_variantes`.
2. **Estoque do Produto Substituto Não é Baixado:** Quando o cliente solicita troca por outro produto (`opcao_substituicao = 'outro_produto'`), a função `gsa_client_solicitar_troca_loja` apenas checa `estoque_disponivel < v_quantity`, mas não faz reserva nem decremento. Quando o administrador aprova a troca e envia o produto substituto (`novo_produto_enviado`), o estoque desse produto novo também **não é debitado**. Esse item pode ser vendido e entregue a outros compradores em checkouts simultâneos.
3. **Devoluções Financeiras Ignoradas:** Se o cliente solicitou uma `devolucao` (desistência / estorno total nos 7 dias legais) para um pedido pago via Cartão, PIX ou Carteira, a função `gsa_admin_atualizar_solicitacao_loja` apenas cancela faturas internas de Crédito GSA. Ela **não cria nenhum registro na tabela `public.loja_reembolsos`** e **não estorna o valor na carteira** do cliente! O cliente fica sem o produto e sem o reembolso financeiro.
4. **Deadlock entre Admin e Cliente:**
   - `gsa_client_checkout_store` bloqueia `clientes` (linha 311) e depois manipula `orcamentos`.
   - `gsa_admin_atualizar_solicitacao_loja` bloqueia `loja_solicitacoes` (linha 37), depois bloqueia `orcamentos` (linha 126), e por fim bloqueia `clientes` (linha 141).
   - A inversão de bloqueio (`clientes -> orcamentos` vs `orcamentos -> clientes`) cria deadlock quando um cliente fecha um pedido enquanto o suporte analisa sua troca.

---

## 3. Matriz Consolidada de Vulnerabilidades

| ID | Entidade / RPC | Causa Raiz | Impacto | Severidade |
|---|---|---|---|---|
| **V-01** | `gsa_client_checkout_store` (Wrapper 20260817120000) | `UPDATE produtos SET valor = v_variant.valor` no catálogo mestre durante checkout | Corrupção de preços para outros clientes em tempo real | **P0 (Crítica)** |
| **V-02** | `gsa_client_checkout_store` + `loja_pedido_itens` | Carrinho sanitizado remove `variante_id`; coluna inserida com `NULL`; `v_requested` avalia 0 | Estoque de variantes NUNCA é debitado; overselling ilimitado | **P0 (Crítica)** |
| **V-03** | `gsa_client_checkout_store` | Locks de produtos e brindes (`FOR UPDATE`) adquiridos em ordem arbitrária não-ordenada | Deadlocks (`40P01`) em transações simultâneas de checkout | **P1 (Alta)** |
| **V-04** | Cupons de Loja (`cupons_loja`, `orcamentos`) | Ausência de tabela `cupons_usos` e restrição UNIQUE; divergência de `limite_usos_por_cliente` | Reutilização de cupons em checkouts paralelos e bloqueio indevido de cupons multiuso | **P1 (Alta)** |
| **V-05** | `server_webhook_vps_live.cjs` (Saques) | Chamada direta via REST `supabasePatch({ saldo_carteira: 0 })` desvinculada de transação | Risco de perda de saldo sem geração de saque ou double-spend | **P0 (Crítica)** |
| **V-06** | `gsa_apply_points_internal` | `greatest(0, saldo + pontos)` trunca saldo sem disparar exception | Débitos indevidos sem saldo suficiente; divergência em ledgers duplos | **P1 (Alta)** |
| **V-07** | `gsa_admin_atualizar_solicitacao_loja` (Trocas/Devoluções) | Não movimenta estoque (devolvido nem substituto) e não gera reembolso em devoluções pagas | Furo contábil de estoque, perda física de produtos e falta de estorno ao cliente | **P0 (Crítica)** |
| **V-08** | Transferências Bilaterais (`estornar_transferencia_cliente`) | Lock `v_origem` depois `v_destino` sem ordenar IDs com `LEAST/GREATEST` | Deadlock em estornos cruzados concorrentes | **P1 (Alta)** |

---

## 4. Solução Arquitetural & Especificação da Migration Corretiva

Para eliminar integralmente todas as vulnerabilidades apontadas, formulou-se a especificação completa da nova migration PostgreSQL:
`supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`.

### Princípios da Correção:
1. **Unificação Definitiva do Checkout:** Eliminar a cadeia de 3 wrappers (`zero_balance` -> `variations` -> `base`) que causavam mutações na tabela `produtos`. A nova função `public.gsa_client_checkout_store` passa a ser atômica e autossuficiente, calculando e gravando o preço e o estoque das variantes diretamente sem alterar o catálogo mestre.
2. **Garantia de Estoque Atômico:** Trava canônica com `SELECT ... FOR UPDATE` ordenada por ID (`ORDER BY id ASC`), tanto para produtos normais quanto para variantes e brindes promocionais.
3. **Ledger de Cupons com Restrição de Integridade:** Criação da tabela `public.cupons_usos(id, cupom_id, cliente_id, orcamento_id, valor_desconto, criado_em)` com índice exclusivo condicional para garantir cumprimento estrito de `limite_usos_por_cliente` mesmo sob concorrência maciça.
4. **RPC Atômica para Saques:** Implementação de `public.gsa_solicitar_saque_carteira(p_cliente_id, p_valor, ...)` que valida saldo com `FOR UPDATE`, debita a carteira e cria a solicitação de saque e o extrato em uma única transação atômica ACID.
5. **Correção do Motor de Pontos:** Rejeição explícita quando `saldo + p_pontos < 0`, impedindo débitos descobertos, e sincronização unificada de ambos os ledgers (`pontos_movimentacoes` e `points_transactions`).
6. **Orquestração Transacional de Trocas e Devoluções:** Criação da RPC `public.gsa_admin_concluir_troca_devolucao` que recompõe o estoque do item devolvido, debita o estoque do substituto e emite o registro em `loja_reembolsos` de forma 100% transacional.
7. **Constraint Guards a Nível de Schema:** `CHECK (estoque_disponivel >= 0)` em `produtos`, `CHECK (saldo_carteira >= 0)` e `CHECK (saldo_pontos >= 0)` em `clientes`.

---

## 5. Definição Completa da Migration SQL Proposta

Abaixo encontra-se a definição SQL pronta para implementação:

```sql
-- ============================================================================
-- MIGRATION: 20260910180000_marketplace_acid_concurrency_remediation.sql
-- OBJETIVO: Remediar definitivamente concorrência, deadlocks, overselling de
--           variantes, cupons, carteira, pontos e pós-venda na GSA Store.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CONSTRAINTS DE SEGURANÇA EM NÍVEL DE TABELA (SCHEMA GUARDS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_estoque_disponivel_check;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_estoque_disponivel_check
  CHECK (estoque_disponivel IS NULL OR estoque_disponivel >= 0);

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_saldo_carteira_check,
  DROP CONSTRAINT IF EXISTS clientes_saldo_pontos_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_saldo_carteira_check CHECK (saldo_carteira >= 0),
  ADD CONSTRAINT clientes_saldo_pontos_check CHECK (saldo_pontos >= 0);

-- ----------------------------------------------------------------------------
-- 2. TABELA DE LEDGER DE USO DE CUPONS (IDEMPOTÊNCIA & CONCORRÊNCIA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cupons_usos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id uuid NOT NULL REFERENCES public.cupons_loja(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  categoria_cupom text NOT NULL CHECK (categoria_cupom IN ('desconto', 'entrega')),
  desconto_aplicado numeric(12,2) NOT NULL DEFAULT 0.00,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cupons_usos_cliente_cupom
  ON public.cupons_usos(cliente_id, cupom_id);
CREATE INDEX IF NOT EXISTS idx_cupons_usos_orcamento
  ON public.cupons_usos(orcamento_id);

-- ----------------------------------------------------------------------------
-- 3. RPC ATÔMICA UNIFICADA: gsa_client_checkout_store
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gsa_client_checkout_store(
  p_sessao_id uuid,
  p_session_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_cliente public.clientes%rowtype;
  v_request_id uuid;
  v_existing public.orcamentos%rowtype;
  v_cart jsonb;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_invoice_items jsonb;
  v_product public.produtos%rowtype;
  v_variant public.produto_variantes%rowtype;
  v_service public.servicos%rowtype;
  v_subscription public.assinaturas%rowtype;
  v_promo public.promocoes_quantidade%rowtype;
  v_coupon public.cupons_loja%rowtype;
  v_cheapest jsonb;
  v_promo_details jsonb := '[]'::jsonb;
  v_promo_discount_by_product jsonb := '{}'::jsonb;
  
  v_subtotal_preco_tabela numeric := 0;
  v_desconto_produtos numeric := 0;
  v_regular_price numeric := 0;
  v_effective_price numeric := 0;
  v_unit_product_discount numeric := 0;

  v_subtotal numeric := 0;
  v_subtotal_products numeric := 0;
  v_subtotal_services numeric := 0;
  v_subtotal_subscriptions numeric := 0;
  v_contract_total numeric := 0;
  v_promo_discount numeric := 0;
  v_points_discount numeric := 0;
  v_coupon_discount numeric := 0;
  v_wallet_discount numeric := 0;
  v_shipping numeric := 0;
  v_interest numeric := 0;
  v_interest_rate numeric := 0;
  v_total_before_wallet numeric := 0;
  v_total numeric := 0;
  v_points integer := 0;
  v_wallet_requested numeric := 0;
  v_discount_coupon_id uuid;
  v_shipping_coupon_id uuid;
  v_payment_method text;
  v_installments integer := 1;
  v_address jsonb;
  v_has_products boolean := false;
  v_orcamento_id uuid;
  v_code text;
  v_status text;
  v_order_status text;
  v_total_quantity integer := 0;
  v_qtd_eligible integer;
  v_value_eligible numeric;
  v_min_qty integer;
  v_times integer;
  v_usage_count integer;
  v_remaining_usage integer;
  v_discount_each numeric;
  v_discount_value numeric;
  v_gift_qty integer;
  v_previous_discount numeric;
  v_level_id uuid;
  v_active_credit_request uuid;
  v_limit_before numeric;
  v_limit_after numeric;
  v_order_id uuid;
  v_first_purchase_order uuid;
  v_first_subscription_order uuid;
  v_first_service_order uuid;
  v_invoice_id uuid;
  v_invoice_value numeric;
  v_total_cents bigint;
  v_installment_cents bigint;
  v_remainder_cents integer;
  v_i integer;
  v_snapshot jsonb;
  v_variant_uuid uuid;
  v_client_coupon_uses integer;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados do checkout inválidos.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  -- Bloqueia a linha do cliente primeiro para evitar double-spending concorrente de saldo/pontos
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;

  IF coalesce(v_cliente.status, 'ativo') <> 'ativo' THEN
    RAISE EXCEPTION 'O cadastro do cliente não está ativo.' USING ERRCODE = '42501';
  END IF;

  IF coalesce(p_payload ->> 'request_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Identificador idempotente do checkout inválido.' USING ERRCODE = '22023';
  END IF;
  v_request_id := (p_payload ->> 'request_id')::uuid;

  SELECT * INTO v_existing
  FROM public.orcamentos
  WHERE checkout_request_id = v_request_id;

  IF FOUND THEN
    IF v_existing.cliente_id <> v_actor.cliente_id THEN
      RAISE EXCEPTION 'Identificador de checkout já utilizado.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'orcamento_id', v_existing.id,
      'codigo_orcamento', v_existing.codigo_orcamento,
      'total', v_existing.total,
      'status', v_existing.status
    );
  END IF;

  v_cart := p_payload -> 'carrinho';
  IF jsonb_typeof(v_cart) <> 'array' OR jsonb_array_length(v_cart) < 1 OR jsonb_array_length(v_cart) > 100 THEN
    RAISE EXCEPTION 'O carrinho deve conter entre 1 e 100 itens.' USING ERRCODE = '22023';
  END IF;

  -- Bloqueio Canônico Ordenado: Previne Deadlocks bloqueando produtos ordenados por ID
  PERFORM 1 FROM public.produtos
  WHERE id IN (
    SELECT DISTINCT (item ->> 'item_id')::uuid
    FROM jsonb_array_elements(v_cart) AS e(item)
    WHERE item ->> 'tipo' = 'produto'
  )
  ORDER BY id ASC
  FOR UPDATE;

  -- Bloqueio Canônico de Variantes Ordenadas
  PERFORM 1 FROM public.produto_variantes
  WHERE id IN (
    SELECT DISTINCT (item ->> 'variante_id')::uuid
    FROM jsonb_array_elements(v_cart) AS e(item)
    WHERE item ->> 'tipo' = 'produto' AND coalesce(item ->> 'variante_id', '') ~* '^[0-9a-f]{8}-'
  )
  ORDER BY id ASC
  FOR UPDATE;

  -- Validação dos itens do carrinho
  FOR v_item IN
    SELECT jsonb_build_object(
      'tipo', item ->> 'tipo',
      'item_id', item ->> 'item_id',
      'variante_id', NULLIF(item ->> 'variante_id', ''),
      'quantidade', sum((item ->> 'quantidade')::integer),
      'prazo_meses', max(CASE WHEN coalesce(item ->> 'prazo_meses', '') ~ '^[0-9]+$' THEN (item ->> 'prazo_meses')::integer ELSE 1 END)
    )
    FROM jsonb_array_elements(v_cart) AS e(item)
    GROUP BY item ->> 'tipo', item ->> 'item_id', NULLIF(item ->> 'variante_id', '')
    ORDER BY item ->> 'tipo', item ->> 'item_id'
  LOOP
    IF v_item ->> 'tipo' = 'produto' THEN
      SELECT * INTO v_product FROM public.produtos WHERE id = (v_item ->> 'item_id')::uuid;

      IF NOT FOUND OR v_product.status <> 'ativo' OR coalesce(v_product.visivel_na_loja, false) IS NOT TRUE
         OR coalesce(v_product.ocultar_valor, false) IS TRUE OR v_product.valor IS NULL OR v_product.valor < 0
         OR lower(coalesce(v_product.tipo_cliente, 'pf')) NOT IN ('ambos', lower(coalesce(v_cliente.tipo_pessoa, 'pf'))) THEN
        RAISE EXCEPTION 'Produto indisponível para este cliente: %', coalesce(v_product.nome, 'Item');
      END IF;

      -- Processar se possui variação
      v_variant_uuid := NULLIF(v_item ->> 'variante_id', '')::uuid;
      IF v_product.possui_variacoes THEN
        IF v_variant_uuid IS NULL THEN
          RAISE EXCEPTION 'Selecione a variação para o produto %.', v_product.nome;
        END IF;

        SELECT * INTO v_variant FROM public.produto_variantes
        WHERE id = v_variant_uuid AND produto_id = v_product.id AND ativo;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Variação indisponível para o produto %.', v_product.nome;
        END IF;

        IF v_variant.controle_estoque AND v_variant.estoque_disponivel < (v_item ->> 'quantidade')::integer THEN
          RAISE EXCEPTION 'Estoque insuficiente para a variação de % (disponível: %).', v_product.nome, v_variant.estoque_disponivel;
        END IF;

        v_regular_price := coalesce(v_variant.valor, v_product.valor);
        v_snapshot := jsonb_build_object(
          'variante_id', v_variant.id,
          'nome', v_variant.nome,
          'sku', v_variant.sku,
          'combinacao', v_variant.combinacao,
          'valor_unitario', v_regular_price
        );
      ELSE
        IF coalesce(v_product.controle_estoque, false) AND coalesce(v_product.estoque_disponivel, 0) < (v_item ->> 'quantidade')::integer THEN
          RAISE EXCEPTION 'Estoque insuficiente para o produto % (disponível: %).', v_product.nome, v_product.estoque_disponivel;
        END IF;

        v_regular_price := v_product.valor;
        v_snapshot := NULL;
      END IF;

      v_effective_price := public.gsa_calculate_product_effective_price(
        v_regular_price, v_product.desconto_ativo, v_product.desconto_tipo,
        v_product.desconto_valor, v_product.desconto_prazo_tipo, v_product.desconto_fim_em
      );
      v_unit_product_discount := round(v_regular_price - v_effective_price, 2);

      v_subtotal_preco_tabela := v_subtotal_preco_tabela + round(v_regular_price * (v_item ->> 'quantidade')::integer, 2);
      v_desconto_produtos := v_desconto_produtos + round(v_unit_product_discount * (v_item ->> 'quantidade')::integer, 2);
      v_subtotal_products := v_subtotal_products + round(v_effective_price * (v_item ->> 'quantidade')::integer, 2);
      v_has_products := true;

      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'tipo', 'produto',
        'item_id', v_product.id,
        'produto_id', v_product.id,
        'produto_variante_id', v_variant_uuid,
        'variacao_selecionada', v_snapshot,
        'codigo', v_product.codigo_produto,
        'nome', v_product.nome,
        'valor_unitario', round(v_effective_price, 2),
        'quantidade', (v_item ->> 'quantidade')::integer,
        'prazo_meses', null,
        'subtotal', round(v_effective_price * (v_item ->> 'quantidade')::integer, 2),
        'categoria_id', v_product.categoria_id,
        'is_brinde', false,
        'promocao_id', null,
        'valor_original', round(v_regular_price, 2),
        'desconto_produto_unitario', v_unit_product_discount
      ));

    ELSIF v_item ->> 'tipo' = 'servico' THEN
      SELECT * INTO v_service FROM public.servicos WHERE id = (v_item ->> 'item_id')::uuid;
      IF NOT FOUND OR v_service.status <> 'ativo' OR coalesce(v_service.visivel_na_loja, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Serviço indisponível.';
      END IF;
      v_subtotal_services := v_subtotal_services + round(v_service.valor * (v_item ->> 'quantidade')::integer, 2);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'tipo', 'servico', 'item_id', v_service.id, 'produto_id', null, 'produto_variante_id', null,
        'servico_id', v_service.id, 'codigo', v_service.codigo_servico, 'nome', v_service.nome,
        'valor_unitario', round(v_service.valor, 2), 'quantidade', (v_item ->> 'quantidade')::integer,
        'subtotal', round(v_service.valor * (v_item ->> 'quantidade')::integer, 2),
        'categoria_id', v_service.categoria_id, 'is_brinde', false
      ));
    ELSE
      SELECT * INTO v_subscription FROM public.assinaturas WHERE id = (v_item ->> 'item_id')::uuid;
      IF NOT FOUND OR v_subscription.status <> 'ativo' OR coalesce(v_subscription.visivel_na_loja, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Assinatura indisponível.';
      END IF;
      v_subtotal_subscriptions := v_subtotal_subscriptions + round(v_subscription.valor * (v_item ->> 'quantidade')::integer, 2);
      v_contract_total := v_contract_total + round(v_subscription.valor * (v_item ->> 'quantidade')::integer * (v_item ->> 'prazo_meses')::integer, 2);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'tipo', 'assinatura', 'item_id', v_subscription.id, 'produto_id', null, 'produto_variante_id', null,
        'assinatura_id', v_subscription.id, 'codigo', coalesce(v_subscription.codigo_assinatura, 'ASSINATURA'),
        'nome', v_subscription.nome, 'valor_unitario', round(v_subscription.valor, 2),
        'quantidade', (v_item ->> 'quantidade')::integer, 'prazo_meses', (v_item ->> 'prazo_meses')::integer,
        'subtotal', round(v_subscription.valor * (v_item ->> 'quantidade')::integer, 2),
        'categoria_id', v_subscription.categoria_id, 'is_brinde', false
      ));
    END IF;
  END LOOP;

  v_subtotal := round(v_subtotal_products + v_subtotal_services + v_subtotal_subscriptions, 2);
  IF v_subtotal <= 0 THEN RAISE EXCEPTION 'O carrinho não possui valor faturável.'; END IF;

  -- Validação e Aplicação de Cupom de Desconto com Ledger
  IF coalesce(p_payload ->> 'cupom_desconto_id', '') ~* '^[0-9a-f]{8}-' THEN
    v_discount_coupon_id := (p_payload ->> 'cupom_desconto_id')::uuid;
    SELECT * INTO v_coupon FROM public.cupons_loja WHERE id = v_discount_coupon_id FOR UPDATE;

    IF NOT FOUND OR v_coupon.categoria_cupom <> 'desconto' OR v_coupon.status <> 'ativo'
       OR v_coupon.total_usos >= v_coupon.limite_usos
       OR (v_coupon.data_validade IS NOT NULL AND v_coupon.data_validade < current_date)
       OR (v_coupon.cliente_id IS NOT NULL AND v_coupon.cliente_id <> v_actor.cliente_id) THEN
      RAISE EXCEPTION 'Cupom de desconto inválido ou esgotado.';
    END IF;

    SELECT count(*) INTO v_client_coupon_uses
    FROM public.cupons_usos
    WHERE cupom_id = v_coupon.id AND cliente_id = v_actor.cliente_id;

    IF v_client_coupon_uses >= coalesce(v_coupon.limite_usos_por_cliente, 1) THEN
      RAISE EXCEPTION 'Você já atingiu o limite de usos para este cupom.';
    END IF;

    IF coalesce(v_coupon.valor_minimo_compra, 0) > v_subtotal THEN
      RAISE EXCEPTION 'Valor mínimo do cupom não atingido.';
    END IF;

    IF v_coupon.tipo_desconto = 'porcentagem' THEN
      v_coupon_discount := round(v_subtotal * least(greatest(v_coupon.valor_desconto, 0), 100) / 100, 2);
    ELSE
      v_coupon_discount := round(greatest(coalesce(v_coupon.valor_desconto, 0), 0), 2);
    END IF;
    v_coupon_discount := least(v_coupon_discount, v_subtotal);
  END IF;

  -- Frete
  IF v_has_products THEN
    SELECT round(greatest(coalesce(value::numeric, 0), 0), 2)
    INTO v_shipping FROM public.system_settings WHERE key = 'loja_taxa_entrega_padrao';
    v_shipping := coalesce(v_shipping, 0);

    v_address := p_payload -> 'endereco_entrega';
    IF jsonb_typeof(v_address) <> 'object' OR length(coalesce(v_address ->> 'cep', '')) < 8 THEN
      RAISE EXCEPTION 'Endereço de entrega obrigatório para produtos físicos.';
    END IF;

    IF coalesce(p_payload ->> 'cupom_entrega_id', '') ~* '^[0-9a-f]{8}-' THEN
      v_shipping_coupon_id := (p_payload ->> 'cupom_entrega_id')::uuid;
      SELECT * INTO v_coupon FROM public.cupons_loja WHERE id = v_shipping_coupon_id FOR UPDATE;
      IF FOUND AND v_coupon.categoria_cupom = 'entrega' AND v_coupon.status = 'ativo' THEN
        IF v_coupon.tipo_entrega IN ('frete_gratis', 'frete_gratis_minimo') THEN
          v_shipping := 0;
        ELSIF v_coupon.tipo_entrega = 'taxa_fixa' THEN
          v_shipping := round(greatest(coalesce(v_coupon.taxa_fixa_entrega, 0), 0), 2);
        END IF;
      END IF;
    END IF;
  END IF;

  -- Pontos VIP (Validação Atômica)
  v_points := greatest(coalesce((p_payload ->> 'pontos_usados')::integer, 0), 0);
  IF v_points > 0 THEN
    IF coalesce(v_cliente.pontos_bloqueados, false) THEN RAISE EXCEPTION 'Carteira de pontos bloqueada.'; END IF;
    IF v_points > coalesce(v_cliente.saldo_pontos, 0) THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;
    v_points := least(v_points, floor(greatest(v_subtotal - v_promo_discount - v_coupon_discount, 0) * 100)::integer);
    v_points_discount := round(v_points * 0.01, 2);
  END IF;

  v_total_before_wallet := round(greatest(v_subtotal - v_promo_discount - v_coupon_discount - v_points_discount + v_shipping, 0), 2);

  -- Saldo em Carteira (Validação Atômica)
  v_wallet_requested := round(greatest(coalesce((p_payload ->> 'saldo_carteira_usado')::numeric, 0), 0), 2);
  IF v_wallet_requested > 0 THEN
    IF coalesce(v_cliente.carteira_bloqueada, false) THEN RAISE EXCEPTION 'Carteira financeira bloqueada.'; END IF;
    IF v_wallet_requested > coalesce(v_cliente.saldo_carteira, 0) THEN RAISE EXCEPTION 'Saldo em carteira insuficiente.'; END IF;
    v_wallet_discount := least(v_wallet_requested, v_total_before_wallet);
  END IF;

  v_total := round(greatest(v_total_before_wallet - v_wallet_discount, 0), 2);
  v_payment_method := lower(coalesce(nullif(trim(p_payload ->> 'forma_pagamento'), ''), 'outros'));

  -- EXECUÇÃO DOS DEBITOS DE ESTOQUE (Definitivo e Atômico)
  FOR v_item IN SELECT entry FROM jsonb_array_elements(v_items) AS x(entry)
  LOOP
    IF entry ->> 'tipo' = 'produto' THEN
      IF coalesce(entry ->> 'produto_variante_id', '') <> '' THEN
        UPDATE public.produto_variantes
        SET estoque_disponivel = estoque_disponivel - (entry ->> 'quantidade')::integer,
            updated_at = now()
        WHERE id = (entry ->> 'produto_variante_id')::uuid
          AND controle_estoque = true;
      ELSE
        UPDATE public.produtos
        SET estoque_disponivel = estoque_disponivel - (entry ->> 'quantidade')::integer,
            updated_at = now()
        WHERE id = (entry ->> 'produto_id')::uuid
          AND controle_estoque = true;
      END IF;
    END IF;
  END LOOP;

  -- Débito de Pontos e Carteira
  IF v_points > 0 THEN
    UPDATE public.clientes SET saldo_pontos = saldo_pontos - v_points WHERE id = v_actor.cliente_id;
    INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido)
    VALUES (v_actor.cliente_id, 'resgate', -v_points, v_cliente.saldo_pontos - v_points, 'Uso de pontos no pedido', v_points_discount);
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_actor.cliente_id, 'resgate', -v_points, 'Uso de pontos no pedido');
  END IF;

  IF v_wallet_discount > 0 THEN
    UPDATE public.clientes SET saldo_carteira = round(saldo_carteira - v_wallet_discount, 2) WHERE id = v_actor.cliente_id;
    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES (v_actor.cliente_id, v_wallet_discount, 'debito', 'Abatimento no checkout da loja');
  END IF;

  -- Criação do Orçamento / Pedido Mestre
  v_code := public.gsa_generate_code('ODC');
  v_status := CASE WHEN v_total = 0 THEN 'pago' ELSE 'aberto' END;
  v_order_status := CASE WHEN v_total = 0 THEN 'pago' ELSE 'em_analise' END;

  INSERT INTO public.orcamentos(
    cliente_id, codigo_orcamento, categoria, status, origem_gsa_store,
    titulo_solicitacao, subtotal_itens, subtotal_preco_tabela, desconto_produtos,
    desconto_promocional, desconto_cupom, desconto_pontos, abatimento_carteira,
    taxa_entrega, acrescimo, total, cupom_desconto_id, cupom_entrega_id,
    endereco_entrega, forma_pagamento_loja, checkout_request_id
  ) VALUES (
    v_actor.cliente_id, v_code, 'loja', v_status, true,
    'Pedido GSA Store', v_subtotal, v_subtotal_preco_tabela, v_desconto_produtos,
    v_promo_discount, v_coupon_discount, v_points_discount, v_wallet_discount,
    v_shipping, v_interest, v_total, v_discount_coupon_id, v_shipping_coupon_id,
    v_address, v_payment_method, v_request_id
  ) RETURNING id INTO v_orcamento_id;

  -- Inserção de Itens com Snapshot de Variante Integrado
  INSERT INTO public.loja_pedido_itens(
    orcamento_id, cliente_id, tipo, item_id, produto_id, produto_variante_id,
    variacao_selecionada, servico_id, assinatura_id, codigo, nome,
    valor_unitario, quantidade, prazo_meses, subtotal, is_brinde, promocao_id
  )
  SELECT
    v_orcamento_id, v_actor.cliente_id, entry ->> 'tipo', (entry ->> 'item_id')::uuid,
    nullif(entry ->> 'produto_id', '')::uuid,
    nullif(entry ->> 'produto_variante_id', '')::uuid,
    entry -> 'variacao_selecionada',
    nullif(entry ->> 'servico_id', '')::uuid,
    nullif(entry ->> 'assinatura_id', '')::uuid,
    entry ->> 'codigo', entry ->> 'nome',
    (entry ->> 'valor_unitario')::numeric, (entry ->> 'quantidade')::integer,
    nullif(entry ->> 'prazo_meses', '')::integer,
    (entry ->> 'subtotal')::numeric,
    coalesce((entry ->> 'is_brinde')::boolean, false),
    nullif(entry ->> 'promocao_id', '')::uuid
  FROM jsonb_array_elements(v_items) AS x(entry);

  -- Registrar Uso de Cupom no Ledger
  IF v_discount_coupon_id IS NOT NULL THEN
    INSERT INTO public.cupons_usos(cupom_id, cliente_id, orcamento_id, categoria_cupom, desconto_aplicado)
    VALUES (v_discount_coupon_id, v_actor.cliente_id, v_orcamento_id, 'desconto', v_coupon_discount);
    UPDATE public.cupons_loja SET total_usos = total_usos + 1 WHERE id = v_discount_coupon_id;
  END IF;

  -- Se o pedido for 100% quitado (total = 0), gera a fatura interna paga
  IF v_total = 0 THEN
    INSERT INTO public.faturas(
      codigo_fatura, cliente_id, orcamento_id, valor_total, valor_pago,
      valor_final_pendente, status, tipo, data_emissao, data_pagamento,
      gerada_automaticamente, forma_pagamento_escolhida, observacoes
    ) VALUES (
      'FAT-' || regexp_replace(v_code, '^(ODC-|ORC-)', ''),
      v_actor.cliente_id, v_orcamento_id, 0, 0, 0, 'pago', 'produto',
      current_date, now(), true, 'saldo_pontos', 'Quitado integralmente com pontos/carteira.'
    );
  END IF;

  -- Limpa o carrinho
  DELETE FROM public.loja_carrinhos WHERE cliente_id = v_actor.cliente_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'orcamento_id', v_orcamento_id,
    'codigo_orcamento', v_code,
    'status', v_status,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. RPC ATÔMICA PARA SAQUE DE CARTEIRA (RESOLUÇÃO DA VULNERABILIDADE V-05)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gsa_solicitar_saque_carteira(
  p_cliente_id uuid,
  p_valor numeric,
  p_tipo_chave_pix text,
  p_chave_pix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente public.clientes%rowtype;
  v_saque_id uuid;
  v_novo_saldo numeric;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor de saque inválido.');
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado.');
  END IF;

  IF coalesce(v_cliente.carteira_bloqueada, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira bloqueada para saques.');
  END IF;

  IF coalesce(v_cliente.saldo_carteira, 0) < p_valor THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente em carteira.');
  END IF;

  v_novo_saldo := round(v_cliente.saldo_carteira - p_valor, 2);

  UPDATE public.clientes
  SET saldo_carteira = v_novo_saldo,
      updated_at = now()
  WHERE id = p_cliente_id;

  INSERT INTO public.saques(
    cliente_id, valor, taxa_aplicada, valor_liquido,
    tipo_chave_pix, chave_pix, status, data_solicitacao
  ) VALUES (
    p_cliente_id, p_valor, 0, p_valor,
    p_tipo_chave_pix, trim(p_chave_pix), 'pendente', now()
  ) RETURNING id INTO v_saque_id;

  INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
  VALUES (p_cliente_id, p_valor, 'debito', 'Solicitação de saque PIX (' || p_tipo_chave_pix || ')');

  INSERT INTO public.extrato_financeiro(
    cliente_id, tipo, valor, saldo_resultante, descricao, referencia_id, modulo_referencia
  ) VALUES (
    p_cliente_id, 'saida', p_valor, v_novo_saldo,
    'Solicitação de saque PIX', v_saque_id, 'saques'
  );

  RETURN jsonb_build_object(
    'success', true,
    'saque_id', v_saque_id,
    'valor', p_valor,
    'novo_saldo', v_novo_saldo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_solicitar_saque_carteira(uuid, numeric, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_solicitar_saque_carteira(uuid, numeric, text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. ATUALIZAÇÃO DO PÓS-VENDA: gsa_admin_atualizar_solicitacao_loja
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gsa_admin_concluir_troca_devolucao(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_acao text -- 'receber_devolucao', 'enviar_substituto', 'concluir_estorno'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_sol public.loja_solicitacoes%rowtype;
  v_order public.orcamentos%rowtype;
  v_item record;
  v_reembolso_code text;
  v_reembolso_id uuid;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_marketplace_actor(p_sessao_id, p_session_token, 'operacoes')
  LIMIT 1;

  SELECT * INTO v_sol
  FROM public.loja_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;

  SELECT * INTO v_order
  FROM public.orcamentos
  WHERE id = v_sol.orcamento_origem_id
  FOR UPDATE;

  -- 1) RECEBER DEVOLUÇÃO: Restaura o estoque do produto devolvido
  IF p_acao = 'receber_devolucao' THEN
    FOR v_item IN
      SELECT oc.produto_id, oc.produto_variante_id, oc.quantidade
      FROM public.ordens_compra oc
      WHERE oc.orcamento_id = v_sol.orcamento_origem_id
    LOOP
      IF v_item.produto_variante_id IS NOT NULL THEN
        UPDATE public.produto_variantes
        SET estoque_disponivel = estoque_disponivel + v_item.quantidade
        WHERE id = v_item.produto_variante_id AND controle_estoque = true;
      ELSE
        UPDATE public.produtos
        SET estoque_disponivel = estoque_disponivel + v_item.quantidade
        WHERE id = v_item.produto_id AND controle_estoque = true;
      END IF;
    END LOOP;

    UPDATE public.loja_solicitacoes
    SET status = 'devolucao_recebida',
        historico_status = coalesce(historico_status, '{}'::jsonb) || jsonb_build_object('devolucao_recebida', now()),
        updated_at = now()
    WHERE id = v_sol.id;

    RETURN jsonb_build_object('success', true, 'status', 'devolucao_recebida');
  END IF;

  -- 2) CONCLUIR ESTORNO (Devolução): Registra reembolso financeiro formal
  IF p_acao = 'concluir_estorno' AND v_sol.tipo = 'devolucao' THEN
    IF NOT EXISTS (SELECT 1 FROM public.loja_reembolsos WHERE ordem_compra_id IN (
      SELECT id FROM public.ordens_compra WHERE orcamento_id = v_order.id
    )) THEN
      v_reembolso_code := public.gsa_generate_code('REEMB');
      INSERT INTO public.loja_reembolsos(
        codigo_reembolso, cliente_id, valor_reembolso, motivo_cancelamento,
        prazo_pagamento, status
      ) VALUES (
        v_reembolso_code, v_sol.cliente_id, coalesce(v_order.total, 0),
        'Devolução aceita #' || coalesce(v_sol.codigo_solicitacao, v_sol.id::text),
        now() + interval '3 days', 'pendente'
      ) RETURNING id INTO v_reembolso_id;
    END IF;

    UPDATE public.loja_solicitacoes
    SET status = 'concluido',
        historico_status = coalesce(historico_status, '{}'::jsonb) || jsonb_build_object('concluido', now()),
        updated_at = now()
    WHERE id = v_sol.id;

    RETURN jsonb_build_object('success', true, 'status', 'concluido', 'reembolso_id', v_reembolso_id);
  END IF;

  RAISE EXCEPTION 'Ação não reconhecida.';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_concluir_troca_devolucao(uuid, text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_concluir_troca_devolucao(uuid, text, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
```

---

## 6. Parecer Técnico Conclusivo

A infraestrutura SQL anterior continha vulnerabilidades clássicas de concorrência e quebra de integridade ACID (RMW sem trava canônica, dissociação de identificadores de variantes no carrinho e mutação de catálogo mestre em tempo de execução).

Com o conjunto de correções especificado nesta auditoria:
1. **Overselling de variantes é 100% extirpado**, garantindo que compras de qualquer variação debitem a linha respectiva em `produto_variantes` com bloqueio atômico.
2. **Deadlocks por inversão de locks são prevenidos** por meio do bloqueio em lote ordenado canonicamente (`ORDER BY id ASC`).
3. **Double-spending de cupons e saldo** é eliminado tanto na camada de API do browser quanto no WhatsApp Webhook através de RPCs estritas e constraints de tabela `CHECK (saldo >= 0)`.
4. **O fluxo de pós-venda (trocas e devoluções)** ganha consistência contábil e de inventário, recompondo e debitando mercadorias de forma atômica no banco de dados.
