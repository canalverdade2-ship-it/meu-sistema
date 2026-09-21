# LAUDO TÉCNICO DE AUDITORIA: FLUXO DE DEVOLUÇÕES, REEMBOLSOS E ACID NO MARKETPLACE GSA
**Data da Auditoria:** 2026-09-10  
**Investigador:** explorer_returns_1 (Returns, Refunds & ACID Explorer)  
**Alvos Analisados:**  
1. `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`  
2. RPC `public.gsa_admin_atualizar_solicitacao_loja` (versão 20260714045000 vs 20260910180000)  
3. Front-end `src/components/admin/LojaTrocasModule.tsx`  
4. Tabelas: `public.loja_solicitacoes`, `public.loja_pedido_itens`, `public.ordens_compra`, `public.orcamentos`, `public.clientes`, `public.faturas`, `public.produtos`, `public.produto_variantes`, `public.loja_reembolsos`, `public.carteira_lancamentos`, `public.pontos_movimentacoes`  
5. Gatilhos de integridade: `prevent_saldo_tampering()`, `gsa_guard_client_credit_limits()`  
6. Suíte de testes: `src/tests/marketplace-returns-exchanges-atomicity.test.ts` e simulador `marketplacePostSalesSimulator.ts`

---

## 1. SUMÁRIO EXECUTIVO

A auditoria técnica aprofundada realizada na migração `20260910180000_marketplace_acid_concurrency_remediation.sql` e na RPC `gsa_admin_atualizar_solicitacao_loja` revelou **vulnerabilidades críticas de severidade P0**, além de **erros de sintaxe e semântica SQL letais** que impediriam a execução em produção ou causariam vazamento massivo de estoque e fundos:

1. **Quebra de Atomicidade e Bloqueio de Execução (P0)**:
   - A condição de disparo do estorno `(v_status_to_save = 'devolucao_recebida' OR (v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso'))` falha para aprovações padrão, pois `tipo = 'reembolso'` **não existe** no domínio de `loja_solicitacoes` (cujos valores canônicos são `'devolucao'` ou `'troca'`). Ao aprovar uma devolução, **nenhum estorno financeiro ou recomposição de estoque é disparado**.
   - No front-end (`LojaTrocasModule.tsx`), a transição para `devolucao_recebida` e `concluido` é feita por um `UPDATE` direto via Supabase Client (`handleUpdateAdvancedStatus`), ignorando a RPC e impedindo qualquer execução de estorno ou recomposição no banco.
   - Há incompatibilidade na nomenclatura dos parâmetros entre o front-end (`p_session_token`, `p_novo_status`) e a migração (`p_token`, `p_status`), gerando erro de PostgREST na invocação nominal da RPC.

2. **Recomposição Indevida de Estoque Total (Phantom Stock Leak - P0)**:
   - O loop de recomposição itera sobre **todos os itens do pedido de origem** (`loja_pedido_itens WHERE orcamento_id = v_orc.id`), e não sobre os itens efetivamente devolvidos.
   - Em devoluções parciais (ex.: comprou 5 itens, devolveu 1), o sistema repõe o estoque de **todos os 5 itens**, inflando artificialmente tanto a tabela `produtos` quanto a tabela `produto_variantes`.

3. **Falha Fatal de Execução no Estorno de Carteira (P0)**:
   - A migração tenta atualizar a coluna inexistente `carteira_saldo` em `public.clientes` (o nome canônico correto em todo o banco é `saldo_carteira`).
   - A migração tenta inserir em uma tabela inexistente `public.carteira_movimentacoes` (o ledger canônico do sistema é `carteira_lancamentos` e `extrato_financeiro`).
   - No PostgreSQL, a execução da RPC resulta em exceção imediata: `column "carteira_saldo" of relation "clientes" does not exist`.
   - Adicionalmente, a migração não invoca `set_config('gsa.credit_release', 'on', true)`, o que faz o trigger de proteção `prevent_saldo_tampering()` barrar qualquer atualização feita por ator autenticado com a mensagem `'Acesso negado: Saldos não podem ser alterados diretamente.'`.

