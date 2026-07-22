# Meu Sistema

Sistema web da GSA desenvolvido com React, TypeScript, Vite e Supabase.

## Executar localmente

**Pré-requisitos:** Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Configure as variáveis necessárias no ambiente local, incluindo as credenciais públicas do Supabase e integrações utilizadas pelo projeto. Nunca coloque chaves privilegiadas no código do navegador.

## Verificações de qualidade

```bash
npm run lint
npm run test:travel
npm run build
```

O comando `test:travel` valida as rotas principais do GSA Viagens e os contratos críticos das migrações de orçamento, aceite, checkout, documentos, suporte, cancelamentos, pagamentos e reembolsos.

## Fluxo implementado no GSA Viagens

A jornada atual contempla:

1. exploração de ofertas e detalhes do pacote;
2. orçamento personalizado, inclusive para visitantes;
3. vínculo do pacote e do lead ao atendimento;
4. geração e aceite de proposta;
5. criação da transação e cadastro de passageiros;
6. upload privado de documentos;
7. checkout e acompanhamento operacional;
8. vouchers com download por link temporário;
9. cancelamentos e reembolsos;
10. central de suporte.

## Integridade financeira das viagens

O módulo separa os seguintes valores:

- total contratado;
- total faturado;
- valor efetivamente pago e conciliado;
- saldo em aberto;
- valor ainda elegível para reembolso.

O campo legado `viagens_transacoes.valor_pago` não deve ser usado como comprovante de pagamento. As decisões de reembolso usam somente as faturas de viagem efetivamente conciliadas como pagas. Durante uma solicitação de cancelamento, cobranças abertas são suspensas sem alterar pagamentos já confirmados.

As parcelas são relacionadas às transações pela tabela `viagens_transacao_parcelas`, além dos metadados históricos das faturas. A decisão administrativa de reembolso exige simultaneamente permissão nos módulos **Viagens** e **Financeiro**.

## Implantação do GSA Viagens

As migrações devem ser aplicadas no Supabase na ordem cronológica. Entre as migrations centrais do módulo estão:

1. `20260720120000_fix_gsa_viagens_core_flow.sql`
2. `20260720123000_gsa_viagens_storage_and_quotes.sql`
3. `20260720130000_gsa_viagens_cancelamento_rpc.sql`
4. `20260720140000_gsa_viagens_hardening.sql`
5. `20260720230000_gsa_viagens_parcelamento_checkout.sql`
6. `20260721150000_gsa_viagens_financial_integrity.sql`
7. `20260721150100_gsa_viagens_admin_refund_queue.sql`

As migrations financeiras:

- preservam o valor total do contrato sem tratá-lo como pagamento;
- calculam pagamentos pela situação real das faturas;
- evitam reembolso acima do valor conciliado;
- suspendem cobranças não pagas durante o cancelamento;
- adicionam idempotência às solicitações e decisões;
- criam a fila administrativa protegida para análise financeira.

Os buckets `viagens-documentos` e `viagens-vouchers` são privados. Vouchers administrativos devem ser gravados seguindo o caminho:

```text
<cliente_id>/<transacao_id>/<nome-do-arquivo>
```

Documentos de passageiros usam:

```text
<cliente_id>/<passageiro_id>/<nome-do-arquivo>
```

Nunca exponha a chave `service_role` no navegador. Operações administrativas privilegiadas devem permanecer no backend, em RPCs protegidas ou Edge Functions.

## GSA Anúncios

As funções públicas de captação e veiculação usam CORS por lista explícita, limitação de requisições e RPCs internas restritas ao `service_role`. Antes de implantar, configure a variável de repositório `ADVERTISING_ALLOWED_ORIGINS` com uma ou mais origens HTTPS separadas por vírgula. O workflow converte essa variável no segredo `ALLOWED_ORIGINS` do Supabase e interrompe a implantação quando a configuração é ausente ou insegura.

As funções de webhook e agendamento são públicas somente no gateway: o webhook exige HMAC e o agendador exige um segredo próprio. A função administrativa `gsa-advertiser-admin` mantém a verificação JWT do Supabase habilitada e reconfirma a permissão do módulo no banco.

Validação local principal:

```bash
npm run test:advertising
npm run test:advertising-complete
npm run build
```

O workflow `advertising-foundation.yml` também executa os testes Deno e exercita o fluxo completo em um PostgreSQL temporário, incluindo proposta, cobrança, criativo, entrega e métricas.
