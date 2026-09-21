# RELATÓRIO TÉCNICO DE ANÁLISE DINÂMICA DE APIS E INTEGRAÇÕES — MILESTONE 2

**Documento**: `analysis.md`  
**Subagente**: `teamwork_preview_explorer_m2_2` (Technical Explorer — API & Integration Specialist)  
**Milestone**: Milestone 2 — Testes Dinâmicos (APIs, Edge Functions, VPS Webhooks e Serviços Externos)  
**Data da Auditoria**: 2026-09-16  
**Diretório de Trabalho**: `.agents/teamwork_preview_explorer_m2_2/`  
**Modo de Integridade**: Benchmark / Verificação Genuína / Read-Only  
**Status Canônico de Origem**: `ANALISADO ESTATICAMENTE` → Estruturado para Execução Dinâmica pelo Worker  

---

## 1. RESUMO EXECUTIVO DO ESCOPO DE APIS E INTEGRAÇÕES

O escopo de backend desacoplado, microsserviços e integrações do sistema GSA HUB compreende **42 interfaces programáticas** categorizadas em três pilares fundamentais:

| Categoria da Interface | Prefixo de Identificação | Quantidade de Itens | Ambiente de Execução | Padrão Arquitetural |
|---|---|---|---|---|
| **Supabase Edge Functions** | `API-EDGE-*` | **17 funções** | Deno Runtime (VPS Docker / Supabase) | Serverless HTTP / Webhooks / RPC Gateways |
| **VPS Webhook Daemon Routes** | `API-WH-*` | **15 rotas** | Node.js v24 (VPS host / `server_webhook.cjs`) | Microserviço HTTP nativo com SessionMutex |
| **Integrações Externas** | `API-END-*` | **10 serviços** | Provedores Remotos (Cloudflare, Meta, Evolution, etc.) | REST APIs / WebSockets / CDNs |
| **Total Geral de Interfaces** | — | **42 endpoints** | Híbrido (Local + VPS 147.15.43.141) | Contratos de Alta Resiliência |

---

## 2. ANÁLISE FORENSE DAS 17 SUPABASE EDGE FUNCTIONS (`API-EDGE-*`)

Todas as 17 funções serverless Deno localizadas em `supabase/functions/` foram inspecionadas linha a linha, detalhando métodos, autenticação, restrições e comportamento esperado.

### 2.1 Mapeamento Detalhado por Função

#### `API-EDGE-001`: `cloudflare-api`
- **Diretório**: `supabase/functions/cloudflare-api/index.ts` (138 linhas)
- **Métodos**: `GET`, `POST`, `OPTIONS`
- **Sub-rotas e Ações**:
  - `GET /zone`: Consulta metadados da zona DNS via Cloudflare API v4.
  - `GET /dns`: Lista registros DNS da zona.
  - `POST /purge-cache`: Purga cache de arquivos específicos (`{ files: [...] }`) ou zona total (`{ purge_everything: true }`).
  - `POST /dev-mode`: Alterna modo de desenvolvimento (`{ value: 'on' | 'off' }`).
  - `POST /under-attack`: Alterna nível de segurança (`{ value: 'under_attack' | 'essentially_off' }`).
- **Autenticação & Controle de Acesso**:
  - Requer `Authorization: Bearer <token>` ou `apikey`.
  - Aceita `SUPABASE_SERVICE_ROLE_KEY` OU JWT de usuário com `gsa_actor_type` in `('admin', 'colaborador')`.
  - Rejeita chamadas não autenticadas com HTTP 401 (`Missing authorization header` ou `Unauthorized user`).
  - Rejeita chamadas de cliente comum (`cliente`, `prestador`, `afiliado`) com HTTP 403 (`Forbidden: requires admin or colaborador role`).
- **Integração Externa**: API Cloudflare v4 (`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}`) via `CLOUDFLARE_API_TOKEN`.