4. **Inconsistências no Estorno de Pontos e Brechas Anti-Exploit (P1)**:
   - O cálculo de pontos estornados utiliza `floor(v_orc.desconto_pontos * 100)` em vez de `round()`, gerando risco de truncamento numérico.
   - O estorno é registrado como `tipo = 'ganho'` na tabela `pontos_movimentacoes`, quando o tipo financeiro canônico é `'estorno'`.
   - **Vulnerabilidade de Exploração (Infinite Loyalty Loop)**: Ao devolver um item, os pontos ganhos na compra original **não são revogados** (clawback). O cliente pode comprar R$ 1.000, acumular 1.000 pontos, devolver os produtos, receber o dinheiro de volta e manter os 1.000 pontos.
   - A comissão do afiliado indicador (`indicador_id`) não é estornada na devolução.

5. **Insegurança Transacional em Faturas e Reembolsos de Pagamentos Externos (P1)**:
   - Se o pedido foi pago via PIX, Cartão de Crédito ou Boleto, a RPC **não gera registro na tabela `loja_reembolsos`** nem estorna o saldo na carteira. O dinheiro pago pelo cliente fica retido sem tracking operacional para o financeiro.
   - Faturas de diferença de troca (`FAT-TROCA-...`) geradas na aprovação não são canceladas caso a solicitação seja subsequentemente rejeitada ou cancelada.
   - Para Crédito GSA (`is_amortizacao_credito`), parcelas já quitadas (`status = 'pago'`) não são estornadas em dinheiro/carteira, embora o limite de crédito total do orçamento seja integralmente devolvido ao cliente.

---

## 2. AUDITORIA DETALHADA POR REQUISITO

### 2.1 ATOMICIDADE: APROVAÇÃO SEM EXECUÇÃO COMPLETA DO ESTORNO
**Pergunta:** *O fluxo garante execução tudo-ou-nada? Uma devolução pode ser aprovada sem que o estorno integral seja executado?*

**Evidência no Código (`20260910180000`, linhas 111-115):**
```sql
-- Atomic Restock and Refunds when item is physically returned or approved
IF (v_status_to_save = 'devolucao_recebida' OR (v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso')) AND v_sol.orcamento_origem_id IS NOT NULL THEN
  SELECT * INTO v_orc
  FROM public.orcamentos
  WHERE id = v_sol.orcamento_origem_id
  FOR UPDATE;
```

**Análise Lógica e Prova de Falha:**
1. **Domínio de `tipo` em `loja_solicitacoes`:**
   - No arquivo `src/types.ts:800`: `tipo: 'troca' | 'devolucao';`.
   - Na migração `20260714056400:573-613`:
     ```sql
     IF v_type = 'devolucao' THEN ... ELSE ... (v_type = 'troca')
     ```
   - O valor `'reembolso'` **não existe** como `tipo` de solicitação de loja.
2. **Avaliação Booleana na Aprovação:**
   - Quando o administrador abre a solicitação de devolução (`tipo = 'devolucao'`) e clica em "Aprovar Solicitação" (`newStatus = 'aprovado'`):
     - `v_status_to_save` = `'aprovado'`
     - `v_sol.tipo` = `'devolucao'`
     - Expressão 1: `(v_status_to_save = 'devolucao_recebida')` $\rightarrow$ **FALSE**
     - Expressão 2: `(v_status_to_save = 'aprovado' AND v_sol.tipo = 'reembolso')` $\rightarrow$ `TRUE AND FALSE` $\rightarrow$ **FALSE**
     - Resultado: O bloco de estorno e recomposição de estoque é **completamente ignorado**.
3. **Bypass no Front-end (`LojaTrocasModule.tsx`):**
   - No modal de resolução, o botão de recebimento físico (`devolucao_recebida`, linha 602) e o de conclusão (`concluido`, linha 641) chamam a função local `handleUpdateAdvancedStatus`:
     ```typescript
     const { error } = await supabase
       .from('loja_solicitacoes')
       .update({
         status: targetStatus,
         historico_status: novoHistorico,
         ...payload,
         updated_at: new Date().toISOString()
       })
       .eq('id', selectedSolicitacao.id);
     ```
   - Essa chamada realiza um `UPDATE` direto na tabela `loja_solicitacoes`. A RPC `gsa_admin_atualizar_solicitacao_loja` **nunca é chamada**. Como não há triggers em `loja_solicitacoes` para disparar reposição de estoque ou estorno de fundos, o pedido transita até `'concluido'` sem que nenhuma operação de estoque ou estorno ocorra no banco.
