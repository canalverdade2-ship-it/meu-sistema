# Calculadoras Pro — implantação em produção

Data UTC: 2026-07-24

Projeto Supabase validado:

- Nome: `teste 02`
- Referência: `ocgajvagxagutfvgxwsy`
- Estado verificado antes da implantação: `ACTIVE_HEALTHY`

## Migrações aplicadas

As migrações abaixo foram executadas na ordem indicada pela API de gerenciamento do Supabase:

1. `20260723233000_free_tools_pro_access.sql`
2. `20260723233500_free_tools_pro_service_permissions.sql`
3. `20260723234000_free_tools_pro_hardening.sql`
4. `20260724113000_simplify_calculator_pro_eligibility_and_public_promotions.sql`
5. `20260724130000_repair_calculator_pro_products.sql`

Execução de implantação: GitHub Actions `30093561473`.

## Produtos confirmados no banco

| Ferramenta | Ativa | Preço inicial | Duração | Benefício automático de cliente |
|---|---:|---:|---:|---:|
| Aposentadoria INSS Pro | Sim | R$ 9,90 | 1.440 minutos | Sim |
| Rescisão trabalhista Pro | Sim | R$ 9,90 | 1.440 minutos | Sim |
| Cálculo de férias Pro | Sim | R$ 9,90 | 1.440 minutos | Sim |

## Objetos validados

- 6 tabelas do módulo encontradas;
- RLS habilitada nas 6 tabelas;
- RPC de snapshot administrativo disponível ao papel `authenticated`;
- RPC de salvamento disponível ao papel `authenticated`;
- RPC de inicialização e autorreparo disponível ao papel `authenticated`;
- RPC de vouchers disponível ao papel `authenticated`;
- antigas RPCs de liberação e revogação manual individual removidas.

Execuções de validação:

- Estado dos produtos e objetos: `30093642937`;
- Contrato de segurança, RLS e permissões: `30093723194`.

Resultado final: `CALCULATOR_PRO_PRODUCTION_READY` e `CALCULATOR_PRO_SECURITY_CONTRACT_READY`.
