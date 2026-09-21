# Handoff Report: Database RPCs, SQL Migrations & ACID Marketplace Concurrency Audit

**Agent:** `teamwork_preview_explorer_19_db`  
**Working Directory:** `.agents/teamwork_preview_explorer_19_db`  
**Handoff Type:** Hard (Audit Complete)  
**Report Artifact:** `.agents/teamwork_preview_explorer_19_db/analysis.md`

---

## 1. Observation

### 1.1. Mutação Destrutiva no Catálogo Durante Checkout de Variantes
- **Arquivo:** `supabase/migrations/20260817120000_product_variations_marketplace.sql` (Linhas 809–829)
- **Código Observado:**
```sql
v_original_values := v_original_values || jsonb_build_array(jsonb_build_object(
  'produto_id', v_product.id,
  'valor', v_product.valor
));
IF v_variant.valor IS NOT NULL THEN
  UPDATE public.produtos SET valor = v_variant.valor WHERE id = v_product.id;
END IF;

v_result := public.gsa_client_checkout_store_base_20260817(
  p_sessao_id, p_session_token, jsonb_set(p_payload, '{carrinho}', v_sanitized_cart, false)
);

FOR v_original IN SELECT value FROM jsonb_array_elements(v_original_values)
LOOP
  UPDATE public.produtos
  SET valor = (v_original ->> 'valor')::numeric
  WHERE id = (v_original ->> 'produto_id')::uuid;
END LOOP;
```
O wrapper altera o preço do produto mestre diretamente na tabela `produtos`, delega para a função base e depois desfaz a alteração.

### 1.2. Desconexão de Variantes e Falha Total de Decremento de Estoque
- **Arquivo:** `supabase/migrations/20260817120000_product_variations_marketplace.sql` (Linhas 743–749 e 846–884)
- **Código Observado:**
```sql
SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'tipo', item ->> 'tipo',
  'item_id', item ->> 'item_id',
  'quantidade', item -> 'quantidade',
  'prazo_meses', CASE WHEN item ? 'prazo_meses' THEN item -> 'prazo_meses' ELSE NULL END
))) INTO v_sanitized_cart FROM jsonb_array_elements(v_cart) source(item);
```
O campo `variante_id` é removido de `v_sanitized_cart`.
Na função base (`20260716183500_product_discount_validity.sql`, linhas 949–981), `loja_pedido_itens` é inserido sem `produto_variante_id` (permanece `NULL`).
Na volta ao wrapper:
```sql
SELECT COALESCE(sum(quantidade), 0) INTO v_requested
FROM public.loja_pedido_itens
WHERE orcamento_id = v_order_id
  AND tipo = 'produto'
  AND produto_id = v_variant.produto_id
  AND produto_variante_id = v_variant.id;
...
UPDATE public.produto_variantes
SET estoque_disponivel = estoque_disponivel - v_requested
WHERE id = v_variant.id;
```
Como `produto_variante_id` na tabela é `NULL`, a cláusula `WHERE produto_variante_id = v_variant.id` avalia como `UNKNOWN`/`FALSE`. `v_requested` é sempre `0`. A query executa `estoque_disponivel = estoque_disponivel - 0`. **O estoque da variante nunca é debitado**.

### 1.3. Inversão de Ordem de Locks e Deadlocks no Checkout
- **Arquivo:** `supabase/migrations/20260716183500_product_discount_validity.sql` (Linhas 370–391, 586, 634 e 871–884)
- **Código Observado:**
Produtos do carrinho são bloqueados inicialmente por `ORDER BY item ->> 'tipo', item ->> 'item_id'`.
Durante a avaliação de promoções:
`SELECT * INTO v_product FROM public.produtos WHERE id = v_promo.produto_brinde_id FOR UPDATE;`
`SELECT * INTO v_product FROM public.produtos WHERE id = (v_cheapest ->> 'item_id')::uuid FOR UPDATE;`
Esses brindes são bloqueados em ordem arbitrária e depois anexados ao final de `v_items`. No loop final de estoque (linhas 871–884), `v_items` é percorrido sem ordenação canônica por ID. Checkouts concorrentes com produtos cruzados e brindes geram `deadlock detected (40P01)`.

### 1.4. Webhook VPS Executando Atualização REST Direta e Não-Atômica no Saldo
- **Arquivo:** `server_webhook_vps_live.cjs` (Linhas 5132–5150)
- **Código Observado:**
```javascript
supabasePatch(`/rest/v1/clientes?id=eq.${session.client.id}`, { saldo_carteira: 0 }, (errPatch, resPatch) => {
  if (errPatch) { ... return; }
  const saqueData = { cliente_id: session.client.id, valor: valor, ... };
  supabasePost('/rest/v1/saques', saqueData, (errPost, resPost) => { ... });
});
```
Operação desprovida de transação ACID, sem `SELECT FOR UPDATE` e sem rollback se o POST falhar.