4. **Fluxo Presencial Inacessível:**
   - Para devoluções presenciais (`metodo_entrega = 'pessoalmente'`), o ciclo de vida da UI é: `'pendente'` $\rightarrow$ `'aprovado'` $\rightarrow$ `'agendado'` $\rightarrow$ `'concluido'`.
   - O status `'devolucao_recebida'` **nunca ocorre** nesse fluxo. Quando a RPC é chamada com `'concluido'`, a condição da linha 111 avalia para **FALSE**.
5. **Veredito de Atomicidade:** **REPROVADO**. É perfeitamente possível (e atualmente o comportamento padrão do sistema) que uma devolução seja aprovada e concluída sem nenhum estorno executado.

---

### 2.2 RECOMPOSIÇÃO DE ESTOQUE (`PRODUTO` E `PRODUTO_VARIANTE`)
**Pergunta:** *A quantidade exata é devolvida tanto ao `produto` quanto à sua `produto_variante` correspondente?*

**Evidência no Código (`20260910180000`, linhas 123-138):**
```sql
-- 1. Restock inventory
FOR v_item IN (
  SELECT produto_id, produto_variante_id, quantidade
  FROM public.loja_pedido_itens
  WHERE orcamento_id = v_orc.id AND tipo = 'produto'
) LOOP
  IF v_item.produto_variante_id IS NOT NULL THEN
    UPDATE public.produto_variantes
    SET estoque_disponivel = estoque_disponivel + v_item.quantidade
    WHERE id = v_item.produto_variante_id AND controle_estoque = true;
  END IF;

  UPDATE public.produtos
  SET estoque_disponivel = estoque_disponivel + v_item.quantidade
  WHERE id = v_item.produto_id AND controle_estoque = true;
END LOOP;
```

**Análise Matemática e Concorrência:**
1. **Distorção de Devolução Parcial (Phantom Stock):**
   - A consulta busca `FROM public.loja_pedido_itens WHERE orcamento_id = v_orc.id`.
   - **Caso de Prova:** O cliente comprou:
     - 1x Camisa Polo Azul G (produto_id: `prod-1`, variante_id: `var-1`, quantidade: 1)
     - 1x Tênis Esportivo Tam 42 (produto_id: `prod-2`, variante_id: `var-2`, quantidade: 1)
     - 1x Relógio Digital (produto_id: `prod-3`, variante_id: NULL, quantidade: 1)
   - O cliente abriu solicitação de devolução **apenas do Relógio Digital**.
   - Ao processar a devolução, o loop reabastece **a Camisa, o Tênis e o Relógio**. O estoque de `prod-1`, `var-1`, `prod-2` e `var-2` é incrementado indevidamente no almoxarifado, criando discrepância contábil e física (estoque fantasma).
2. **Ausência de Trava de Idempotência:**
   - Não existe flag na tabela `loja_solicitacoes` (ex.: `recomposicao_estoque_executada boolean`) indicando que o estoque já foi restabelecido.
   - Caso um operador acione a transição para `devolucao_recebida` mais de uma vez (ou caso a solicitação seja revertida para análise e recepcionada novamente), o loop executa novamente, somando duplicadamente as quantidades ao `estoque_disponivel`.
3. **Locking de Linha:**
   - O `UPDATE` em `produto_variantes` e `produtos` não é precedido por um `SELECT ... FOR UPDATE` ordenado por ID. Em cenários de alta concorrência com checkouts simultâneos, a atualização fora de ordem lexicográfica pode induzir a *Deadlocks* (Erro `40P01` no PostgreSQL).
4. **Veredito de Estoque:** **REPROVADO**. O algoritmo não filtra os itens devolvidos e repõe indevidamente a totalidade do pedido de origem.

---

### 2.3 ESTORNO DE SALDO EM CARTEIRA (`CARTEIRA_SALDO`)
**Pergunta:** *O saldo em `carteira_saldo` é estornado com exatidão caso tenha sido utilizado?*

**Evidência no Código (`20260910180000`, linhas 140-152):**
```sql
-- 2. Refund Wallet Balance
IF coalesce(v_orc.abatimento_carteira, 0) > 0 THEN
  UPDATE public.clientes
  SET carteira_saldo = coalesce(carteira_saldo, 0) + v_orc.abatimento_carteira
  WHERE id = v_sol.cliente_id;

  INSERT INTO public.carteira_movimentacoes(cliente_id, tipo, valor, saldo_apos, descricao)
  VALUES (
    v_sol.cliente_id, 'credito', v_orc.abatimento_carteira,
    coalesce(v_cliente.carteira_saldo, 0) + v_orc.abatimento_carteira,
    'Estorno de saldo por devolução (Pedido #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text) || ')'
  );
END IF;
```

