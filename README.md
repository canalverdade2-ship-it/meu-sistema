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

O comando `test:travel` valida as rotas principais do GSA Viagens e os contratos críticos das migrações de orçamento, aceite, checkout, documentos, suporte e cancelamentos.

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

## Implantação do GSA Viagens

Antes de publicar as novas telas, aplique as migrações do Supabase na ordem cronológica:

1. `20260720120000_fix_gsa_viagens_core_flow.sql`
2. `20260720123000_gsa_viagens_storage_and_quotes.sql`
3. `20260720130000_gsa_viagens_cancelamento_rpc.sql`

Essas migrações:

- corrigem o aceite de propostas e o checkout;
- vinculam pacotes aos pedidos de orçamento;
- criam buckets privados para documentos e vouchers;
- habilitam orçamento público com dados de contato;
- adicionam o fluxo seguro de cancelamento e reembolso.

Os buckets `viagens-documentos` e `viagens-vouchers` são privados. Vouchers administrativos devem ser gravados seguindo o caminho:

```text
<cliente_id>/<transacao_id>/<nome-do-arquivo>
```

Documentos de passageiros usam:

```text
<cliente_id>/<passageiro_id>/<nome-do-arquivo>
```

Nunca exponha a chave `service_role` no navegador. Operações administrativas privilegiadas devem permanecer no backend, em RPCs protegidas ou Edge Functions.
