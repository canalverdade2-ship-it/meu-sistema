# Relatório de Auditoria Financeira: RPCs e Funções de Banco de Dados

**Data da Auditoria:** 10 de Setembro de 2026  
**Auditor:** Explorer 3 (Financial RPC Explorer)  
**Projeto:** GSA HUB — Gestão de Serviços & Marketplace  
**Escopo:** Transações financeiras, RPCs do Supabase, Migrations SQL, Frontend React (`src/`) e Servidores de Webhook (`server_webhook*.cjs`).

---

## 1. Sumário Executivo

Esta auditoria realizou uma varredura completa e aprofundada em todas as funções de banco de dados (PostgreSQL/Supabase), chamadas RPC no frontend e manipuladores transacionais nos servidores de webhook.

O sistema possui avanços significativos de segurança e arquitetura em várias rotinas recentes (como o uso de `gsa_client_session_actor` para validação criptográfica de sessão, bloqueio `FOR UPDATE` ordenado para prevenir deadlocks em transferências entre contas e chaves de idempotência via `request_id`). No entanto, foram detectadas **vulnerabilidades críticas de severidade alta (P0/P1)** envolvendo:
1. **Falta de Row Level Security (RLS) na tabela `public.vouchers`**, permitindo que qualquer usuário autenticado leia vouchers globais e de outros clientes;
2. **Operações financeiras não-atômicas e sem ledger nos webhooks WhatsApp (`server_webhook.cjs` e `server_webhook_vps_live.cjs`)**, que zeram saldo de carteira via chamadas REST isoladas sem transação ACID, sem registro em `extrato_financeiro` e sem proteção contra requisições duplicadas;
3. **Vulnerabilidade de gasto duplo (double-spending) no saque de afiliados (`gsa_client_request_affiliate_payout`)**, que soma o saldo da carteira do cliente sem bloqueá-lo ou debitá-lo no momento da solicitação;
4. **Vulnerabilidade de autorização e execução não autenticada na RPC `gsa_converter_pontos_carteira`**, concedida para `anon` sem verificação de identidade, permitindo conversão arbitrária de pontos de terceiros;
5. **Bloqueio crônico de operações legítimas pelo trigger `prevent_saldo_tampering()`**, devido à ausência do bypass de sessão (`my.app.bypass_saldo_check`) em `gsa_admin_processar_saque`, `gsa_admin_ajustar_saldo_cliente`, `gsa_client_pagar_fatura` e `gsa_admin_processar_transferencia`;
6. **Inversão lógica e quebra de contrato de dados em `gsa_admin_ajustar_saldo_cliente`**, que debita o cliente quando o painel administrativo envia `'entrada'` e não registra lançamentos no extrato oficial;
7. **Ausência de constraints DDL `CHECK (saldo >= 0)`** no banco de dados para `saldo_carteira` e `saldo_pontos`.

---

## 2. Inventário de Funções e RPCs Financeiras

Abaixo está o mapeamento consolidado de todas as funções e procedimentos de movimentação financeira:

| Função / RPC | Arquivo de Origem (Migration) | Invocador Principal | Propósito | Nível de Segurança |
| :--- | :--- | :--- | :--- | :--- |
| `gsa_client_request_withdrawal` | `20260714056200_secure_client_wallet_points_transfers.sql` | `SaquesList.tsx` | Solicitação de saque PIX de saldo da carteira | ✅ Alta (Sessão, Idempotente, FOR UPDATE) |
| `gsa_client_cancel_withdrawal` | `20260714056200_secure_client_wallet_points_transfers.sql` | `SaquesList.tsx` | Cancelamento de saque pendente e estorno em carteira | ✅ Alta (Sessão, FOR UPDATE, Ledger) |
| `gsa_admin_processar_saque` | `20260714020000_secure_admin_withdrawal_transfer_rpcs.sql` | `FinanceiroModule.tsx` | Aprovação ou rejeição/estorno de saque pelo ADM | ⚠️ Parcial (Falta bypass do trigger de saldo) |
| `gsa_provider_request_withdrawal` | `20260830123000_provider_registration_otp_...sql` | `providerOperations.ts` | Solicitação de saque de repasses de prestador | ✅ Alta (assert_provider, FOR UPDATE) |
| `gsa_provider_cancel_withdrawal` | `20260720210000_harden_provider_portal.sql` | `providerOperations.ts` | Cancelamento e estorno de saque de prestador | ✅ Alta (assert_provider, FOR UPDATE) |
| `gsa_admin_processar_saque_prestador`| `20260714050000_secure_admin_provider_withdrawal_rpc.sql`| `PrestadoresFinanceiro.tsx` | Decisão de pagamento de saque de prestador | ✅ Alta (Admin session, FOR UPDATE) |
| `gsa_client_create_credit_withdrawal`| `20260829133000_credit_available_withdrawals.sql` | `CreditWithdrawalModal.tsx` | Saque via linha de crédito (bloqueio de limite) | ✅ Alta (Advisory lock, Idempotência) |
| `gsa_client_convert_points` | `20260714056200_secure_client_wallet_points_transfers.sql` | `ClientPontos.tsx` | Conversão de pontos em saldo financeiro (Web) | ✅ Alta (Sessão, Idempotente, FOR UPDATE) |
| `gsa_converter_pontos_carteira` | `20260828120000_atomic_points_conversion.sql` | `server_webhook_vps_live.cjs` | Conversão atômica de pontos via WhatsApp | 🚨 Vulnerável (Exposta a `anon`, sem auth) |
| `gsa_client_redeem_wallet_voucher`| `20260714056300_secure_remaining_client_financial_actions.sql`| `ClientVouchers.tsx` | Resgate de voucher financeiro na carteira | ✅ Alta (UNIQUE constraint, FOR UPDATE) |
| `gsa_partner_redemption_create_internal` | `20260828235500_partner_redemption_duplicate_guard.sql` | `service.ts` / Webhook | Resgate de vouchers e cupons de parceiros | ✅ Alta (Advisory xact lock por telefone) |
| `gsa_client_request_transfer` | `20260829050000_instant_client_transfers.sql` | `ClientTransferencias.tsx` | Transferência instantânea de saldo/pontos | ✅ Alta (ORDER BY id FOR UPDATE, ACID) |
| `gsa_client_reverse_transfer` | `20260723114000_bypass_client_sensitive_guard_in_rpcs.sql` | `ClientTransferencias.tsx` | Estorno de transferência pelo remetente/destinatário | ✅ Alta (ORDER BY id FOR UPDATE, Bal check) |
| `gsa_admin_processar_transferencia`| `20260829050000_instant_client_transfers.sql` | Painel ADM | Estorno administrativo de transferência | ⚠️ Parcial (Falta bypass do trigger de saldo) |
| `gsa_admin_ajustar_saldo_cliente` | `20260826233000_db_rpc_integrity_remediation.sql` | `ClientesModule.tsx` | Ajuste manual de saldo de cliente pelo ADM | 🚨 Quebrada (Inversão deb/cred, sem bypass) |
| `gsa_client_pagar_fatura` | `20260714054000_atomic_invoice_payment_and_points.sql` | `PaymentModal.tsx` | Pagamento de fatura usando carteira/pontos | ⚠️ Parcial (Falta bypass do trigger de saldo) |
| `gsa_client_checkout_store` | `20260817203000_zero_balance_store_checkout.sql` | `StoreHub.tsx` | Checkout no marketplace com saldo em carteira | ⚠️ Parcial (Falta bypass do trigger de saldo) |
| `gsa_client_request_affiliate_payout`| `20260729110000_fix_affiliate_all_issues.sql` | `service.ts` | Solicitação de saque PIX de comissões/carteira | 🚨 Crítica (Double-spending com carteira) |
| `gsa_admin_decide_affiliate_payout` | `20260722233000_complete_affiliate_flow.sql` | Painel ADM | Baixa e pagamento de comissões de afiliado | ⚠️ Absorve déficit de carteira sem rollback |
| `server_webhook.cjs` (Saque PIX) | `server_webhook.cjs` (linha 5173) | WhatsApp Bot (Cliente) | Solicitação de saque de carteira via WhatsApp | 🚨 Crítica (Não-atômico, sem RPC, sem ledger) |
| `server_webhook.cjs` (Prestador) | `server_webhook.cjs` (linha 6500) | WhatsApp Bot (Prestador) | Solicitação de saque via WhatsApp | 🚨 Falha Grave (Insere saque com valor R$ 0) |

---

## 3. Análise Detalhada dos 4 Pilares de Conformidade