**Erros e Quebras Fatais Identificadas:**
1. **Erro de Coluna Inexistente (`carteira_saldo` vs `saldo_carteira`):**
   - Na tabela `public.clientes`, a coluna oficial é **`saldo_carteira`**.
   - A coluna `carteira_saldo` **não existe** no esquema do banco de dados (confirmado em todas as 25 migrations de auditoria financeira, e.g., `20260711160000`, `20260714032000`, `20260714056100`).
   - Impacto: Quando `v_orc.abatimento_carteira > 0`, o comando falha fatalmente com:
     `ERROR: column "carteira_saldo" of relation "clientes" does not exist`.
2. **Erro de Tabela Inexistente (`carteira_movimentacoes`):**
   - A tabela `public.carteira_movimentacoes` **não existe** no banco de dados.
   - A tabela oficial de lançamentos de carteira é **`public.carteira_lancamentos`** (colunas: `cliente_id`, `valor`, `tipo`, `descricao`) acompanhada de **`public.extrato_financeiro`**.
   - Impacto: O comando falha com `ERROR: relation "public.carteira_movimentacoes" does not exist`.
3. **Bloqueio por Gatilho de Segurança (`prevent_saldo_tampering`):**
   - A migração `20260723114000_bypass_client_sensitive_guard_in_rpcs.sql` define o gatilho `prevent_saldo_tampering` na tabela `clientes`:
     ```sql
     IF current_setting('my.app.bypass_saldo_check', true) = 'on'
        OR current_setting('gsa.credit_release', true) = 'on' THEN
         RETURN NEW;
     END IF;

     IF auth.role() = 'authenticated' THEN
         IF NEW.saldo_carteira IS DISTINCT FROM OLD.saldo_carteira OR NEW.saldo_pontos IS DISTINCT FROM OLD.saldo_pontos THEN
             RAISE EXCEPTION 'Acesso negado: Saldos não podem ser alterados diretamente.';
         END IF;
     END IF;
     ```
   - A migração `20260910180000` **não executa** `PERFORM set_config('gsa.credit_release', 'on', true)`. Logo, mesmo que a coluna fosse renomeada para `saldo_carteira`, a execução por usuário com role `authenticated` (administrador logado na interface web) sofreria rejeição imediata com rollback da transação inteira.
4. **Veredito de Carteira:** **REPROVADO**. Código quebrado em tempo de execução, tabela fantasma e trigger bypass ausente.

---

### 2.4 ESTORNO DE PONTOS DE FIDELIDADE (`PONTOS_FIDELIDADE`)
**Pergunta:** *Os pontos de fidelidade são estornados com exatidão e registrados na tabela de movimentações?*

**Evidência no Código (`20260910180000`, linhas 154-168):**
```sql
-- 3. Refund Points
IF coalesce(v_orc.desconto_pontos, 0) > 0 THEN
  v_refunded_points := floor(v_orc.desconto_pontos * 100)::integer;
  UPDATE public.clientes
  SET saldo_pontos = coalesce(saldo_pontos, 0) + v_refunded_points
  WHERE id = v_sol.cliente_id;

  INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido)
  VALUES (
    v_sol.cliente_id, 'ganho', v_refunded_points,
    coalesce(v_cliente.saldo_pontos, 0) + v_refunded_points,
    'Estorno de pontos por devolução (Pedido #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text) || ')',
    v_orc.desconto_pontos
  );
END IF;
```

**Análise Matemática e de Segurança:**
1. **Truncamento Aritmético (`floor` vs `round`):**
   - O uso de `floor(v_orc.desconto_pontos * 100)` para conversão de moeda para pontos pode sofrer com imprecisões de ponto flutuante em operações compostas. Exemplo: um desconto calculado como `9.999999` resulta em `999` com `floor`, quando o valor correto é `1000` (`round`). O padrão estabelecido na migração canônica `20260714056100:302` é:
     ```sql
     v_points_to_restore := round(v_points_discount * 100)::integer;
     ```
