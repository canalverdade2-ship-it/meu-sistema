# Calculadoras GSA — Free e Pro

## Estrutura de acesso

Cada calculadora pública possui dois níveis:

- **Free:** consulta simples, sem cadastro e sem identificação pessoal;
- **Pro:** consulta avançada, liberada somente após validação no servidor.

O acesso Pro pode ser concedido por:

1. pagamento avulso confirmado pela InfinitePay;
2. voucher gratuito de uma utilização;
3. liberação manual e temporária no painel administrativo;
4. período gratuito configurado pelo administrador;
5. cliente ativo, autenticado e com pelo menos uma fatura com status `pago`, quando o benefício estiver habilitado.

Visitantes podem pagar ou usar voucher sem cadastro. O acesso fica vinculado a um identificador anônimo armazenado no navegador. Clientes autenticados também recebem vínculo com a conta.

## Migrações

Aplicar em ordem:

1. `supabase/migrations/20260723233000_free_tools_pro_access.sql`
2. `supabase/migrations/20260723233500_free_tools_pro_service_permissions.sql`
3. `supabase/migrations/20260723234000_free_tools_pro_hardening.sql`

As migrações criam produtos, pagamentos, vouchers, liberações, sessões, eventos, RPCs administrativas, bloqueio global e limite de tentativas de checkout.

## Edge Functions

Publicar:

- `gsa-free-tools-pro`
- `gsa-free-tools-pro-webhook`

As duas estão configuradas com `verify_jwt = false` porque também atendem visitantes. A segurança é feita dentro das funções por identidade anônima, sessão Supabase opcional, validações de banco e confirmação do pagamento na InfinitePay.

## Secrets e variáveis

Configurar no ambiente das Edge Functions:

```text
INFINITEPAY_HANDLE=identificador_da_conta_sem_cifrao
PUBLIC_SITE_URL=https://dominio-publico-do-sistema
ALLOWED_ORIGINS=https://dominio-publico-do-sistema
```

As variáveis padrão do Supabase também precisam estar disponíveis:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` permanece exclusivamente nas Edge Functions. Ela nunca pode ser publicada no navegador.

## Checkout e confirmação

A função `gsa-free-tools-pro` cria o link de pagamento pela InfinitePay e registra um `order_nsu` único.

A liberação não confia apenas no redirecionamento do navegador. Ela ocorre somente quando:

- o webhook recebe o evento e confirma o pagamento com `payment_check`; ou
- a página de retorno consulta `payment_check` usando os identificadores recebidos.

O valor confirmado deve ser igual ou superior ao preço registrado no pedido.

## Gestão administrativa

A gestão está em:

```text
Painel administrativo → Configurações → Calculadoras Pro
```

O administrador pode:

- ativar ou desativar cada calculadora Pro;
- definir preço em reais;
- definir duração do acesso comprado;
- habilitar o benefício para clientes ativos com fatura paga;
- programar início e término de período gratuito;
- criar voucher específico ou válido para qualquer calculadora;
- cancelar vouchers não utilizados;
- pesquisar clientes e criar liberações temporárias;
- revogar liberações manuais;
- acompanhar pagamentos InfinitePay.

Ao desativar uma calculadora, as sessões Pro abertas são revogadas automaticamente.

## Validação

Executar:

```bash
npm run test:free-tools
npx tsc --noEmit
deno check supabase/functions/gsa-free-tools-pro/index.ts
deno check supabase/functions/gsa-free-tools-pro-webhook/index.ts
npm run build
```

O workflow `.github/workflows/free-tools-pro-quality.yml` executa essas verificações nas alterações do módulo.
