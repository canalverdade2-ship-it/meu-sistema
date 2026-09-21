# Project: Marketplace ACID Concurrency Review & Remediation

## Architecture
O sistema de e-commerce e marketplace do GSA HUB opera sobre PostgreSQL (Supabase) e React / TypeScript, gerenciando checkout com alta simultaneidade, precificação de produtos e variações, descontos promocionais, cupons, saldo de carteira, pontos de fidelidade e crédito loja, bem como o ciclo completo de pós-venda (trocas e devoluções atômicas).

### Componentes e Módulos Centrais:
1. **Base Checkout Engine**: `public.gsa_client_checkout_store_base_20260817` (`supabase/migrations/20260716183010_update_checkout_function.sql`). Realiza locking de linhas (`FOR UPDATE`), cálculo de preços efetivos, injeção de preço de variantes em memória privada PL/pgSQL (`v_variant_price`), validação de estoque e inserção atômica de pedidos (`orcamentos`, `loja_pedido_itens`).
2. **Variation Architecture & Checkout Wrapper**: `public.gsa_client_checkout_store` (`supabase/migrations/20260817120000_product_variations_marketplace.sql`). Valida e isola variações de produtos (`produto_variantes`), executa sanitização de carrinho e decremento de estoque das variantes.
3. **Zero-Balance Checkout Wrapper**: `supabase/migrations/20260817203000_zero_balance_store_checkout.sql`. Liquidação automática de faturas para pedidos 100% quitados via saldo/pontos.
4. **Post-Sales Return & Refund RPC**: `public.gsa_admin_atualizar_solicitacao_loja` (`supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`). Gerencia a máquina de estados de devoluções e trocas, recomposição atômica de estoque de produtos e variantes, estorno de saldo de carteira (`saldo_carteira`), estorno de pontos de fidelidade (`saldo_pontos`), faturas de diferença de troca e cancelamento de faturas de crédito.
5. **Frontend Pós-Venda**: `src/components/admin/LojaTrocasModule.tsx`. Painel administrativo de gestão de trocas e devoluções.

---

## Feature Inventory
Todas as features identificadas durante a fase de survey foram catalogadas e atribuídas a um milestone específico:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1.1: Isolamento de Preço de Variação | Garantir que `v_variant_price` opere exclusivamente em memória local PL/pgSQL (`v_product.valor`) sem mutar `public.produtos`. | M2 | ORIGINAL_REQUEST §R1 |
| 2 | R1.2: Whitelist de Chaves do Carrinho na Base | Permitir `'variante_id'` e `'produto_variante_id'` no validador `jsonb_object_keys(item)` da função base para evitar quebra de checkout com variações. | M2 | Survey (VULN-01) |
| 3 | R1.3: Preservação de Variações no Wrapper | Eliminar a remoção de `variante_id` no `v_sanitized_cart` do wrapper, garantindo que a base receba a variação e persista `loja_pedido_itens.produto_variante_id`. | M2 | Survey (VULN-02) |
| 4 | R1.4: Baixa Real de Estoque de Variantes | Corrigir a query pós-checkout no wrapper para decrementar a quantidade real comprada em `produto_variantes.estoque_disponivel` (eliminando overselling infinito de variantes). | M2 | Survey (VULN-03) |
| 5 | R1.5: Ordenação Determinística de Locks no Checkout | Padronizar aquisição de locks (`FOR UPDATE`) ordenados lexicograficamente por ID para prevenir deadlocks (Erro 40P01) sob concorrência extrema. | M2 | Survey (Deadlock 1 & 2) |
| 6 | R2.1: Gatilho de Execução no Status de Devolução | Corrigir condição na RPC para disparar estornos em `'devolucao'` quando aprovado (`aprovado`, `devolucao_recebida`, `concluido`) e adicionar flag de idempotência. | M3 | ORIGINAL_REQUEST §R2 |
| 7 | R2.2: Recomposição Precisa de Estoque (Item Devolvido) | Recompor estoque estritamente dos itens devolvidos (`produto` + `produto_variante`) com base na solicitação, eliminando recomposição fantasma de itens não devolvidos. | M3 | ORIGINAL_REQUEST §R2.1 |
| 8 | R2.3: Estorno Preciso de Saldo em Carteira | Corrigir nome de coluna para `saldo_carteira` e tabela para `carteira_lancamentos` e `extrato_financeiro`, adicionando bypass de trigger (`gsa.credit_release`). | M3 | ORIGINAL_REQUEST §R2.2 |
| 9 | R2.4: Estorno Preciso de Pontos de Fidelidade | Utilizar `round()`, inserir em `pontos_movimentacoes` com tipo canônico `'estorno'`, aplicar bypass de trigger e prevenir exploit de pontos. | M3 | ORIGINAL_REQUEST §R2.3 |
| 10 | R2.5: Segurança Transacional de Faturas de Troca e Crédito | Cancelar faturas órfãs `FAT-TROCA-...` em caso de rejeição/cancelamento, e restaurar limite de crédito com cancelamento de parcelas pendentes. | M3 | ORIGINAL_REQUEST §R2.4 |
| 11 | R2.6: Roteamento da RPC no Frontend | Atualizar `LojaTrocasModule.tsx` para direcionar mudanças de status via RPC `gsa_admin_atualizar_solicitacao_loja`, eliminando o bypass direto via `.update()`. | M3 | Survey (VULN-11) |
| 12 | R2.7: Compatibilidade de Parâmetros da RPC | Suportar tanto `p_token`/`p_status` quanto `p_session_token`/`p_novo_status` na assinatura da RPC para compatibilidade retroativa e futura. | M3 | Survey (VULN-07) |
| 13 | Concurrency Simulation & Stress Suite (E2E Track) | Desenvolver e executar simulações de concorrência extrema (Tiers 1-4) simulando requisições no mesmo milissegundo para provar integridade de preços, estoque e saldo. | M1 | ORIGINAL_REQUEST §Acceptance Criteria |
| 14 | Adversarial Stress & Forensic Integrity Gate | Execução de testes adversariais (Tier 5), testes de estresse em lote, verificação por pares e auditoria forense com zero violações. | M4 | Acceptance Criteria & Project Policy |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Concurrency Simulation & Stress Suite (E2E Track) | Implementar infraestrutura e suíte completa de testes de estresse e simulação de concorrência (Tiers 1 a 4). Publica `TEST_READY.md`. | none | PLANNED |
| 2 | Checkout & Variation Remediation (Milestone R1) | Refatorar migrações de checkout (`20260716183010` e `20260817120000`): validação de chaves na base, preservação de variante no wrapper, baixa de estoque e ordenação de locks. | none | PLANNED |
| 3 | Post-Sales Returns, Refunds & Faturas Remediation (Milestone R2) | Refatorar migração `20260910180000` e componente `LojaTrocasModule.tsx`: atomicidade de devolução, recomposição seletiva, estorno de `saldo_carteira`, pontos (`estorno`), faturas e compatibilidade de parâmetros. | M2 | PLANNED |
| 4 | Adversarial Hardening & Forensic Multi-Agent Gate (Final Milestone) | Execução de 100% dos testes de estresse (Tiers 1-4), geração e execução de casos adversariais (Tier 5), revisão por pares e aprovação por auditoria forense. | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### Checkout Base Contract (`gsa_client_checkout_store_base_20260817`)
- **Inputs**: `p_sessao_id uuid`, `p_session_token text`, `p_payload jsonb`.
- **Item Whitelist**: Permite estritamente `('tipo', 'item_id', 'quantidade', 'prazo_meses', 'variante_id', 'produto_variante_id')`.
- **Preço da Variante**: Injeta em `v_product.valor` em memória se `variante_id` estiver presente e válida.
- **Gravação em Itens**: Grava `produto_variante_id` em `loja_pedido_itens` e `ordens_compra`.