2. **Tipo de Movimentação Contábil Inadequado:**
   - O registro na tabela `pontos_movimentacoes` utiliza `tipo = 'ganho'`.
   - Nas transações do programa de fidelidade da GSA, estornos de pedidos cancelados/devolvidos devem ser registrados como `tipo = 'estorno'` (ou `'estorno_desconto'`). Definir como `'ganho'` corrompe os relatórios de gamificação e extrato do cliente, fazendo parecer uma bonificação promocional.
3. **Brecha de Fraude Financeira: Ausência de Clawback dos Pontos Ganhos:**
   - Na conclusão da compra original, o cliente acumula pontos de fidelidade com base no valor pago (regra 1 ponto por real líquido).
   - O código em `20260910180000` apenas devolve os pontos que foram **gastos como desconto**.
   - O código **não revoga os pontos que foram creditados ao cliente pela compra**!
   - **Vulnerabilidade de Arbitragem**: Um usuário compra R$ 5.000,00 em produtos no cartão ou PIX, ganha 5.000 pontos. Em seguida, solicita devolução de 100% dos produtos. Recebe estorno do dinheiro e **mantém os 5.000 pontos**, os quais podem ser convertidos em saques ou novos pedidos.
4. **Ausência de Revogação de Comissão de Indicação:**
   - Não há reversão do bônus de indicação (`indicador_id`) concedido ao afiliado responsável pelo cliente, permitindo conluio entre afiliado e comprador para gerar comissões artificiais via compra e devolução.
5. **Bloqueio por Trigger:**
   - Assim como na carteira, `prevent_saldo_tampering` monitora alterações em `saldo_pontos` e abortará a transação caso a variável de sessão não seja ativada.
6. **Veredito de Pontos:** **REPROVADO**. Suscetível a truncamento, vulnerável a exploit de acúmulo infinito de pontos e sujeito a bloqueio por trigger.

---

### 2.5 EMISSÃO E CANCELAMENTO DE FATURAS (`FATURAS`)
**Pergunta:** *As faturas são geradas e canceladas com segurança transacional?*

**Evidência no Código (`20260910180000`, linhas 84-108 e 171-197):**
```sql
-- Handle difference invoice
IF v_status_to_save = 'aprovado' AND v_diff > 0 THEN
  v_codigo_fatura := 'FAT-TROCA-' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text);

  SELECT id INTO v_fatura_id
  FROM public.faturas
  WHERE codigo_fatura = v_codigo_fatura
  LIMIT 1;

  IF v_fatura_id IS NULL THEN
    INSERT INTO public.faturas(
      codigo_fatura, cliente_id, valor_total, valor_final_pendente, valor_base_original,
      status, tipo, gerada_automaticamente, is_amortizacao_credito, data_vencimento, itens_faturados
    )
    VALUES (
      v_codigo_fatura, v_sol.cliente_id, v_diff, v_diff, v_diff,
      'pendente', 'produto', true, false, current_date + 2,
      jsonb_build_array(jsonb_build_object(
        'codigo', 'DIF-' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text),
        'descricao', 'Diferenca de valor na troca de produto (Ref. Solicitacao #' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text) || ')',
        'valor_unitario', v_diff, 'quantidade', 1, 'subtotal', v_diff, 'tipo', 'produto'
      ))
    )
    RETURNING id INTO v_fatura_id;
  END IF;
END IF;
```

**Análise de Segurança Transacional:**
1. **Faturas Órfãs em Trocas Canceladas ou Rejeitadas:**
   - Quando uma troca é aprovada com diferença a pagar (`v_diff > 0`), a fatura `FAT-TROCA-...` é emitida no status `'pendente'`.
   - Se o cliente desiste da troca, ou se o administrador rejeita/cancela a solicitação posteriormente (`v_status_to_save IN ('rejeitado', 'cancelado')`), a RPC **não cancela a fatura gerada**.
   - A fatura permanece aberta e em débito no painel financeiro do cliente, podendo negativar o cliente ou gerar cobrança indevida.
