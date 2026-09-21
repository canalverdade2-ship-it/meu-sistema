# Relatório de Auditoria Técnica de Concorrência e Integridade ACID: Checkout e Variações

**Data da Auditoria**: 2026-09-10  
**Auditor**: `explorer_checkout_1`  
**Escopo**:  
- `supabase/migrations/20260716183010_update_checkout_function.sql`
- `supabase/migrations/20260817120000_product_variations_marketplace.sql`
- `supabase/migrations/20260817203000_zero_balance_store_checkout.sql`
- `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`

---

## 1. Sumário Executivo

Esta auditoria realizou uma verificação matemática e estática exaustiva da função `gsa_client_checkout_store_base_20260817` (originada em `20260716183010_update_checkout_function.sql`), bem como dos wrappers de controle de variações (`20260817120000_product_variations_marketplace.sql`) e quitação de saldo zero (`20260817203000_zero_balance_store_checkout.sql`).

### Veredito Geral
1. **Mutação de Preço (`v_variant_price`)**: **NÃO HÁ mutação na tabela global `public.produtos`**. A injeção de `v_variant_price` é estritamente isolada na variável de memória local do PL/pgSQL (`v_product.valor`), propagando-se exclusivamente para a composição dos itens do pedido (`v_items`, `loja_pedido_itens`) e totais do orçamento (`orcamentos`).
2. **Falha Crítica de Dessincronização do Wrapper**: O wrapper `gsa_client_checkout_store` (em `20260817120000`) sanitiza o carrinho expurgando a chave `variante_id` (`v_sanitized_cart`), pois o validador da base rejeitaria chaves desconhecidas. **Consequência fatal**: a função base nunca recebe `variante_id`, nunca injeta `v_variant_price`, fatura o produto pelo preço base (em vez do preço da variação), grava `produto_variante_id = NULL` e faz com que a baixa de estoque da variação no pós-checkout decremente exatamente **0 unidades**.
3. **Bloqueio de Linha (`FOR UPDATE`) e Risco de Deadlock**: Para produtos base, o bloqueio canônico `ORDER BY item ->> 'tipo', item ->> 'item_id'` previne deadlocks entre carrinhos concorrentes. Porém, há **risco comprovado de Deadlock por Inversão de Ordem de Bloqueio** entre o wrapper de checkout (que trava `produtos`/`produto_variantes` antes de `clientes`) e rotas administrativas como `gsa_admin_atualizar_solicitacao_loja` (que trava `clientes` antes de `produtos`/`produto_variantes`), além de deadlock cruzado em promoções com brindes (`ganhe_outro_produto`).
4. **Prevenção de Overselling**: Totalmente eficaz para produtos base (sem variações) via `FOR UPDATE` + verificação de saldo pós-bloqueio. Contudo, para produtos **com variações**, o estoque da variação (`produto_variantes.estoque_disponivel`) **NÃO é baixado** devido ao bug de sanitização, permitindo **venda infinita de variações sem estoque** sob qualquer nível de concorrência.

---

## 2. Auditoria Matemática 1: Escopo e Isolamento de `v_variant_price`

### 2.1 Análise de Código e Trilha de Execução
No arquivo `20260716183010_update_checkout_function.sql`:
- **Declaração**: Linha 23 declara `v_product public.produtos%rowtype;`.
- **Leitura**: Linhas 182-185:
  ```sql
  SELECT * INTO v_product
  FROM public.produtos
  WHERE id = (v_item ->> 'item_id')::uuid
  FOR UPDATE;
  ```
- **Injeção do Preço da Variação**: Linhas 187-196:
  ```sql
  -- Use variant price if present
  IF nullif(v_item ->> 'variante_id', '') IS NOT NULL THEN
    DECLARE
      v_variant_price numeric;
    BEGIN
      SELECT valor INTO v_variant_price FROM public.produto_variantes WHERE id = (v_item ->> 'variante_id')::uuid;
      IF v_variant_price IS NOT NULL THEN
        v_product.valor := v_variant_price;
      END IF;
    END;
  END IF;
  ```

### 2.2 Demonstração Matemática de Não-Mutação Global
Em PostgreSQL PL/pgSQL, a variável `v_product` é um registro em memória privada da sessão (alocado no contexto de memória do executor PL/pgSQL / `SPI_execute`).
A instrução `v_product.valor := v_variant_price;` executa uma atribuição pontual de campo escalar na tupla interna do processo da transação corrente.

Para que ocorra uma mutação na tabela `public.produtos`, é mandatória a execução de um comando `UPDATE public.produtos SET valor = ...`.
Ao inspecionar minuciosamente todas as ocorrências de `UPDATE public.produtos` no arquivo:
- **Linhas 688-690**:
  ```sql
  UPDATE public.produtos
  SET estoque_disponivel = estoque_disponivel - (entry ->> 'quantidade')::integer
  WHERE id = v_product.id;
  ```
