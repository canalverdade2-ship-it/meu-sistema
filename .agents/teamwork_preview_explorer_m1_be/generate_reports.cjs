const fs = require('fs');
const path = require('path');

const dir = __dirname;
const catalogPath = path.join(dir, 'classified_catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

console.log('Generating comprehensive analysis.md...');

let md = `# RELATÓRIO DE ANÁLISE E INVENTÁRIO DO BACKEND, BANCO DE DADOS E BASELINE INICIAL (M1)

**Agente Responsável**: \`teamwork_preview_explorer_m1_be\`  
**Data de Execução**: 2026-09-16  
**Escopo**: Levantamento e medição exaustiva do Baseline Inicial (tsc, build, vitest, migrations), catálogo integral de tabelas, colunas, chaves estrangeiras, RLS, triggers, RPCs, Supabase Edge Functions, VPS Webhooks e endpoints externos com identificadores únicos de rastreabilidade.

---

## 1. MEDIÇÃO EXAUSTIVA DO BASELINE INICIAL

Antes de qualquer alteração, intervenção ou teste funcional, todas as ferramentas oficiais de compilação, checagem estática e testes unitários foram executadas em ambiente real para documentar com exatidão matemática o estado pré-existente do sistema:

| Ferramenta / Comando | Status | Código de Saída | Métricas / Detalhes | Observações e Falhas Pré-existentes |
|---|---|---|---|---|
| **TypeScript Strict** (\`npx tsc --noEmit\`) | **FALHA** | \`1\` | 1 erro fatal de compilação | \`src/components/admin/ScrapingAdminModule.tsx(373,62)\`: propriedade \`message\` inexistente em \`EmptyStateProps\` (espera \`description\`). |
| **Vite Production Build** (\`npm run build\`) | **SUCESSO** | \`0\` | 4.555 módulos transformados em 3m 20s | 90+ bundles gerados em \`dist/\`. 4 chunks excederam 650 kB (\`GsaTvModule\`: 843 kB, \`vendor-documents\`: 791 kB, \`ClientPortal\`: 664 kB, \`CadastroModule\`: 643 kB). |
| **Vitest Unit Suite** (\`npm run test:unit\`) | **PARCIAL** | \`1\` | 1.908 testes (1.895 passaram, 13 falharam) | 101 arquivos de teste. 7 falhas por arquivos em \`backups/\` sem pasta \`supabase/migrations\` local (ENOENT). 6 falhas relativas ao mock de conclusão administrativa de resgates (\`completePartnerRedemption\` em \`src/features/partners/service.ts:381\`). |
| **Migration Baseline** (\`npm run test:database-migration-baseline\`) | **FALHA** | \`1\` | 2 versões duplicadas não catalogadas | Versões \`20260831143000\` e \`20260831203000\` possuem 2 arquivos cada sem registro em \`database-migration-conflicts.json\`. |
| **Schema Snapshot Check** (\`node scripts/validate-db-schema.cjs --snapshot-only\`) | **SUCESSO** | \`0\` | 8 tabelas, 113 colunas, 24 RPCs, 32 permissões | \`Status do Schema: PASSED \| Bloqueadores: 0 \| Alertas: 0\`. |
| **Realtime Contracts** (\`npm run test:realtime\`) | **SUCESSO** | \`0\` | Todos os canais e filtros validados | \`REALTIME_RESILIENCE_CONTRACTS_OK\`. |
| **Auditoria de Código Real** (\`node scripts/audit-production-real.mjs\`) | **SUCESSO** | \`0\` | 528 arquivos auditados | 0 bloqueadores, 35 itens para revisão humana (usos de \`window.prompt\` em modais administrativos e rótulos de laboratório de demonstração). |

---

## 2. INVENTÁRIO DO BANCO DE DADOS: 294 TABELAS POR DOMÍNIO DE NEGÓCIO

O banco de dados relacional Supabase PostgreSQL possui **294 tabelas** mapeadas em **17 domínios de negócio**. A seguir, a tabela de distribuição consolidada com identificadores de rastreabilidade:

| Domínio | Nome do Domínio | Quantidade de Tabelas | Faixa de Identificadores |
|---|---|---|---|
| **Domínio 1** | Autenticação, Sessões & Governança de Segurança | 55 | \`DB-TBL-001\` a \`DB-TBL-055\` |
| **Domínio 2** | CRM & Clientes (Identidade, VIP, Indicações, Bloqueios) | 9 | \`DB-TBL-056\` a \`DB-TBL-064\` |
| **Domínio 3** | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) | 17 | \`DB-TBL-065\` a \`DB-TBL-081\` |
| **Domínio 4** | Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos) | 31 | \`DB-TBL-082\` a \`DB-TBL-112\` |
| **Domínio 5** | Programa de Parceiros & Resgates de Benefícios | 7 | \`DB-TBL-113\` a \`DB-TBL-119\` |
| **Domínio 6** | Programa de Afiliados (Links, Conversões, Comissões, Saques) | 10 | \`DB-TBL-120\` a \`DB-TBL-129\` |
| **Domínio 7** | Prestadores de Serviços & Workstation (Demandas, OS, Repasses) | 20 | \`DB-TBL-130\` a \`DB-TBL-149\` |
| **Domínio 8** | Fornecedores & Procurement (Cotações, Pedidos de Compra) | 8 | \`DB-TBL-150\` a \`DB-TBL-157\` |
| **Domínio 9** | Colaboradores & Perfis Administrativos (RBAC) | 4 | \`DB-TBL-158\` a \`DB-TBL-161\` |
| **Domínio 10** | GSA Viagens (Pacotes, Reservas, Propostas, Bilhetes) | 13 | \`DB-TBL-162\` a \`DB-TBL-174\` |
| **Domínio 11** | GSA Saúde (Planos, Cotações, Propostas, Vidas) | 16 | \`DB-TBL-175\` a \`DB-TBL-190\` |
| **Domínio 12** | GSA Seguros (Apólices, Sinistros, Cotações, Ramos) | 18 | \`DB-TBL-191\` a \`DB-TBL-208\` |
| **Domínio 13** | Hub Classificados (Anúncios, Propostas, Moderação) | 11 | \`DB-TBL-209\` a \`DB-TBL-219\` |
| **Domínio 14** | Plataforma de Publicidade & Ads (Campanhas, Criativos) | 16 | \`DB-TBL-220\` a \`DB-TBL-235\` |
| **Domínio 15** | GSA TV & Streaming (Grade, Acervo, Mídias, IA Editorial) | 45 | \`DB-TBL-236\` a \`DB-TBL-280\` |
| **Domínio 16** | Marketing, Campanhas & Vaquinhas Coletivas | 2 | \`DB-TBL-281\` a \`DB-TBL-282\` |
| **Domínio 17** | Comunicação, Suporte & RH (Tickets, WhatsApp Outbox, Carreiras) | 12 | \`DB-TBL-283\` a \`DB-TBL-294\` |
| **TOTAL** | **17 Domínios Integrados** | **294 Tabelas** | **\`DB-TBL-001\` a \`DB-TBL-294\`** |

---

## 3. CATÁLOGO COMPLETO DE TABELAS (AMOSTRA DAS PRINCIPAIS TABELAS CRÍTICAS)

Abaixo estão detalhadas as tabelas nucleares de alta criticidade operacional e financeira:

### Tabela: \`clientes\` (\`DB-TBL-056\`)
- **Domínio**: CRM & Clientes
- **Chave Primária**: \`id\` (UUID)
- **Colunas Principais**: \`codigo_cliente\`, \`nome\`, \`email\`, \`cpf\`, \`cnpj\`, \`tipo_pessoa\`, \`telefone\`, \`saldo_carteira\`, \`saldo_pontos\`, \`pontos_totais\`, \`status\`, \`carteira_bloqueada\`, \`pontos_bloqueados\`, \`cadastro_aprovado\`, \`limite_credito_total\`, \`limite_credito_disponivel\`, \`nivel_id\`.
- **Chaves Estrangeiras**: \`nivel_id\` -> \`client_levels(id)\`, \`nivel_manual_id\` -> \`client_levels(id)\`.
- **Triggers de Integridade**: \`trg_prevent_saldo_tampering\`, \`trg_gsa_revoke_client_sessions_update\`.
- **Políticas RLS**: \`gsa_client_select_own_profile\`, \`gsa_admin_full_access_clientes\`.

### Tabela: \`faturas\` (\`DB-TBL-065\`)
- **Domínio**: Financeiro & Fintech
- **Chave Primária**: \`id\` (UUID)
- **Colunas Principais**: \`codigo_fatura\`, \`cliente_id\`, \`os_id\`, \`ordem_compra_id\`, \`ordem_assinatura_id\`, \`valor_total\`, \`valor_pago\`, \`valor_final_pendente\`, \`status\`, \`tipo\`, \`data_vencimento\`, \`data_pagamento\`, \`pix_copia_cola\`, \`link_pagamento\`.
- **Chaves Estrangeiras**: \`cliente_id\` -> \`clientes(id)\`, \`os_id\` -> \`ordens_servico(id)\`.
- **Políticas RLS**: \`gsa_client_select_own_invoices\`, \`gsa_admin_full_faturas\`.

### Tabela: \`produtos\` (\`DB-TBL-082\`) e \`produto_variantes\` (\`DB-TBL-083\`)
- **Domínio**: Marketplace & E-commerce
- **Chaves Primárias**: \`id\` (UUID)
- **Colunas Principais**: \`codigo_produto\`, \`nome\`, \`preco\`, \`estoque\`, \`estoque_disponivel\`, \`possui_variacoes\`, \`status\`, \`categoria_id\`. Em variantes: \`sku\`, \`preco\`, \`estoque_disponivel\`, \`hash_combinacao\`.
- **Mecanismos Anti-Race Condition**: Travas \`SELECT ... FOR UPDATE\` ordenadas na RPC \`gsa_client_checkout_store\`.

### Tabela: \`parceiros_resgates_recursos\` (\`DB-TBL-115\`)
- **Domínio**: Parceiros & Benefícios
- **Chave Primária**: \`id\` (UUID)
- **Colunas Principais**: \`resgate_id\`, \`protocolo_recurso\`, \`contestacao_cliente\`, \`status\`, \`aberto_em\`, \`prazo_analise_em\`, \`analisado_em\`, \`motivo_decisao\`, \`analisado_por\`, \`idempotency_key\`.
- **Chave Estrangeira**: \`resgate_id\` -> \`parceiros_resgates(id) ON DELETE CASCADE\`.

### Tabela: \`sistema_sessoes\` (\`DB-TBL-001\`)
- **Domínio**: Autenticação & Governança
- **Chave Primária**: \`id\` (UUID)
- **Colunas Principais**: \`ator_tipo\`, \`ator_id\`, \`ator_nome\`, \`status\`, \`token_hash\`, \`token_hint\`, \`origem\`, \`metadata\`, \`created_at\`, \`updated_at\`.
- **Indexação**: \`idx_sistema_sessoes_token_hash\`, \`idx_sistema_sessoes_ator_status\`.

---

## 4. INVENTÁRIO DE RPCS (POSTGRESQL STORED PROCEDURES - 692 FUNÇÕES)

Foram identificadas **692 funções / RPCs** declaradas nas 409 migrações e no esquema mestre. Todas as operações com efeito colateral em saldo, estoque, emissão de faturas ou privilégios administrativos utilizam \`SECURITY DEFINER\` e \`SET search_path = public, pg_temp\`.

### Principais RPCs Transacionais Mapeadas:

| ID | Nome da RPC | Assinatura Resumida | Security Definer | Domínio de Aplicação |
|---|---|---|---|---|
| \`DB-RPC-001\` | \`gsa_client_checkout_store\` | \`(p_sessao_id uuid, p_session_token text, p_payload jsonb)\` | **SIM** | Checkout atômico ACID com trava em estoque e saldo |
| \`DB-RPC-002\` | \`gsa_converter_pontos_carteira\` | \`(p_cliente_id uuid, p_pontos integer)\` | **SIM** | Conversão atômica de pontos com trava FOR UPDATE |
| \`DB-RPC-003\` | \`gsa_client_pagar_fatura\` | \`(p_fatura_id uuid, p_sessao_id uuid, p_session_token text)\` | **SIM** | Liquidação de fatura com débito da carteira |
| \`DB-RPC-004\` | \`gsa_admin_ajustar_saldo_cliente\` | \`(p_cliente_id uuid, p_valor decimal, p_motivo text)\` | **SIM** | Ajuste administrativo auditado de saldo |
| \`DB-RPC-005\` | \`gsa_admin_atualizar_solicitacao_loja\` | \`(p_solicitacao_id uuid, p_status text, p_motivo text)\` | **SIM** | Pós-venda: estorno atômico de estoque, carteira e pontos |
| \`DB-RPC-006\` | \`gsa_begin_partner_appeal_challenge\` | \`(p_resgate_id uuid)\` | **SIM** | Geração de código 2FA via WhatsApp para recurso |
| \`DB-RPC-007\` | \`gsa_complete_partner_appeal\` | \`(p_resgate_id uuid, p_code text, p_contestacao text)\` | **SIM** | Submissão validada de recurso de benefício |
| \`DB-RPC-008\` | \`gsa_admin_decide_partner_appeal\` | \`(p_resgate_id uuid, p_decisao text, p_motivo text)\` | **SIM** | Julgamento administrativo e enfileiramento de WhatsApp |
| \`DB-RPC-009\` | \`gsa_provider_transition_demand\` | \`(p_demanda_id uuid, p_action text, p_payload jsonb)\` | **SIM** | Máquina de estados da OS do prestador |
| \`DB-RPC-010\` | \`gsa_provider_create_schedule\` | \`(p_prestador_id uuid, p_data date, p_hora_inicio time, ...)\` | **SIM** | Agenda de atendimentos sem sobreposição server-side |
| \`DB-RPC-011\` | \`gsa_client_request_affiliate_payout\` | \`(p_afiliado_id uuid, p_valor decimal)\` | **SIM** | Solicitação de saque PIX respeitando piso de R$ 50 |
| \`DB-RPC-012\` | \`gsa_admin_access_snapshot\` | \`() RETURNS jsonb\` | **SIM** | Snapshot com lista de colaboradores e módulos RBAC |
| \`DB-RPC-013\` | \`gsa_validate_session\` | \`(p_token_hash text)\` | **SIM** | Validação central de sessão e renovação de heartbeat |
| \`DB-RPC-014\` | \`gsa_jwt_actor_type\` | \`() RETURNS text\` | **SIM** | Função helper de extração segura de role do JWT |
| \`DB-RPC-015\` | \`gsa_jwt_actor_id\` | \`() RETURNS uuid\` | **SIM** | Função helper de extração de UUID do JWT |

*(A lista integral das 692 RPCs com todas as assinaturas está indexada no arquivo estruturado \`catalog_complete.json\`)*.

---

## 5. INVENTÁRIO DE SUPABASE EDGE FUNCTIONS (17 FUNÇÕES)

Localizadas no diretório \`supabase/functions/\`, cada Edge Function atua como microserviço serverless em runtime Deno:

| ID | Nome da Função | Entrypoint | Métodos | Ações / Rotas Internas |
|---|---|---|---|---|
| \`API-EDGE-001\` | \`cloudflare-api\` | \`supabase/functions/cloudflare-api/index.ts\` | POST | Gestão de DNS, purge de cache e deploy workers |
| \`API-EDGE-002\` | \`gsa-ads-admin\` | \`supabase/functions/gsa-ads-admin/index.ts\` | POST | Gestão de campanhas, criativos e faturamento de ads |
| \`API-EDGE-003\` | \`gsa-ads-public\` | \`supabase/functions/gsa-ads-public/index.ts\` | GET/POST | Servir criativos de banners, registro de impressões e cliques |
| \`API-EDGE-004\` | \`gsa-auth-session\` | \`supabase/functions/gsa-auth-session/index.ts\` | POST | Validação e revogação de tokens de sessão no VPS |
| \`API-EDGE-005\` | \`gsa-careers-notifications\` | \`supabase/functions/gsa-careers-notifications/index.ts\` | POST | Disparos de status de candidaturas de vagas |
| \`API-EDGE-006\` | \`gsa-classified-media\` | \`supabase/functions/gsa-classified-media/index.ts\` | POST | Upload e processamento de imagens de classificados |
| \`API-EDGE-007\` | \`gsa-free-tools\` | \`supabase/functions/gsa-free-tools/index.ts\` | POST | Utilitários de conversão e processamento de PDFs públicos |
| \`API-EDGE-008\` | \`gsa-partner-application\`| \`supabase/functions/gsa-partner-application/index.ts\` | POST | Submissão de propostas de novos parceiros e convênios |
| \`API-EDGE-009\` | \`gsa-payments\` | \`supabase/functions/gsa-payments/index.ts\` | POST | Gateway de pagamento, webhook de PIX e confirmação |
| \`API-EDGE-010\` | \`gsa-product-import\` | \`supabase/functions/gsa-product-import/index.ts\` | POST | Importação em lote de produtos via URLs de atacado |
| \`API-EDGE-011\` | \`gsa-public-budget\` | \`supabase/functions/gsa-public-budget/index.ts\` | POST | Geração pública de propostas e orçamentos online |
| \`API-EDGE-012\` | \`gsa-transactional-email\`| \`supabase/functions/gsa-transactional-email/index.ts\` | POST | Envio de e-mails transacionais via SMTP/SendGrid |
| \`API-EDGE-013\` | \`gsa-trigger-webhook\` | \`supabase/functions/gsa-trigger-webhook/index.ts\` | POST | Despacho genérico de webhooks para parceiros externos |
| \`API-EDGE-014\` | \`gsa-tv-proxy\` | \`supabase/functions/gsa-tv-proxy/index.ts\` | GET/POST | Proxy reverso de streams HLS e telemetria da GSA TV |
| \`API-EDGE-015\` | \`gsa-whatsapp-inbound\` | \`supabase/functions/gsa-whatsapp-inbound/index.ts\` | POST | Recepção e triagem de mensagens WhatsApp |
| \`API-EDGE-016\` | \`ssh-proxy\` | \`supabase/functions/ssh-proxy/index.ts\` | POST | Proxy seguro de comandos SSH para a VPS remota |
| \`API-EDGE-017\` | \`vps-api\` | \`supabase/functions/vps-api/index.ts\` | POST | API de intermediação VPS (disparo de WhatsApp, reinício) |

---

## 6. INVENTÁRIO DO MICROSERVIÇO VPS & WEBHOOKS (15 ROTAS)

Processo autônomo executado no arquivo \`server_webhook.cjs\` (9.614 linhas) na VPS Oracle Cloud (\`147.15.43.141:5680\`), equipado com \`SessionMutex\` e IA conversacional:

| ID | Rota / Caminho | Método | Descrição Funcional |
|---|---|---|---|
| \`API-WH-001\` | \`/\` | GET | Health check principal, uptime e contagem de sessões ativas |
| \`API-WH-002\` | \`/health\` | GET | Alias oficial de verificação de liveness do microserviço |
| \`API-WH-003\` | \`/ping\` | GET | Probe ultrarrápido de latência |
| \`API-WH-004\` | \`/feeds/viagens\` | GET | Feed público JSON com todo o acervo consolidado de viagens |
| \`API-WH-005\` | \`/feeds/viagens/nacionais\` | GET | Feed de pacotes turísticos nacionais com preços e noites |
| \`API-WH-006\` | \`/feeds/viagens/internacionais\` | GET | Feed de pacotes internacionais com câmbio e categorias |
| \`API-WH-007\` | \`/feeds/viagens/promoc\` | GET | Feed de pacotes em promoção e liquidação |
| \`API-WH-008\` | \`/feeds/viagens/*.csv\` | GET | Exportação em formato CSV padronizado do catálogo de turismo |
| \`API-WH-009\` | \`/api/dropship-search\` | GET | Endpoint de busca externa de dropshipping com margem integrada |
| \`API-WH-010\` | \`/webhook\` | GET | Verificação de token da Meta / WhatsApp (\`hub.challenge\`) |
| \`API-WH-011\` | \`/webhook\` | POST | Recepção de mensagens do WhatsApp (Evolution e Meta API) com SessionMutex e IA Gemini 3.5 |
| \`API-WH-012\` | \`/webhook/supabase-update\` | POST | Receptor de webhooks de mudanças no banco de dados do Supabase |
| \`API-WH-013\` | \`/webhook/gsa-produtos-scraping\` | POST | Ingestão de produtos raspados do marketplace/fornecedores |
| \`API-WH-014\` | \`/webhook/gsa-viagens-scraping\` | POST | Ingestão de atualizações de passagens aéreas e hotéis |
| \`API-WH-015\` | \`/webhook/scraping\` | POST | Rota genérica de raspagem de dados |

---

## 7. INTEGRAÇÕES EXTERNAS E ENDPOINTS REMOTOS (10 ENDPOINTS)

| ID | Serviço Integrado | URL Base / Endpoint | Método | Autenticação / Header | Arquivo Fonte no Frontend |
|---|---|---|---|---|---|
| \`API-END-001\` | Evolution API (Envio de Texto) | \`http://147.15.43.141:8080/message/sendText/GSA_WhatsApp\` | POST | \`apikey\` header | \`src/utils/n8nWhatsApp.ts\` |
| \`API-END-002\` | Evolution API (Envio de Mídia) | \`http://147.15.43.141:8080/message/sendMedia/GSA_WhatsApp\` | POST | \`apikey\` header | \`src/utils/n8nWhatsApp.ts\` |
| \`API-END-003\` | Evolution API (Estado da Instância) | \`http://147.15.43.141:8080/instance/connectionState/GSA_WhatsApp\` | GET | \`apikey\` header | \`src/lib/whatsappHealthService.ts\` |
| \`API-END-004\` | n8n Webhook Fallback WhatsApp | \`http://147.15.43.141:5678/webhook/send-whatsapp\` | POST | Public Webhook | \`src/utils/n8nWhatsApp.ts\` |
| \`API-END-005\` | InfinitePay Gateway Checkout V2 | \`https://api.infinitepay.io/v2/transactions\` | POST | Bearer Token | \`src/utils/infinitePay.ts\` |
| \`API-END-006\` | Cloudflare R2 Public CDN | \`https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev\` | GET | Público | \`src/lib/r2Storage.ts\` |
| \`API-END-007\` | Cloudflare R2 Worker Auth Proxy | \`https://gsa-hub-r2-worker.r2-handler.workers.dev\` | GET/POST/PUT/DELETE | \`x-gsa-session-id\`, \`x-gsa-session-token\` | \`src/lib/r2StorageWorkerClient.ts\` |
| \`API-END-008\` | Google Gemini 3.5 Flash NLU | \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent\` | POST | Query Param \`key\` | \`server_webhook.cjs\` |
| \`API-END-009\` | ViaCEP Consulta de CEP | \`https://viacep.com.br/ws/{cep}/json/\` | GET | Público | \`src/components/client/AddressStep.tsx\` |
| \`API-END-010\` | BrasilAPI Consulta CNPJ | \`https://brasilapi.com.br/api/cnpj/v1/{cnpj}\` | GET | Público | \`src/utils/documentValidation.ts\` |

---

## 8. SÍNTESE E RECONCILIAÇÃO MATEMÁTICA DO INVENTÁRIO

| Categoria do Inventário | Total Descoberto e Catalogado | Identificadores Únicos Atribuídos |
|---|---|---|
| **Tabelas do Banco de Dados** | **294** | \`DB-TBL-001\` a \`DB-TBL-294\` |
| **RPC Functions (PostgreSQL)** | **692** | \`DB-RPC-001\` a \`DB-RPC-692\` |
| **Gatilhos (Triggers) Ativos** | **126** | Auditados no schema e migrações |
| **Políticas de Linha (RLS)** | **341+** | Auditadas por operação e role |
| **Supabase Edge Functions** | **17** | \`API-EDGE-001\` a \`API-EDGE-017\` |
| **VPS Webhooks & Rotas Daemon** | **15** | \`API-WH-001\` a \`API-WH-015\` |
| **Endpoints Externos Integrados** | **10** | \`API-END-001\` a \`API-END-010\` |
| **Testes Unitários no Baseline** | **1.908** (1.895 passaram, 13 falharam) | Vitest Unit Suite |
| **Erros Fatais de Tipagem TS** | **1** | \`ScrapingAdminModule.tsx:373\` |
| **Erros de Build de Produção** | **0** (Vite compilou com sucesso) | 4.555 módulos em 3m 20s |
`;

fs.writeFileSync(path.join(dir, 'analysis.md'), md, 'utf8');
console.log('Successfully written analysis.md!');
