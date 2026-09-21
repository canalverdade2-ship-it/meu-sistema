## 2026-09-10T22:30:19Z

From: parent (449c54e5-e413-43a4-a211-63290c3315ed)
To: teamwork_preview_orchestrator_20

Mission Overview:
Revisão técnica profunda e simulação de concorrência das correções ACID recém-implementadas no banco de dados para os fluxos de checkout e devolução do marketplace.
Integrity mode: benchmark.
Requested team: Large-scale agent team.

Key Requirements:
1. R1. Auditoria de Concorrência no Checkout (Base Function)
   - Analisar a função `gsa_client_checkout_store_base_20260817` no arquivo `supabase/migrations/20260716183010_update_checkout_function.sql`.
   - Verificar se a lógica que injeta o preço da variação `v_variant_price` está livre de vulnerabilidades de sobreposição global (evitando a mutação da tabela principal de produtos) e se os bloqueios `FOR UPDATE` impedem a venda de produtos sem estoque durante alta simultaneidade.

2. R2. Auditoria de Estornos e Devoluções Atômicas
   - Analisar a migração `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql` e a RPC `gsa_admin_atualizar_solicitacao_loja`.
   - Verificar e garantir matematicamente que o fluxo de devoluções:
     1. Devolve a quantidade exata ao estoque do `produto` e da sua `produto_variante` correspondente.
     2. Estorna precisamente o valor em `carteira_saldo` se foi utilizado.
     3. Estorna precisamente os `pontos_fidelidade` e os registra na tabela de movimentações.
     4. Gera e cancela faturas com segurança transacional.

3. Verification Resources:
   - `supabase/migrations/20260716183010_update_checkout_function.sql`
   - `supabase/migrations/20260817120000_product_variations_marketplace.sql`
   - `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`

4. Acceptance Criteria:
   - Testes de Estresse e Simulações: Executar simulações lógicas de concorrência extrema para provar que duas transações simultâneas no mesmo milissegundo não corrompem os preços ou o estoque.
   - Integridade do Pós-Venda: O relatório deve atestar que não há furos no fluxo que permitam a aprovação de uma devolução sem que o estorno integral (Estoque, Pontos e Saldo) seja executado na mesma transação atômica.
   - Se qualquer vulnerabilidade nas lógicas escritas manualmente for encontrada, refatorar a respectiva migration e apresentar a correção.