### 3.1. Atomicidade (ACID) e Isolamento de Transações
- **No Banco de Dados (PostgreSQL):** As funções executadas em blocos `BEGIN ... END;` no PostgreSQL rodam dentro de transações atômicas implícitas. Quando há falha ou exceção (`RAISE EXCEPTION`), todo o bloco é revertido. O uso de `ORDER BY id FOR UPDATE` em transferências mútuas (`gsa_client_request_transfer` e `gsa_client_reverse_transfer`) elimina completamente o risco de *deadlock* entre contas simultâneas.
- **Nos Webhooks (Node.js CJS):** **VIOLAÇÃO GRAVE DE ACID.** Em `server_webhook.cjs` (linhas 5178-5201) e `server_webhook_vps_live.cjs` (linhas 5133-5155), o saque de carteira via WhatsApp foi implementado em duas requisições HTTP REST separadas:
  1. `supabasePatch('/rest/v1/clientes?id=eq...', { saldo_carteira: 0 })`
  2. `supabasePost('/rest/v1/saques', saqueData)`
  Caso a segunda requisição falhe por qualquer razão (timeout de rede, instabilidade da VPS, erro 500), **o saldo do cliente é deletado e o saque não é criado**, sem mecanismo de compensação ou rollback.

### 3.2. Proteção contra Race Conditions (Concorrência e Travas)
- **Implementações Fortes:**
  - `gsa_client_convert_points`: Trava a linha do cliente com `SELECT * FROM clientes WHERE id = ... FOR UPDATE;`, garantindo que requisições paralelas não debitem os mesmos pontos mais de uma vez.
  - `gsa_client_request_withdrawal`: Trava a carteira com `FOR UPDATE` e checa saldo imediatamente antes do débito.
  - `gsa_client_redeem_wallet_voucher`: Bloqueia o voucher com `SELECT * FROM vouchers WHERE id = ... FOR UPDATE` e o cliente com `FOR UPDATE`.
  - `gsa_partner_redemption_create_internal`: Utiliza advisory lock exclusivo no hash `parceiro_id + telefone` (`pg_advisory_xact_lock`), impedindo cliques duplos simultâneos na criação de resgates de benefícios.
- **Falhas de Concorrência Identificadas:**
  - `server_webhook.cjs`: A leitura do saldo é obtida da memória (`session.client.saldo_carteira`). Mensagens enviadas rapidamente pelo usuário executam dois `supabasePatch` e inserem dois registros em `saques`, permitindo sacar o dobro do valor real.
  - `cliente_premios`: A atualização em `gsa_client_operational_write` (linhas 488-494 da migration `20260720232000`) não realiza `FOR UPDATE` e não valida se o prêmio já estava em status `pendente`.

### 3.3. Prevenção de Saldo Negativo, Gasto Duplo e Replay
- **Idempotência e Replay:**
  - A tabela `gsa_client_operation_requests` com chave primária `request_id` (migration `20260714056200`) e a tabela `loja_credito_saques` com `id = p_request_id` protegem eficazmente contra repetições de requisições de rede.
- **Vulnerabilidade de Double-Spending (Afiliados + Carteira):**
  - A função `gsa_client_request_affiliate_payout` (`20260729110000_fix_affiliate_all_issues.sql`, linhas 189-198) permite ao afiliado resgatar o valor das comissões somado ao saldo da sua carteira de cliente (`+ v_wallet`).
  - **O Problema:** A função insere o pedido em `gsa_afiliado_saques`, **mas NÃO debita nem bloqueia `clientes.saldo_carteira`**. O cliente continua com o saldo disponível e pode, logo em seguida, solicitar saque comum da carteira, comprar produtos na loja ou transferir o saldo para outro cliente. Quando o administrador aprova o saque do afiliado, o dinheiro é pago duas vezes pela empresa.
- **Constraints DDL no Banco:**
  - Não existem constraints `CHECK (saldo_carteira >= 0)` ou `CHECK (saldo_pontos >= 0)` na tabela `clientes`. Toda a proteção depende exclusivamente de checagens em código PL/pgSQL.

### 3.4. Autorização e Segurança Definer (Falsificação de Transações)
- **Modelo de Sessão Criptográfica:**
  - Todas as RPCs canônicas usam `gsa_client_session_actor(p_sessao_id, p_session_token)`. Como a identidade do cliente é extraída do token de sessão no banco (`sistema_sessoes`), os clientes **não conseguem** forjar transações para outros IDs informando parâmetros de terceiros.