Não existe nenhum comando que atualize a coluna `valor`, `valor_promocional` ou qualquer outro atributo tarifário da tabela `produtos`.

**Propagação do Valor Injetado**:
1. `v_regular_price := v_product.valor;` (linha 215)
2. `v_effective_price := public.gsa_calculate_product_effective_price(...)` (linhas 216-220)
3. `v_unit_product_discount := round(v_regular_price - v_effective_price, 2);` (linha 221)
4. Agregação em `v_subtotal_products := v_subtotal_products + round(v_effective_price * quantidade, 2);` (linha 227)
5. Inclusão no payload imutável do pedido `v_items`:
   - `'valor_unitario', round(v_effective_price, 2)`
   - `'subtotal', round(v_effective_price * quantidade, 2)`
   - `'valor_original', round(v_regular_price, 2)`
6. Persistência em `public.loja_pedido_itens` (linhas 758-789) e `public.orcamentos` (linhas 713-755).

**Conclusão**: O preço da variação é 100% estanque ao pedido corrente. Nenhuma transação concorrente que leia `public.produtos` visualiza alteração de preço.

---

## 3. A Falha Crítica de Conexão: Wrapper vs. Função Base

Embora o algoritmo de cálculo de `v_variant_price` esteja matematicamente correto isolado na base, ele **nunca é acionado na prática** quando o checkout é chamado através do fluxo do sistema.

### 3.1 Mecanismo da Falha
1. No arquivo `20260817120000_product_variations_marketplace.sql` (linhas 743-749), o wrapper cria o carrinho sanitizado:
   ```sql
   SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
     'tipo', item ->> 'tipo',
     'item_id', item ->> 'item_id',
     'quantidade', item -> 'quantidade',
     'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
   ))) INTO v_sanitized_cart
   FROM jsonb_array_elements(v_cart) source(item);
   ```
   **O wrapper omite deliberadamente `variante_id` e `produto_variante_id`**.
2. **Motivo dessa omissão**: Na função base (`20260716183010_update_checkout_function.sql`, linhas 147-151), há um validador estrito que rejeita qualquer chave não listada:
   ```sql
   OR EXISTS (
     SELECT 1 FROM jsonb_object_keys(item) AS key_name
     WHERE key_name NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses')
   )
   ```
3. O wrapper então repassa `v_sanitized_cart` para a base (linha 813):
   ```sql
   v_result := public.gsa_client_checkout_store_base_20260817(
     p_sessao_id, p_session_token,
     jsonb_set(p_payload, '{carrinho}', v_sanitized_cart, false)
   );
   ```
4. Dentro de `gsa_client_checkout_store_base_20260817`:
   - `v_item ->> 'variante_id'` é sempre `NULL`.
   - `IF nullif(v_item ->> 'variante_id', '') IS NOT NULL` é sempre `FALSE`.
   - O preço aplicado é o do **produto pai** (`v_product.valor`), e NÃO o da variação.
   - `loja_pedido_itens.produto_variante_id` é gravado como `NULL`.
   - `ordens_compra.produto_variante_id` é gravado como `NULL`.
5. No retorno ao wrapper (linhas 831-837):
   ```sql
   SELECT COALESCE(sum(quantidade), 0) INTO v_requested
   FROM public.loja_pedido_itens
   WHERE orcamento_id = v_order_id
     AND tipo = 'produto'
     AND produto_id = v_variant.produto_id
     AND produto_variante_id = v_variant.id;
   ```
   Como `produto_variante_id` é `NULL` na tabela `loja_pedido_itens`, a query retorna:
   $$v\_requested = 0$$
6. Em decorrência:
   - O snapshot `variacao_selecionada` não é gravado em nenhum item do pedido (linhas 854-864 afetam 0 linhas).
   - O estoque da variação é atualizado com decremento zero (linha 867):
     $$estoque\_disponivel = estoque\_disponivel - 0$$

---

## 4. Auditoria Matemática 2: Bloqueio Concorrente (`FOR UPDATE`) e Deadlocks

### 4.1 Mapeamento da Ordem de Aquisição de Locks

