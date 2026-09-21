# Relatório de Diagnóstico de Compilação TypeScript, Edge Functions e Webhooks

**Auditor**: Teamwork Explorer (Integration, Edge Functions & Compilation Auditor)  
**Data**: 2026-09-11T02:25:00Z  
**Repositório**: Grupo GSA (GSA HUB)  
**Escopo**: Diagnóstico de compilação TypeScript (`tsc`, `vite build`), auditoria de todas as 16 Edge Functions em `supabase/functions/`, inspeção de segurança e concorrência dos scripts de webhook (`server_webhook_vps_live.cjs`, `server_webhook.cjs`), e validação de conformidade dos contratos de interface entre Front-end e Banco de Dados (PostgreSQL / Migrations).

---

## 1. Observation (Observações Diretas, Evidências Verbatim e Comandos)

### 1.1 Diagnóstico de Compilação TypeScript e Build do Frontend
1. **TypeScript Typecheck (`tsc --noEmit`)**:
   - **Comando executado**: `node ./node_modules/typescript/lib/tsc.js --noEmit`
   - **Resultado**: Código de saída `0` (Clean). Nenhum erro de sintaxe ou tipagem TypeScript no projeto (`src/**/*.ts`, `src/**/*.tsx`).
   - **Strict Typecheck**: `npm run typecheck:strict` (`tsc --noEmit -p tsconfig.strict.json`) executou com código de saída `0`.

2. **Frontend Production Build (`vite build`)**:
   - **Comando executado**: `npm run build`
   - **Resultado**: Código de saída `0`. Transformou 4.543 módulos em 3m 42s com sucesso gerando o bundle em `dist/`.

3. **Bloqueador no Linter / Auditor de Produção (`audit-production-real.mjs`)**:
   - **Comando**: `npm run lint` (`tsc --noEmit && node scripts/audit-production-real.mjs --enforce`)
   - **Resultado**: Código de saída `1` com a mensagem:
     `Auditoria concluída: 525 arquivos, 2 bloqueador(es), 33 ocorrência(s) para revisão.`
   - **Evidência direta (`audit/production-real-audit.md`)**:
     - `src/components/admin/gsa-tv/GsaTvMasterControl.tsx:215` — `// Elimina qualquer dado fictício anterior de testes`
     - `src/lib/gsaTvCommercialBreaks.ts:80` — `// ZERO dados fictícios: a biblioteca inicia vazia aguardando o cadastro real do operador`
   - **Causa**: O regex na linha 20 de `scripts/audit-production-real.mjs` (`regex: /(?:dados?|data)\s+(?:fict[ií]ci[oa]s?|fals[oa]s?|fake|mock)/i`) captura comentários de código que afirmam a ausência de dados fictícios, disparando falsos-positivos como bloqueadores.

---

### 1.2 Auditoria de Edge Functions (`supabase/functions/`)

1. **Bug Crítico em `gsa-transactional-email` (Tabela Inexistente e Falha Silenciosa de E-mails)**:
   - **Arquivo**: `supabase/functions/gsa-transactional-email/index.ts`, linhas 42–53:
     ```typescript
     const { data: cliente } = await supabase
       .from("clientes_pf")
       .select("nome, email")
       .eq("id", orcamento.cliente_id)
       .maybeSingle();

     if (!cliente || !cliente.email) {
       return new Response(JSON.stringify({ message: "Client or email not found" }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 200, // Não dar erro para não travar o webhook
       });
     }
     ```
   - **Fato Observado**: A tabela `clientes_pf` **não existe** no banco de dados nem nas migrações SQL (a tabela correta é `clientes`).
   - **Impacto**: Todo evento de criação ou alteração de status de pedido em `orcamentos` falha silenciosamente na busca do cliente e retorna `{ message: "Client or email not found" }`, deixando de enviar 100% dos e-mails transacionais da GSA Store.