### Checkout Wrapper Contract (`gsa_client_checkout_store`)
- **Sanitização**: Preserva `'variante_id'` e `'produto_variante_id'` no objeto do carrinho antes de repassar à base.
- **Decremento de Estoque**: Consulta `loja_pedido_itens` com `orcamento_id` e `produto_variante_id`, aplicando `UPDATE produto_variantes SET estoque_disponivel = estoque_disponivel - v_requested WHERE id = v_variant.id`.
- **Bloqueio Determinístico**: Trava produtos e variantes ordenados por `(item_id, variante_id)` para evitar deadlocks com compras paralelas.

### Post-Sales RPC Contract (`gsa_admin_atualizar_solicitacao_loja`)
- **Assinatura Flexível**: Aceita `p_sessao_id uuid`, `p_session_token text` (ou `p_token text`), `p_solicitacao_id uuid`, `p_novo_status text` (ou `p_status text`), `p_resposta_admin text DEFAULT NULL`.
- **Bypass de Segurança**: Invoca `PERFORM set_config('gsa.credit_release', 'on', true)` e `set_config('gsa.system_override', 'on', true)`.
- **Idempotência**: Verifica `coalesce(v_sol.estorno_executado, false) = false` antes de efetuar estornos/recomposições e marca `estorno_executado = true`.
- **Estoque**: Restaura estoque do produto e da variante correspondente aos itens devolvidos.
- **Carteira**: Atualiza `public.clientes.saldo_carteira` e insere em `public.carteira_lancamentos`.
- **Pontos**: Atualiza `public.clientes.saldo_pontos` e insere em `public.pontos_movimentacoes` com `tipo = 'estorno'`.
- **Faturas**: Cancela faturas `FAT-TROCA-...` pendentes caso a solicitação seja cancelada ou rejeitada.

---

## Code Layout
- `supabase/migrations/20260716183010_update_checkout_function.sql` — Função base de checkout e precificação
- `supabase/migrations/20260817120000_product_variations_marketplace.sql` — Schema de variações e wrapper de checkout
- `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql` — RPC de devoluções e remediação ACID
- `src/components/admin/LojaTrocasModule.tsx` — Painel administrativo de trocas e devoluções
- `src/tests/marketplace-concurrency-simulation.test.ts` — Suite de simulação de concorrência extrema e verificação ACID