- **Brecha Crítica de Autorização:**
  - A RPC `gsa_converter_pontos_carteira` (criada em `20260828120000_atomic_points_conversion.sql`) é `SECURITY DEFINER` e foi concedida com `GRANT EXECUTE ... TO anon, authenticated, service_role`.
  - Ela recebe diretamente `p_cliente_id uuid` e **não valida o chamador**. Um usuário não autenticado ou qualquer cliente pode disparar essa RPC para o UUID de qualquer outro cliente, convertendo involuntariamente os pontos da vítima em saldo de carteira.

---

## 4. Achados Críticos (Detalhamento Técnico)

### [ACHADO-01] [CRÍTICO] Tabela `public.vouchers` sem Row Level Security (RLS)
- **Localização:** `supabase/migrations/20260830023000_harden_client_portal_end_to_end.sql` (linhas 11-15).
- **Evidência:** A migration de fechamento de segurança listou as tabelas protegidas no array `v_tables`:
  ```sql
  v_tables constant text[] := ARRAY[
    'clientes', 'carteira_lancamentos', 'pontos_movimentacoes',
    'emprestimos', 'loja_credito_solicitacoes', 'notificacoes',
    'tickets', 'cliente_documentos', 'faturas', 'transferencias', 'saques'
  ];
  ```
  A tabela `vouchers` foi esquecida e não consta em `v_tables`.
- **Impacto:** A tabela `public.vouchers` não tem RLS ativada no banco. Qualquer usuário com a role `authenticated` (ou `anon`, dependendo dos grants legados) pode realizar queries diretas `SELECT * FROM vouchers`, expondo códigos de vouchers e descontos de outros clientes e da empresa.
- **Critério de Aceite Afetado:** Viola o critério R2 do prompt oficial (`ORIGINAL_REQUEST.md`, linha 351).

---

### [ACHADO-02] [CRÍTICO] Webhooks WhatsApp Realizam Saques Fora de RPC e Não-Atômicos
- **Localização:**
  - `server_webhook_vps_live.cjs` (linhas 5126–5156)
  - `server_webhook.cjs` (linhas 5172–5203)
- **Evidência no Código:**
  ```javascript
  // Zera a carteira do cliente
  supabasePatch(`/rest/v1/clientes?id=eq.${session.client.id}`, { saldo_carteira: 0 }, (errPatch, resPatch) => {
    if (errPatch) { ... }
    // Insere o saque
    const saqueData = {
      cliente_id: session.client.id,
      valor: valor,
      ...
    };
    supabasePost('/rest/v1/saques', saqueData, (errPost, resPost) => { ... });
  });
  ```
- **Impacto:**
  1. Falta de atomicidade: se o POST falhar, o cliente tem seu saldo zerado e nenhum saque registrado.
  2. Ausência de auditoria: não são gerados registros nas tabelas `extrato_financeiro` nem `carteira_lancamentos`. O saldo some da conta sem rastreabilidade contábil.
  3. Stale state: usa `session.client.saldo_carteira` em memória sem trava de concorrência.
  4. Falta de idempotência: mensagens repetidas no WhatsApp geram múltiplos saques com o mesmo valor em memória.

---

### [ACHADO-03] [ALTO] Webhook de Prestador Registra Saque com Valor R$ 0,00
- **Localização:**
  - `server_webhook_vps_live.cjs` (linhas 6454–6459)
  - `server_webhook.cjs` (linhas 6500–6505)
- **Evidência no Código:**
  ```javascript
  supabasePost('/rest/v1/prestador_saques', {
    prestador_id: provider?.id || null,
    chave_pix: pixKey,
    valor: 0.00,
    status: 'solicitado'
  }, () => { ... });
  ```
- **Impacto:** O saque é inserido com `valor: 0.00` e status `'solicitado'`. A RPC oficial do prestador (`gsa_provider_request_withdrawal`) exige cálculo do saldo a partir de `prestador_transacoes` e debita a conta do prestador. No webhook, a transação não é debitada e o saque chega zerado para o administrador.

---

### [ACHADO-04] [CRÍTICO] Vulnerabilidade de Double-Spending no Saque de Afiliados
- **Localização:** `supabase/migrations/20260729110000_fix_affiliate_all_issues.sql` (linhas 177-204).
- **Evidência no Código:**
  ```sql
  SELECT coalesce(saldo_carteira, 0) INTO v_wallet
  FROM public.clientes WHERE id = v_actor.cliente_id;
  ...
  SELECT greatest(
    coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'disponivel'), 0)
    + v_wallet
    - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0),
    0
  ) INTO v_available;
  ...
  INSERT INTO public.gsa_afiliado_saques(
    request_id, afiliado_id, valor, status, pix_tipo_snapshot, pix_chave_snapshot, solicitado_em
  ) VALUES (
    p_request_id, v_affiliate.id, v_value, 'solicitado', v_affiliate.pix_tipo, v_affiliate.pix_chave, now()
  ) RETURNING * INTO v_payout;
  ```
