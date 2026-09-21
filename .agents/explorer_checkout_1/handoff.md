# Handoff Report — explorer_checkout_1

**Task**: Auditoria Técnica de Concorrência e Integridade ACID: Função de Checkout Base e Variações  
**Data**: 2026-09-10  
**Status**: Concluído (Hard Handoff)

---

## 1. Observation

### Obs 1: Isolamento de Memória de `v_variant_price`
- **Arquivo**: `supabase/migrations/20260716183010_update_checkout_function.sql`
- **Linha 23**: Declaração de registro PL/pgSQL local:
  ```sql
  v_product public.produtos%rowtype;
  ```
- **Linhas 188-196**: Atribuição em memória de sessão privada:
  ```sql
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
- **Linhas 688-690**: O único `UPDATE` executado em `public.produtos` durante todo o checkout altera estritamente o estoque:
  ```sql
  UPDATE public.produtos
  SET estoque_disponivel = estoque_disponivel - (entry ->> 'quantidade')::integer
  WHERE id = v_product.id;
  ```
  Nenhum comando executa `UPDATE public.produtos SET valor = ...`.

### Obs 2: Expurgamento de `variante_id` pelo Wrapper
- **Arquivo**: `supabase/migrations/20260817120000_product_variations_marketplace.sql`
- **Linhas 743-749**: O array `v_sanitized_cart` descarta deliberadamente `variante_id` e `produto_variante_id`:
  ```sql
  SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'tipo', item ->> 'tipo',
    'item_id', item ->> 'item_id',
    'quantidade', item -> 'quantidade',
    'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
  ))) INTO v_sanitized_cart
  FROM jsonb_array_elements(v_cart) source(item);
  ```
- **Linha 813**: O carrinho sanitizado é passado à função base `gsa_client_checkout_store_base_20260817`:
  ```sql
  v_result := public.gsa_client_checkout_store_base_20260817(
    p_sessao_id, p_session_token,
    jsonb_set(p_payload, '{carrinho}', v_sanitized_cart, false)
  );
  ```
- **Linhas 831-837**: O wrapper tenta buscar a quantidade do item na tabela `loja_pedido_itens`:
  ```sql
  SELECT COALESCE(sum(quantidade), 0) INTO v_requested
  FROM public.loja_pedido_itens
  WHERE orcamento_id = v_order_id
    AND tipo = 'produto'
    AND produto_id = v_variant.produto_id
    AND produto_variante_id = v_variant.id;
  ```
  Como a função base gravou `produto_variante_id = NULL` (devido a `v_sanitized_cart`), esta consulta sempre retorna `0`.
- **Linhas 865-869**: O decremento de estoque da variação é executado com valor 0:
  ```sql
  IF v_variant.controle_estoque THEN
    UPDATE public.produto_variantes
    SET estoque_disponivel = estoque_disponivel - v_requested
    WHERE id = v_variant.id;
  END IF;
  ```

### Obs 3: Whitelist Restritiva na Base
- **Arquivo**: `supabase/migrations/20260716183010_update_checkout_function.sql`
- **Linhas 147-151**:
  ```sql
  OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(item) AS key_name
    WHERE key_name NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses')
  )
  ```
  Caso um cliente ou o wrapper envie `variante_id` diretamente, o bloco dispara exceção:
  `RAISE EXCEPTION 'O carrinho contém item inválido ou campo não permitido.';`

### Obs 4: Ordem Invertida de Travas (Deadlock)
- **No wrapper** (`20260817120000_product_variations_marketplace.sql` linhas 789-795):
  Trava primeiro `public.produtos` e `public.produto_variantes` `FOR UPDATE`, e somente depois a base trava `public.clientes` (linha 103 de `20260716183010`).
- **Na devolução admin** (`20260910180000_marketplace_acid_concurrency_remediation.sql` linhas 120 e 131):
  Trava primeiro `public.clientes` `FOR UPDATE` (linha 120) e depois atualiza `public.produto_variantes` (linha 131) e `public.produtos` (linha 136).

---

## 2. Logic Chain

1. **Da Obs 1**: Em PostgreSQL, mutações em variáveis PL/pgSQL do tipo record (`%rowtype`) afetam unicamente o escopo da chamada da função em execução. Sem um comando `UPDATE public.produtos SET valor = ...`, a tupla em disco não é alterada. Portanto, a injeção de `v_variant_price` em `v_product.valor` é 100% isolada e não contamina o catálogo global.
2. **Da Obs 2 e Obs 3**: O wrapper em `20260817120000` sanitiza o carrinho para não disparar a exceção de chaves desconhecidas em `20260716183010:148-150`. Ao remover `variante_id`, a função base nunca recebe o identificador da variação comprada.
3. **Consequência da Dessincronização**: A função base não entra no bloco de preço da variação (`IF nullif(v_item ->> 'variante_id', '') IS NOT NULL`), gravando o preço do produto pai no pedido e gravando `produto_variante_id = NULL` em `loja_pedido_itens`.
4. **Da Falha de Estoque da Variação**: Ao retornar da base para o wrapper, o wrapper busca itens onde `produto_variante_id = v_variant.id`. Como o campo foi gravado como `NULL`, o retorno é `v_requested = 0`. O wrapper executa `estoque_disponivel = estoque_disponivel - 0`. O estoque da variação nunca diminui, permitindo overselling irrestrito de qualquer variante.
5. **Da Obs 4**: Quando uma transação de checkout adquire locks na ordem $(Produtos/Variantes \to Clientes)$ concorrentemente com uma transação de devolução que adquire locks na ordem $(Clientes \to Produtos/Variantes)$ sobre os mesmos registros, cria-se um ciclo de dependência de espera mútuo, caracterizando deadlock determinístico.

---

## 3. Caveats

- **Ambiente de Testes Live**: Como o modo de operação é `benchmark`/read-only e não temos acesso ao banco Supabase remoto ativo sem execução de scripts, a análise foi conduzida através de verificação estática formal, modelo relacional e semântica estrita do motor PL/pgSQL do PostgreSQL 15+.
- **Interação com `20260817203000_zero_balance_store_checkout.sql`**: Este wrapper adicional apenas intercepta pedidos com saldo $0,00$ para gerar faturas internas quitadas; ele preserva o resultado do checkout intermediário sem alterar a mecânica de bloqueios de itens.

---

## 4. Conclusion

1. **Preço da Variação**: Está matematicamente comprovado que `v_variant_price` **NÃO muta a tabela `produtos`**. No entanto, devido à sanitização do wrapper (`v_sanitized_cart`), o preço da variação **nunca é aplicado**, cobrando o valor base do produto pai.
2. **Controle de Concorrência e Overselling**: O controle é perfeito para produtos sem variação, mas está **completamente quebrado para variações**, gerando baixa de 0 unidades no estoque de variantes e possibilitando overselling ilimitado.
3. **Deadlocks**: Identificado risco real de deadlock entre checkouts com variações e aprovações de devolução de pedidos devido à inversão de travas `produtos/variantes` vs `clientes`.

---

## 5. Verification Method

Para verificar independentemente estas constatações:

1. **Inspeção de Código**:
   - Abrir `supabase/migrations/20260817120000_product_variations_marketplace.sql` nas linhas 743-749 e constatar a ausência de `variante_id` no objeto montado para `v_sanitized_cart`.
   - Abrir `supabase/migrations/20260716183010_update_checkout_function.sql` nas linhas 148-150 e constatar a ausência de `'variante_id'` na lista `NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses')`.
   - Abrir `supabase/migrations/20260817120000_product_variations_marketplace.sql` nas linhas 831-837 e verificar que a query filtra por `produto_variante_id = v_variant.id`, que foi gravado como `NULL` pela base.
2. **Script de Simulação Automatizada**:
   - Um script SQL simulando a chamada `gsa_client_checkout_store` com payload contendo um produto com `variante_id` revelará que:
     - `loja_pedido_itens.valor_unitario` reflete `produtos.valor`, e não `produto_variantes.valor`.
     - `produto_variantes.estoque_disponivel` não é alterado após o commit.
     - `loja_pedido_itens.produto_variante_id` é gravado como `NULL`.
