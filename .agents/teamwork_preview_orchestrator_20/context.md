# Context Briefing for teamwork_preview_orchestrator_20

## Original User Request
Refer to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` under header `## 2026-09-10T22:29:06Z`.

## Requested Team Scale
The user explicitly requested: `Requested team: Large-scale agent team`.
Deploy a comprehensive multi-agent swarm (explorers, workers/database specialists, test writers for concurrency simulation, adversarial reviewers, challengers, and gate auditors) to rigorously audit, mathematically verify, simulate extreme concurrency, and refactor the migration code if any flaw is detected.

## Task Objective
Revisão técnica profunda e simulação de concorrência das correções ACID recém-implementadas no banco de dados para os fluxos de checkout e devolução do marketplace.
- Working directory: ~/teamwork_projects/marketplace_acid_review
- Integrity mode: benchmark

## Requirements

### R1. Auditoria de Concorrência no Checkout (Base Function)
Analisar a função `gsa_client_checkout_store_base_20260817` no arquivo `supabase/migrations/20260716183010_update_checkout_function.sql`.
Verificar se a lógica que injeta o preço da variação `v_variant_price` está livre de vulnerabilidades de sobreposição global (evitando a mutação da tabela principal de produtos) e se os bloqueios `FOR UPDATE` impedem a venda de produtos sem estoque durante alta simultaneidade.

### R2. Auditoria de Estornos e Devoluções Atômicas
Analisar a migração `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql` e a RPC `gsa_admin_atualizar_solicitacao_loja`.
Verificar e garantir matematicamente que o fluxo de devoluções:
1. Devolve a quantidade exata ao estoque do `produto` e da sua `produto_variante` correspondente.
2. Estorna precisamente o valor em `carteira_saldo` se foi utilizado.
3. Estorna precisamente os `pontos_fidelidade` e os registra na tabela de movimentações.
4. Gera e cancela faturas com segurança transacional.

## Verification Resources
As migrations supracitadas estão disponíveis no projeto em:
- `supabase/migrations/20260716183010_update_checkout_function.sql`
- `supabase/migrations/20260817120000_product_variations_marketplace.sql`
- `supabase/migrations/20260910180000_marketplace_acid_concurrency_remediation.sql`

## Acceptance Criteria

### Testes de Estresse e Simulações
- [ ] O time deve executar simulações lógicas de concorrência extrema para provar que duas transações simultâneas no mesmo milissegundo não corrompem os preços ou o estoque.

### Integridade do Pós-Venda
- [ ] O relatório deve atestar que não há furos no fluxo que permitam a aprovação de uma devolução sem que o estorno integral (Estoque, Pontos e Saldo) seja executado na mesma transação atômica.
- [ ] Se qualquer vulnerabilidade nas lógicas escritas manualmente for encontrada, a equipe deverá refatorar a respectiva migration e apresentar a correção.

## Workspace & Directories
- Project Root: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`
- Working Directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_20`