2. **Inconsistência nos Pagamentos com Crédito GSA:**
   - A query da linha 173:
     ```sql
     SELECT EXISTS (
       SELECT 1
       FROM public.faturas
       WHERE cliente_id = v_sol.cliente_id
         AND is_amortizacao_credito = true
         AND itens_faturados @> jsonb_build_array(jsonb_build_object('codigo', 'CRE-' || v_orc.codigo_orcamento))
     ) INTO v_tem_fatura_credito;
     ```
   - E a linha 187:
     ```sql
     UPDATE public.faturas
        SET status = 'cancelado', ...
      WHERE ... AND status <> 'pago';
     ```
   - **Cenário de Inconsistência Contábil**: Se o cliente comprou em 3 parcelas de R$ 100,00 e já pagou a 1ª parcela:
     - Linha 181: Devolve o valor total do orçamento `coalesce(v_orc.total, 0)` (R$ 300,00) ao `limite_credito_disponivel`.
     - As parcelas 2 e 3 (não pagas) são canceladas.
     - A parcela 1 (já paga em dinheiro/PIX) **permanece como 'pago'**, mas os R$ 100,00 pagos **não são estornados** para a conta bancária ou saldo de carteira do cliente. O cliente pagou R$ 100,00 reais e teve o limite restaurado como se nunca tivesse desembolsado nada.
3. **Desprezo Total por Pagamentos Externos (PIX / Cartão de Crédito):**
   - O comentário na linha 170 indica: `-- 4. Credit Card/PIX logic`.
   - No entanto, a lógica subsequente restringe-se exclusivamente a `is_amortizacao_credito = true` (Crédito próprio da loja GSA).
   - Se a compra foi paga por PIX ou Cartão via gateway:
     - Nenhuma fatura é cancelada.
     - Nenhum registro é inserido em `public.loja_reembolsos`.
     - O valor líquido pago pelo cliente não é estornado.
4. **Veredito de Faturas:** **REPROVADO**. Gera faturas órfãs, não trata parcelas quitadas de crédito e ignora transações pagas via PIX/Cartão.

---

### 2.6 AUDITORIA DE CONCORRÊNCIA, LOCKS E CASOS DE BORDA

| Item Auditado | Implementação em `20260910180000` | Comportamento sob Concorrência / Limitação | Gravidade |
|---|---|---|---|
| **Lock na Solicitação** | `SELECT ... FROM loja_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;` | **Adequado**. Impede que dois administradores alterem o mesmo registro simultaneamente. | OK |
| **Lock no Orçamento** | `SELECT ... FROM orcamentos WHERE id = v_sol.orcamento_origem_id FOR UPDATE;` | **Parcial**. É executado apenas quando a condição de estorno é atendida; na aprovação inicial é ignorado. | P2 |
| **Lock em Produtos e Variantes** | Inexistente (`UPDATE` direto sem lock prévio ordenado) | **Vulnerável a Deadlock**. Se múltiplas transações concorrentes atualizarem produtos e variantes em ordens distintas, ocorre deadlock no Postgres. | P1 |
| **Idempotência de Estorno** | Ausente (não há verificação se o estorno já ocorreu) | **Risco de Duplicidade**. Se o status transitar mais de uma vez para `devolucao_recebida`, o estoque e os créditos são duplicados. | P0 |
| **Rateio Proporcional (CDC Art. 49)** | Ausente (aplica 100% de desconto e total do pedido) | **Exploit de Devolução Parcial**. Se o cliente usou cupom/carteira e devolve 1 item de um carrinho com 5 itens, recebe o desconto total de volta. | P0 |
| **Assinatura da Função (Signature)** | `(p_sessao_id, p_token, p_solicitacao_id, p_status, p_resposta_admin)` | **Quebra de Contrato com Front-end**. Front-end envia `p_session_token` e `p_novo_status`. O PostgREST rejeita a chamada. | P0 |

---

## 3. PROVAS MATEMÁTICAS E CENÁRIOS DE EXPLORAÇÃO

### Cenário 1: O Exploit do Estoque Fantasma (Phantom Inventory Inflation)
- **Estado Inicial:**
  - Produto A (Camisa): `estoque_disponivel` = 10
  - Produto B (Jaqueta): `estoque_disponivel` = 5
- **Transação T1 (Checkout):**
  - Cliente compra 1 Camisa e 1 Jaqueta no Pedido #100.
  - Estoque Atualizado: Camisa = 9, Jaqueta = 4.
- **Transação T2 (Devolução Parcial):**
  - Cliente solicita devolução apenas da Jaqueta (insatisfação de tamanho).
  - Administrador processa devolução via `gsa_admin_atualizar_solicitacao_loja`.
  - O loop executa sobre todos os itens de `loja_pedido_itens` do Pedido #100:
    ```sql
    UPDATE produtos SET estoque_disponivel = estoque_disponivel + v_item.quantidade
    ```
  - Camisa: $9 + 1 = 10$.
  - Jaqueta: $4 + 1 = 5$.