2. **Vulnerabilidade Crítica de Segurança em `gsa-transactional-email` (Relay Não Autenticado)**:
   - **Arquivo**: `supabase/functions/gsa-transactional-email/index.ts`, linhas 22–35 e 98–150.
   - **Fato Observado**: O endpoint aceita requisições `POST` sem validar cabeçalhos de autorização (`Authorization`), sem assinatura HMAC e sem segredo compartilhado.
   - **Impacto**: Qualquer atacante na internet pode invocar `POST /functions/v1/gsa-transactional-email` com o payload `{ "type": "CUSTOM_EVENT", "event_name": "ABANDONED_CART", "payload": { "cliente": { "email": "vitima@alvo.com", "nome": "Alvo" }, "carrinhoUrl": "https://site-malicioso.com" } }` e disparar e-mails de phishing/spam arbitrários em nome de `contato@grupogsa.com.br` através da conta Resend da GSA.

3. **Vulnerabilidade de Autorização e SSRF em `vps-api`**:
   - **Arquivo**: `supabase/functions/vps-api/index.ts`, linha 123:
     ```typescript
     const isAuthorized = true; // Permite chamadas do painel, edge function e administradores
     ```
   - **Linhas 132, 230, 275**: Hardcode da chave de API da Evolution API:
     `'apikey': 'gsa_hub_evolution_token_2026'`
   - **Linhas 137, 288**: Hardcode de IP público de VPS:
     `147.15.43.141`
   - **Linhas 198, 256–332**: Aceita parâmetro arbitrário `targetIp`:
     ```typescript
     const targetHost = body.targetIp && body.targetIp !== '127.0.0.1' && body.targetIp !== 'localhost' ? body.targetIp : '172.19.0.1';
     ```
   - **Impacto**: Chamadas não autenticadas podem forçar a Edge Function a disparar mensagens de WhatsApp para qualquer número ou fazer requisições HTTP internas para a sub-rede Docker (`172.19.0.1` ou `targetIp`), configurando risco de Server-Side Request Forgery (SSRF).

4. **Ausência de Validação de Papel (RBAC) em `cloudflare-api` e `ssh-proxy`**:
   - **Arquivos**: `supabase/functions/cloudflare-api/index.ts` (linhas 47–48) e `supabase/functions/ssh-proxy/index.ts` (linhas 51–52):
     ```typescript
     const { data: { user }, error: userError } = await supabase.auth.getUser();
     if (userError || !user) return json(401, { error: 'Unauthorized user' }, origin);
     ```
   - **Fato Observado**: O código apenas valida se existe um JWT válido via `supabase.auth.getUser()`, mas **nunca valida** se o usuário é `admin` ou `colaborador`.
   - **Impacto**: Qualquer usuário autenticado da aplicação (ex: cliente ou parceiro) que extraia o seu Bearer Token pode invocar `cloudflare-api` para purgar o cache do Cloudflare (`/purge-cache`), ativar modo de desenvolvimento (`/dev-mode`) ou acionar modo sob ataque (`/under-attack`).

5. **Hardcode de Handle do Provedor de Pagamento em `gsa-payments`**:
   - **Arquivo**: `supabase/functions/gsa-payments/index.ts`, linha 3:
     ```typescript
     const INFINITEPAY_HANDLE = 'getsemani-gsa';
     ```
   - **Fato Observado**: Não lê `Deno.env.get('INFINITEPAY_HANDLE')` com fallback, divergindo de `gsa-ads-admin` e `gsa-free-tools`.

6. **Código Órfão / Morto em `gsa-payments`**:
   - **Arquivo**: `supabase/functions/gsa-payments/index.ts`, linhas 233–299:
   - **Fato Observado**: A função `procesarPagamento(supabase, fatura, meta)` foi mantida no arquivo mas não é mais invocada, pois o processamento foi migrado para a RPC atômica `gsa_finalize_external_invoice_payment`.

---

### 1.3 Auditoria dos Scripts de Webhook (`server_webhook_vps_live.cjs` e `server_webhook.cjs`)

