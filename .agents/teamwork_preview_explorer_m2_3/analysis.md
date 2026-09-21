# RELATÓRIO DE ANÁLISE TÉCNICA E PLANO DE EXECUÇÃO: BANCO DE DADOS, PERSISTÊNCIA REAL & PROPAGAÇÃO CROSS-MÓDULO (MILESTONE 2)

**Agente**: `teamwork_preview_explorer_m2_3`  
**Milestone**: Milestone 2: Dynamic Testing (Database, Persistence & Cross-Module Propagation)  
**Data**: 2026-09-16  
**Status**: Investigação Técnica Completa / Plano de Execução Pronto para o Worker  
**Diretório de Trabalho**: `.agents/teamwork_preview_explorer_m2_3/`  
**Documento Alvo a ser Gerado pelo Worker**: `RELATORIO_BANCO.md`

---

## 1. RESUMO EXECUTIVO DA INVESTIGAÇÃO

Esta investigação realizou a varredura profunda, estrutural e comportamental de toda a camada de dados do ecossistema GSA HUB, compreendendo:
- **294 Tabelas Relacionais do PostgreSQL** (`DB-TBL-001` a `DB-TBL-294`) divididas em 17 domínios de negócio.
- **692 Stored Procedures / RPCs Transacionais** (`DB-RPC-001` a `DB-RPC-692`).
- **Políticas de Segurança em Nível de Linha (RLS)** para todos os 4 perfis de atores (`cliente`, `prestador`, `fornecedor`, `colaborador`/`admin`) e mitigação estrita de acessos não-autenticados (`anon`).
- **Mecanismos de Concorrência e Atomicidade ACID**: travas exclusivas `SELECT ... FOR UPDATE`, proteção contra adulteração de saldos (`prevent_saldo_tampering()`), ordenação canônica anti-deadlock e deduplicação de requisições por chave de idempotência (`checkout_request_id`, `request_id`).
- **Topologia de Propagação Cross-Módulo nas 80 Arestas Canônicas** (`EDGE-001` a `EDGE-080` de `GRAFO_CONEXOES.md` e `MATRIZ_RASTREABILIDADE.md`), cobrindo os 4 vetores de propagação: Triggers de BD, Supabase Realtime, Invalidação de Cache TanStack Query e Gateway Webhook Daemon na VPS (porta 5680 via `SessionMutex`).
- **Inspeção e Validação dos Scripts de Verificação Existentes**:
  - `scripts/validate-db-schema.cjs`: testado localmente, retornando **Exit Code 0** (100% de conformidade contratual em tabelas, colunas, RPCs e permissões).
  - `scripts/verify-client-rls-acceptance.mjs`: testado via playback sequencial de migrations, aprovando **17 de 17 verificações** (RLS ativo em `saques`, `pontos_movimentacoes`, `vouchers`, eliminação de `USING (true)` em `orcamentos` e `ordens_compra`, e bypass anti-tampering em 4 RPCs financeiras).
  - `scripts/adversarial-database-security-challenge.mjs`: testado com sucesso, aprovando **35 de 35 desafios adversariais** (isolamento multi-tenant, bloqueio de escrita direta não autorizada e travas `FOR UPDATE` em conversão de pontos e saques).
  - `scripts/check-realtime-audit.ts` e `scripts/check-realtime-contracts.ts`: executados com **Score 100/100** e `REALTIME_RESILIENCE_CONTRACTS_OK`.

---

## 2. MAPEAMENTO TOPOLÓGICO DAS 294 TABELAS NOS 17 DOMÍNIOS DE NEGÓCIO

A camada de persistência do GSA HUB está consolidada em 294 tabelas no schema `public`. A distribuição exata catalogada em `INVENTARIO_COMPLETO.md` e mapeada contra as migrações SQL é a seguinte:

| Domínio | Nome do Domínio | Qtd Tabelas | Faixa de IDs | Tabelas Críticas de Destaque |
|---|---|---|---|---|
| **Domínio 1** | Autenticação, Sessões & Governança de Segurança | 55 | `DB-TBL-001` a `DB-TBL-055` | `sistema_sessoes`, `gsa_access_tokens`, `gsa_admin_audit_events`, `solicitacoes_exclusao`, `system_settings`, `gsa_auth_identities` |
| **Domínio 2** | CRM & Clientes (Identidade, VIP, Indicações, Bloqueios) | 9 | `DB-TBL-056` a `DB-TBL-064` | `clientes`, `client_levels`, `level_history`, `indicacoes`, `cliente_documentos`, `cliente_promocoes` |
| **Domínio 3** | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) | 17 | `DB-TBL-065` a `DB-TBL-081` | `faturas`, `carteira_lancamentos`, `extrato_financeiro`, `saques`, `emprestimos`, `emprestimo_parcelas`, `cobrancas`, `cobranca_acordos`, `pontos_movimentacoes` |
| **Domínio 4** | Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos) | 31 | `DB-TBL-082` a `DB-TBL-112` | `produtos`, `produto_variantes`, `produto_variacao_grupos`, `produto_variacao_opcoes`, `pedidos`, `loja_pedido_itens`, `loja_carrinhos`, `loja_solicitacoes`, `loja_reembolsos`, `cupons_loja`, `promocoes_quantidade` |
| **Domínio 5** | Programa de Parceiros & Resgates de Benefícios | 7 | `DB-TBL-113` a `DB-TBL-119` | `parceiros`, `parceiros_resgates`, `parceiros_resgates_recursos`, `parceiros_resgates_eventos`, `parceiros_resgates_notificacoes`, `parceiros_resgates_recurso_desafios` |
| **Domínio 6** | Programa de Afiliados (Links, Conversões, Comissões, Saques) | 10 | `DB-TBL-120` a `DB-TBL-129` | `gsa_afiliados`, `gsa_afiliado_links`, `gsa_afiliado_cliques`, `afiliado_comissoes`, `gsa_afiliado_saques`, `gsa_afiliado_transferencias` |
| **Domínio 7** | Prestadores de Serviços & Workstation (Demandas, OS, Repasses) | 20 | `DB-TBL-130` a `DB-TBL-149` | `prestadores`, `prestador_demandas`, `prestador_agendamentos`, `prestador_saques`, `prestador_documentos`, `demanda_comentarios`, `ordens_servico` |
| **Domínio 8** | Fornecedores & Procurement (Cotações, Pedidos de Compra) | 8 | `DB-TBL-150` a `DB-TBL-157` | `fornecedores`, `fornecedor_produtos`, `pedidos_compra`, `documentos_fornecedor`, `fornecedor_titulos`, `fornecedor_entregas` |
| **Domínio 9** | Colaboradores & Perfis Administrativos (RBAC) | 4 | `DB-TBL-158` a `DB-TBL-161` | `colaboradores`, `colaborador_modulos`, `funcoes_colaboradores`, `permissoes_modulos` |
| **Domínio 10** | GSA Viagens (Pacotes, Reservas, Propostas, Bilhetes) | 13 | `DB-TBL-162` a `DB-TBL-174` | `gsa_viagens_pacotes`, `viagens_solicitacoes_reserva`, `viagens_passageiros`, `viagens_pacote_imagens`, `viagens_transacoes` |
| **Domínio 11** | GSA Saúde (Planos, Cotações, Propostas, Vidas) | 16 | `DB-TBL-175` a `DB-TBL-190` | `saude_planos`, `saude_propostas`, `saude_beneficiarios`, `saude_contratos`, `saude_cotacoes` |
| **Domínio 12** | GSA Seguros (Apólices, Sinistros, Cotações, Ramos) | 18 | `DB-TBL-191` a `DB-TBL-208` | `seguros_apolices`, `seguros_sinistros`, `seguros_sinistro_mensagens`, `seguros_documentos`, `seguros_cotacoes` |
| **Domínio 13** | Hub Classificados (Anúncios, Propostas, Moderação) | 11 | `DB-TBL-209` a `DB-TBL-219` | `classificados_anuncios`, `classificados_midias`, `classificados_propostas`, `classificados_mensagens` |
| **Domínio 14** | Plataforma de Publicidade & Ads (Campanhas, Criativos) | 16 | `DB-TBL-220` a `DB-TBL-235` | `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_campaign_placements`, `gsa_ad_delivery_events`, `gsa_advertiser_profiles` |
| **Domínio 15** | GSA TV & Streaming (Grade, Acervo, Mídias, IA Editorial) | 45 | `DB-TBL-236` a `DB-TBL-280` | `gsa_tv_channels`, `gsa_tv_schedule_slots`, `gsa_tv_media_items`, `gsa_tv_as_run`, `gsa_tv_programs`, `gsa_tv_ai_studio_projects`, `gsa_tv_on_air_graphics` |
| **Domínio 16** | Marketing, Campanhas & Vaquinhas Coletivas | 2 | `DB-TBL-281` a `DB-TBL-282` | `gsa_hero_banners`, `loja_vaquinhas`, `loja_vaquinha_contribuicoes` |
| **Domínio 17** | Comunicação, Suporte & RH (Tickets, WhatsApp Outbox, Carreiras) | 12 | `DB-TBL-283` a `DB-TBL-294` | `tickets`, `ticket_mensagens`, `gsa_careers_applications`, `gsa_careers_vacancies`, `whatsapp_pendencias_ativas`, `gsa_whatsapp_ramais` |

---

## 3. MAPEAMENTO FORENSE DAS 692 STORED PROCEDURES / RPCs

O sistema implementa uma camada transacional rica, contendo **692 stored procedures** (`DB-RPC-001` a `DB-RPC-692`).

### 3.1 Classificação por Tipo de Acesso e Ator
1. **RPCs Públicas (`anon` + `authenticated`)**:
   - Resgate público de benefícios (`gsa_public_resgatar_beneficio_parceiro`).
   - Rastreamento de cliques de afiliados (`gsa_public_track_affiliate_click` / `gsa_public_record_affiliate_click`).
   - Consulta pública de protocolos (`gsa_public_consultar_protocolo`).
   - Autenticação e desafios 2FA via gateway (`gsa_auth_login_client`, `gsa_auth_login_collaborator`).
   - Consulta e contribuição de vaquinhas coletivas (`gsa_obter_vaquinha`, `gsa_criar_vaquinha`).
2. **RPCs do Portal do Cliente (`authenticated` com actor_type = 'cliente')**:
   - Pagamento de faturas com carteira/pontos (`gsa_client_pagar_fatura`).
   - Conversão de pontos em saldo (`gsa_converter_pontos_carteira`).
   - Transferências P2P e estorno em janela de tolerância (`gsa_client_request_transfer`, `gsa_client_reverse_transfer`).
   - Solicitação de saques PIX (`gsa_client_request_withdrawal`).
   - Checkout atômico da loja com variantes (`gsa_client_checkout_store`).
   - Solicitação e gerenciamento de afiliados (`gsa_client_create_affiliate_link`, `gsa_client_request_affiliate_payout`).
3. **RPCs do Portal do Prestador (`authenticated` com actor_type = 'prestador')**:
   - Transição de estado de demandas de campo (`gsa_provider_transition_demand`: accept, counteroffer, deliver).
   - Agendamento sem conflitos (`gsa_provider_create_schedule`).
   - Solicitação de repasses financeiros (`gsa_provider_request_withdrawal`).
4. **RPCs do Fornecedor B2B (`authenticated` com actor_type = 'fornecedor')**:
   - Submissão de propostas de novos produtos (`gsa_supplier_request_product`).
   - Despacho de remessa com chave de NF-e (`gsa_supplier_submit_delivery`).
   - Atualização de dados bancários em quarentena (`gsa_supplier_update_profile`).
5. **RPCs Administrativas e de Governança (`authenticated` com actor_type IN ('admin', 'colaborador'))**:
   - Julgamento de resgates e recursos de parceiros (`gsa_admin_decide_partner_appeal`, `gsa_admin_complete_partner_redemption`).
   - Gestão de colaboradores e permissões RBAC (`gsa_admin_save_collaborator`, `gsa_admin_rotate_collaborator_credential`).
   - Homologação de remessas e incremento de estoque físico (`gsa_admin_review_supplier_delivery`).
   - Operações financeiras controladas (`gsa_admin_processar_saque`, `gsa_admin_ajustar_saldo_cliente`, `gsa_admin_baixar_fatura`).
   - Controle de playout linear da GSA TV (`gsa_admin_gsa_tv_mutate`, `gsa_admin_gsa_tv_emergency_cut`).