- **Resultado Contábil:**
  - O cliente **ficou com a Camisa em casa**.
  - O estoque da Camisa no sistema voltou para **10** (quantidade idêntica à de antes da venda!).
  - **Distorção Física:** O almoxarifado possui 9 camisas, mas o sistema venderá 10. Quando o 10º cliente comprar, haverá ruptura de estoque e impossibilidade de entrega (venda a descoberto).

---

### Cenário 2: O Exploit de Fidelidade Infinita (Infinite Points Arbitrage)
- **Regra de Pontuação da GSA:** R$ 1,00 líquido gasto = 1 ponto de fidelidade. 100 pontos = R$ 1,00 de desconto (ou saque).
- **Passo 1:** Usuário possui `saldo_pontos = 0` e `saldo_carteira = R$ 0,00`.
- **Passo 2:** Usuário compra R$ 10.000,00 em equipamentos na loja via PIX.
- **Passo 3:** Pedido é marcado como `'pago'`. Sistema bonifica o usuário com **10.000 pontos**.
- **Passo 4:** No dia seguinte, usuário exerce o direito de arrependimento (Art. 49 CDC) e abre devolução.
- **Passo 5:** Administrador conclui a devolução. O dinheiro (R$ 10.000,00) é devolvido ao usuário.
- **Passo 6:** O código da RPC em `20260910180000` **não executa clawback** dos pontos creditados na compra.
- **Resultado:** O usuário continua com **10.000 pontos** intactos em sua conta, sem ter gasto 1 centavo.
- **Passo 7:** Usuário converte os 10.000 pontos em **R$ 100,00 de saldo de carteira** e solicita saque via chave PIX.
- **Dano Financeiro:** O usuário extraiu R$ 100,00 de caixa líquido da empresa a custo zero. Repetir esse ciclo 100 vezes drena R$ 10.000,00 da tesouraria do marketplace.

---

### Cenário 3: Violação de Paridade e Truncamento de Rateio
- **Estrutura do Pedido #200:**
  - Item 1: R$ 100,00
  - Item 2: R$ 100,00
  - Subtotal Bruto: R$ 200,00
  - Cupom de Boas-Vindas: -R$ 80,00
  - Total Líquido Pago: R$ 120,00
- **Devolução do Item 1:**
  - O cliente devolve o Item 1.
  - Pelo Código de Defesa do Consumidor e modelo proporcional:
    $$\text{Fator de Rateio} = \frac{\text{Líquido Pago}}{\text{Bruto Total}} = \frac{120}{200} = 0,60$$
    $$\text{Reembolso Devido} = R\$ 100,00 \times 0,60 = R\$ 60,00$$
  - No modelo errôneo de estorno bruto:
    - O cliente recebe R$ 100,00 de volta.
    - O valor restante retido pela loja é $120 - 100 = R\$ 20,00$.
    - O cliente manteve o Item 2 (que custa R$ 100,00) tendo pago apenas R$ 20,00 por ele. O desconto do cupom foi 100% apropriado pelo cliente na metade do pedido.

---

## 4. CONFRONTO: VERSÃO EM PRODUÇÃO VS MIGRAÇÃO 20260910180000

| Aspecto | Versão Legada (`20260714045000`) | Migração `20260910180000` | Requisito Canônico Robusto |
|---|---|---|---|
| **Recomposição de Estoque** | Não possuía | Recompõe todos os itens do pedido | Deve recompor **apenas** os itens devolvidos (`produto` + `variante`) |
| **Estorno de Carteira** | Não possuía | Tenta atualizar coluna inexistente `carteira_saldo` e tabela `carteira_movimentacoes` | Atualizar `saldo_carteira`, inserir em `carteira_lancamentos` e `extrato_financeiro` |
| **Estorno de Pontos Gastos** | Não possuía | Usa `floor()` e insere `tipo = 'ganho'` | Usar `round()`, inserir `tipo = 'estorno'`, bypassar trigger |
| **Clawback de Pontos Ganhos** | Não possuía | Não possui (Vulnerabilidade P0) | Deve deduzir os pontos acumulados pela compra original |
| **Clawback de Afiliado** | Não possuía | Não possui | Deve deduzir comissão creditada ao indicador |
| **Fatura de Diferença (Troca)** | Emitia `FAT-TROCA-...` | Emitia `FAT-TROCA-...` (permanece idêntico) | Emite `FAT-TROCA-...`, mas deve cancelar se rejeitada |
| **Reembolsos Externos (PIX/Cartão)** | Não tratava | Não trata (Vulnerabilidade P1) | Deve gerar registro em `public.loja_reembolsos` |
| **Faturas de Crédito GSA** | Cancelava não pagas | Cancelava não pagas (permanece idêntico) | Cancelar não pagas e estornar valor das parcelas já pagas |
| **Parâmetros da RPC** | `p_session_token`, `p_novo_status` | Alterou para `p_token`, `p_status` (Quebrou UI) | Manter compatibilidade com `LojaTrocasModule.tsx` |

