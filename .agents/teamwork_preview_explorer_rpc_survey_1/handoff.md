# Handoff Report — Explorer 3 (Financial RPC Explorer)

## 1. Observation

1. **Ausência de RLS na tabela `vouchers`:**
   - Em `supabase/migrations/20260830023000_harden_client_portal_end_to_end.sql` (linhas 11-15), o array de tabelas protegidas é definido como:
     ```sql
     v_tables constant text[] := ARRAY[
       'clientes', 'carteira_lancamentos', 'pontos_movimentacoes',
       'emprestimos', 'loja_credito_solicitacoes', 'notificacoes',
       'tickets', 'cliente_documentos', 'faturas', 'transferencias', 'saques'
     ];
     ```
   - A tabela `vouchers` não consta em `v_tables`, não teve `ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY` executado e não possui políticas ativas para isolar dados do cliente (`gsa_client_own_vouchers_read`), contrariando o critério R2 do prompt (`ORIGINAL_REQUEST.md`, linha 351).

2. **Webhooks WhatsApp efetuando saques com operações desacopladas e sem ledger:**
   - Em `server_webhook_vps_live.cjs` (linhas 5133-5155) e `server_webhook.cjs` (linhas 5179-5201):
     ```javascript
     supabasePatch(`/rest/v1/clientes?id=eq.${session.client.id}`, { saldo_carteira: 0 }, (errPatch, resPatch) => {
       if (errPatch) { ... }
       const saqueData = {
         cliente_id: session.client.id,
         valor: valor,
         taxa_aplicada: 0,
         valor_liquido: valor,
         tipo_chave_pix: session.pixType,
         chave_pix: pixKey,
         status: 'pendente',
         data_solicitacao: new Date().toISOString()
       };
       supabasePost('/rest/v1/saques', saqueData, (errPost, resPost) => { ... });
     });
     ```
   - Não há transação atômica entre o PATCH e o POST. Se o POST falhar, o saldo do cliente é deletado e nenhum registro de saque é gerado. Não há geração de registros em `extrato_financeiro` nem `carteira_lancamentos`.

3. **Saque de prestador via WhatsApp gerando registro zerado:**
   - Em `server_webhook_vps_live.cjs` (linhas 6454-6458) e `server_webhook.cjs` (linhas 6500-6504):
     ```javascript
     supabasePost('/rest/v1/prestador_saques', {
       prestador_id: provider?.id || null,
       chave_pix: pixKey,
       valor: 0.00,
       status: 'solicitado'
     }, () => { ... });
     ```
   - Insere saque com `valor: 0.00` e não debita a conta corrente em `prestador_transacoes`.