- **Impacto:** O valor do `saldo_carteira` é contabilizado como saldo disponível para saque de afiliado, porém **não é debitado nem bloqueado na tabela `clientes`**. O usuário pode pedir o saque de afiliado e, em seguida, sacar o mesmo valor no painel do cliente ou gastá-lo no marketplace. Quando a equipe financeira pagar o saque do afiliado, terá pago um saldo que o cliente já gastou.

---

### [ACHADO-05] [ALTO] RPC `gsa_converter_pontos_carteira` Concedida a `anon` sem Autenticação
- **Localização:** `supabase/migrations/20260828120000_atomic_points_conversion.sql` (linhas 5-92).
- **Evidência no Código:**
  ```sql
  CREATE OR REPLACE FUNCTION public.gsa_converter_pontos_carteira(
    p_cliente_id uuid,
    p_pontos integer DEFAULT NULL
  ) RETURNS jsonb ... SECURITY DEFINER ...
  GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) TO anon, authenticated, service_role;
  ```
- **Impacto:** Qualquer ator externo (mesmo sem login, usando a chave pública do Supabase) pode chamar `supabase.rpc('gsa_converter_pontos_carteira', { p_cliente_id: 'uuid-de-qualquer-cliente' })`. Não há verificação de `auth.uid()` ou token de sessão.

---

### [ACHADO-06] [CRÍTICO] Trigger `prevent_saldo_tampering` Bloqueia Operações Administrativas e de Pagamento
- **Localização:**
  - Trigger: `supabase/migrations/20260723114000_bypass_client_sensitive_guard_in_rpcs.sql` (linhas 1-21).
  - RPCs afetadas:
    - `gsa_admin_processar_saque` (`20260714020000_secure_admin_withdrawal_transfer_rpcs.sql`, linha 110)
    - `gsa_admin_ajustar_saldo_cliente` (`20260826233000_db_rpc_integrity_remediation.sql`, linha 171)
    - `gsa_client_pagar_fatura` (`20260714054000_atomic_invoice_payment_and_points.sql`, linha 627)
    - `gsa_admin_processar_transferencia` (`20260714020000`, linhas 355-356, 375-376)
- **Evidência no Código:**
  O trigger `prevent_saldo_tampering()` contém:
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
  Nas 4 RPCs citadas acima, o desenvolvedor esqueceu de invocar `PERFORM set_config('my.app.bypass_saldo_check', 'on', true);`.
- **Impacto:**
  1. Quando o administrador rejeita um saque no painel e o sistema tenta estornar o saldo para o cliente, a transação aborta com erro `Acesso negado: Saldos não podem ser alterados diretamente`.
  2. Quando um cliente paga uma fatura no painel escolhendo abater com o saldo da carteira, a transação aborta com o mesmo erro.
  3. Quando o administrador tenta ajustar o saldo manualmente no painel de Clientes, a operação é bloqueada.

---

### [ACHADO-07] [ALTO] Inversão de Operação e Incompatibilidade Contratual em `gsa_admin_ajustar_saldo_cliente`
- **Localização:**
  - Backend: `supabase/migrations/20260826233000_db_rpc_integrity_remediation.sql` (linhas 149-180).
  - Frontend: `src/components/admin/ClientesModule.tsx` (linhas 1578-1593).
- **Evidência no Código:**
  Na migration:
  ```sql
  IF p_tipo = 'credito' THEN
    UPDATE public.clientes SET saldo_carteira = COALESCE(saldo_carteira, 0) + p_valor WHERE id = p_cliente_id;
  ELSE
    UPDATE public.clientes SET saldo_carteira = GREATEST(0, COALESCE(saldo_carteira, 0) - p_valor) WHERE id = p_cliente_id;
  END IF;
  ```
  No frontend (`ClientesModule.tsx`):
  ```typescript
  // balanceType pode ser 'entrada' ou 'saida'
  p_tipo: balanceType, // Envia 'entrada' para adicionar saldo!
  ```
  Como o backend verifica estritamente `IF p_tipo = 'credito'`, quando o frontend envia `'entrada'`, a condição é falsa e cai no `ELSE`, **subtraindo o valor do cliente ao invés de adicionar!**
  Além disso, a migration alterou o retorno para `jsonb_build_object('success', true, 'novo_saldo', ...)` enquanto o frontend espera `data?.saldo_atual` e `data?.ajuste`. E não grava em `extrato_financeiro` nem `carteira_lancamentos`.