1. **Sanity Check Automatizado (`scripts/verify-integrations-webhooks.ts`)**:
   - **Comando**: `npx tsx scripts/verify-integrations-webhooks.ts`
   - **Resultado**: 10 testes executados, **10 aprovados**, 0 falhas:
     - Sintaxe V8 de `server_webhook.cjs` e `server_webhook_vps_live.cjs`: Válida (`node --check`).
     - Proteção contra race conditions via `SessionMutex`: Presente e ativa.
     - Fallback seguro do `SERVICE_ROLE_JWT`: Presente via variáveis de ambiente.
     - Operações de pontos via RPC atômica: Conforme (`gsa_converter_pontos_carteira`).
     - Clientes de integração (`src/utils/n8nWhatsApp.ts`, `src/lib/whatsappVariationService.ts`): Tratamento robusto com `try/catch`.

2. **Inspeção de Concorrência e Mutex**:
   - **Arquivo**: `server_webhook_vps_live.cjs` (linhas 45–84, 8972, 9297) e `server_webhook.cjs` (linhas 45–84, 9202, 9527):
   - A classe `SessionMutex` implementa filas FIFO isoladas por número de telefone (`queues = new Map()`). Mensagens enviadas em rajada pelo mesmo contato são serializadas sequencialmente, enquanto contatos distintos são processados em paralelo.

3. **Atomicidade e RMW de Pontos**:
   - **Arquivo**: `server_webhook_vps_live.cjs` (linha 5071):
     `supabaseRpc('gsa_converter_pontos_carteira', { p_cliente_id: clientId }, (err, result) => { ... })`
   - Não realiza Read-Modify-Write em JavaScript; a mutação é 100% delegada à procedure PL/pgSQL atômica com trava de linha e bypass do trigger anti-tampering.

4. **Integridade de Codificação UTF-8**:
   - Varredura por caracteres corrompidos `\uFFFD`: Retornou **0 ocorrências** em ambos os arquivos (`server_webhook_vps_live.cjs` e `server_webhook.cjs`).

5. **Tratamento de Exceções e Resiliência**:
   - Linhas 9334–9340 de `server_webhook_vps_live.cjs`: Possui handlers globais `process.on('uncaughtException')` e `process.on('unhandledRejection')` que evitam a queda do serviço daemon no VPS.

---

### 1.4 Auditoria de Contratos de Interface (Front-end ↔ Supabase / Migrations)

1. **Quebra de Contrato Crítica: Cadastro de Prestador (`ProviderAccessPage.tsx`)**:
   - **Arquivo Front-end**: `src/pages/ProviderAccessPage.tsx`, linhas 254–266:
     ```typescript
     const { error } = await supabase.rpc('gsa_public_register_provider', {
       p_payload: { ...providerData, pin },
     });
     ```
   - **Arquivo de Migração**: `supabase/migrations/20260830123000_provider_registration_otp_and_authorization_hardening.sql`, linhas 146–149 e 230:
     ```sql
     DROP FUNCTION IF EXISTS public.gsa_public_register_provider(jsonb);

     CREATE OR REPLACE FUNCTION public.gsa_public_register_provider(
       p_payload jsonb,
       p_verification_token text
     ) RETURNS jsonb
     ```
   - **Fato Observado**: A migração eliminou a assinatura com 1 parâmetro `(jsonb)` e criou a assinatura exigindo obrigatoriamente 2 parâmetros: `p_payload jsonb` e `p_verification_token text`.
   - **Impacto**: O cadastro de prestadores na página `ProviderAccessPage.tsx` falha no PostgreSQL com o erro de função inexistente (`function public.gsa_public_register_provider(p_payload => jsonb) does not exist`).
   - **Validação de Teste**: `npx tsx scripts/check-provider-portal-security-contracts.ts` falha com:  
     `AssertionError [ERR_ASSERTION]: src/pages/ProviderAccessPage.tsx: contrato ausente: registrationVerificationToken`