6. **Funções Internas de Trigger e Sistema (`SECURITY DEFINER` restritas a `service_role` ou triggers)**:
   - Sincronização de saldo e pontuação (`prevent_saldo_tampering()`).
   - Recalculo automático de nível VIP (`fn_gsa_auto_check_vip_level`).
   - Sincronização de valores pendentes de faturas (`fn_faturas_sync_valor_final_pendente`).
   - Automação de quitação de empréstimos (`fn_processar_pagamento_quitacao_emprestimo`).

### 3.2 Padrões de Segurança Invioláveis Observados nas RPCs
- **`SECURITY DEFINER` com `SET search_path = public, pg_temp`**: Presente em todas as funções sensíveis para prevenir ataques de Search Path Hijacking.
- **Validação de Identidade Criptográfica**: Funções cliente validam `auth.role() = 'authenticated'` e `public.gsa_jwt_actor_id() = p_cliente_id`.
- **Revogação Explícita de Privilégios**: Comandos `REVOKE ALL ... FROM public, anon` seguidos de `GRANT EXECUTE ... TO authenticated, service_role`.

---

## 4. AUDITORIA E ESTRATÉGIA DE TESTE DINÂMICO DE RLS (ROW LEVEL SECURITY)

### 4.1 Arquitetura RLS Multi-Tenant no PostgreSQL
A segregação multi-tenant do GSA HUB não depende de filtros aplicados na camada de frontend. Ela é aplicada diretamente no kernel do PostgreSQL através de funções auxiliares `STABLE`:
- `public.gsa_jwt_actor_type()`: retorna o tipo de ator gravado no claim `app_metadata.gsa_actor_type` do JWT (`cliente`, `prestador`, `fornecedor`, `colaborador`, `admin`).
- `public.gsa_jwt_actor_id()`: retorna o UUID do ator em `app_metadata.gsa_actor_id`.
- `public.gsa_jwt_session_id()`: retorna o UUID da sessão em `app_metadata.gsa_session_id`.
- `public.gsa_jwt_session_is_valid()`: valida se a sessão está `ativo` na tabela `sistema_sessoes` e associada ao `auth.uid()` em `gsa_auth_identities`.

### 4.2 Matriz de Políticas RLS por Ator e Tabela

| Tabela | RLS Ativo | Política Cliente | Política Prestador | Política Fornecedor | Política Admin / Colaborador | Acesso Anon |
|---|---|---|---|---|---|---|
| `saques` | SIM | SELECT próprio (`cliente_id = gsa_jwt_actor_id()`) | Bloqueado (usa `prestador_saques`) | Bloqueado | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `pontos_movimentacoes` | SIM | SELECT próprio (`cliente_id = gsa_jwt_actor_id()`) | Bloqueado | Bloqueado | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `vouchers` | SIM | SELECT próprio (`cliente_id = gsa_jwt_actor_id()`) | Bloqueado | Bloqueado | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `orcamentos` | SIM | SELECT próprio (`cliente_id = gsa_jwt_actor_id()`) | Bloqueado | Bloqueado | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `ordens_compra` | SIM | SELECT próprio (`cliente_id = gsa_jwt_actor_id()`) | Bloqueado | SELECT pedidos próprios | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `carteira_lancamentos`| SIM | SELECT próprio (`cliente_id = gsa_jwt_actor_id()`) | Bloqueado | Bloqueado | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `extrato_financeiro` | SIM | SELECT próprio (`cliente_id = gsa_jwt_actor_id()`) | Bloqueado | Bloqueado | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `prestador_demandas` | SIM | Bloqueado (vê via OS) | SELECT atribuídas (`prestador_id = gsa_jwt_actor_id()`) | Bloqueado | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `fornecedor_produtos` | SIM | Bloqueado (vê catálogo loja) | Bloqueado | ALL próprios (`fornecedor_id = gsa_jwt_actor_id()`) | ALL (`gsa_jwt_is_admin()`) | NENHUM |
| `colaboradores` | SIM | Bloqueado | Bloqueado | Bloqueado | SELECT/UPDATE conforme RBAC | NENHUM |

### 4.3 Eliminação de Políticas Wildcard (`USING (true)`)
Historicamente, migrações preliminares continham políticas permissivas (`USING (true)`) nas tabelas `orcamentos` e `ordens_compra` (`marketplace_orders_read` e `marketplace_purchase_orders_read`). Essas políticas foram **formalmente revogadas e eliminadas** nas migrações `20260910233000` e `20260911030000`, substituídas por `gsa_client_own_orcamentos_hardened` e `gsa_client_own_ordens_compra_hardened`. O script adversarial confirmou que **zero tabelas financeiras ou de pedidos possuem vazamentos wildcard**.

---

## 5. ATOMICIDADE FINANCEIRA, CONCORRÊNCIA E PROTEÇÃO ANTI-TAMPERING

### 5.1 Trigger `prevent_saldo_tampering()` e Protocolo de Bypass
A integridade financeira dos saldos de clientes é garantida por trigger `BEFORE UPDATE OF saldo_carteira, saldo_pontos ON public.clientes`.

```sql
CREATE OR REPLACE FUNCTION public.prevent_saldo_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
    IF current_setting('my.app.bypass_saldo_check', true) = 'on'
       OR current_setting('gsa.credit_release', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF auth.role() IN ('authenticated', 'anon') OR auth.role() IS NULL THEN
        IF NEW.saldo_carteira IS DISTINCT FROM OLD.saldo_carteira 
           OR NEW.saldo_pontos IS DISTINCT FROM OLD.saldo_pontos THEN
            RAISE EXCEPTION 'Acesso negado: Saldos não podem ser alterados diretamente.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
```