#### `API-EDGE-002`: `gsa-ads-admin`
- **Diretório**: `supabase/functions/gsa-ads-admin/index.ts` (158 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Modos Operacionais**:
  1. **Webhook de Pagamento Genérico**: Detectado por cabeçalho `x-gsa-signature`. Valida assinatura HMAC SHA-256 usando `ADVERTISING_WEBHOOK_SECRET`. Chama RPC `gsa_ads_process_payment_event`.
  2. **Webhook InfinitePay**: Detectado por `order_nsu` e `transaction_nsu`. Realiza consulta segura em `https://api.checkout.infinitepay.io/payment_check`.
  3. **Convite de Administrador para Anunciante**: Requer JWT de administrador (`action: 'invite'`, `request_id: UUID`). Chama `gsa_admin_get_advertiser_invite_target` e despacha convite via Supabase Auth Admin.
- **Validações Estritas**:
  - Limite máximo de payload: 128 KB (`payload_too_large` → HTTP 413).
  - CORS restrito a origens confiáveis (`origin_not_allowed` → HTTP 403).
  - Assinatura inválida → HTTP 401 (`invalid_signature`).

#### `API-EDGE-003`: `gsa-ads-public`
- **Diretório**: `supabase/functions/gsa-ads-public/index.ts` (378 linhas)
- **Métodos**: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
- **Ações Disponíveis**:
  - `deliver`: Entrega dinâmica de campanhas publicitárias ativas filtradas por slot, dispositivo e público.
  - `event`: Rastreia impressões e cliques incrementando contadores diários.
  - `submit_request`: Submissão de proposta comercial de publicidade (com validação estrita de dígitos verificadores de CPF/CNPJ, datas ISO e formatos).
  - `consult_protocol`: Consulta pública do andamento da proposta comercial.
  - `scheduler`: Manutenção periódica via cron (ativa/desativa campanhas expiradas e limpa criativos órfãos no storage).
- **Autenticação & Segurança**:
  - Scheduler protegido por `x-cron-secret` correspondente a `ADVERTISING_CRON_SECRET` (HTTP 401 se ausente/inválido).
  - Limite de tamanho de requisição: 32 KB.
  - Rate limiting por IP e visitante via hash SHA-256.

#### `API-EDGE-004`: `gsa-auth-session` (Broker Central de Autenticação)
- **Diretório**: `supabase/functions/gsa-auth-session/index.ts` (646 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Ações Suportadas (13 ações)**:
  - `login_pin`: Login com documento e PIN de 4 dígitos (clientes PF e PJ).
  - `register_affiliate`: Cadastro direto de novo parceiro afiliado.
  - `login_admin`: Login restrito de administradores master com credencial de alta segurança.
  - `login_colaborador`: Login de colaboradores com token funcional individual.
  - `request_partner_appeal`: Geração de desafio 2FA via WhatsApp para recurso de benefício recusado.
  - `submit_partner_appeal`: Submissão de contestação com validação do hash do código.
  - `request_client_first_access`: Desafio de primeiro acesso para novos clientes.
  - `complete_client_first_access`: Definição de PIN inicial de 4 dígitos.
  - `request_client_recovery`: Envio de código de recuperação de senha.
  - `complete_client_recovery`: Redefinição definitiva de PIN com código 2FA.
  - `request_provider_registration_code`: Envio de código SMS/WhatsApp para novo prestador.
  - `check_provider_registration_code`: Verificação preliminar de código.
  - `verify_provider_registration_code`: Validação final do onboarding de prestador.
- **Proteções de Segurança**:
  - Limite de payload: 8.192 bytes (8 KB).
  - Rate Limiting de Balde Duplo: Cada ação possui limites estritos de IP e de Assunto (Subject) implementados via RPC `gsa_consume_auth_rate_limit`.
  - Exceder tentativas resulta em HTTP 429 com cabeçalho `retry_after`.

#### `API-EDGE-005`: `gsa-careers-notifications`
- **Diretório**: `supabase/functions/gsa-careers-notifications/index.ts` (101 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Gatilho**: Cron job autenticado via `x-careers-notification-secret` OU JWT administrativo.
- **Operação**: Consome a tabela de outbox `gsa_careers_notification_outbox`, formata templates de e-mail em HTML responsivo com escape de caracteres (`escapeHtml`) e formatação pt-BR de datas/horas, despachando via API Resend (`https://api.resend.com/emails`).
- **Resiliência**: Tratamento de até 6 tentativas com backoff antes de marcar falha definitiva.

#### `API-EDGE-006`: `gsa-classified-media`
- **Diretório**: `supabase/functions/gsa-classified-media/index.ts` (300 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Operações**:
  - `upload`: Upload de fotos de anúncios para o bucket Cloudflare R2 `classificados-midias`. Valida MIME type (`image/jpeg`, `image/png`, `image/webp`) e tamanho máximo de 8 MB por arquivo.
  - `delete`: Exclusão de até 10 caminhos de mídia órfãos ou cancelados no R2.
- **Autenticação**: Sessão ativa via cabeçalhos `x-gsa-session-id` e `x-gsa-session-token` OU JWT Supabase.

#### `API-EDGE-007`: `gsa-free-tools`
- **Diretório**: `supabase/functions/gsa-free-tools/index.ts` (335 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Escopo**: 19 ferramentas de cálculos trabalhistas e empresariais (`termination`, `retirement`, `vacation`, `thirteenth`, `bpc`, `overtime`, `net_salary`, etc.).
- **Funcionalidades Pro**:
  - `status`: Consulta permissão Pro por cliente autenticado ou grant ativo.
  - `checkout`: Geração de link de pagamento InfinitePay para liberação de relatórios completos em PDF.
  - `payment_check`: Validação síncrona de liquidação do checkout.
  - `redeem_voucher`: Resgate de vouchers promocionais no formato `GSA-PRO-[A-Z0-9]{8,20}`.
- **Rate Limits**: 5 tentativas de checkout por 10 minutos; 12 tentativas de resgate de voucher por 10 minutos.

#### `API-EDGE-008`: `gsa-partner-application`
- **Diretório**: `supabase/functions/gsa-partner-application/index.ts` (372 linhas)
- **Métodos**: `POST`, `OPTIONS` (Multipart/form-data)
- **Finalidade**: Ingestão pública de solicitações de credenciamento de parceiros comerciais.
- **Processamento**:
  - Recebe formulário estruturado em JSON e arquivos de logotipo e banner.
  - Valida tipos de imagem e tamanho máximo (5 MB por imagem, 12 MB total).
  - Faz upload para Cloudflare R2 no bucket `parceiros-midias`.
  - Persiste na tabela `parceiros_candidaturas` gerando protocolo oficial `PARC-YYYYMMDD-XXXXXX`.

#### `API-EDGE-009`: `gsa-payments`
- **Diretório**: `supabase/functions/gsa-payments/index.ts` (234 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Rotas e Ações**:
  - **Webhook Inbound InfinitePay**: Recebe confirmação (`order_nsu`, `transaction_nsu`), consulta o endpoint oficial da InfinitePay (`https://api.checkout.infinitepay.io/payment_check`) para atestar status `paid`, e liquida a fatura chamando a RPC transacional `gsa_finalize_external_invoice_payment`.
  - `create_link`: Gera link de pagamento InfinitePay dinâmico para faturas de clientes. Exige sessão válida do cliente proprietário da fatura (`gsa_client_session_actor`).
  - `generate_invoices`: Rotina acionada via cron com cabeçalho `x-cron-secret` para faturar assinaturas recorrentes de planos e serviços.

#### `API-EDGE-010`: `gsa-product-import`
- **Diretório**: `supabase/functions/gsa-product-import/index.ts` (332 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Autenticação**: Restrita a administradores e colaboradores via sessão ou JWT.
- **Segurança SSRF**: Implementa `assertUrlResolvesPublic` (`supabase/functions/_shared/ssrf_validator.ts`), impedindo que URLs privadas ou IPs da rede interna (ex: `127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`) sejam consultadas pelo servidor.
- **Funcionalidades**: Raspagem de dados de produtos externos (ex: Shopee), parsing de variações de estoque e espelhamento automático de imagens para o bucket Cloudflare R2.

#### `API-EDGE-011`: `gsa-public-budget`
- **Diretório**: `supabase/functions/gsa-public-budget/index.ts` (268 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Finalidade**: Gateway público para criação de orçamentos institucionais (sites, sistemas, apps, branding).
- **Proteções Anti-Abuso**:
  - Campo honeypot `website`: se preenchido por robôs, a requisição é descartada com sucesso falso.
  - Checagem temporal `started_at`: requisições submetidas em menos de 2 segundos após abertura da página são rejeitadas por bot automation.
  - Rate limit de 12 requisições por hora por IP via `gsa_consume_auth_rate_limit`.
- **Destino no Banco**: Invoca `gsa_public_create_enterprise_budget_v2` ou `gsa_public_create_brand_budget_v1`.

#### `API-EDGE-012`: `gsa-transactional-email`
- **Diretório**: `supabase/functions/gsa-transactional-email/index.ts` (202 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Segurança**: Proteção contra open relay. Exige `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET` ou JWT de administrador. Rejeita qualquer requisição anônima com HTTP 401.
- **Operação**: Consome eventos transacionais do banco de dados (ex: `ABANDONED_CART`, `SUBSCRIPTION_RENEWAL`) e envia e-mails transacionais via Resend.

#### `API-EDGE-013`: `gsa-trigger-webhook`
- **Diretório**: `supabase/functions/gsa-trigger-webhook/index.ts` (46 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Finalidade**: Proxy interno para comunicação entre containers Deno e o host da VPS Oracle Linux.
- **Mapeamento de Rede**: Reescreve dinamicamente `localhost` e `127.0.0.1` para o gateway do Docker bridge (`172.19.0.1`), permitindo que a Edge Function invoque o daemon Node.js na porta 5680.

#### `API-EDGE-014`: `gsa-tv-proxy`
- **Diretório**: `supabase/functions/gsa-tv-proxy/index.ts` (134 linhas)
- **Métodos**: `GET`, `POST`, `OPTIONS`
- **Ações**:
  - `GET ?action=status`: Retorna snapshot operacional consolidado do canal de TV (resolução, FPS, bitrate, HLS playlist, métricas de Prometheus, status dos containers Docker e saúde do buffer).
  - `POST`: Executa comandos de controle de playout linear (`next`, `reset`, `fallback`, `compile`, `warmup`). Rejeita comandos fora da allowlist com HTTP 400.

#### `API-EDGE-015`: `gsa-whatsapp-inbound`
- **Diretório**: `supabase/functions/gsa-whatsapp-inbound/index.ts` (133 linhas)
- **Métodos**: `POST`, `OPTIONS`
- **Origem**: Recebe webhooks da Evolution API e do n8n contendo mensagens e mídias de WhatsApp.
- **Roteamento Inteligente**:
  - Consulta `whatsapp_pendencias_ativas` pelo telefone remetente.
  - Se houver pendência do tipo `arquivo` e mídia em base64 anexada, faz upload no Cloudflare R2 (`documentos_cliente`, `comprovantes` ou `anexos_ticket`) e avança o status da solicitação.

#### `API-EDGE-016`: `ssh-proxy`
- **Diretório**: `supabase/functions/ssh-proxy/index.ts` (95 linhas)
- **Métodos**: `GET`, `POST`, `OPTIONS`
- **Autenticação**: Exige estritamente papel `admin` no JWT Supabase. Rejeita clientes e colaboradores não-administradores com HTTP 403.
- **Operação**: Gerencia conexões WebSocket para o terminal web administrativo da VPS.

#### `API-EDGE-017`: `vps-api`
- **Diretório**: `supabase/functions/vps-api/index.ts` (411 linhas)
- **Métodos**: `GET`, `POST`, `OPTIONS`
- **Autenticação**: Chave `service_role` ou JWT de administrador/colaborador.
- **Funcionalidades**:
  - Leitura real de métricas do Kernel Linux da VPS através do sistema de arquivos `/proc` (`/proc/meminfo`, `/proc/stat`, `/proc/uptime`).
  - Proxy seguro para envio de mensagens WhatsApp via Evolution API local (`http://147.15.43.141:8080/message/sendText`).
  - Roteamento de alvos permitidos (`getAllowedVpsTargets`), prevenindo redirecionamentos arbitrários.

---

## 3. ANÁLISE FORENSE DAS 15 ROTAS DO VPS WEBHOOK DAEMON (`server_webhook.cjs`)

O microserviço principal da VPS (`server_webhook.cjs`, 472 kB, 9.614 linhas) implementa 15 rotas HTTP em servidor Node.js nativo.

| ID da Rota | Caminho / Rota | Método HTTP | Finalidade Operacional | Concorrência & Segurança | Resposta de Sucesso | Tratamento de Erro |
|---|---|---|---|---|---|---|
| `API-WH-001` | `/` | `GET` | Health Check principal da aplicação | Acesso livre | `200` JSON `{ status: "UP", activeSessions }` | N/A |
| `API-WH-002` | `/health` | `GET` | Alias de Health Check | Acesso livre | `200` JSON `{ status: "UP" }` | N/A |
| `API-WH-003` | `/ping` | `GET` | Probe ultrarrápido de latência | Acesso livre | `200` JSON `{ status: "UP" }` | N/A |
| `API-WH-004` | `/feeds/viagens` | `GET` | Catálogo consolidado de pacotes turísticos | Cache-Control: no-cache, CORS: * | `200` JSON com array completo de pacotes | Erro 500 se banco offline |
| `API-WH-005` | `/feeds/viagens/nacionais` | `GET` | Feed de pacotes nacionais GSA | CORS: * | `200` JSON com `GSA_PACOTES_NACIONAIS` | N/A |
| `API-WH-006` | `/feeds/viagens/internacionais` | `GET` | Feed de pacotes internacionais GSA | CORS: * | `200` JSON com `GSA_PACOTES_INTERNACIONAIS` | N/A |
| `API-WH-007` | `/feeds/viagens/promoc` | `GET` | Feed de ofertas e promoções de viagens | CORS: * | `200` JSON com `GSA_PACOTES_PROMOCOES` | N/A |
| `API-WH-008` | `/feeds/viagens/*.csv` | `GET` | Exportação do catálogo de viagens em CSV | Encoding UTF-8 com BOM/headers | `200` text/csv com colunas padronizadas | Formato CSV estrito |
| `API-WH-009` | `/api/dropship-search` | `GET` | Busca em catálogo de dropshipping (?q=) | Sanitização de query, alerta admin | `200` JSON com 3 modelos precificados | Termo vazio usa default |
| `API-WH-010` | `/webhook` | `GET` | Desafio de verificação do Webhook Meta | Valida `hub.verify_token` contra `VERIFY_TOKEN` | `200` text/plain com `hub.challenge` | `403` Forbidden se token inválido |
| `API-WH-011` | `/webhook` | `POST` | Receptor de mensagens Evolution & Meta | **`SessionMutex` por número FIFO** | `200` JSON `{ status: "ok" }` imediato | JSON malformado ignora |
| `API-WH-012` | `/webhook/supabase-update` | `POST` | Receptor de eventos de banco Supabase | Roteamento por tabela e tipo | `200` JSON `{ status: "ok" }` | Log em console e ignore |
| `API-WH-013` | `/webhook/gsa-produtos-scraping`| `POST` | Ingestão de produtos raspados (Shopee) | Validação de variações e imagens | `200` JSON `{ status: "ok" }` | Formato inválido rejeitado |
| `API-WH-014` | `/webhook/gsa-viagens-scraping` | `POST` | Ingestão de scraping de voos e hotéis | Atualização de custos de pacotes | `200` JSON `{ status: "ok" }` | Formato inválido rejeitado |
| `API-WH-015` | `/webhook/scraping` | `POST` | Alias genérico de ingestão de scraping | Roteador universal de feeds | `200` JSON `{ status: "ok" }` | Formato inválido rejeitado |

### 3.1 Verificação da Arquitetura de Concorrência (R4)
1. **`SessionMutex`**: Confirmada a presença e o funcionamento da classe `SessionMutex` (linhas 45-84). Ela utiliza um `Map` interno associando cada número de telefone (`fromPhone`) a uma promessa encadeada. Isso garante que mensagens simultâneas do mesmo usuário sejam processadas estritamente em ordem FIFO, sem bloquear mensagens de outros usuários.
2. **Fallback de `SERVICE_ROLE_JWT`**: Confirmado nas linhas 14-15 (`process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || ''`), eliminando dependência exclusiva de chaves hardcoded e permitindo injeção segura por variáveis de ambiente.
3. **Atomicidade em Pontos**: Confirmada na linha 5117, onde a conversão de pontos chama diretamente a RPC transacional `gsa_converter_pontos_carteira`, eliminando vulnerabilidades de Read-Modify-Write (RMW) no JavaScript.

---

## 4. ANÁLISE FORENSE DAS 10 INTEGRAÇÕES EXTERNAS (`API-END-*`)

| ID | Serviço Integrado | URL / Endpoint Base | Método | Mecanismo de Autenticação | Arquivo de Integração no Código | Status de Conectividade Aferido |
|---|---|---|---|---|---|---|
| `API-END-001` | Evolution API WhatsApp Send Text | `http://147.15.43.141:8080/message/sendText/GSA_WhatsApp` | `POST` | `apikey` no cabeçalho | `src/utils/n8nWhatsApp.ts` | **ATIVO** (Testado via curl: responde 401 sem chave) |
| `API-END-002` | Evolution API WhatsApp Send Media | `http://147.15.43.141:8080/message/sendMedia/GSA_WhatsApp` | `POST` | `apikey` no cabeçalho | `src/utils/n8nWhatsApp.ts` | **ATIVO** na mesma instância |
| `API-END-003` | Evolution API Connection State Check | `http://147.15.43.141:8080/instance/connectionState/GSA_WhatsApp` | `GET` | `apikey` no cabeçalho | `src/lib/whatsappHealthService.ts` | **ATIVO** (Testado via curl: responde 401 sem chave) |
| `API-END-004` | n8n Webhook WhatsApp Fallback | `http://147.15.43.141:5678/webhook/send-whatsapp` | `POST` | Webhook público / Header secreto | `src/utils/n8nWhatsApp.ts` | Configurado como Tier 3 de contingência |
| `API-END-005` | InfinitePay Checkout & Transactions | `https://api.infinitepay.io/v2/transactions` e `/links` | `POST` | `Bearer <token>` / Handle | `src/utils/infinitePay.ts` | Endpoint de produção InfinitePay |
| `API-END-006` | Cloudflare R2 Public CDN | `https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev` | `GET` | Acesso público / Leitura direta | `src/lib/r2Storage.ts` | Roteamento de mídia pública |
| `API-END-007` | Cloudflare R2 Worker Auth Proxy | `https://gsa-hub-r2-worker.r2-handler.workers.dev` | `CRUD` | `x-gsa-session-id`, `x-gsa-session-token` | `src/lib/r2StorageWorkerClient.ts` | Proxy seguro para documentos privados |
| `API-END-008` | Google Gemini 3.5 Flash NLU | `https://generativelanguage.googleapis.com/...` | `POST` | `GEMINI_API_KEY` na URL | `server_webhook.cjs` | Motor de inteligência do bot WhatsApp |
| `API-END-009` | ViaCEP Postal Code Lookup | `https://viacep.com.br/ws/{cep}/json/` | `GET` | Público sem autenticação | `src/components/client/AddressStep.tsx` | **ATIVO** (Testado via curl: respondeu CEP da Praça da Sé) |
| `API-END-010` | BrasilAPI CNPJ Lookup | `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` | `GET` | Público sem autenticação | `src/utils/documentValidation.ts` | **ATIVO** (Testado via curl: respondeu CNPJ do Banco do Brasil) |

---

## 5. DIAGNÓSTICO DO TOOLING EXISTENTE E RESULTADOS PRÉ-EXISTENTES

Durante nossa varredura nas ferramentas existentes em `scripts/`:
1. `scripts/verify-integrations-webhooks.ts`:
   - Executado via `npx tsx scripts/verify-integrations-webhooks.ts`.
   - **Resultado**: 10/10 verificações passaram com 100% de conformidade:
     - `server_webhook.cjs`: Sintaxe V8 válida, SessionMutex implementado, Fallback JWT presente, RPC atômica presente.
     - `server_webhook_vps_live.cjs`: Sintaxe V8 válida, SessionMutex implementado, Fallback JWT presente, RPC atômica presente.
     - `src/utils/n8nWhatsApp.ts`: Tratamento de erro robusto (try/catch) com proteção de timeout.
     - `src/lib/whatsappVariationService.ts`: Tratamento de erro robusto.
2. `scripts/verify-utf8-encoding.ts`:
   - Executado via `npx tsx scripts/verify-utf8-encoding.ts`.
   - **Resultado**: Detectou 26 violações de codificação em 4 arquivos do projeto:
     - `src/components/admin/demandas/DemandasDashboard.tsx`: 6 ocorrências de caracteres de substituição `\uFFFD` (ex: `Concludas`, `Em Anlise`).
     - `scripts/check-gsa-tv-contracts.ts`: 18 ocorrências de mojibake em comentários e assertions (ex: `mutaÃ§Ã£o`, `nÃ£o`).
     - `scripts/adversarial-frontend-stress-test.mjs`: 1 regex de mojibake.
     - `scripts/adversarial-targeted-check.mjs`: 1 regex de mojibake.

---

## 6. PLANO METODOLÓGICO DE TESTES DINÂMICOS PARA O WORKER (`RELATORIO_TESTES_API.md`)

Para a confecção do entregável obrigatório `RELATORIO_TESTES_API.md`, o Worker deverá executar testes dinâmicos estruturados em quatro eixos de validação:

### 6.1 Eixo A — Invocação Dinâmica e Verificação de Contratos de Payload
- **Execução**:
  - Para as Edge Functions: O Worker executa chamadas HTTP diretas via `fetch` contra a URL da VPS (`https://api.147-15-43-141.nip.io/functions/v1/<função>` ou harness de teste local).
  - Para o Webhook VPS: O Worker inicia `server_webhook.cjs` em processo isolado na porta de teste 5689 e submete requisições reais com payloads representativos.
- **Asserções Obrigatórias**:
  - Status code HTTP correto (200, 201, 204).
  - Tipos e chaves de resposta conformes aos schemas TypeScript.
  - Ausência de crashes ou exceções não tratadas (unhandled promise rejections).

### 6.2 Eixo B — Cabeçalhos de Autenticação, Validação de Token JWT e Rejeição Não Autorizada
- **Execução**:
  - Teste Positivo: Invocar endpoints com JWT de `admin` ou chave `service_role` -> atestar sucesso (HTTP 200).
  - Teste Negativo (Não Autenticado): Invocar endpoints sem cabeçalho `Authorization` ou sem chave -> atestar HTTP 401 Unauthorized imediato.
  - Teste Negativo (Permissão Insuficiente / RBAC): Invocar endpoints protegidos (ex: `cloudflare-api`, `ssh-proxy`, `vps-api`, `gsa-ads-admin`) utilizando JWT com `gsa_actor_type = 'cliente'` -> atestar HTTP 403 Forbidden.
  - Teste Negativo (Token Corrompido / Expirado): Invocar com string arbitrária (`Bearer invalid.jwt.signature`) -> atestar HTTP 401.

### 6.3 Eixo C — Resiliência, Rate Limiting, Payloads Malformados e Erros
- **Execução**:
  - **Payloads Malformados**: Enviar JSON truncado ou corpo vazio onde é exigido JSON -> atestar HTTP 400 Bad Request com mensagem amigável sem vazar stack trace.
  - **Excesso de Tamanho (Payload Too Large)**: Enviar payload superior aos limites estabelecidos (ex: > 8 KB no `gsa-auth-session`, > 32 KB no `gsa-ads-public`, > 128 KB no `gsa-ads-admin`) -> atestar HTTP 413 Payload Too Large.
  - **Rate Limiting**: Enviar rajada de 10 requisições simultâneas ao `gsa-auth-session` -> atestar disparo de HTTP 429 Too Many Requests com `retry_after`.
  - **Proteção Anti-Bot / Honeypot**: Enviar requisição para `gsa-public-budget` com o campo honeypot preenchido ou `started_at` inferior a 2 segundos -> atestar rejeição/descarte conforme especificado.
  - **Prevenção contra SSRF**: Testar importação em `gsa-product-import` apontando para endereços de loopback ou metadados de nuvem -> atestar bloqueio por `assertUrlResolvesPublic`.

### 6.4 Eixo D — Integridade Estrita de Encoding UTF-8
- **Execução**:
  - Submeter payloads com caracteres acentuados da língua portuguesa (`São Paulo`, `Orçamento`, `Benefício`, `Atenção`) e emojis (`✅`, `🎉`, `🚨`).
  - Validar que a resposta JSON e a gravação correspondente nas tabelas (`faturas`, `tickets`, `parceiros_resgates_notificacoes`) preservam 100% da acentuação correta.
  - Atestar ausência absoluta de sequências de mojibake (`Ã§`, `Ã£`, `Ã©`) ou caracteres de substituição (`\uFFFD`).

---

## 7. MATRIZ DE TESTES DINÂMICOS CONSOLIDADA (42 ENDPOINTS)

A tabela a seguir consolida a especificação exata de cada um dos 42 endpoints para inclusão em `RELATORIO_TESTES_API.md`:

| ID Canônico | Nome / Rota | Método | Auth Esperada | Teste Positivo (Happy Path) | Teste Negativo (Rejeição / Erro) | Teste de Encoding UTF-8 | Validação Concorrência / Limites |
|---|---|---|---|---|---|---|---|
| `API-EDGE-001` | `cloudflare-api` | `GET/POST` | Admin JWT / Service Role | Consulta `/zone` com service_role retorna 200 e dados da zona | Consulta sem header retorna 401; com cliente JWT retorna 403 | Headers e logs preservam UTF-8 | Subrota inexistente retorna 404 |
| `API-EDGE-002` | `gsa-ads-admin` | `POST` | HMAC Secret / Admin JWT | Webhook com assinatura HMAC válida processa evento de ad | Assinatura HMAC divergente retorna 401 invalid_signature | Nomes de anunciante com acento preservados | Payload > 128 KB retorna 413 |
| `API-EDGE-003` | `gsa-ads-public` | `GET/POST` | Público / Cron Secret | Entrega anúncios para `ADS_PUBLIC_SHOWCASE` retornando 200 | Cron scheduler sem secret retorna 401; CPF inválido retorna 400 | Termos de busca e descrições mantêm acentuação | Payload > 32 KB retorna 413 |
| `API-EDGE-004` | `gsa-auth-session` | `POST` | Broker / Dual Rate Limit | Login com PIN válido gera sessão de cliente com token | PIN incorreto 5x gera 401 com contador; 6ª tentativa gera 429 | Nomes em `register_affiliate` sem `\uFFFD` | Payload > 8 KB retorna 413; Rate limit por IP e Assunto |
| `API-EDGE-005` | `gsa-careers-notifications` | `POST` | Cron Secret / Admin JWT | Despacha outbox pendente de RH via Resend retornando `{ sent }` | Chamada anônima retorna 401 unauthorized | Mensagem em pt-BR com acentuação e data formatada | Limite de lote em 20 itens por invocação |
| `API-EDGE-006` | `gsa-classified-media` | `POST` | Sessão Ativa / JWT | Upload de JPEG 2 MB com credencial válida persiste no R2 | Upload sem autenticação retorna 401; arquivo .exe retorna 400 | Nomes de arquivo sanitizados preservando integridade | Arquivo > 8 MB retorna 413; Máximo 10 deletes por batch |
| `API-EDGE-007` | `gsa-free-tools` | `POST` | Público / Cliente JWT | Consulta status de calculadora retornando `{ access: 'free' }` | Tool ID inexistente retorna 400; voucher inválido retorna 400 | Termos jurídicos trabalhistas em pt-BR preservados | Limite de 5 checkouts e 12 vouchers por 10 min |
| `API-EDGE-008` | `gsa-partner-application` | `POST` | Público (Multipart) | Submissão com dados válidos e logotipo gera protocolo `PARC-*` | CNPJ com dígito verificador incorreto retorna 400 | Razão social com caracteres especiais preservada | Imagens > 5 MB retornam 413; Request total > 12 MB bloqueado |
| `API-EDGE-009` | `gsa-payments` | `POST` | Cliente Sessão / Cron Secret | Webhook da InfinitePay liquida fatura via RPC transacional | Geração de link para fatura de outro cliente retorna 401/404 | Descrições de faturas preservam acentos | Trava anti-duplicação por `order_nsu` |
| `API-EDGE-010` | `gsa-product-import` | `POST` | Admin Sessão / JWT | Raspagem de produto público com sucesso espelhando fotos no R2 | Tentativa de scraping em IP privado (SSRF) retorna 400 | Título e descrição do produto mantêm acentuação | Limite de HTML em 10 MB e Imagens em 12 MB |
| `API-EDGE-011` | `gsa-public-budget` | `POST` | Público com Honeypot | Submissão de orçamento com tempo > 2s gera código no banco | Campo honeypot preenchido ou envio em < 2s é bloqueado | Detalhes do projeto preservam acentuação | Rate limit de 12 requisições por hora por IP |
| `API-EDGE-012` | `gsa-transactional-email` | `POST` | Service Role / Secret | Envio de e-mail de carrinho abandonado com credencial de sistema | Invocação sem chave service_role ou segredo retorna 401 | Corpo HTML de e-mail renderizado sem mojibake | Prevenção contra open relay abuse |
| `API-EDGE-013` | `gsa-trigger-webhook` | `POST` | Rede Interna Deno | Disparo de webhook reescreve 127.0.0.1 para 172.19.0.1 com sucesso | WebhookUrl ausente retorna 400 | Payload transmitido em UTF-8 íntegro | Timeout transparente de gateway |
| `API-EDGE-014` | `gsa-tv-proxy` | `GET/POST` | Operação GSA TV | Consulta status retorna telemetria, playout e cache de vídeo | Comando inválido (ex: `drop_db`) retorna 400 comando desconhecido | Títulos dos programas da grade em pt-BR preservados | Allowlist estrita de comandos (`next`, `compile`, etc.) |
| `API-EDGE-015` | `gsa-whatsapp-inbound` | `POST` | Webhook Evolution / n8n | Mensagem recebida em pendência ativa atualiza status do módulo | Telefone ausente no corpo retorna 400 Phone missing | Mensagens recebidas salvas com UTF-8 sem quebras | Despacho seguro de anexos para o storage R2 |
| `API-EDGE-016` | `ssh-proxy` | `GET/POST` | Exclusivo Admin Master | Upgrade de conexão WebSocket autorizado para admin master | Usuário sem credencial ou cliente comum recebe 401/403 | Sessão de terminal preserva UTF-8 | Bloqueio imediato de sessões revogadas |
| `API-EDGE-017` | `vps-api` | `GET/POST` | Admin JWT / Service Role | Consulta `/metrics` retorna dados reais de CPU/RAM de `/proc` | Invocação anônima retorna 401 | Mensagens de alerta administrativo em UTF-8 | Allowlist estrita de IPs da VPS |
| `API-WH-001` | `/` | `GET` | Aberto | Retorna status UP, serviço e total de sessões ativas | Método não suportado (ex: DELETE) tratado | N/A | Resposta síncrona sem overhead |
| `API-WH-002` | `/health` | `GET` | Aberto | Retorna status UP imediato | N/A | N/A | Probe de liveness |
| `API-WH-003` | `/ping` | `GET` | Aberto | Retorna status UP ultrarrápido | N/A | N/A | Probe de baixa latência |
| `API-WH-004` | `/feeds/viagens` | `GET` | Aberto | Retorna array consolidado de pacotes turísticos em JSON | Falha de leitura de pacotes tratada com fallback | Acentuação de destinos (Maceió, Gramado) correta | Headers de no-cache e CORS ativos |
| `API-WH-005` | `/feeds/viagens/nacionais` | `GET` | Aberto | Retorna array de pacotes nacionais em JSON | N/A | Nomes de cidades com acento preservados | Retorno imediato de memória |
| `API-WH-006` | `/feeds/viagens/internacionais` | `GET` | Aberto | Retorna array de pacotes internacionais em JSON | N/A | Nomes internacionais preservados | Retorno imediato de memória |
| `API-WH-007` | `/feeds/viagens/promoc` | `GET` | Aberto | Retorna array de pacotes em promoção | N/A | Descontos e descrições com UTF-8 íntegro | Retorno imediato de memória |
| `API-WH-008` | `/feeds/viagens/*.csv` | `GET` | Aberto | Retorna arquivo CSV com cabeçalho e linhas formatadas | N/A | CSV com codificação UTF-8 estrita | Escape de aspas em campos de texto |
| `API-WH-009` | `/api/dropship-search` | `GET` | Aberto | Busca termo (?q=fone) e retorna 3 produtos calculados | Termo malformado sanitizado sem crash | Nomes de produtos mantêm formatação | Notificação disparada para o admin via WhatsApp |
| `API-WH-010` | `/webhook` | `GET` | Verificação Meta | Retorna hub.challenge quando verify_token coincide | Token divergente retorna HTTP 403 Forbidden | N/A | Prevenção contra spoofing de webhook |
| `API-WH-011` | `/webhook` | `POST` | Mensagem WhatsApp | Processa mensagem recebida via SessionMutex e responde 200 | JSON inválido é ignorado sem derrubar o processo | Mensagens do bot enviadas sem caracteres quebrados | **SessionMutex por número FIFO** |
| `API-WH-012` | `/webhook/supabase-update`| `POST` | Trigger do Supabase | Notifica admin e cliente sobre mudanças em pedidos e faturas | Payload sem record é ignorado com sucesso | Mensagens geradas contêm nomes e valores formatados | Execução via SessionMutex |
| `API-WH-013` | `/webhook/gsa-produtos-scraping` | `POST` | Ingestão Scraping | Atualiza produtos da Shopee na base | Corpo não-JSON ignorado | Textos de produtos mantêm acentos | Ingestão idempotente |
| `API-WH-014` | `/webhook/gsa-viagens-scraping` | `POST` | Ingestão Scraping | Atualiza tabelas de custos de voos e hotéis | Formato incompatível rejeitado | Destinos e rotas em UTF-8 | Idempotência de atualização |
| `API-WH-015` | `/webhook/scraping` | `POST` | Ingestão Scraping | Roteia feed genérico para o handler correspondente | Formato inválido ignorado | Integridade de caracteres garantida | Roteamento uniforme |
| `API-END-001` | Evolution API Send Text | `POST` | API Key Header | Dispara mensagem de texto no WhatsApp da VPS retornando 200 | Falha de rede ou 401 tratada com fallback para n8n | **UTF-8 rigoroso: sem "Ã§" ou "Ã£o"** | Timeout comutando para Tier 2/Tier 3 |
| `API-END-002` | Evolution API Send Media | `POST` | API Key Header | Envia arquivo ou imagem com legenda no WhatsApp | Falha tratada com registro de pendência no banco | Legenda de mídia em UTF-8 perfeito | Timeout comutando para fallback |
| `API-END-003` | Evolution API Health Check | `GET` | API Key Header | Retorna estado de conexão da instância (`open`) | Instância desconectada aciona alerta no dashboard | N/A | Checagem de latência |
| `API-END-004` | n8n Webhook Fallback | `POST` | Webhook Token | Despacha notificação via n8n caso a Evolution API falhe | Timeout de webhook registrado em pendências | Mensagem transmitida sem perda de acentos | Camada de contingência (Tier 3) |
| `API-END-005` | InfinitePay Checkout API | `POST` | Bearer Token / Handle | Cria link de pagamento com order_nsu e webhook_url | Gateway fora do ar retorna mensagem amigável | Descrição do item na fatura em UTF-8 | Idempotência por order_nsu |
| `API-END-006` | Cloudflare R2 Public CDN | `GET` | Leitura Pública | Serve ativos de mídia públicos em alta velocidade | Arquivo inexistente retorna 404 da Cloudflare | URLs codificadas com RFC 3986 | Cache CDN com TTL otimizado |
| `API-END-007` | Cloudflare R2 Worker Auth | `CRUD` | Sessão Headers | Fornece URL assinada para visualização de RG/CNH do cliente | Requisição sem token de sessão retorna 403 Forbidden | Nomes de arquivos sanitizados | URLs assinadas com tempo de expiração curto |
| `API-END-008` | Google Gemini 3.5 Flash | `POST` | API Key Query | Processa intenção do cliente no WhatsApp e retorna resposta | Quota excedida aciona fallback para menu estruturado | Respostas em português com acentuação e tom cortês | Rate limit de 15 RPM tratado com fila |
| `API-END-009` | ViaCEP Lookup | `GET` | Aberto | Retorna logradouro, bairro, cidade e UF para CEP válido | CEP com formato inválido retorna erro de formato | Dados retornados em UTF-8 puro | Auto-preenchimento nos formulários |
| `API-END-010` | BrasilAPI CNPJ Lookup | `GET` | Aberto | Retorna razão social, sócios e CNAEs para CNPJ válido | CNPJ inexistente ou inválido retorna 404 | Razão social e endereço em UTF-8 íntegro | Auto-preenchimento de onboarding PJ |

---

## 8. CONCLUSÕES DA INVESTIGAÇÃO

1. **Estrutura de Interfaces Completa e Íntegra**: O sistema possui 42 interfaces programáticas com responsabilidades bem delimitadas e proteções arquiteturais comprovadas (SessionMutex, SSRF Validator, Rate Limits de balde duplo, checagem estrita de CPF/CNPJ).
2. **Conectividade da VPS Validada**: Testes empíricos ao vivo via `curl` atestaram que a VPS (`147.15.43.141`) está ativa e operacional, rejeitando chamadas não autorizadas na Evolution API (HTTP 401) conforme projetado.
3. **Serviços Externos Públicos Operacionais**: Consultas em tempo real a ViaCEP e BrasilAPI confirmaram funcionamento instantâneo e conformidade contratual.
4. **Vulnerabilidades de Encoding a Serem Sanadas no M3**:
   - O arquivo `src/components/admin/demandas/DemandasDashboard.tsx` possui 6 caracteres corrompidos `\uFFFD`.
   - O script `scripts/check-gsa-tv-contracts.ts` possui 18 sequências mojibake em comentários e assertions.
   These findings are cataloged for resolution in Milestone 3.
5. **Prontidão para Execução do Worker**: A metodologia de teste dinâmico, asserções de contrato, controle de autorização e cenários negativos estão 100% especificados para permitir que o Worker execute a suíte de testes dinâmicos e elabore o relatório oficial `RELATORIO_TESTES_API.md`.