2. **Quebra de Permissão em Confirmação de Vaquinha (`vaquinhaService.ts`)**:
   - **Arquivo Front-end**: `src/lib/vaquinhaService.ts`, linhas 169–172:
     ```typescript
     const { data, error } = await supabase.rpc('gsa_confirmar_contribuicao_vaquinha', {
       p_contribuicao_id: contribuicaoId,
       p_transacao_id: transacaoId || null,
     });
     ```
   - **Arquivo de Migração**: `supabase/migrations/20260830043000_admin_security_residual_end_to_end.sql`, linhas 289–290:
     ```sql
     REVOKE ALL ON FUNCTION public.gsa_confirmar_contribuicao_vaquinha(uuid,text) FROM PUBLIC,anon,authenticated;
     GRANT EXECUTE ON FUNCTION public.gsa_confirmar_contribuicao_vaquinha(uuid,text) TO service_role;
     ```
   - **Fato Observado**: A permissão de execução foi revogada de `anon` e `authenticated` por segurança e restrita exclusivamente ao `service_role`.
   - **Impacto**: A chamada direta do cliente via Front-end em `vaquinhaService.ts` falha com `permission denied for function gsa_confirmar_contribuicao_vaquinha`. Essa confirmação deve ser disparada unicamente pelo webhook de pagamento ou via Edge Function autorizada.

3. **Inconsistência de Contrato no Painel de Afiliado (`AfiliadoDashboard.tsx`)**:
   - **Script de Teste**: `scripts/check-affiliate-contracts.ts`, linha 89.
   - **Fato Observado**: O script exige que o componente `AfiliadoDashboard.tsx` exponha a função `activateClientProfileFromAffiliate` (já implementada em `src/features/affiliates/service.ts:221`) e o texto `'Ativar perfil de cliente'`.
   - **Impacto**: `npm run test:affiliates` falha com:  
     `AssertionError: src/pages/Afiliado/AfiliadoDashboard.tsx: contrato ausente: activateClientProfileFromAffiliate`.

4. **Inconsistência de Contrato na Landing de Carreiras (`CareersLandingPage.tsx`)**:
   - **Script de Teste**: `scripts/check-careers-contracts.ts`, linhas 41–43.
   - **Fato Observado**: O componente `CareersLandingPage.tsx` não invoca a RPC `gsa_public_list_career_vacancies` para listar as vagas ativas cadastradas pelo RH e não vincula `vacancy_id` no payload da candidatura.
   - **Impacto**: `npm run test:careers` falha na asserção de integração com o catálogo de vagas.

---

## 2. Logic Chain (Cadeia de Raciocínio dos Fatos às Conclusões)

1. **Compilação TypeScript e Bundling**:
   - Observou-se que `tsc --noEmit` completou com código 0 e `vite build` gerou o bundle de produção sem erros de sintaxe.
   - Logo, **o código TypeScript é estaticamente válido e compila perfeitamente**.
   - Contudo, `npm run lint` falhou unicamente devido ao script de auditoria textual `audit-production-real.mjs`, que interpretou comentários explicativos em `GsaTvMasterControl.tsx` e `gsaTvCommercialBreaks.ts` como código simulado.

2. **Fluxo de E-mails Transacionais (`gsa-transactional-email`)**:
   - A Edge Function executa `supabase.from("clientes_pf")`.
   - O schema do banco de dados não possui `clientes_pf`, apenas `clientes`.
   - Como o código trata erros retornando HTTP 200 `{ message: "Client or email not found" }`, a falha é completamente silenciosa.
   - Além disso, a ausência de autenticação permite abuso irrestrito da API Resend da empresa.

3. **Vulnerabilidades de VPS e Infraestrutura (`vps-api`, `cloudflare-api`, `ssh-proxy`)**:
   - Em `vps-api`, `isAuthorized = true` contorna qualquer autenticação. O código aceita disparos de WhatsApp e IPs de destino arbitrários.
   - Em `cloudflare-api` e `ssh-proxy`, a checagem é apenas de sessão ativa (qualquer usuário autenticado), permitindo que usuários não administrativos executem comandos privilegiados de infraestrutura DNS/WAF.