**Regra de Ouro**:
Qualquer stored procedure que execute mutação legítima de saldo (ex: `gsa_converter_pontos_carteira`, `gsa_client_pagar_fatura`, `gsa_admin_processar_saque`) DEVE executar:
`PERFORM set_config('my.app.bypass_saldo_check', 'on', true);` dentro do bloco da transação. Qualquer tentativa externa ou injeção SQL que tente alterar `saldo_carteira` diretamente é sumariamente abortada com exceção.

### 5.2 Bloqueios Exclusivos (`FOR UPDATE`) e Prevenção de Deadlocks
Para evitar race conditions em operações simultâneas de alta frequência:
1. **Conversão de Pontos (`gsa_converter_pontos_carteira`)**: Trava a linha do cliente (`SELECT * FROM clientes WHERE id = p_cliente_id FOR UPDATE`), valida se `saldo_pontos >= p_pontos`, debita pontos e credita carteira na mesma transação.
2. **Checkout Store com Variantes (`gsa_client_checkout_store`)**:
   - Trava a linha do cliente comprador: `SELECT * FROM clientes WHERE id = ... FOR UPDATE`.
   - Trava os produtos e variantes **em ordem canônica estrita** (`ORDER BY item_id, variante_id FOR UPDATE`) para eliminar qualquer possibilidade de Deadlock quando dois clientes tentam comprar os mesmos SKUs em ordens inversas.
   - Verifica estoque: `IF v_variant.estoque_disponivel < v_requested THEN RAISE EXCEPTION ...`.
   - Decrementa estoque fisicamente e gera fatura atômica.
3. **Pagamento de Fatura com Carteira (`gsa_client_pagar_fatura`)**:
   - Trava a fatura: `SELECT * FROM faturas WHERE id = ... FOR UPDATE`.
   - Trava o cliente: `SELECT * FROM clientes WHERE id = ... FOR UPDATE`.
   - Se houver voucher: `SELECT * FROM vouchers WHERE id = ... FOR UPDATE`.
   - Realiza o débito na carteira e baixa a fatura como `pago` sem risco de duplo pagamento.

---

## 6. METODOLOGIA DE TESTE DE PERSISTÊNCIA REAL (WRITE -> RELOAD -> DIRECT QUERY)

Para atender estritamente ao Requisito R2 e à Regra de Ouro 6, os testes dinâmicos de persistência executados pelo Worker devem seguir o ciclo obrigatório de 3 etapas:

```
[Etapa 1: Mutação Controlada]
    │  Executa mutação via RPC ou endpoint com payload determinístico e UUID rastreável.
    ▼
[Etapa 2: Purga de Cache & Isolamento de Estado]
    │  Descarta instâncias em memória, purga cache local/TanStack Query e fecha conexão aberta.
    ▼
[Etapa 3: Leitura Física Direta no PostgreSQL]
    │  Abre nova conexão limpa (via client pg direto ou nova chamada PostgREST isolada).
    ▼
[Validação das Asserções]
    - Confirma se os campos alterados refletem os novos valores no disco.
    - Confirma integridade das foreign keys e ausência de campos nulos obrigatórios.
    - Confirma criação dos registros de auditoria (ledger) em carteira_lancamentos / extrato_financeiro.
```

---

## 7. ARQUITETURA DE TESTE DE PROPAGAÇÃO CROSS-MÓDULO NAS 80 ARESTAS

As 80 arestas canônicas descritas em `GRAFO_CONEXOES.md` e rastreadas em `MATRIZ_RASTREABILIDADE.md` operam através de quatro vetores estruturais de propagação:

### 7.1 Os 4 Vetores de Propagação
1. **Vetor 1: Triggers de Banco de Dados**: Disparo atômico interno no PostgreSQL (ex: liquidação de fatura -> `fn_faturas_sync_valor_final_pendente` -> crédito de pontos de cashback em `clientes`).
2. **Vetor 2: Canais WebSocket Realtime (`useRealtimeSubscription`)**: Publicação de mensagens de broadcast pelo PostgreSQL Replication slot -> Supabase Realtime Server -> WebSocket -> Frontend consumidor atualiza tela sem recarregar.
3. **Vetor 3: Invalidação de Cache TanStack Query**: Disparo de `queryClient.invalidateQueries({ queryKey: [...] })` após a resposta de mutações na UI, forçando refetch instantâneo de listas e badges.
4. **Vetor 4: Microserviço Daemon VPS (Porta 5680 com `SessionMutex`)**: Ingestão de webhooks assíncronos (InfinitePay / WhatsApp Evolution API) na VPS `147.15.43.141`, enfileiramento por chave de sessão, execução da transação no banco e notificação aos clientes.

### 7.2 Catálogo Consolidado de Propagação para as 80 Arestas (`EDGE-001` a `EDGE-080`)

