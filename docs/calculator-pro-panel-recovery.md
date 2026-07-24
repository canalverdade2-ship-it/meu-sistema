# Recuperação das configurações das Calculadoras Pro

A aba administrativa deve sempre apresentar as três configurações obrigatórias:

- Rescisão trabalhista (`termination`)
- Aposentadoria INSS (`retirement`)
- Cálculo de férias (`vacation`)

O painel tenta executar `gsa_admin_ensure_calculator_pro_products` antes da leitura. Quando o banco não retorna as três linhas, a interface exibe os valores padrão e um aviso de sincronização, em vez de permanecer em branco.

A migração `20260724130000_repair_calculator_pro_products.sql` inicializa as linhas ausentes e torna o salvamento idempotente por `tool_id`.