---

### [ACHADO-08] [MÉDIO] Ausência de Constraint DDL de Saldo Não-Negativo na Tabela `clientes`
- **Localização:** Definições da tabela `public.clientes`.
- **Evidência:** Nenhuma migration aplica constraints `CHECK (saldo_carteira >= 0)` ou `CHECK (saldo_pontos >= 0)` na tabela `clientes`.
- **Impacto:** Caso ocorra qualquer falha lógica em queries ou scripts administrativos diretos, saldos negativos podem ser gravados no banco de dados sem que o SGBD rejeite a alteração a nível de integridade referencial e de domínio.

---

## 5. Recomendações e Propostas de Remediação

### 5.1. Remediação do RLS na tabela `public.vouchers` (P0)
Aplicar script de migration adicionando `vouchers` às políticas do cliente:
```sql
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vouchers FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vouchers TO authenticated;
GRANT ALL ON TABLE public.vouchers TO service_role;

DROP POLICY IF EXISTS gsa_management_vouchers ON public.vouchers;
CREATE POLICY gsa_management_vouchers ON public.vouchers
FOR ALL TO authenticated
USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));

DROP POLICY IF EXISTS gsa_client_own_vouchers_read ON public.vouchers;
CREATE POLICY gsa_client_own_vouchers_read ON public.vouchers
FOR SELECT TO authenticated
USING (
  public.gsa_jwt_actor_type() = 'cliente'
  AND (cliente_id = public.gsa_jwt_actor_id() OR cliente_id IS NULL)
);
```

### 5.2. Remediação dos Webhooks WhatsApp (`server_webhook*.cjs`) (P0)
Substituir o fluxo de duas chamadas REST (`supabasePatch` + `supabasePost`) por uma RPC atômica dedicada para atendimento via WhatsApp (ex: `gsa_webhook_solicitar_saque_cliente(p_cliente_id, p_pix_tipo, p_pix_chave)`), executada sob role `service_role` ou com token de autenticação de máquina, que realize:
- Trava `FOR UPDATE` no cliente;
- Validação de saldo mínimo e liberação de saque;
- Atualização atômica do saldo;
- Inserção em `saques`, `carteira_lancamentos` e `extrato_financeiro`;
- Retorno dos dados atualizados para envio ao WhatsApp.
Corrigir também o saque de prestadores para calcular o saldo real ao invés de fixar `valor: 0.00`.

### 5.3. Remediação do Double-Spending de Afiliados (P0)
Em `gsa_client_request_affiliate_payout`:
- Se a solicitação consumir saldo da carteira do cliente, travar a linha do cliente com `SELECT * FROM clientes WHERE id = ... FOR UPDATE;` e debitar imediatamente `saldo_carteira` (ou bloquear em coluna `saldo_carteira_bloqueado`), gerando o lançamento correspondente no extrato financeiro.

### 5.4. Fechamento de Acesso em `gsa_converter_pontos_carteira` (P1)
Revogar o grant público e restringir exclusivamente a `service_role`:
```sql
REVOKE ALL ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) TO service_role;
```

### 5.5. Injeção de `bypass_saldo_check` nas RPCs Legítimas (P0)
Adicionar `PERFORM set_config('my.app.bypass_saldo_check', 'on', true);` no início de:
- `gsa_admin_processar_saque`
- `gsa_admin_ajustar_saldo_cliente`
- `gsa_client_pagar_fatura`
- `gsa_admin_processar_transferencia` e `gsa_admin_processar_transferencia_legacy_20260829`
- `gsa_client_checkout_store`

### 5.6. Correção de `gsa_admin_ajustar_saldo_cliente` (P1)
Padronizar o suporte tanto a `'entrada'`/`'credito'` quanto a `'saida'`/`'debito'`, restaurar a gravação no extrato financeiro e manter as propriedades de retorno compatíveis com o frontend (`saldo_atual`, `ajuste`, `saldo_anterior`).