---

## 5. ESPECIFICAÇÃO DA REMEDIAÇÃO TÉCNICA (PROPOSTA DE ARQUITETURA)

Para solucionar de forma definitiva e à prova de concorrência os problemas apontados, a RPC `gsa_admin_atualizar_solicitacao_loja` e o front-end `LojaTrocasModule.tsx` devem receber a seguinte reformulação arquitetural:

### 5.1 No Banco de Dados (`public.gsa_admin_atualizar_solicitacao_loja`)
1. **Configuração de Sessão para Bypass de Trigger**:
   Executar no início da RPC:
   ```sql
   PERFORM set_config('gsa.credit_release', 'on', true);
   PERFORM set_config('gsa.system_override', 'on', true);
   ```
2. **Compatibilidade e Flexibilidade de Parâmetros**:
   Aceitar os nomes canônicos esperados pelo front-end (`p_session_token`, `p_novo_status`), além de suportar aliases.
3. **Condição Correta de Disparo**:
   Disparar a devolução quando:
   - `v_status_to_save IN ('aprovado', 'concluido', 'devolucao_recebida')` para solicitações do tipo `'devolucao'`.
   - Controlar a execução através de uma flag booleana idempotente:
     `IF coalesce(v_sol.credito_estornado, false) IS TRUE THEN ... SKIP ...`
4. **Recomposição Estrita dos Itens Devolvidos**:
   - Analisar o campo `itens_devolvidos` (ou vincular via `ordens_compra` da solicitação) em vez de iterar sobre todo o pedido de origem.
   - Atualizar tanto `produto_variantes.estoque_disponivel` quanto `produtos.estoque_disponivel`.
5. **Correção de Nomenclatura Financeira**:
   - `UPDATE public.clientes SET saldo_carteira = saldo_carteira + ...`
   - `INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao) ...`
   - `INSERT INTO public.extrato_financeiro(...) ...`
6. **Anti-Exploit Clawback**:
   - Reverter os pontos concedidos na compra original:
     `UPDATE public.clientes SET saldo_pontos = greatest(saldo_pontos - v_pontos_ganhos, 0) ...`
7. **Reembolsos Externos**:
   - Se `forma_pagamento_loja IN ('pix', 'cartao', 'boleto')`, gerar registro em `public.loja_reembolsos` com status `'pendente'`.
8. **Cancelamento de Faturas Órfãs**:
   - Se a solicitação transitar para `'rejeitado'` ou `'cancelado'`, buscar e cancelar qualquer `FAT-TROCA-...` pendente associada.

### 5.2 No Front-end (`LojaTrocasModule.tsx`)
1. **Eliminar o `UPDATE` Direto em `handleUpdateAdvancedStatus`**:
   Substituir as chamadas diretas a `supabase.from('loja_solicitacoes').update(...)` por chamadas à RPC `gsa_admin_atualizar_solicitacao_loja`, garantindo que qualquer mudança de status (seja logística ou administrativa) transite pela máquina de estados atômica no PostgreSQL.

---

## 6. CONCLUSÃO

A migração `20260910180000_marketplace_acid_concurrency_remediation.sql` em seu estado atual **não atende aos critérios de integridade ACID e segurança pós-venda**. Ela introduz quebras de tempo de execução (tabelas e colunas inexistentes), bloqueio por gatilhos de segurança, e severas vulnerabilidades de concorrência e arbitragem de fidelidade.

O relatório detalhado com os apontamentos acima está pronto para servir de insumo à equipe de remediação para correção do arquivo SQL e do módulo React.