### 1.5. Ausência de Ledger de Uso de Cupons e Falha em `limite_usos_por_cliente`
- **Arquivo:** `supabase/migrations/20260716183500_product_discount_validity.sql` (Linhas 719–724)
- **Código Observado:**
```sql
OR EXISTS (
  SELECT 1 FROM public.orcamentos o
  WHERE o.cliente_id = v_actor.cliente_id
    AND o.status <> 'cancelado'
    AND (o.cupom_desconto_id = v_coupon.id OR o.cupom_entrega_id = v_coupon.id)
)
```
Não há tabela de ledger `cupons_usos` nem índice `UNIQUE`. Além disso, a subquery bloqueia qualquer cliente com 1 pedido anterior mesmo quando `cupons_loja.limite_usos_por_cliente > 1`.

### 1.6. Pós-Venda: Trocas e Devoluções Não Movimentam Estoque Nem Geram Reembolso
- **Arquivo:** `supabase/migrations/20260714045000_secure_admin_store_exchange_rpc.sql` (Linhas 69–187) e `src/components/admin/LojaTrocasModule.tsx` (Linhas 168–176)
- **Código Observado:**
`gsa_admin_atualizar_solicitacao_loja` apenas cancela faturas de Crédito GSA. Não há nenhum `UPDATE produtos` ou `UPDATE produto_variantes` para devolver o estoque recebido, nem para debitar o estoque do produto substituto. Para devoluções de pedidos pagos em dinheiro/PIX/cartão, não é gerado registro em `loja_reembolsos`.

---

## 2. Logic Chain

1. **A partir da Observação 1.1:** A instrução `UPDATE public.produtos SET valor = v_variant.valor` altera o preço na linha do produto compartilhado em catálogo. Logo, sob concorrência, qualquer leitor ou transação paralela acessará o preço alterado temporariamente pela variante de outro usuário.
2. **A partir da Observação 1.2:** A remoção de `variante_id` de `v_sanitized_cart` resulta em inserção de `produto_variante_id = NULL` em `loja_pedido_itens`. A cláusula `WHERE produto_variante_id = v_variant.id` avalia `0` itens para toda variante. Logo, o cálculo `estoque_disponivel = estoque_disponivel - 0` nunca subtrai as unidades compradas, permitindo *unbounded overselling*.
3. **A partir da Observação 1.3:** Como brindes de regras de promoção e produtos no loop final são bloqueados sem ordenação canônica (`id ASC`), dois checkouts simultâneos contendo produtos A e B em posições invertidas tentarão adquirir locks em direções opostas, caracterizando deadlock cíclico formal no PostgreSQL.
4. **A partir da Observação 1.4:** Duas requisições HTTP REST desvinculadas (`PATCH` e `POST`) não possuem garantia transacional (ACID). Falhas entre elas ou chamadas concorrentes provocam corrupção financeira ou double-spending do saldo da carteira.
5. **A partir da Observação 1.5:** A checagem de cupons baseada unicamente em subquery PL/pgSQL não oferece isolamento contra *phantom reads* e impede cupons com usos múltiplos por cliente.
6. **A partir da Observação 1.6:** A ausência de instruções DML para recomposição de inventário em `gsa_admin_atualizar_solicitacao_loja` gera descasamento imediato entre o estoque físico e o banco de dados toda vez que um cliente devolve ou troca uma mercadoria.

---

## 3. Caveats

- A auditoria realizada foi estritamente estática e em modo somente-leitura, conforme determinação da função Explorer. Nenhuma alteração foi aplicada em arquivos de código-fonte de produção ou banco de dados vivo nesta etapa.
- Ambientes de teste locais podem necessitar da execução de migração prévia das constraints se houver produtos existentes com `estoque_disponivel < 0` acumulados do bug anterior.

---

## 4. Conclusion

O ecossistema de banco de dados do marketplace apresenta vulnerabilidades críticas de concorrência e integridade ACID, com destaque para a falha matemática que anula o decremento de estoque de variantes e o update temporário de preços no catálogo. 
A arquitetura foi inteiramente mapeada e formulou-se a especificação completa de uma nova migration corretiva (`20260910180000_marketplace_acid_concurrency_remediation.sql`), detalhada no arquivo `.agents/teamwork_preview_explorer_19_db/analysis.md`.

---

## 5. Verification Method

Para verificar e validar as constatações deste relatório:

1. **Inspeção Estática dos Arquivos e Linhas Citados:**
   - Conferir linhas 809–829 e 846–884 de `supabase/migrations/20260817120000_product_variations_marketplace.sql`.
   - Conferir linhas 5132–5150 de `server_webhook_vps_live.cjs`.
   - Conferir linhas 69–187 de `supabase/migrations/20260714045000_secure_admin_store_exchange_rpc.sql`.
2. **Execução da Suíte de Testes Automatizada:**
   Executar no terminal do projeto:
   ```bash
   npm test src/tests/marketplace-checkout-pricing.test.ts
   npm test src/tests/database-schema-integrity.test.ts
   ```
3. **Validação do Relatório Completo:**
   Consultar o laudo detalhado e a migration SQL completa em:
   `.agents/teamwork_preview_explorer_19_db/analysis.md`