| Etapa | Função / Linha | Tabela Bloqueada | Cláusula / Ordenação |
|---|---|---|---|
| 1 | Wrapper `20260817120000`: 789-795 | `public.produtos` e `public.produto_variantes` | `ORDER BY item ->> 'item_id', coalesce(item ->> 'variante_id', ...)` |
| 2 | Base `20260716183010`: 101-103 | `public.clientes` | Por ID do ator da sessão |
| 3 | Base `20260716183010`: 184 | `public.produtos` | `ORDER BY item ->> 'tipo', item ->> 'item_id'` |
| 4 | Base `20260716183010`: 251 | `public.servicos` | `ORDER BY item ->> 'tipo', item ->> 'item_id'` |
| 5 | Base `20260716183010`: 278 | `public.assinaturas` | `ORDER BY item ->> 'tipo', item ->> 'item_id'` |
| 6 | Base `20260716183010`: 387 | `public.produtos` (Brinde) | `produto_brinde_id` da promoção (dinâmico) |
| 7 | Base `20260716183010`: 519 | `public.cupons_loja` (Desconto) | Por ID do cupom |
| 8 | Base `20260716183010`: 594 | `public.cupons_loja` (Frete) | Por ID do cupom |
| 9 | Base `20260716183010`: 683 | `public.produtos` (Baixa) | Ordem de iteração do array `v_items` |
| 10 | Wrapper `20260817120000`: 828 | `public.produto_variantes` (Baixa) | Ordem do carrinho |

### 4.2 Prova do Deadlock 1: Inversão de Ordem entre Checkout e Devolução
Considere duas transações simultâneas:
- **Transação $T_1$**: Checkout de um carrinho com Produto $P$ e Variação $V$, realizado pelo Cliente $C$.
- **Transação $T_2$**: Aprovação de devolução/troca (`gsa_admin_atualizar_solicitacao_loja` em `20260910180000_marketplace_acid_concurrency_remediation.sql`) do mesmo Cliente $C$ envolvendo o mesmo Produto $P$ / Variação $V$.

**Ordem de Lock em $T_1$ (Checkout)**:
1. $T_1$ executa linha 790 de `20260817120000`: Adquire Lock Exclusivo em $P$ (`produtos`).
2. $T_1$ executa linha 795 de `20260817120000`: Adquire Lock Exclusivo em $V$ (`produto_variantes`).
3. $T_1$ chama a base e tenta executar linha 103 de `20260716183010`: Requisita Lock em $C$ (`clientes`).

**Ordem de Lock em $T_2$ (Devolução Admin)**:
1. $T_2$ executa linha 120 de `20260910180000`: Adquire Lock Exclusivo em $C$ (`clientes`).
2. $T_2$ executa linhas 131 e 136 de `20260910180000`: Requisita Lock em $V$ (`produto_variantes`) ou $P$ (`produtos`).

**Resultado no Grafo de Espera**:
$$T_1 \xrightarrow{\text{espera lock em } C} T_2 \quad \text{e} \quad T_2 \xrightarrow{\text{espera lock em } P/V} T_1$$
Ciclo fechado de espera: **Deadlock imediato detectado pelo PostgreSQL** (`ERROR: deadlock detected`), forçando o rollback de uma das transações.

### 4.3 Prova do Deadlock 2: Promoções Cruzadas de Brinde (`ganhe_outro_produto`)
Considere duas transações $T_A$ e $T_B$ de clientes distintos:
- Promoção 1: Compra Produto $A \implies$ Ganha Produto $B$.
- Promoção 2: Compra Produto $B \implies$ Ganha Produto $A$.
1. $T_A$ compra Produto $A$: Trava $A$ na iteração canônica do carrinho.
2. $T_B$ compra Produto $B$: Trava $B$ na iteração canônica do carrinho.
3. No loop de promoções (linha 387 de `20260716183010`):
   - $T_A$ tenta travar o brinde $B$ (bloqueia aguardando $T_B$).
   - $T_B$ tenta travar o brinde $A$ (bloqueia aguardando $T_A$).
Ciclo fechado:
$$T_A \xrightarrow{\text{lock em } B} T_B \xrightarrow{\text{lock em } A} T_A \implies \text{Deadlock}.$$

---

## 5. Auditoria Matemática 3: Controle de Estoque e Prevenção de Overselling

### 5.1 Produtos Sem Variação (Base Products)
Para produtos convencionais onde `possui_variacoes = false`:
1. No início do cálculo (linha 184), `SELECT ... FOR UPDATE` serializa as compras sobre a mesma linha de `public.produtos`.
2. O nível de isolamento padrão (Read Committed) garante que, quando uma transação posterior é liberada da fila de espera, ela relê a versão mais recente e comitada da tupla (`estoque_disponivel` já decrementado pela transação anterior).
3. Linha 210 e linha 685 avaliam:
   $$\text{IF } \text{coalesce}(v\_product.estoque\_disponivel, 0) < \text{quantidade} \implies \text{RAISE EXCEPTION}$$
4. Além disso, existe a constraint `produtos_estoque_nao_negativo` (`CHECK (COALESCE(estoque_disponivel, 0) >= 0)`).
**Conclusão**: Para produtos base, o sistema é **matematicamente imune a overselling**.