4. **Cadastro de Prestador (`ProviderAccessPage.tsx`)**:
   - A migração `20260830123000` alterou `gsa_public_register_provider` para exigir `(jsonb, text)` com o token do desafio de WhatsApp.
   - O Front-end em `ProviderAccessPage.tsx` continuou passando apenas `(jsonb)`.
   - Como consequência, o banco rejeita a chamada por divergência de assinatura de parâmetros.

---

## 3. Caveats (Ressalvas e Áreas Não Investigadas)

- Não foram efetuadas modificações em arquivos de produção do projeto durante esta auditoria (princípio estrito de read-only do Explorer).
- A verificação de runtime das Edge Functions considerou o código fonte em `supabase/functions/` e as variáveis declaradas via `Deno.env.get()`; o deployment real na infraestrutura do Supabase Cloud depende dos secrets estarem configurados no painel do Supabase.
- No script `server_webhook_vps_live.cjs`, o funcionamento pleno da Evolution API depende da disponibilidade das portas 8080/5678 no host VPS remoto.

---

## 4. Conclusion (Conclusão e Diagnóstico Estruturado)

O ecossistema Grupo GSA apresenta **excelente maturidade de compilação** (zero erros de tipagem TypeScript e build Vite 100% bem-sucedido) e **conformidade exemplar nos scripts de webhook VPS** (SessionMutex funcional, operações de pontos atômicas e codificação UTF-8 impecável sem tokens `\uFFFD`).

Entretanto, foram identificados **4 pontos críticos de integração e segurança** que necessitam de remediação imediata:
1. **P0**: Correção do endpoint `gsa-transactional-email` (trocar `clientes_pf` por `clientes` e adicionar chave de autenticação webhook).
2. **P0**: Correção da assinatura do cadastro de prestadores em `ProviderAccessPage.tsx` para passar `p_verification_token`.
3. **P1**: Fechamento de segurança em `vps-api` (remover `isAuthorized = true`, aplicar validação de admin e proteger chaves de API).
4. **P1**: Aplicação de RBAC estrito em `cloudflare-api` e `ssh-proxy` (verificar `user.app_metadata.gsa_actor_type in ('admin', 'colaborador')`).
5. **P2**: Ajuste nos componentes `AfiliadoDashboard.tsx` e `CareersLandingPage.tsx` para atender aos contratos dos testes `test:affiliates` e `test:careers`.
6. **P2**: Ajuste no regex de `audit-production-real.mjs` para desconsiderar comentários de código, permitindo que `npm run lint` passe com código 0.

---

## 5. Verification Method (Métodos de Reprodução e Verificação Independente)

Para reproduzir e verificar de forma independente todas as conclusões deste relatório:

1. **Verificar Compilação TypeScript e Strict**:
   ```bash
   node ./node_modules/typescript/lib/tsc.js --noEmit
   npm run typecheck:strict
   ```
   *Resultado esperado*: Código de saída 0.

2. **Verificar Build do Frontend**:
   ```bash
   npm run build
   ```
   *Resultado esperado*: Código de saída 0, bundle gerado em `dist/`.

3. **Verificar Sanity dos Webhooks**:
   ```bash
   npx tsx scripts/verify-integrations-webhooks.ts
   ```
   *Resultado esperado*: 10/10 testes aprovados com sucesso.

4. **Verificar Contratos do Realtime e Portais**:
   ```bash
   npx tsx scripts/check-realtime-contracts.ts
   npx tsx scripts/check-client-portal-security-contracts.ts
   ```
   *Resultado esperado*: Ambos aprovados com código 0.

5. **Reproduzir Falhas de Contrato Identificadas**:
   ```bash
   # Falha do contrato de prestador (p_verification_token ausente)
   npx tsx scripts/check-provider-portal-security-contracts.ts

   # Falha do contrato de afiliado (activateClientProfile ausente no dashboard)
   npx tsx scripts/check-affiliate-contracts.ts

   # Falha do contrato de carreiras (gsa_public_list_career_vacancies ausente na landing)
   npx tsx scripts/check-careers-contracts.ts

   # Falha do linter por comentários contendo 'dados fictícios'
   node scripts/audit-production-real.mjs --enforce
   ```