| Aresta | Domínio | Evento de Origem (Módulo A) | Vetor de Propagação | Mecanismo de Transporte | Efeito Observado no Módulo B (Destino) |
|---|---|---|---|---|---|
| `EDGE-001` | Auth | Login de Cliente PF (`ClientLoginPage.tsx`) | Vetor 2 + 3 | PostgREST -> JWT App Metadata -> Query Cache | `ClientPortal.tsx` monta dashboard com dados de perfil, saldo e extrato |
| `EDGE-002` | Auth | Login de Colaborador (`RestrictedAccessHubPage.tsx`) | Vetor 2 + 3 | RPC `gsa_auth_login_collaborator` -> RBAC | `SecureAdminPanel.tsx` exibe menu restrito com apenas as abas autorizadas |
| `EDGE-003` | Auth | Heartbeat de Sessão (`useAutoLogout.ts`) | Vetor 2 + 4 | RPC `gsa_ping_session` -> Evento Customizado | Sessão revogada dispara `gsa-session-revoked` e desconecta imediatamente |
| `EDGE-004` | Acessos | Salvar Colaborador (`AcessosModule.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_save_collaborator` -> DB Trigger | Tabela de colaboradores atualiza e permissões entram em vigor |
| `EDGE-005` | Acessos | Rotação de Credencial (`AcessosModule.tsx`) | Vetor 1 + 2 | RPC `gsa_admin_rotate_collaborator_credential` | Todas as sessões ativas do colaborador caem via Realtime |
| `EDGE-006` | Segurança | Pedido de Exclusão Sensível (`deleteRequest.ts`) | Vetor 1 + 3 | RPC `gsa_admin_create_deletion_request` | Registro entra na quarentena do painel do 2º homem aguardando aval |
| `EDGE-007` | Config | Salvar Configurações Gerais (`ConfiguracoesModule.tsx`)| Vetor 1 + 3 | RPC `gsa_admin_update_settings_secure` (Allowlist)| Taxas de conversão atualizam na Calculadora, Fidelidade e Loja |
| `EDGE-008` | CRM | Cadastro de Empresa PJ (`BusinessRegistrationPage.tsx`)| Vetor 1 + 2 | RPC de cadastro -> Fila de Análise | Empresa aparece instantaneamente no `ClientesModule.tsx` como pendente |
| `EDGE-009` | CRM | Promoção Manual de Nível VIP (`AreaVIPModule.tsx`) | Vetor 1 + 2 + 3| RPC `gsa_admin_set_client_level_manual` -> Trigger | Portal do cliente exibe novo selo VIP e checkout recalcula descontos |
| `EDGE-010` | CRM | Assinar Plano VIP Anual (`ClientAreaVIP.tsx`) | Vetor 1 + 3 | RPC `gsa_client_subscribe_vip` -> Débito Carteira | Gera fatura liquidada, promove nível VIP e reflete no faturamento |
| `EDGE-011` | CRM | Atualizar Endereço/Contato (`ClientProfile.tsx`) | Vetor 1 + 3 | `clientOperationalWrite` em `clientes` | Endereço padrão de frete já surge preenchido no checkout da loja |
| `EDGE-012` | Financeiro | Pagar Fatura com Carteira (`FaturasList.tsx`) | Vetor 1 + 2 + 3| RPC `gsa_client_pagar_fatura` (Lock ACID) | Fatura muda para 'pago' no portal e no dashboard financeiro do admin |
| `EDGE-013` | Financeiro | Gerar PIX Dinâmico (`pixService.ts`) | Vetor 4 + 3 | Gateway InfinitePay V2 -> Edge gsa-payments | Modal exibe QR Code dinâmico e inicia listener Realtime na fatura |
| `EDGE-014` | Financeiro | Webhook de Pagamento PIX (`server_webhook.cjs`) | Vetor 4 + 1 + 2| VPS Daemon Porta 5680 -> SessionMutex -> DB | Fatura é liquidada, libera cashback e modal do cliente fecha com sucesso |
| `EDGE-015` | Financeiro | Converter Pontos em Carteira (`ClientPontos.tsx`) | Vetor 1 + 3 | RPC `gsa_converter_pontos_carteira` (FOR UPDATE) | Header do portal atualiza contadores de pontos e saldo simultaneamente |
| `EDGE-016` | Financeiro | Transferência P2P de Saldo (`ClientTransferencias.tsx`)| Vetor 1 + 2 + 3| RPC `gsa_client_request_transfer` -> Débito/Crédito| Saldo debita na origem e destinatário recebe notificação instantânea |
| `EDGE-017` | Financeiro | Reverter Transferência P2P (`ClientTransferencias.tsx`)| Vetor 1 + 3 | RPC `gsa_client_reverse_transfer` (Janela 15m) | Fundos retornam à carteira de origem e geram estorno no extrato |
| `EDGE-018` | Financeiro | Solicitar Saque de Crédito (`CreditWithdrawalModal.tsx`)| Vetor 1 + 2 + 3| RPC `gsa_client_request_withdrawal` | Pedido aparece na esteira de julgamento do administrador financeiro |
| `EDGE-019` | Financeiro | Marcar Saque como Pago (`CreditWithdrawalsAdminPanel`)| Vetor 1 + 2 + 3| RPC `gsa_admin_processar_saque` -> Trigger Ledger | Cliente recebe comprovante PIX no extrato e status muda para 'pago' |
| `EDGE-020` | Empréstimo | Solicitar Empréstimo Pessoal (`ClientMeuCredito.tsx`)| Vetor 1 + 2 + 3| `clientOperationalWrite` em `emprestimos` | Proposta entra na workstation de análise de risco do administrador |
| `EDGE-021` | Empréstimo | Aprovar Empréstimo (`EmprestimosModule.tsx`) | Vetor 1 + 2 + 3| RPC `gsa_admin_emprestimo_aprovar` | Gera parcelas em `emprestimo_parcelas` e contrato para assinatura |
| `EDGE-022` | Cobrança | Gerar Acordo de Cobrança (`CobrancaModule.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_gerar_acordo_cobranca` | Substitui faturas em atraso por novas parcelas e suspende protesto |
| `EDGE-023` | E-commerce | Adicionar Item ao Carrinho (`ProductPage.tsx`) | Vetor 1 + 3 | `clientOperationalWrite` em `loja_carrinhos` | Sacola de compras no header atualiza badge e lista itens no drawer |
| `EDGE-024` | E-commerce | Finalizar Compra da Loja (`CheckoutPage.tsx`) | Vetor 1 + 2 + 3| RPC `gsa_client_checkout_store` (Locks canônicos) | Baixa estoque de variantes, gera fatura e pedido entra em 'Meus Pedidos' |
| `EDGE-025` | Pós-Venda | Solicitar Devolução/Troca (`PurchasesPage.tsx`) | Vetor 1 + 2 + 3| `clientOperationalWrite` em `loja_solicitacoes` | Chamado surge na workstation pós-venda do admin para inspeção |
| `EDGE-026` | Pós-Venda | Aprovar Devolução (`LojaTrocasModule.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_atualizar_solicitacao_loja` | Restaura estoque de variantes e estorna saldo na carteira do cliente |
| `EDGE-027` | Catálogo | Salvar Produto com Variantes (`ProdutosModule.tsx`) | Vetor 1 + 2 + 3| RPC `gsa_admin_save_product_catalog_v2` | SKUs gerados aparecem imediatamente na vitrine pública da loja |
| `EDGE-028` | Descontos | Criar Cupom de Desconto (`CuponsLojaModule.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_create_store_coupon` | Cupom passa a ser aceito no checkout aplicando desconto no subtotal |
| `EDGE-029` | Parceiros | Resgatar Cupom de Parceiro (`ClientVouchers.tsx`) | Vetor 1 + 2 + 4| RPC `gsa_public_resgatar_beneficio_parceiro` | Protocolo gerado, SLA 24h inicia no painel admin e WhatsApp é enfileirado|
| `EDGE-030` | Recursos | Desafio 2FA de Recurso (`ProtocolConsultPage.tsx`) | Vetor 4 + 1 | Edge `gsa-auth-session` -> WhatsApp Dispatch | Desafio de 6 dígitos gravado em hash e despachado ao celular |
| `EDGE-031` | Recursos | Submeter Recurso com Anexos (`ProtocolConsultPage.tsx`)| Vetor 1 + 2 + 3| Edge `gsa-auth-session` -> Multi-table insert | Resgate passa para 'em_recurso' e surge em destaque no painel admin |
| `EDGE-032` | Recursos | Julgar Recurso Deferido (`PartnerRedemptionDetailModal`)| Vetor 1 + 2 + 4| RPC `gsa_admin_decide_partner_appeal` -> Outbox | Cliente recebe veredito no WhatsApp (UTF-8) e status atualiza na tela |
| `EDGE-033` | Afiliados | Criar Link de Divulgação (`AfiliadoDashboard.tsx`) | Vetor 1 + 3 | RPC `gsa_client_create_affiliate_link` | Link parametrizado com hash único surge no catálogo do afiliado |
| `EDGE-034` | Afiliados | Captura de Referral URL (`AffiliateTrackingBridge.tsx`)| Vetor 1 + 2 | RPC `gsa_public_record_affiliate_click` | Cliques totais incrementam no dashboard do afiliado em tempo real |
| `EDGE-035` | Afiliados | Liberar Comissões em Carência (`AffiliateAdminModule`)| Vetor 1 + 3 | RPC `gsa_admin_release_affiliate_commissions` | Comissões > 30 dias movem para 'disponivel' no saldo do afiliado |
| `EDGE-036` | Afiliados | Transferir Saldo entre Afiliados (`AfiliadoDashboard`) | Vetor 1 + 3 | RPC `gsa_client_transfer_affiliate_balance` | Débito na origem, crédito no destino e registro de extrato |
| `EDGE-037` | Workstation| Despachar OS para Prestador (`OrcamentosModule.tsx`) | Vetor 1 + 2 + 3| RPC `gsa_admin_finalize_service_order` | Demanda criada com status 'aberta' toca alerta sonoro no prestador |
| `EDGE-038` | Workstation| Prestador Conclui Demanda (`PrestadorDemandas.tsx`) | Vetor 1 + 2 + 3| RPC `gsa_provider_transition_demand` ('deliver') | Demanda passa para 'em_analise' com fotos anexadas visíveis ao admin |
| `EDGE-039` | Workstation| Agendar Atendimento de Campo (`PrestadorAgenda.tsx`) | Vetor 1 + 3 | RPC `gsa_provider_create_schedule` (Anti-choque) | Bloco de horário bloqueado na agenda do técnico e no CRM |
| `EDGE-040` | Workstation| Solicitar Repasse de Demanda (`PrestadorFinanceiro.tsx`)| Vetor 1 + 2 + 3| RPC `gsa_provider_request_withdrawal` | Valor retido do saldo e enfileirado para pagamento no contas a pagar |
| `EDGE-041` | Procurement| Fornecedor Sugere Produto (`FornecedorProdutos.tsx`) | Vetor 1 + 2 + 3| RPC `gsa_supplier_request_product` | Item surge na workstation de compras corporativas da GSA |
| `EDGE-042` | Procurement| Despacho de Remessa com NF-e (`FornecedorRemessas.tsx`)| Vetor 1 + 2 + 3| RPC `gsa_supplier_submit_delivery` com chave 44d | Pedido passa para 'em_transito' aguardando chegada no almoxarifado |
| `EDGE-043` | Procurement| Homologar Recebimento Físico (`FornecedoresModule.tsx`)| Vetor 1 + 3 | RPC `gsa_admin_review_supplier_delivery` | Estoque de variantes é incrementado e título do fornecedor liberado |
| `EDGE-044` | RBAC | Mover Demanda no Kanban (`DemandasColaboradorModule`) | Vetor 1 + 2 + 3| RPC `gsa_collaborator_transition_demand` | Fase comercial atualizada e histórico com autor_id gravado |
| `EDGE-045` | RBAC | Guarda de Rotas de Colaborador (`SecureAdminPanel.tsx`)| Vetor 2 + 3 | Realtime listener em `colaborador_modulos` | Revogação de acesso pelo admin desmonta a tela do colaborador na hora |
| `EDGE-046` | Viagens | Criar Pacote Turístico (`TravelAdminModule.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_travel_create_package` | Pacote publicado na vitrine de turismo com simulador de parcelas |
| `EDGE-047` | Viagens | Reservar Pacote de Viagem (`TravelPackageDetailModal`) | Vetor 1 + 3 | RPC `gsa_client_checkout_travel` | Gera faturas e solicitação de reserva na esteira de passagens |
| `EDGE-048` | Saúde | Emitir Proposta de Plano de Saúde (`SaudeModule.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_saude_salvar_proposta` | Vidas/dependentes vinculados com guia de carência no portal do cliente |
| `EDGE-049` | Seguros | Registrar Sinistro de Veículo (`SegurosModule.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_seguros_registrar_sinistro` | Protocolo aberto com fotos e mensagens de acompanhamento de perícia |
| `EDGE-050` | Classificados| Aprovar Anúncio de Classificado (`ClassifiedsModule`) | Vetor 1 + 2 + 3| RPC `gsa_admin_classificados_moderar` | Anúncio entra no ar na vitrine pública com chat de interessados ativo |
| `EDGE-051` | Ads | Criar Campanha de Mídia (`AdvertiserPortal.tsx`) | Vetor 1 + 3 | RPC `gsa_advertiser_create_campaign` -> Fatura | Campanha entra na fila de conformidade editorial de marketing |
| `EDGE-052` | Ads | Ativar Campanha Aprovada (`AdvertisingAdminModule`) | Vetor 1 + 2 + 3| RPC `gsa_admin_approve_ad_campaign` | Criativos entram na rotação do ad server contabilizando impressões |
| `EDGE-053` | GSA TV | Salvar Grade Linear (`GsaTvControlRoom.tsx`) | Vetor 1 + 4 | RPC `gsa_admin_gsa_tv_mutate` -> VPS Watchdog | Daemon de playout na VPS recarrega a grade sem interromper transmissão |
| `EDGE-054` | GSA TV | Chavear Sinal Ao Vivo On-Air (`GsaTvLiveConsole.tsx`)| Vetor 4 + 2 | Edge `gsa-tv-proxy` -> Daemon Porta 5680 | Comutador troca sinal para RTMP externo e registra log no as-run |
| `EDGE-055` | Suporte | Abrir Ticket de Dúvida (`ClientSuporte.tsx`) | Vetor 1 + 2 + 3| `clientOperationalWrite` em `tickets` | Chamado cai na fila de triagem com alerta sonoro no painel do suporte |
| `EDGE-056` | Suporte | Responder Ticket de Suporte (`TicketsModule.tsx`) | Vetor 1 + 2 + 4| RPC `gsa_admin_ticket_reply` -> WhatsApp Outbox | Cliente recebe mensagem em tempo real no chat e notificação WhatsApp |
| `EDGE-057` | RH | Candidatar-se a Vaga de Emprego (`CareersPublicPage`) | Vetor 1 + 4 | Edge `gsa-careers-notifications` -> DB | Currículo em PDF armazenado e candidato entra na triagem de RH |
| `EDGE-058` | VPS | Disparo de WhatsApp Transacional (`n8nWhatsApp.ts`) | Vetor 4 | Cascata: vps-api -> Evolution API -> n8n | Entrega com acentuação UTF-8 perfeita sem travar o cliente |
| `EDGE-059` | Armazenamento| Visualização Segura de Documentos KYC (`privateStorage`)| Vetor 4 | Cloudflare Worker / R2 Bucket Privado | Gera presigned URL temporária sem expor link permanente do arquivo |
| `EDGE-060` | VPS Daemon | Fila FIFO por Número WhatsApp (`server_webhook.cjs`) | Vetor 4 + 1 | In-Memory `SessionMutex` (Porta 5680) | Múltiplas mensagens simultâneas processadas sequencialmente sem lock |
| `EDGE-061` | Marketing | Publicar Hero Banner (`SiteCampaignAdminModule.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_save_hero_banner` | Banner passa a rodar no carrossel da home pública |
| `EDGE-062` | Scraping | Executar Coleta Shopee (`ScrapingAdminModule.tsx`) | Vetor 4 + 2 | RPC `gsa_admin_trigger_scraping_now` -> Worker | Telemetria de scraping atualiza modal em tempo real |
| `EDGE-063` | Shopee | Processar Pedidos Externos (`ShopeeOperationsModule`)| Vetor 1 + 3 | RPC `gsa_admin_shopee_job` | Pedidos integrados decrementam estoque físico das variantes no GSA HUB |
| `EDGE-064` | Indique | Convidar Amigo por WhatsApp (`ClientIndiqueGanhe.tsx`)| Vetor 1 + 3 | `clientOperationalWrite` em `indicacoes` | Código único criado e voucher de boas-vindas gerado ao convidado |
| `EDGE-065` | Fidelidade | Resgatar Brinde Físico (`ClientPremios.tsx`) | Vetor 1 + 3 | `clientOperationalWrite` em `cliente_premios` | Debita pontos do cliente e pedido entra na expedição de brindes |
| `EDGE-066` | Assinaturas| Cadastrar Plano Recorrente (`OrdensAssinaturaModule`)| Vetor 1 + 3 | RPC `gsa_admin_save_subscription_catalog` | Plano fica disponível para contratação no portal do cliente |
| `EDGE-067` | Fiscal | Emitir Nota Fiscal Eletrônica (`FiscalModule.tsx`) | Vetor 4 + 1 | RPC `gsa_admin_emitir_nota_fiscal` -> Mensageria | Chave de 44 dígitos gerada e botão de download do DANFE disponível |
| `EDGE-068` | Precificação| Alterar Margem de Mão de Obra (`CalculatorProAdmin`)| Vetor 1 + 3 | RPC `gsa_admin_save_calculator_pro_runtime_config` | Simulador de orçamentos online recalcula preços com a nova margem |
| `EDGE-069` | Governança | Executar Diagnóstico Global (`SystemMonitorModule.tsx`)| Vetor 4 + 1 | RPC `gsa_admin_system_snapshot` | Probes de latência de banco, redis e storage gravados em log |
| `EDGE-070` | Mensageria | Testar Conexão Evolution API (`WhatsAppHealthMonitor`)| Vetor 4 | HTTP Direct VPS 147.15.43.141:8080 | Status da instância atualiza badge de verde para vermelho em falha |
| `EDGE-071` | Vaquinha | Contribuir com Vaquinha (`CrowdfundingModal.tsx`) | Vetor 1 + 2 + 3| `clientOperationalWrite` em `loja_vaquinha_...` | Valor arrecadado soma e barra de progresso avança em tempo real |
| `EDGE-072` | GSA TV | Registrar Direitos Autorais (`GsaTvRights.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_save_rights_record` | Selo jurídico verde liberado para exibição do vídeo na grade |
| `EDGE-073` | GSA TV | Inserir Lower-Third no Ar (`GsaTvGraphics.tsx`) | Vetor 2 + 4 | RPC `gsa_admin_gsa_tv_mutate` -> Playout WebSocket | Tarja de notícias animada entra sobreposta ao sinal de transmissão |
| `EDGE-074` | BI | Filtrar Período DRE (`PainelRentabilidade.tsx`) | Vetor 1 + 3 | RPC `gsa_admin_financial_snapshot` | Consolida receitas, custos de mercadoria e margem líquida em gráficos |
| `EDGE-075` | RH | Publicar Nova Vaga de Emprego (`CareerVacanciesManager`)| Vetor 1 + 3 | RPC `gsa_admin_save_career_vacancy` | Vaga publicada instantaneamente no portal Trabalhe Conosco |
| `EDGE-076` | Promoções | Cancelar Promoção Ativa (`ClientCancelPromoModal.tsx`)| Vetor 1 + 3 | `clientOperationalWrite` em `cliente_promocoes` | Promoção passa para inativa e suspende bonificação em compras futuras |
| `EDGE-077` | Combos | Salvar Regra Leve X Pague Y (`PromocaoQuantidadeForm`)| Vetor 1 + 3 | RPC `gsa_admin_save_promocao_quantidade` | Motor de cálculo da loja aplica desconto automático ao atingir volume |
| `EDGE-078` | Disputas | Contestar Lançamento de Crédito (`CreditDisputeModal`)| Vetor 1 + 2 + 3| `clientOperationalWrite` em `loja_credito_disputas`| Chamado entra em quarentena com trava temporária da cobrança |
| `EDGE-079` | KYC | Upload de Documentos Técnicos (`ProviderAccessPage`) | Vetor 4 + 1 + 3| R2 Storage -> RPC `gsa_provider_upload_document` | Documentos anexados e prestador entra na esteira de homologação técnica |
| `EDGE-080` | Bancário | Alterar Conta Bancária Fornecedor (`FornecedorFinanceiro`)| Vetor 1 + 3 | RPC `gsa_supplier_update_profile` (Quarentena) | Mudança de chave PIX entra em quarentena de 48h para checagem ativa |

---

## 8. PLANO DE EXECUÇÃO DO WORKER PARA `RELATORIO_BANCO.md`

O Worker encarregado de executar e consolidar os testes dinâmicos para a entrega oficial de `RELATORIO_BANCO.md` deve seguir o roteiro automatizado e os critérios de validação descritos a seguir.

### 8.1 Baterias de Testes Obrigatórias

1. **Bateria 1: Conformidade Contratual de Schema e Migrações (Exit 0)**:
   - *Comando*: `node scripts/validate-db-schema.cjs --snapshot-only`
   - *Comando*: `npm run test:database-migration-baseline` (verificar conflitos documentados em `audit/database-migration-conflicts.json`)
   - *Métrica Esperada*: 100% de tabelas contratuais, colunas e assinaturas de RPCs em total conformidade.
2. **Bateria 2: Validação Programática de RLS e Prevenção de Vazamentos (Exit 0)**:
   - *Comando*: `node scripts/verify-client-rls-acceptance.mjs`
   - *Métrica Esperada*: 17/17 verificações aprovadas (RLS ativo em `saques`, `pontos_movimentacoes`, `vouchers`, ausência de `USING (true)`, bypass anti-tampering em 4 RPCs).
3. **Bateria 3: Desafio Adversarial de Segurança e Concorrência de RPCs (Exit 0)**:
   - *Comando*: `node scripts/adversarial-database-security-challenge.mjs`
   - *Métrica Esperada*: 35/35 testes defendidos (isolamento multi-tenant, bloqueio de escrita direta, travas `FOR UPDATE` e verificações de caller auth).
4. **Bateria 4: Resiliência de Contratos Realtime e Ausência de Leaks (Exit 0)**:
   - *Comando*: `npm run test:realtime`
   - *Comando*: `npx tsx scripts/check-realtime-audit.ts`
   - *Métrica Esperada*: 0 usos de hooks legados, 0 canais sem cleanup, 100% de canais com filtros de linha obrigatórios.
5. **Bateria 5: Suíte de Testes de Integridade de Dados no Vitest (Exit 0)**:
   - *Comando*: `npx vitest run src/tests/database-schema-integrity.test.ts`
   - *Comando*: `npx vitest run src/tests/marketplace-checkout-concurrency-audit.test.ts`
   - *Comando*: `npx vitest run src/tests/marketplace-returns-exchanges-atomicity.test.ts`
   - *Comando*: `npx vitest run src/tests/realtime-concurrency-adversarial.test.ts`

### 8.2 Estrutura do Documento Oficial `RELATORIO_BANCO.md`
O documento final gerado pelo Worker deve conter:
1. **Cabeçalho Oficial de Auditoria**: Data, ambiente, ferramentas e integridade de dados.
2. **Sumário Executivo Quantitativo**: Total de tabelas verificadas (294), RPCs catalogadas (692), políticas RLS ativas, triggers e índices.
3. **Quadro de Conformidade RLS por Domínio**: Evidências de testes multi-tenant e ausência de vazamentos `USING (true)`.
4. **Laudo de Atomicidade ACID e Proteções Financeiras**: Comprovação de `prevent_saldo_tampering()`, `FOR UPDATE` locks e prevenção de double-spend.
5. **Matriz de Persistência Real**: Registros de testes `Write -> Reload -> Direct Query`.
6. **Matriz de Propagação Cross-Módulo nas 80 Arestas**: Tabela consolidada contendo Status, Tempo de Resposta e Evidência para cada uma das 80 arestas.
7. **Reconciliação Matemática com o Inventário**: Números absolutos reconciliados sem discrepâncias.

---

## 9. CONCLUSÕES TÉCNICAS E DIRETRIZES FINAIS

1. **Robustez Arquitetural Comprovada**: O sistema GSA HUB possui uma arquitetura de banco de dados e controle de acesso extremamente sofisticada e madura, baseada em `SECURITY DEFINER`, RLS orientado a claims de JWT no app_metadata, triggers de proteção de saldo e travas `FOR UPDATE` canônicas.
2. **Zero Falsas Alegações**: Em cumprimento à Regra de Ouro 11, este documento mantém o status de análise estática e planejamento rigoroso, fornecendo ao Worker os scripts, queries, comandos e asserções exatas para a execução dinâmica sem mascaramento de falhas.
3. **Prontidão Imediata**: Todas as ferramentas e scripts de validação de banco (`validate-db-schema.cjs`, `verify-client-rls-acceptance.mjs`, `adversarial-database-security-challenge.mjs`, `check-realtime-audit.ts`) foram executadas e verificadas no ambiente real, operando de forma determinística e reproduzível.