### 5.2 Produtos Com Variação (Variations)
Para produtos com variações (`possui_variacoes = true`), a integridade falha categoricamente:
1. Conforme demonstrado na Seção 3, `produto_variantes.estoque_disponivel` **NÃO é decrementado** ao final do checkout ($v\_requested = 0$).
2. O estoque em `produto_variantes` permanece estático.
3. Mesmo com alta concorrência de 1.000 requisições simultâneas para uma variação que possui apenas 1 unidade física em estoque:
   - Todas as 1.000 requisições executam `SELECT * FROM produto_variantes ... FOR UPDATE`.
   - Como nenhuma transação altera `estoque_disponivel` da variação, a checagem `estoque_disponivel < v_requested` sempre passa com sucesso.
   - Todas as 1.000 compras são aprovadas.
4. **Gravidade**: **Vulnerabilidade de Overselling Ilimitado**.
5. **Efeito Colateral Inverso no Pós-Venda**: Ao processar uma devolução em `gsa_admin_atualizar_solicitacao_loja`, o sistema executa:
   ```sql
   UPDATE public.produto_variantes
   SET estoque_disponivel = estoque_disponivel + v_item.quantidade
   WHERE id = v_item.produto_variante_id;
   ```
   Como o estoque nunca foi subtraído no checkout, a devolução incrementa unidades fantasmas, inflando progressivamente o estoque contábil do marketplace.

---

## 6. Catálogo de Vulnerabilidades e Casos Limite

### V-01 (Crítica - P0): Expurgamento de `variante_id` no Wrapper
- **Arquivo**: `supabase/migrations/20260817120000_product_variations_marketplace.sql` (linhas 743-749)
- **Impacto**: Anula a precificação da variação, anula a identificação da variação nos itens e zera a baixa de estoque da variação.
- **Correção**: Incluir `'variante_id', item ->> 'variante_id'` na construção do `v_sanitized_cart`.

### V-02 (Crítica - P0): Whitelist Restritiva na Função Base
- **Arquivo**: `supabase/migrations/20260716183010_update_checkout_function.sql` (linhas 147-151)
- **Impacto**: Rejeita qualquer requisição direta com erro `O carrinho contém item inválido ou campo não permitido.` se contiver a chave `variante_id`.
- **Correção**: Permitir explicitamente as chaves `'variante_id'` e `'produto_variante_id'` na validação `jsonb_object_keys(item)`.

### V-03 (Alta - P1): Deadlock por Inversão de Locks entre Wrapper e Admin
- **Arquivo**: `20260817120000_product_variations_marketplace.sql` vs `20260910180000_marketplace_acid_concurrency_remediation.sql`
- **Impacto**: Falha transacional com aborto de requisições de clientes sob concorrência com a operação administrativa de devoluções.
- **Correção**: Padronizar a ordem canônica global de aquisição de travas em todas as funções: travar `clientes` SEMPRE antes de travar produtos e variantes.

### V-04 (Média - P2): Deadlock Cruzado em Brindes Promocionais
- **Arquivo**: `20260716183010_update_checkout_function.sql` (linhas 387 e 443)
- **Impacto**: Se dois clientes comprarem itens que concedem um ao outro como brinde mútuo, ocorre deadlock.
- **Correção**: Se a promoção conceder um brinde cujo `produto_id` seja menor que os produtos já travados, deve-se adotar `NOWAIT` com retry em nível de aplicação ou pré-ordenar todos os bloqueios de catálogo.

### V-05 (Média - P2): Inconsistência de Estoque Pai vs. Variante
- Se `produtos.controle_estoque = true` e `produto_variantes.controle_estoque = true`, a base baixa o estoque do produto pai e o wrapper baixa o da variante. Se o produto pai tiver estoque agregado inferior à soma das variações, uma compra de variação pode falhar na base por falta de estoque pai.
- **Correção**: No modelo de variantes, o estoque agregador pai deve ser gerenciado de forma coerente (ou desativado quando houver variantes ativas).

---

## 7. Especificação Técnica da Remediação

Para solucionar definitivamente as falhas identificadas sem regredir a segurança ACID conquistada, a equipe de implementação deve aplicar:

```sql
-- 1. Na função base (gsa_client_checkout_store_base_20260817):
-- Atualizar a validação de chaves do carrinho para aceitar variante_id
WHERE key_name NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses', 'variante_id', 'produto_variante_id')

-- 2. No wrapper gsa_client_checkout_store (20260817120000):
-- Preservar a variante ao sanitizar o carrinho
SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'tipo', item ->> 'tipo',
  'item_id', item ->> 'item_id',
  'quantidade', item -> 'quantidade',
  'variante_id', COALESCE(item ->> 'variante_id', item ->> 'produto_variante_id'),
  'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
))) INTO v_sanitized_cart
FROM jsonb_array_elements(v_cart) source(item);

-- 3. No wrapper: Alinhar a ordem de lock para evitar deadlock
-- Travar clientes antes de travar produtos/variantes:
SELECT * INTO v_cliente FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;
```