4. **Double-spending no saque de afiliados:**
   - Em `supabase/migrations/20260729110000_fix_affiliate_all_issues.sql` (linhas 177-204):
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
     ) VALUES ( ... );
     ```
   - O saldo da carteira é somado ao disponível de saque do afiliado, mas `clientes.saldo_carteira` não é debitado nem bloqueado no momento da solicitação.

5. **Exposição pública de RPC de conversão de pontos sem autenticação:**
   - Em `supabase/migrations/20260828120000_atomic_points_conversion.sql` (linhas 5-92):
     ```sql
     CREATE OR REPLACE FUNCTION public.gsa_converter_pontos_carteira(
       p_cliente_id uuid,
       p_pontos integer DEFAULT NULL
     ) RETURNS jsonb ... SECURITY DEFINER ...
     GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) TO anon, authenticated, service_role;
     ```
   - A função não valida a identidade do chamador (`auth.uid()` ou sessão) e é executável por `anon`.

6. **Trigger de proteção de saldo bloqueando operações administrativas e de faturas:**
   - Em `supabase/migrations/20260723114000_bypass_client_sensitive_guard_in_rpcs.sql` (linhas 1-21):
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
   - As funções `gsa_admin_processar_saque` (`20260714020000`, linha 110), `gsa_admin_ajustar_saldo_cliente` (`20260826233000`, linha 171), `gsa_client_pagar_fatura` (`20260714054000`, linha 627) e `gsa_admin_processar_transferencia` (`20260714020000`, linhas 355, 375) alteram `saldo_carteira` ou `saldo_pontos` sem ativar `bypass_saldo_check`, falhando com exceção sob a role `authenticated`.

7. **Inversão lógica de débito/crédito em `gsa_admin_ajustar_saldo_cliente`:**
   - Em `supabase/migrations/20260826233000_db_rpc_integrity_remediation.sql` (linhas 170-174):
     ```sql
     IF p_tipo = 'credito' THEN
       UPDATE public.clientes SET saldo_carteira = COALESCE(saldo_carteira, 0) + p_valor WHERE id = p_cliente_id;
     ELSE
       UPDATE public.clientes SET saldo_carteira = GREATEST(0, COALESCE(saldo_carteira, 0) - p_valor) WHERE id = p_cliente_id;
     END IF;
     ```
   - Em `src/components/admin/ClientesModule.tsx` (linhas 1582-1585), o frontend envia `p_tipo: 'entrada'`. O backend compara estritamente com `'credito'`, caindo no `ELSE` e debitando o saldo do cliente quando a intenção era adicionar.

---

## 2. Logic Chain

1. **Acesso não autorizado a vouchers (Obs 1):** Como o PostgreSQL exige `ENABLE ROW LEVEL SECURITY` e declaração explícita de `POLICY` para isolar linhas entre clientes na role `authenticated`, a ausência de `vouchers` na migration `20260830023000` deixa a tabela vulnerável a leitura direta via API REST Supabase.
2. **Perda de fundos nos webhooks (Obs 2):** Como HTTP é stateless e não transacional entre requisições distintas, executar um PATCH seguido de POST sem uma RPC atômica viola a propriedade de atomicidade (ACID). Se a conexão cair antes do POST, o dinheiro sumiu do cliente sem deixar rastro no extrato financeiro.
3. **Inconsistência contábil de prestadores (Obs 3):** Como a tabela `prestador_transacoes` é a base da contabilidade do prestador e a criação do saque via webhook insere `valor: 0.00` em `prestador_saques` sem débito em `prestador_transacoes`, a solicitação torna-se inoperante para aprovação pelo administrador.
4. **Gasto duplo em comissões de afiliados (Obs 4):** A função de saque de afiliados soma o `saldo_carteira` para compor o valor sacável, mas não altera o saldo da carteira no banco no momento do pedido. Como o saldo da carteira continua disponível para compras e transferências, o cliente pode consumir esse saldo em outra frente antes da aprovação do saque pelo ADM, resultando em pagamento duplicado.
5. **Manipulação indevida de pontos por terceiros (Obs 5):** Uma função `SECURITY DEFINER` roda com privilégios de superusuário/dono. Concedida a `anon` e aceitando qualquer `p_cliente_id`, ela permite que qualquer pessoa force a conversão de pontos de qualquer usuário arbitrário.
6. **Quebra de fluxo operacional por trigger de segurança (Obs 6):** O trigger `prevent_saldo_tampering` foi criado para impedir que o cliente altere seu próprio saldo diretamente. Contudo, ao esquecer o bypass de sessão nas rotinas de rejeição de saques, estorno de transferências, ajuste manual e pagamento de faturas, essas rotinas disparam o trigger e abortam a transação.
7. **Subtração indevida no ajuste de saldo do cliente (Obs 7):** O frontend envia `'entrada'` para adições de saldo e o backend só adiciona se a string for exatamente `'credito'`, debitando em todos os outros casos. Logo, um clique de "adicionar saldo" no painel ADM reduz o saldo do cliente.

---

## 3. Caveats

- Não foram inspecionadas rotinas proprietárias de provedores externos de pagamento (gateways Asaas / Mercado Pago / Efí), uma vez que o webhook local atua na camada intermediária Evolution/WhatsApp.
- A auditoria não executou testes com mutações reais em produção, mantendo-se estritamente em modo de leitura e análise de código e migrations.

---

## 4. Conclusion

O sistema de RPCs financeiras possui fundações sólidas no fluxo principal web (especialmente nas transações baseadas em `gsa_client_session_actor`, travas mútuas ordenadas e chaves de idempotência). No entanto, há vulnerabilidades de alta prioridade que precisam ser saneadas antes de liberar o sistema para produção:
1. Ativar RLS e políticas de acesso restrito na tabela `vouchers`.
2. Substituir as chamadas diretas REST de saques nos webhooks por RPCs atômicas com ledger completo.
3. Bloquear imediatamente o saldo da carteira ao solicitar saque de afiliados para eliminar o gasto duplo.
4. Revogar grant `anon` na RPC `gsa_converter_pontos_carteira`.
5. Inserir `bypass_saldo_check` em `gsa_admin_processar_saque`, `gsa_admin_ajustar_saldo_cliente`, `gsa_client_pagar_fatura` e `gsa_admin_processar_transferencia`.
6. Corrigir a verificação de `p_tipo` (`'entrada'`/`'credito'`) em `gsa_admin_ajustar_saldo_cliente`.

O relatório exaustivo completo está documentado em:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_rpc_survey_1\survey_report.md`.

---

## 5. Verification Method

Para verificar de forma independente os apontamentos deste laudo:

1. **Verificação de RLS na tabela `vouchers`:**
   Inspecionar `supabase/migrations/20260830023000_harden_client_portal_end_to_end.sql` (linhas 11-15) e constatar que a tabela `vouchers` não está no array de ativação de RLS e criação de políticas.
2. **Verificação dos saques do webhook WhatsApp:**
   Inspecionar `server_webhook_vps_live.cjs` (linhas 5133-5155 e 6454-6458) e constatar o `supabasePatch` desacoplado do `supabasePost` e o valor fixado em `0.00`.
3. **Verificação do double-spending em saque de afiliados:**
   Inspecionar `supabase/migrations/20260729110000_fix_affiliate_all_issues.sql` (linhas 177-204) e constatar que `v_wallet` é somado em `v_available`, mas nenhuma coluna de carteira é debitada ou travada no momento do INSERT.
4. **Verificação de autorização em `gsa_converter_pontos_carteira`:**
   Inspecionar `supabase/migrations/20260828120000_atomic_points_conversion.sql` (linhas 5-92) e constatar que não há checagem de sessão e o grant é concedido a `anon`.
5. **Verificação de inversão em `gsa_admin_ajustar_saldo_cliente`:**
   Comparar `supabase/migrations/20260826233000_db_rpc_integrity_remediation.sql` (linha 170) com `src/components/admin/ClientesModule.tsx` (linha 1582) e constatar a divergência entre `'entrada'` e `'credito'`.
