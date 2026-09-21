# GRAFO DE CONEXÕES DO SISTEMA GSA HUB

**Documento Oficial**: `GRAFO_CONEXOES.md`  
**Milestone**: Milestone 1 — Baseline Inicial, Inventário de Escopo e Grafo de Conexões (R1)  
**Data da Auditoria**: 2026-09-16  
**Status Canônico de 100% das Arestas**: **`ANALISADO ESTATICAMENTE`** (Zero alegações de `VALIDADO`)  
**Metodologia de Modelagem**: Cada aresta de conexão modela a travessia de dados entre as camadas da arquitetura em 5 níveis hierárquicos:
```
[1. UI Component / Elemento]
       │
       ▼
[2. Handler Local / Hook]
       │
       ▼
[3. Service Method / API Client]
       │
       ▼
[4. Backend Endpoint / RPC]
       │
       ▼
[5. Tabelas PostgreSQL & Triggers]
       │
       ▼
[Propagação Inter-Módulos / Realtime / Invalidação de Cache]
```

---

## 1. SUMÁRIO EXECUTIVO DA TOPOLOGIA DO GRAFO

| Métrica Estrutural | Valor Consolidado | Detalhes / Cobertura |
|---|---|---|
| **Total de Arestas Canônicas** | **80 arestas estruturadas** | Identificadores padronizados de `EDGE-001` a `EDGE-080` |
| **Domínios Funcionais Cobertos** | **14 domínios nucleares** | Cobertura integral dos módulos administrativos, públicos, transacionais e de streaming |
| **Chamadas RPC Mapeadas no Frontend** | **116 ocorrências** | 52 funções PostgreSQL `SECURITY DEFINER` distintas |
| **Operações de Tabela Supabase** | **383 ocorrências** | Distribuídas em 84 tabelas relacionais com RLS |
| **Subscrições Realtime Auditadas** | **115 subscrições ativas** | 63 tabelas com filtros de linha e debounce |
| **Endpoints de Edge Functions** | **17 microserviços** | Invocações serverless Deno em `supabase/functions/` |
| **Rotas de Webhook VPS** | **15 rotas ativas** | Microserviço daemon Node.js porta 5680 com `SessionMutex` |

---

## 2. MECANISMOS DE PROPAGAÇÃO CROSS-MÓDULO

Toda mutação de estado executada no sistema propaga seus efeitos através de quatro mecanismos coordenados:
1. **Gatilhos de Banco de Dados (Triggers)**: Executam integridade referencial, cálculos de comissões, pontuação VIP e logs de auditoria no próprio PostgreSQL de forma atômica.
2. **Canais WebSocket Supabase Realtime**: Transmissão bidirecional de eventos (`INSERT`, `UPDATE`, `DELETE`) ouvidos pelos hooks `useRealtimeSubscription`, atualizando telas em segundo plano.
3. **Invalidação de Cache TanStack Query**: `queryClient.invalidateQueries({ queryKey: [...] })` força o recarregamento imediato de listas, contadores e extratos quando uma mutação é concluída.
4. **Eventos Customizados de Janela**: Eventos globais (`window.dispatchEvent(new CustomEvent('gsa-session-revoked'))`) forçam o encerramento imediato de sessões revogadas no navegador.

---

## 3. CATÁLOGO DAS 80 ARESTAS CANÔNICAS POR DOMÍNIO FUNCIONAL

### Domínio 1: Autenticação & Sessões (3 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-001` | `ClientLoginPage.tsx`<br>Botão 'Entrar' (Formulário de Login Cliente) | `handleLoginSubmit` | `sessionService.loginClient` | `RPC gsa_auth_login_client / Edge gsa-auth-session` | `sistema_sessoes, clientes, gsa_auth_rate_limits` | ClientPortal.tsx (Dashboard), Header de Saldo/Pontos, App.tsx (Sessão Ativa) | **ANALISADO ESTATICAMENTE** |
| `EDGE-002` | `RestrictedAccessHubPage.tsx`<br>Formulário de Código de Acesso Colaborador | `handleCodeSubmit` | `sessionService.loginColaborador` | `RPC gsa_auth_login_collaborator` | `sistema_sessoes, colaboradores, colaborador_modulos` | SecureAdminPanel.tsx (Menu filtrado por colaboradorModulos) | **ANALISADO ESTATICAMENTE** |
| `EDGE-003` | `useAutoLogout.ts`<br>Timer Intervalar (Heartbeat de 15s) | `pingSessionCycle` | `sessionService.pingSession` | `RPC gsa_ping_session` | `sistema_sessoes` | window CustomEvent 'gsa-session-revoked' -> App.tsx (Desconexão e Limpeza) | **ANALISADO ESTATICAMENTE** |

### Domínio 2: Governança & Acessos (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-004` | `AcessosModule.tsx`<br>Botão 'Salvar Colaborador' (Modal de Criação/Edição) | `handleSaveCollaborator` | `callAdminRpc('gsa_admin_save_collaborator')` | `RPC gsa_admin_save_collaborator` | `colaboradores, colaborador_modulos, audit_logs` | AcessosModule.tsx (Tabela de Colaboradores) e Sessões ativas do colaborador | **ANALISADO ESTATICAMENTE** |
| `EDGE-005` | `AcessosModule.tsx`<br>Botão 'Rotacionar Credencial' (Menu de Ações) | `handleRotateCredential` | `callAdminRpc('gsa_admin_rotate_collaborator_credential')` | `RPC gsa_admin_rotate_collaborator_credential` | `colaboradores, sistema_sessoes (revogação em lote)` | Sessões ativas do colaborador desconectadas imediatamente via Realtime | **ANALISADO ESTATICAMENTE** |

### Domínio 3: Governança & Segurança (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-006` | `deleteRequest.ts`<br>Botão 'Excluir Cliente / Registro' (Ação Administrativa Crítica) | `requestSensitiveDeletion` | `callAdminRpc('gsa_admin_create_deletion_request')` | `RPC gsa_admin_create_deletion_request` | `solicitacoes_exclusao, sensitive_audit_logs` | Painel de Quarentena de Exclusões (Aprovação de Segundo Homem) | **ANALISADO ESTATICAMENTE** |

### Domínio 4: Governança & Configurações (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-007` | `ConfiguracoesModule.tsx`<br>Botão 'Salvar Alterações' (Formulário de Configurações) | `handleSaveSettings` | `callAdminRpc('gsa_admin_update_settings_secure')` | `RPC gsa_admin_update_settings_secure` | `system_settings, empresa` | ClientPortal (Cálculo de pontos), StoreHub, CheckoutPage | **ANALISADO ESTATICAMENTE** |

### Domínio 5: CRM & Clientes (4 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-008` | `BusinessRegistrationPage.tsx`<br>Formulário de Onboarding de Pessoa Jurídica (PJ) | `handleBusinessRegister` | `clientOperationalWrite('clientes', 'insert')` | `RPC gsa_client_registration_challenge / PostgREST` | `clientes, gsa_client_registration_challenges` | Admin ClientesModule.tsx (Fila de Homologação PJ) | **ANALISADO ESTATICAMENTE** |
| `EDGE-009` | `AreaVIPModule.tsx`<br>Botão 'Alterar Nível Manual' (Modal de Ajuste VIP) | `handleChangeLevelManual` | `callAdminRpc('gsa_admin_set_client_level_manual')` | `RPC gsa_admin_set_client_level_manual` | `clientes, level_history, client_levels` | ClientPortal.tsx (Badge VIP), CheckoutPage (Desconto em compras) | **ANALISADO ESTATICAMENTE** |
| `EDGE-010` | `ClientAreaVIP.tsx`<br>Botão 'Assinar Plano VIP Anual' | `handleSubscribeVip` | `callClientRpc('gsa_client_subscribe_vip')` | `RPC gsa_client_subscribe_vip` | `clientes, assinaturas, faturas, extrato_financeiro` | Admin FinanceiroModule.tsx (Fatura de Assinatura) e Admin AssinaturasModule.tsx | **ANALISADO ESTATICAMENTE** |
| `EDGE-011` | `ClientProfile.tsx`<br>Botão 'Salvar Endereço e Contato' | `handleSaveProfile` | `clientOperationalWrite('clientes', 'update')` | `RPC gsa_client_operational_write` | `clientes` | CheckoutPage.tsx (Endereço de Entrega padrão pré-preenchido) | **ANALISADO ESTATICAMENTE** |

### Domínio 6: Financeiro & Fintech (8 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-012` | `FaturasList.tsx`<br>Botão 'Pagar com Carteira' (Modal de Quitação de Fatura) | `handlePayInvoiceWallet` | `callClientRpc('gsa_client_pagar_fatura')` | `RPC gsa_client_pagar_fatura` | `faturas, pagamentos, clientes (saldo_carteira), carteira_lancamentos, extrato_financeiro` | Admin FinanceiroModule.tsx (Status da Fatura -> 'pago') e ClientFinanceiro.tsx | **ANALISADO ESTATICAMENTE** |
| `EDGE-013` | `pixService.ts`<br>Botão 'Gerar PIX Instantâneo' (Modal de Checkout / Fatura) | `createDynamicPix` | `createInfinitePayOrderCheckout` | `InfinitePay Checkout V2 / Edge gsa-payments` | `faturas (pix_copia_cola, link_pagamento)` | CheckoutPixModal.tsx (Exibição de QR Code e Copia-e-Cola com polling) | **ANALISADO ESTATICAMENTE** |
| `EDGE-014` | `server_webhook.cjs (VPS Daemon)`<br>Webhook Inbound Gateway (/webhook/infinitepay) | `handleInfinitePayWebhook` | `SessionMutex -> Database Transaction` | `VPS Daemon Porta 5680 / PostgreSQL` | `faturas, pagamentos, clientes, extrato_financeiro, pontos_movimentacoes` | Realtime WebSocket -> Frontend atualiza fatura de 'pendente' para 'pago' instantaneamente | **ANALISADO ESTATICAMENTE** |
| `EDGE-015` | `ClientPontos.tsx`<br>Botão 'Converter Pontos em Carteira' | `handleConvertPoints` | `callClientRpc('gsa_client_convert_points')` | `RPC gsa_client_convert_points` | `clientes (saldo_pontos, saldo_carteira), pontos_movimentacoes, carteira_lancamentos, extrato_financeiro` | Header do Portal do Cliente e Admin ClientesModule.tsx | **ANALISADO ESTATICAMENTE** |
| `EDGE-016` | `ClientTransferencias.tsx`<br>Botão 'Transferir Saldo' (Formulário P2P) | `handleTransferBalance` | `callClientRpc('gsa_client_request_transfer')` | `RPC gsa_client_request_transfer` | `transferencias, clientes (origem e destino), carteira_lancamentos, extrato_financeiro` | Extrato do Cliente Origem e Notificação em Tempo Real no Cliente Destino | **ANALISADO ESTATICAMENTE** |
| `EDGE-017` | `ClientTransferencias.tsx`<br>Botão 'Reverter Transferência' (Dentro da Janela de Tolerância) | `handleReverseTransfer` | `callClientRpc('gsa_client_reverse_transfer')` | `RPC gsa_client_reverse_transfer` | `transferencias, clientes (estorno), carteira_lancamentos, extrato_financeiro` | Extrato de ambos os clientes e status da transferência atualizado | **ANALISADO ESTATICAMENTE** |
| `EDGE-018` | `CreditWithdrawalModal.tsx`<br>Botão 'Solicitar Saque de Crédito' | `handleRequestCreditWithdrawal` | `callClientRpc('gsa_client_request_withdrawal')` | `RPC gsa_client_request_withdrawal` | `saques, clientes, extrato_financeiro` | Admin CreditWithdrawalsAdminPanel.tsx / FinanceiroSuperDomain.tsx | **ANALISADO ESTATICAMENTE** |
| `EDGE-019` | `CreditWithdrawalsAdminPanel.tsx`<br>Botão 'Marcar Saque como Pago' (Após transferência PIX) | `handleMarkWithdrawalPaid` | `callAdminRpc('gsa_admin_processar_saque')` | `RPC gsa_admin_processar_saque` | `saques, extrato_financeiro, faturas, audit_logs` | ClientFinanceiro.tsx (Extrato atualizado com comprovante de liquidação) | **ANALISADO ESTATICAMENTE** |

### Domínio 7: Financeiro & Empréstimos (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-020` | `ClientMeuCredito.tsx`<br>Botão 'Solicitar Empréstimo Pessoal' | `handleRequestLoan` | `clientOperationalWrite('emprestimos', 'insert')` | `RPC gsa_client_operational_write` | `emprestimos, emprestimo_documentos, emprestimo_historico` | Admin EmprestimosModule.tsx (Fila de Análise de Crédito) | **ANALISADO ESTATICAMENTE** |
| `EDGE-021` | `EmprestimosModule.tsx`<br>Botão 'Aprovar Proposta de Empréstimo' | `handleApproveLoan` | `callAdminRpc('gsa_admin_emprestimo_aprovar')` | `RPC gsa_admin_emprestimo_aprovar` | `emprestimos, emprestimo_parcelas, contratos, faturas` | ClientEmprestimos.tsx (Contrato disponível para assinatura digital) | **ANALISADO ESTATICAMENTE** |

### Domínio 8: Financeiro & Cobrança (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-022` | `CobrancaModule.tsx`<br>Botão 'Gerar Acordo de Renegociação' | `handleGenerateDebtAgreement` | `callAdminRpc('gsa_admin_gerar_acordo_cobranca')` | `RPC gsa_admin_gerar_acordo_cobranca` | `cobrancas, cobranca_acordos, cobranca_historico, faturas (substituição)` | ClientFinanceiro.tsx (Novas faturas do acordo) e CobrancaModule.tsx | **ANALISADO ESTATICAMENTE** |

### Domínio 9: Marketplace & E-commerce (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-023` | `ProductPage.tsx`<br>Botão 'Adicionar ao Carrinho' / 'Comprar Agora' | `handleAddToCart` | `clientOperationalWrite('loja_carrinhos', 'update')` | `RPC gsa_client_operational_write` | `loja_carrinhos` | EcommerceHeader.tsx (Contador do Carrinho) e CartDrawer.tsx | **ANALISADO ESTATICAMENTE** |
| `EDGE-024` | `CheckoutPage.tsx`<br>Botão 'Finalizar Compra' (Etapa 3 do Checkout) | `handleExecuteCheckout` | `callClientRpc('gsa_client_checkout_store')` | `RPC gsa_client_checkout_store / gsa_client_checkout_store_base_20260817` | `pedidos, loja_pedido_itens, produtos, produto_variantes (baixa estoque), faturas, clientes, loja_carrinhos (limpeza)` | PurchasesPage.tsx (Meus Pedidos), Admin OrdensCompraModule.tsx, Fornecedor Portal | **ANALISADO ESTATICAMENTE** |

### Domínio 10: Marketplace & Pós-Venda (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-025` | `PurchasesPage.tsx`<br>Botão 'Solicitar Devolução / Troca' | `handleRequestReturn` | `clientOperationalWrite('loja_solicitacoes', 'insert')` | `RPC gsa_client_operational_write` | `loja_solicitacoes` | Admin LojaTrocasModule.tsx (Fila de Moderação de Devoluções) | **ANALISADO ESTATICAMENTE** |
| `EDGE-026` | `LojaTrocasModule.tsx`<br>Botão 'Aprovar Solicitação de Devolução' | `handleApproveReturn` | `callAdminRpc('gsa_admin_atualizar_solicitacao_loja')` | `RPC gsa_admin_atualizar_solicitacao_loja` | `loja_solicitacoes, loja_reembolsos, produto_variantes (restauração estoque), clientes (estorno saldo/pontos)` | Client PurchasesPage.tsx, ClientFinanceiro.tsx (Saldo Estornado), ProdutosModule.tsx (Estoque) | **ANALISADO ESTATICAMENTE** |

### Domínio 11: Marketplace & Catálogo (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-027` | `ProdutosModule.tsx`<br>Botão 'Salvar Produto' (Modal de Criação/Edição) | `handleSaveProduct` | `callAdminRpc('gsa_admin_save_product_catalog_v2')` | `RPC gsa_admin_save_product_catalog_v2` | `produtos, produto_variacao_grupos, produto_variacao_opcoes, produto_variantes` | StoreHub.tsx (Catálogo Público), ProductPage.tsx (Grade de Venda) | **ANALISADO ESTATICAMENTE** |

### Domínio 12: Marketplace & Descontos (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-028` | `CuponsLojaModule.tsx`<br>Botão 'Criar Cupom de Desconto' | `handleCreateCoupon` | `callAdminRpc('gsa_admin_create_store_coupon')` | `RPC gsa_admin_create_store_coupon / PostgREST` | `cupons_loja` | CheckoutPage.tsx (Modal de Cupons Disponíveis) e StoreHub.tsx | **ANALISADO ESTATICAMENTE** |

### Domínio 13: Parceiros & Benefícios (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-029` | `ClientVouchers.tsx`<br>Botão 'Resgatar Benefício do Parceiro' | `handleRedeemBenefit` | `redeemPartnerBenefit` | `RPC gsa_public_resgatar_beneficio_parceiro` | `parceiros_resgates, parceiros, parceiros_resgates_notificacoes` | PartnersAdminModule.tsx / PartnerRedemptionDetailModal.tsx e WhatsApp do Cliente | **ANALISADO ESTATICAMENTE** |

### Domínio 14: Parceiros & Recursos (3 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-030` | `ProtocolConsultPage.tsx`<br>Botão 'Entrar com Recurso' (Quando Status = 'recusado') | `handleStartAppeal` | `requestPartnerAppealVerification` | `Edge Function gsa-auth-session ('request_partner_appeal')` | `parceiros_resgates_recurso_desafios` | WhatsApp do Cliente (Envio de PIN 2FA de 6 dígitos) | **ANALISADO ESTATICAMENTE** |
| `EDGE-031` | `ProtocolConsultPage.tsx`<br>Botão 'Enviar Recurso com Evidências' | `handleSubmitAppeal` | `completePartnerAppeal` | `Edge Function gsa-auth-session ('submit_partner_appeal')` | `parceiros_resgates_recursos, parceiros_resgates_eventos, parceiros_resgates (status -> 'em_recurso')` | Admin PartnerRedemptionDetailModal.tsx (Aba de Recursos Pendentes) | **ANALISADO ESTATICAMENTE** |
| `EDGE-032` | `PartnerRedemptionDetailModal.tsx`<br>Botão 'Aceitar / Negar Recurso' (Julgamento Administrativo) | `handleDecideAppeal` | `decidePartnerAppeal` | `RPC gsa_admin_decide_partner_appeal` | `parceiros_resgates_recursos, parceiros_resgates_eventos, parceiros_resgates_notificacoes, parceiros_resgates_public_status` | ProtocolConsultPage.tsx (Status Deferido/Indeferido) e WhatsApp com UTF-8 estrito | **ANALISADO ESTATICAMENTE** |

### Domínio 15: Programa de Afiliados (4 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-033` | `AfiliadoDashboard.tsx`<br>Botão 'Gerar Novo Link de Divulgação' | `handleCreateLink` | `createAffiliateLink` | `RPC gsa_client_create_affiliate_link` | `gsa_afiliado_links, gsa_afiliados` | AfiliadoDashboard.tsx (Lista de Links Ativos com Contador de Cliques) | **ANALISADO ESTATICAMENTE** |
| `EDGE-034` | `AffiliateTrackingBridge.tsx`<br>Listener de URL (?ref=CODIGO) no Bootstrap | `captureAffiliateReferralFromLocation` | `localStorage & Cookie Persistence / RPC gsa_public_record_affiliate_click` | `RPC gsa_public_record_affiliate_click` | `gsa_afiliado_cliques, gsa_afiliado_links (incremento cliques)` | AfiliadoDashboard.tsx (Contador de Cliques em Tempo Real) e Checkout de Compras | **ANALISADO ESTATICAMENTE** |
| `EDGE-035` | `AffiliateAdminModule.tsx`<br>Botão 'Liberar Comissões em Carência' | `handleReleaseCommissions` | `callAdminRpc('gsa_admin_release_affiliate_commissions')` | `RPC gsa_admin_release_affiliate_commissions` | `afiliado_comissoes, gsa_afiliados (saldo_comissao)` | AfiliadoDashboard.tsx (Saldo Disponível para Saque) | **ANALISADO ESTATICAMENTE** |
| `EDGE-036` | `AfiliadoDashboard.tsx`<br>Botão 'Transferir Saldo para Outro Afiliado' | `handleTransferAffiliateBalance` | `transferAffiliateBalance` | `RPC gsa_client_transfer_affiliate_balance` | `gsa_afiliado_transferencias, gsa_afiliados (origem e destino)` | Extrato P2P de Ambos os Afiliados | **ANALISADO ESTATICAMENTE** |

### Domínio 16: Prestadores & Workstation (4 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-037` | `OrcamentosModule.tsx`<br>Botão 'Despachar para Prestador' (Após Aprovação do Orçamento) | `handleDispatchToProvider` | `callAdminRpc('gsa_admin_finalize_service_order')` | `RPC gsa_admin_finalize_service_order` | `ordens_servico, prestador_demandas, orcamentos` | PrestadorDemandas.tsx (Nova Demanda na Fila do Prestador) | **ANALISADO ESTATICAMENTE** |
| `EDGE-038` | `PrestadorDemandas.tsx`<br>Botões de Ação na Demanda ('Aceitar' / 'Contraproposta' / 'Entregar') | `handleTransitionDemand` | `providerOperations.transitionDemand` | `RPC gsa_provider_transition_demand` | `prestador_demandas, demanda_comentarios, ordens_servico` | Admin DemandasOpsSuperDomain.tsx e ClientServicos.tsx | **ANALISADO ESTATICAMENTE** |
| `EDGE-039` | `PrestadorAgenda.tsx`<br>Botão 'Agendar Atendimento' | `handleCreateSchedule` | `providerOperations.createSchedule` | `RPC gsa_provider_create_schedule` | `prestador_agendamentos` | Calendário do Prestador e Linha do Tempo da OS | **ANALISADO ESTATICAMENTE** |
| `EDGE-040` | `PrestadorFinanceiro.tsx`<br>Botão 'Solicitar Saque de Repasse' | `handleRequestWithdrawal` | `providerOperations.requestWithdrawal` | `RPC gsa_provider_request_withdrawal` | `prestador_saques, prestadores (saldo_disponivel)` | Admin FinanceiroModule.tsx (Contas a Pagar / Repasses de Prestadores) | **ANALISADO ESTATICAMENTE** |

### Domínio 17: Fornecedores & Procurement (3 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-041` | `FornecedorProdutos.tsx`<br>Botão 'Propor Produto ao Catálogo' | `handleProposeProduct` | `requestSupplierProduct` | `RPC gsa_supplier_request_product` | `fornecedor_produtos, fornecedores` | Admin FornecedoresModule.tsx (Fila de Homologação de Produtos) | **ANALISADO ESTATICAMENTE** |
| `EDGE-042` | `FornecedorRemessas.tsx`<br>Botão 'Enviar Remessa com NF-e' (Despacho de Pedido) | `handleSubmitDelivery` | `submitSupplierDelivery` | `RPC gsa_supplier_submit_delivery` | `pedidos_compra, documentos_fornecedor, fornecedor_titulos` | Admin FornecedoresModule.tsx (Conferência de Carga e NF-e) | **ANALISADO ESTATICAMENTE** |
| `EDGE-043` | `FornecedoresModule.tsx`<br>Botão 'Homologar Recebimento e Integrar Estoque' | `handleReviewDelivery` | `callAdminRpc('gsa_admin_review_supplier_delivery')` | `RPC gsa_admin_review_supplier_delivery` | `pedidos_compra, produtos, produto_variantes (incremento estoque), fornecedor_titulos` | StoreHub.tsx (Estoque do Marketplace atualizado) e Financeiro Contas a Pagar | **ANALISADO ESTATICAMENTE** |

### Domínio 18: Colaboradores & RBAC (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-044` | `DemandasColaboradorModule.tsx`<br>Quadro Kanban (Arrastar demanda entre colunas) | `handleDropDemandPhase` | `callAdminRpc('gsa_collaborator_transition_demand')` | `RPC gsa_collaborator_transition_demand` | `ordens_servico, demanda_comentarios` | Admin DemandasOpsSuperDomain.tsx e ClientServicos.tsx | **ANALISADO ESTATICAMENTE** |
| `EDGE-045` | `SecureAdminPanel.tsx`<br>Guarda de Rotas (Navegação interna no painel) | `enforceCollaboratorRbac` | `routeSecurity.isRouteAllowed` | `Client-side Guard + Realtime subscription em colaborador_modulos` | `colaborador_modulos, colaboradores` | Interceptação imediata com tela de Acesso Negado em caso de invasão de rota | **ANALISADO ESTATICAMENTE** |

### Domínio 19: GSA Viagens (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-046` | `TravelAdminModule.tsx`<br>Botão 'Criar Pacote de Viagem' | `handleCreateTravelPackage` | `callAdminRpc('gsa_admin_travel_create_package')` | `RPC gsa_admin_travel_create_package` | `gsa_viagens_pacotes, viagens_pacote_imagens` | Marketplace Viagens (/marketplace/pacotes-viagem) e Home.tsx | **ANALISADO ESTATICAMENTE** |
| `EDGE-047` | `TravelPackageDetailModal.tsx`<br>Botão 'Solicitar Reserva de Viagem' | `handleRequestTravelBooking` | `callClientRpc('gsa_client_checkout_travel')` | `RPC gsa_client_checkout_travel` | `viagens_solicitacoes_reserva, viagens_passageiros, faturas` | Admin TravelAdminModule.tsx (Fila de Reservas de Turismo) | **ANALISADO ESTATICAMENTE** |

### Domínio 20: GSA Saúde & Seguros (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-048` | `SaudeModule.tsx`<br>Botão 'Emitir Proposta de Plano de Saúde' | `handleCreateHealthProposal` | `callAdminRpc('gsa_admin_saude_salvar_proposta')` | `RPC gsa_admin_saude_salvar_proposta` | `saude_propostas, saude_beneficiarios, saude_contratos` | ClientPortal (Área de Saúde) e Faturamento Recorrente | **ANALISADO ESTATICAMENTE** |

### Domínio 21: GSA Seguros (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-049` | `SegurosModule.tsx`<br>Botão 'Registrar Sinistro de Seguro' | `handleRegisterClaim` | `callAdminRpc('gsa_admin_seguros_registrar_sinistro')` | `RPC gsa_admin_seguros_registrar_sinistro` | `seguros_sinistros, seguros_sinistro_mensagens, seguros_documentos` | ClientPortal (Acompanhamento de Sinistro) e Regulação Pericial | **ANALISADO ESTATICAMENTE** |

### Domínio 22: Hub Classificados (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-050` | `ClassifiedsModule.tsx`<br>Botão 'Aprovar Anúncio de Classificado' (Moderação) | `handleApproveClassifiedAd` | `callAdminRpc('gsa_admin_classificados_moderar')` | `RPC gsa_admin_classificados_moderar` | `classificados_anuncios, classificados_midias` | Marketplace Classificados (/marketplace/classificados) e Public Search | **ANALISADO ESTATICAMENTE** |

### Domínio 23: Publicidade & Ads (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-051` | `AdvertiserPortal.tsx`<br>Botão 'Criar Nova Campanha de Anúncio' | `handleCreateAdCampaign` | `callClientRpc('gsa_advertiser_create_campaign')` | `RPC gsa_advertiser_create_campaign / Edge gsa-ads-admin` | `gsa_ad_campaigns, gsa_ad_creatives, gsa_ad_campaign_placements, faturas` | Admin AdvertisingAdminModule.tsx e Motor de Entrega de Banners | **ANALISADO ESTATICAMENTE** |
| `EDGE-052` | `AdvertisingAdminModule.tsx`<br>Botão 'Aprovar e Ativar Campanha' | `handleApproveAdCampaign` | `callAdminRpc('gsa_admin_approve_ad_campaign')` | `RPC gsa_admin_approve_ad_campaign` | `gsa_ad_campaigns, gsa_ad_delivery_events` | AdvertisingSlot.tsx em todo o portal público e GSA TV Banners | **ANALISADO ESTATICAMENTE** |

### Domínio 24: GSA TV & Playout (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-053` | `GsaTvControlRoom.tsx`<br>Botão 'Salvar Grade Semanal de Programação' | `handleSaveTvSchedule` | `callAdminRpc('gsa_admin_gsa_tv_mutate')` | `RPC gsa_admin_gsa_tv_mutate` | `gsa_tv_schedule_slots, gsa_tv_programs, gsa_tv_schedule_versions` | Guia de Programação Público (EPG) e Daemon de Playout na VPS | **ANALISADO ESTATICAMENTE** |
| `EDGE-054` | `GsaTvLiveConsole.tsx`<br>Botão 'Comutar Fonte Ao Vivo' (Chaveamento On-Air) | `handleSwitchLiveSource` | `callAdminRpc('gsa_admin_gsa_tv_extended')` | `RPC gsa_admin_gsa_tv_extended / Edge gsa-tv-proxy` | `gsa_tv_channels (live_source_id), gsa_tv_as_run` | Stream HLS Master e Player Web de Transmissão | **ANALISADO ESTATICAMENTE** |

### Domínio 25: Comunicação & Suporte (2 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-055` | `ClientSuporte.tsx`<br>Botão 'Abrir Ticket de Atendimento' | `handleCreateSupportTicket` | `clientOperationalWrite('tickets', 'insert')` | `RPC gsa_client_operational_write` | `tickets, ticket_mensagens` | Admin TicketsModule.tsx (Fila de Atendimento Omnichannel) | **ANALISADO ESTATICAMENTE** |
| `EDGE-056` | `TicketsModule.tsx`<br>Botão 'Enviar Resposta ao Cliente' | `handleSendTicketReply` | `callAdminRpc('gsa_admin_ticket_reply')` | `RPC gsa_admin_ticket_reply` | `ticket_mensagens, tickets (status -> 'aguardando_cliente')` | ClientSuporte.tsx (Chat em Tempo Real) e Notificação via WhatsApp | **ANALISADO ESTATICAMENTE** |

### Domínio 26: Recursos Humanos & Carreiras (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-057` | `CareersPublicPage.tsx`<br>Botão 'Candidatar-se à Vaga' | `handleSubmitApplication` | `submitCareerApplication` | `Edge Function gsa-careers-notifications` | `gsa_careers_applications, gsa_careers_application_history` | Admin CareersAdminModule.tsx (Triagem de Candidatos de RH) | **ANALISADO ESTATICAMENTE** |

### Domínio 27: Infraestrutura & VPS (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-058` | `n8nWhatsApp.ts`<br>Disparador Automático de Mensagens Transacionais | `sendTransactionalWhatsApp` | `Cascata 3-Tier: vps-api -> Evolution API -> n8n` | `Edge vps-api / VPS 147.15.43.141:8080 (Evolution) / 5678 (n8n)` | `whatsapp_pendencias_ativas, gsa_whatsapp_ramais` | Aparelho WhatsApp do Destinatário com Encoding UTF-8 Estrito | **ANALISADO ESTATICAMENTE** |

### Domínio 28: Infraestrutura & Armazenamento (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-059` | `privateStorage.ts`<br>Serviço de Upload e Leitura de Documentos Seguros | `getPrivateR2Url` | `Cloudflare R2 Worker (gsa-hub-r2-worker)` | `Cloudflare Worker / R2 Bucket 'gsa-private-documents'` | `cliente_documentos, prestador_documentos` | FileViewerProvider.tsx (Visualizador Protegido com URL Assinada de 15 Minutos) | **ANALISADO ESTATICAMENTE** |

### Domínio 29: Infraestrutura & VPS Daemon (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-060` | `server_webhook.cjs (VPS Daemon)`<br>SessionMutex Concurrency Guard (Fila FIFO por Número) | `SessionMutex.acquire` | `Node.js In-Memory Mutex Lock` | `Porta 5680 / Gemini 3.5 Flash Lite Engine` | `sistema_logs, faturas, produtos` | WhatsApp Conversational Bot (Processamento Sequencial sem Race Conditions) | **ANALISADO ESTATICAMENTE** |

### Domínio 30: Marketing & Campanhas (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-061` | `SiteCampaignAdminModule.tsx`<br>Botão 'Salvar Hero Banner' | `handleSaveHeroBanner` | `callAdminRpc('gsa_admin_save_hero_banner')` | `RPC gsa_admin_save_hero_banner` | `gsa_hero_banners` | Home.tsx / SiteCampaignBootstrap.tsx (Banners rotativos da home) | **ANALISADO ESTATICAMENTE** |

### Domínio 31: Automação & Scraping (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-062` | `ScrapingAdminModule.tsx`<br>Botão 'Disparar Scraping Agora' | `handleTriggerScrapingNow` | `callAdminRpc('gsa_admin_trigger_scraping_now')` | `RPC gsa_admin_trigger_scraping_now` | `automacao_scraping_configs, automacao_scraping_logs` | ScrapingExecutionMonitorModal.tsx (Progresso da Coleta em Tempo Real) | **ANALISADO ESTATICAMENTE** |

### Domínio 32: Marketplace & Integração Shopee (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-063` | `ShopeeOperationsModule.tsx`<br>Botão 'Processar Fila de Pedidos Shopee' | `handleProcessShopeeQueue` | `callAdminRpc('gsa_admin_shopee_job')` | `RPC gsa_admin_shopee_job` | `shopee_orders_queue, pedidos, produtos (sincronização de estoque)` | ProdutosModule.tsx (Estoque Sincronizado) e OrdensCompraModule.tsx | **ANALISADO ESTATICAMENTE** |

### Domínio 33: CRM & Indique e Ganhe (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-064` | `ClientIndiqueGanhe.tsx`<br>Botão 'Convidar Amigo por WhatsApp' | `handleCreateReferral` | `clientOperationalWrite('indicacoes', 'insert')` | `RPC gsa_client_operational_write` | `indicacoes, vouchers` | IndicacoesModule.tsx (Admin) e Dashboard do Cliente Indicador | **ANALISADO ESTATICAMENTE** |

### Domínio 34: Fidelidade & Prêmios (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-065` | `ClientPremios.tsx`<br>Botão 'Resgatar Prêmio Físico com Pontos' | `handleRedeemPrize` | `clientOperationalWrite('cliente_premios', 'insert')` | `RPC gsa_client_operational_write` | `cliente_premios, clientes (saldo_pontos), pontos_movimentacoes` | PremiosModule.tsx (Admin Fila de Entrega) e Header de Pontos do Cliente | **ANALISADO ESTATICAMENTE** |

### Domínio 35: Operações & Assinaturas (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-066` | `OrdensAssinaturaModule.tsx`<br>Botão 'Cadastrar Plano de Assinatura Recorrente' | `handleSaveSubscriptionPlan` | `callAdminRpc('gsa_admin_save_subscription_catalog')` | `RPC gsa_admin_save_subscription_catalog` | `ordens_assinatura, assinaturas` | ClientAssinaturas.tsx (Planos disponíveis para contratação) | **ANALISADO ESTATICAMENTE** |

### Domínio 36: Financeiro & Fiscal (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-067` | `FiscalModule.tsx`<br>Botão 'Emitir Nota Fiscal (NF-e / NFS-e)' | `handleEmitInvoiceFiscal` | `callAdminRpc('gsa_admin_emitir_nota_fiscal')` | `RPC gsa_admin_emitir_nota_fiscal` | `ordens_fiscais, faturas` | ClientFinanceiro.tsx (Disponibilização do DANFE / XML para o cliente) | **ANALISADO ESTATICAMENTE** |

### Domínio 37: Ferramentas & Precificação (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-068` | `CalculatorProAdminPanel.tsx`<br>Botão 'Salvar Regras de Precificação do Sistema' | `handleSavePricingRules` | `callAdminRpc('gsa_admin_save_calculator_pro_runtime_config')` | `RPC gsa_admin_save_calculator_pro_runtime_config` | `pricing_configs, system_settings` | Calculadoras Públicas e Simuladores de Serviços do Grupo GSA | **ANALISADO ESTATICAMENTE** |

### Domínio 38: Governança & Monitoria (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-069` | `SystemMonitorModule.tsx`<br>Botão 'Executar Diagnóstico do Sistema' | `handleRunDiagnostics` | `callAdminRpc('gsa_admin_system_snapshot')` | `RPC gsa_admin_system_snapshot` | `sistema_logs, gsa_audit_logs, gsa_session_blacklists` | SystemStatusIndicator.tsx (Badge de Integridade no Topo do Painel) | **ANALISADO ESTATICAMENTE** |

### Domínio 39: Comunicação & Mensageria (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-070` | `WhatsAppHealthMonitor.tsx`<br>Botão 'Testar Conexão com Evolution API' | `handleTestWhatsAppConnection` | `whatsappHealthService.checkHealth` | `HTTP Direct VPS 147.15.43.141:8080 (/instance/connectionState)` | `gsa_whatsapp_ramais` | WhatsAppButton.tsx e Painel de Telemetria de Disparos | **ANALISADO ESTATICAMENTE** |

### Domínio 40: Marketplace & Crowdfunding (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-071` | `CrowdfundingModal.tsx`<br>Botão 'Contribuir com a Vaquinha' | `handleContributeVaquinha` | `clientOperationalWrite('loja_vaquinha_contribuicoes', 'insert')` | `RPC gsa_client_operational_write` | `loja_vaquinhas, loja_vaquinha_contribuicoes, faturas` | Barra de Progresso da Vaquinha na Loja em Tempo Real | **ANALISADO ESTATICAMENTE** |

### Domínio 41: GSA TV & Direitos Autorais (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-072` | `GsaTvRights.tsx`<br>Botão 'Registrar Licença de Conteúdo Audiovisual' | `handleSaveRightsRecord` | `callAdminRpc('gsa_admin_save_rights_record')` | `RPC gsa_admin_save_rights_record` | `gsa_tv_rights_records, gsa_tv_rights_documents` | GsaTvControlRoom.tsx (Validação de Copyright no Agendamento) | **ANALISADO ESTATICAMENTE** |

### Domínio 42: GSA TV & Grafismo On-Air (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-073` | `GsaTvGraphics.tsx`<br>Botão 'Ativar Tarja / Lower-Third no Ar' | `handleTriggerOnAirGraphic` | `callAdminRpc('gsa_admin_gsa_tv_mutate')` | `RPC gsa_admin_gsa_tv_mutate` | `gsa_tv_on_air_graphics, gsa_tv_graphic_templates` | Camada de Grafismo HTML no Renderizador de Vídeo da VPS | **ANALISADO ESTATICAMENTE** |

### Domínio 43: Financeiro & Business Intelligence (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-074` | `PainelRentabilidade.tsx`<br>Seletor de Período Financeiro (Mês / Trimestre) | `handleLoadProfitabilityMetrics` | `callAdminRpc('gsa_admin_financial_snapshot')` | `RPC gsa_admin_financial_snapshot` | `faturas, extrato_financeiro, pedidos` | Gráficos do Recharts em PainelRentabilidade.tsx e Dashboard.tsx | **ANALISADO ESTATICAMENTE** |

### Domínio 44: Recursos Humanos & Gestão de Vagas (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-075` | `CareerVacanciesManager.tsx`<br>Botão 'Publicar Nova Vaga de Emprego' | `handleSaveVacancy` | `callAdminRpc('gsa_admin_save_career_vacancy')` | `RPC gsa_admin_save_career_vacancy` | `gsa_careers_vacancies` | CareersPublicPage.tsx (Portal Trabalhe Conosco Público) | **ANALISADO ESTATICAMENTE** |

### Domínio 45: CRM & Promoções (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-076` | `ClientCancelPromoModal.tsx`<br>Botão 'Confirmar Desistência da Promoção' | `handleCancelPromotion` | `clientOperationalWrite('cliente_promocoes', 'update')` | `RPC gsa_client_operational_write` | `cliente_promocoes` | ClientPromocoes.tsx (Promoção desativada da lista de benefícios) | **ANALISADO ESTATICAMENTE** |

### Domínio 46: Marketplace & Combos Promocionais (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-077` | `PromocaoQuantidadeForm.tsx`<br>Botão 'Salvar Regra de Combo / Leve X Pague Y' | `handleSaveQuantityPromotion` | `callAdminRpc('gsa_admin_save_promocao_quantidade')` | `RPC gsa_admin_save_promocao_quantidade` | `promocoes_quantidade` | StoreHub.tsx e CheckoutPage.tsx (Cálculo Automático de Desconto no Carrinho) | **ANALISADO ESTATICAMENTE** |

### Domínio 47: Financeiro & Disputas de Crédito (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-078` | `CreditDisputeModal.tsx`<br>Botão 'Abrir Contestação de Limite / Lançamento' | `handleOpenCreditDispute` | `clientOperationalWrite('loja_credito_disputas', 'insert')` | `RPC gsa_client_operational_write` | `loja_credito_disputas, loja_credito_solicitacoes` | Admin CreditoModule.tsx (Fila de Moderação de Disputas de Crédito) | **ANALISADO ESTATICAMENTE** |

### Domínio 48: Prestadores & Conformidade KYC (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-079` | `ProviderAccessPage.tsx`<br>Botão 'Enviar Documentação Técnica de Prestador' | `handleUploadProviderDocument` | `providerOperations.uploadDocument` | `Supabase Storage 'documentos_prestador' / RPC gsa_provider_upload_document` | `prestador_documentos, prestadores` | PrestadoresModule.tsx (Admin Fila de Homologação de Técnicos) | **ANALISADO ESTATICAMENTE** |

### Domínio 49: Fornecedores & Governança Bancária (1 Arestas)

| ID da Aresta | Elemento de Origem (UI) | Handler Local | Método de Serviço | Endpoint Backend / RPC | Tabelas do Banco Afetadas | Alvo de Propagação Cross-Módulo | Status |
|---|---|---|---|---|---|---|---|
| `EDGE-080` | `FornecedorFinanceiro.tsx`<br>Botão 'Solicitar Alteração de Conta Bancária / PIX' | `handleRequestBankChange` | `updateSupplierProfile` | `RPC gsa_supplier_update_profile` | `fornecedores, audit_logs` | FornecedoresModule.tsx (Admin Quarentena de Segurança Bancária) | **ANALISADO ESTATICAMENTE** |

---

## 4. ESPECIFICAÇÃO DETALHADA DAS 5-TUPLAS DE CONEXÃO (`EDGE-001` A `EDGE-080`)

Abaixo está o registro exaustivo de cada aresta com sua 5-tupla canônica completa e caminho de propagação:

### Aresta: `EDGE-001` — Botão 'Entrar' (Formulário de Login Cliente)
- **Domínio**: Autenticação & Sessões
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/ClientLoginPage.tsx` ──> Botão 'Entrar' (Formulário de Login Cliente)
  2. **Handler Local**: `handleLoginSubmit`
  3. **Método de Serviço / Hook**: `sessionService.loginClient`
  4. **Backend Endpoint / RPC**: `RPC gsa_auth_login_client / Edge gsa-auth-session`
  5. **Tabelas do Banco de Dados**: `sistema_sessoes, clientes, gsa_auth_rate_limits`
- **Alvo de Propagação Cross-Módulo**: ClientPortal.tsx (Dashboard), Header de Saldo/Pontos, App.tsx (Sessão Ativa)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-002` — Formulário de Código de Acesso Colaborador
- **Domínio**: Autenticação & Sessões
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/RestrictedAccessHubPage.tsx` ──> Formulário de Código de Acesso Colaborador
  2. **Handler Local**: `handleCodeSubmit`
  3. **Método de Serviço / Hook**: `sessionService.loginColaborador`
  4. **Backend Endpoint / RPC**: `RPC gsa_auth_login_collaborator`
  5. **Tabelas do Banco de Dados**: `sistema_sessoes, colaboradores, colaborador_modulos`
- **Alvo de Propagação Cross-Módulo**: SecureAdminPanel.tsx (Menu filtrado por colaboradorModulos)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-003` — Timer Intervalar (Heartbeat de 15s)
- **Domínio**: Autenticação & Sessões
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/hooks/useAutoLogout.ts` ──> Timer Intervalar (Heartbeat de 15s)
  2. **Handler Local**: `pingSessionCycle`
  3. **Método de Serviço / Hook**: `sessionService.pingSession`
  4. **Backend Endpoint / RPC**: `RPC gsa_ping_session`
  5. **Tabelas do Banco de Dados**: `sistema_sessoes`
- **Alvo de Propagação Cross-Módulo**: window CustomEvent 'gsa-session-revoked' -> App.tsx (Desconexão e Limpeza)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-004` — Botão 'Salvar Colaborador' (Modal de Criação/Edição)
- **Domínio**: Governança & Acessos
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/AcessosModule.tsx` ──> Botão 'Salvar Colaborador' (Modal de Criação/Edição)
  2. **Handler Local**: `handleSaveCollaborator`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_save_collaborator')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_save_collaborator`
  5. **Tabelas do Banco de Dados**: `colaboradores, colaborador_modulos, audit_logs`
- **Alvo de Propagação Cross-Módulo**: AcessosModule.tsx (Tabela de Colaboradores) e Sessões ativas do colaborador
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-005` — Botão 'Rotacionar Credencial' (Menu de Ações)
- **Domínio**: Governança & Acessos
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/AcessosModule.tsx` ──> Botão 'Rotacionar Credencial' (Menu de Ações)
  2. **Handler Local**: `handleRotateCredential`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_rotate_collaborator_credential')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_rotate_collaborator_credential`
  5. **Tabelas do Banco de Dados**: `colaboradores, sistema_sessoes (revogação em lote)`
- **Alvo de Propagação Cross-Módulo**: Sessões ativas do colaborador desconectadas imediatamente via Realtime
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-006` — Botão 'Excluir Cliente / Registro' (Ação Administrativa Crítica)
- **Domínio**: Governança & Segurança
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/lib/deleteRequest.ts` ──> Botão 'Excluir Cliente / Registro' (Ação Administrativa Crítica)
  2. **Handler Local**: `requestSensitiveDeletion`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_create_deletion_request')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_create_deletion_request`
  5. **Tabelas do Banco de Dados**: `solicitacoes_exclusao, sensitive_audit_logs`
- **Alvo de Propagação Cross-Módulo**: Painel de Quarentena de Exclusões (Aprovação de Segundo Homem)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-007` — Botão 'Salvar Alterações' (Formulário de Configurações)
- **Domínio**: Governança & Configurações
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/ConfiguracoesModule.tsx` ──> Botão 'Salvar Alterações' (Formulário de Configurações)
  2. **Handler Local**: `handleSaveSettings`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_update_settings_secure')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_update_settings_secure`
  5. **Tabelas do Banco de Dados**: `system_settings, empresa`
- **Alvo de Propagação Cross-Módulo**: ClientPortal (Cálculo de pontos), StoreHub, CheckoutPage
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-008` — Formulário de Onboarding de Pessoa Jurídica (PJ)
- **Domínio**: CRM & Clientes
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/BusinessRegistrationPage.tsx` ──> Formulário de Onboarding de Pessoa Jurídica (PJ)
  2. **Handler Local**: `handleBusinessRegister`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('clientes', 'insert')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_registration_challenge / PostgREST`
  5. **Tabelas do Banco de Dados**: `clientes, gsa_client_registration_challenges`
- **Alvo de Propagação Cross-Módulo**: Admin ClientesModule.tsx (Fila de Homologação PJ)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-009` — Botão 'Alterar Nível Manual' (Modal de Ajuste VIP)
- **Domínio**: CRM & Clientes
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/AreaVIPModule.tsx` ──> Botão 'Alterar Nível Manual' (Modal de Ajuste VIP)
  2. **Handler Local**: `handleChangeLevelManual`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_set_client_level_manual')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_set_client_level_manual`
  5. **Tabelas do Banco de Dados**: `clientes, level_history, client_levels`
- **Alvo de Propagação Cross-Módulo**: ClientPortal.tsx (Badge VIP), CheckoutPage (Desconto em compras)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-010` — Botão 'Assinar Plano VIP Anual'
- **Domínio**: CRM & Clientes
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientAreaVIP.tsx` ──> Botão 'Assinar Plano VIP Anual'
  2. **Handler Local**: `handleSubscribeVip`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_client_subscribe_vip')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_subscribe_vip`
  5. **Tabelas do Banco de Dados**: `clientes, assinaturas, faturas, extrato_financeiro`
- **Alvo de Propagação Cross-Módulo**: Admin FinanceiroModule.tsx (Fatura de Assinatura) e Admin AssinaturasModule.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-011` — Botão 'Salvar Endereço e Contato'
- **Domínio**: CRM & Clientes
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientProfile.tsx` ──> Botão 'Salvar Endereço e Contato'
  2. **Handler Local**: `handleSaveProfile`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('clientes', 'update')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `clientes`
- **Alvo de Propagação Cross-Módulo**: CheckoutPage.tsx (Endereço de Entrega padrão pré-preenchido)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-012` — Botão 'Pagar com Carteira' (Modal de Quitação de Fatura)
- **Domínio**: Financeiro & Fintech
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/financeiro/FaturasList.tsx` ──> Botão 'Pagar com Carteira' (Modal de Quitação de Fatura)
  2. **Handler Local**: `handlePayInvoiceWallet`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_client_pagar_fatura')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_pagar_fatura`
  5. **Tabelas do Banco de Dados**: `faturas, pagamentos, clientes (saldo_carteira), carteira_lancamentos, extrato_financeiro`
- **Alvo de Propagação Cross-Módulo**: Admin FinanceiroModule.tsx (Status da Fatura -> 'pago') e ClientFinanceiro.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-013` — Botão 'Gerar PIX Instantâneo' (Modal de Checkout / Fatura)
- **Domínio**: Financeiro & Fintech
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/lib/pixService.ts` ──> Botão 'Gerar PIX Instantâneo' (Modal de Checkout / Fatura)
  2. **Handler Local**: `createDynamicPix`
  3. **Método de Serviço / Hook**: `createInfinitePayOrderCheckout`
  4. **Backend Endpoint / RPC**: `InfinitePay Checkout V2 / Edge gsa-payments`
  5. **Tabelas do Banco de Dados**: `faturas (pix_copia_cola, link_pagamento)`
- **Alvo de Propagação Cross-Módulo**: CheckoutPixModal.tsx (Exibição de QR Code e Copia-e-Cola com polling)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-014` — Webhook Inbound Gateway (/webhook/infinitepay)
- **Domínio**: Financeiro & Fintech
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `server_webhook.cjs (VPS Daemon)` ──> Webhook Inbound Gateway (/webhook/infinitepay)
  2. **Handler Local**: `handleInfinitePayWebhook`
  3. **Método de Serviço / Hook**: `SessionMutex -> Database Transaction`
  4. **Backend Endpoint / RPC**: `VPS Daemon Porta 5680 / PostgreSQL`
  5. **Tabelas do Banco de Dados**: `faturas, pagamentos, clientes, extrato_financeiro, pontos_movimentacoes`
- **Alvo de Propagação Cross-Módulo**: Realtime WebSocket -> Frontend atualiza fatura de 'pendente' para 'pago' instantaneamente
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-015` — Botão 'Converter Pontos em Carteira'
- **Domínio**: Financeiro & Fintech
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientPontos.tsx` ──> Botão 'Converter Pontos em Carteira'
  2. **Handler Local**: `handleConvertPoints`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_client_convert_points')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_convert_points`
  5. **Tabelas do Banco de Dados**: `clientes (saldo_pontos, saldo_carteira), pontos_movimentacoes, carteira_lancamentos, extrato_financeiro`
- **Alvo de Propagação Cross-Módulo**: Header do Portal do Cliente e Admin ClientesModule.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-016` — Botão 'Transferir Saldo' (Formulário P2P)
- **Domínio**: Financeiro & Fintech
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientTransferencias.tsx` ──> Botão 'Transferir Saldo' (Formulário P2P)
  2. **Handler Local**: `handleTransferBalance`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_client_request_transfer')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_request_transfer`
  5. **Tabelas do Banco de Dados**: `transferencias, clientes (origem e destino), carteira_lancamentos, extrato_financeiro`
- **Alvo de Propagação Cross-Módulo**: Extrato do Cliente Origem e Notificação em Tempo Real no Cliente Destino
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-017` — Botão 'Reverter Transferência' (Dentro da Janela de Tolerância)
- **Domínio**: Financeiro & Fintech
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientTransferencias.tsx` ──> Botão 'Reverter Transferência' (Dentro da Janela de Tolerância)
  2. **Handler Local**: `handleReverseTransfer`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_client_reverse_transfer')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_reverse_transfer`
  5. **Tabelas do Banco de Dados**: `transferencias, clientes (estorno), carteira_lancamentos, extrato_financeiro`
- **Alvo de Propagação Cross-Módulo**: Extrato de ambos os clientes e status da transferência atualizado
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-018` — Botão 'Solicitar Saque de Crédito'
- **Domínio**: Financeiro & Fintech
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/CreditWithdrawalModal.tsx` ──> Botão 'Solicitar Saque de Crédito'
  2. **Handler Local**: `handleRequestCreditWithdrawal`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_client_request_withdrawal')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_request_withdrawal`
  5. **Tabelas do Banco de Dados**: `saques, clientes, extrato_financeiro`
- **Alvo de Propagação Cross-Módulo**: Admin CreditWithdrawalsAdminPanel.tsx / FinanceiroSuperDomain.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-019` — Botão 'Marcar Saque como Pago' (Após transferência PIX)
- **Domínio**: Financeiro & Fintech
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/super-domains/financeiro/CreditWithdrawalsAdminPanel.tsx` ──> Botão 'Marcar Saque como Pago' (Após transferência PIX)
  2. **Handler Local**: `handleMarkWithdrawalPaid`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_processar_saque')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_processar_saque`
  5. **Tabelas do Banco de Dados**: `saques, extrato_financeiro, faturas, audit_logs`
- **Alvo de Propagação Cross-Módulo**: ClientFinanceiro.tsx (Extrato atualizado com comprovante de liquidação)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-020` — Botão 'Solicitar Empréstimo Pessoal'
- **Domínio**: Financeiro & Empréstimos
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientMeuCredito.tsx` ──> Botão 'Solicitar Empréstimo Pessoal'
  2. **Handler Local**: `handleRequestLoan`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('emprestimos', 'insert')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `emprestimos, emprestimo_documentos, emprestimo_historico`
- **Alvo de Propagação Cross-Módulo**: Admin EmprestimosModule.tsx (Fila de Análise de Crédito)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-021` — Botão 'Aprovar Proposta de Empréstimo'
- **Domínio**: Financeiro & Empréstimos
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/EmprestimosModule.tsx` ──> Botão 'Aprovar Proposta de Empréstimo'
  2. **Handler Local**: `handleApproveLoan`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_emprestimo_aprovar')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_emprestimo_aprovar`
  5. **Tabelas do Banco de Dados**: `emprestimos, emprestimo_parcelas, contratos, faturas`
- **Alvo de Propagação Cross-Módulo**: ClientEmprestimos.tsx (Contrato disponível para assinatura digital)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-022` — Botão 'Gerar Acordo de Renegociação'
- **Domínio**: Financeiro & Cobrança
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/CobrancaModule.tsx` ──> Botão 'Gerar Acordo de Renegociação'
  2. **Handler Local**: `handleGenerateDebtAgreement`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_gerar_acordo_cobranca')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_gerar_acordo_cobranca`
  5. **Tabelas do Banco de Dados**: `cobrancas, cobranca_acordos, cobranca_historico, faturas (substituição)`
- **Alvo de Propagação Cross-Módulo**: ClientFinanceiro.tsx (Novas faturas do acordo) e CobrancaModule.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-023` — Botão 'Adicionar ao Carrinho' / 'Comprar Agora'
- **Domínio**: Marketplace & E-commerce
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/store/ProductPage.tsx` ──> Botão 'Adicionar ao Carrinho' / 'Comprar Agora'
  2. **Handler Local**: `handleAddToCart`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('loja_carrinhos', 'update')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `loja_carrinhos`
- **Alvo de Propagação Cross-Módulo**: EcommerceHeader.tsx (Contador do Carrinho) e CartDrawer.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-024` — Botão 'Finalizar Compra' (Etapa 3 do Checkout)
- **Domínio**: Marketplace & E-commerce
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/store/CheckoutPage.tsx` ──> Botão 'Finalizar Compra' (Etapa 3 do Checkout)
  2. **Handler Local**: `handleExecuteCheckout`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_client_checkout_store')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_checkout_store / gsa_client_checkout_store_base_20260817`
  5. **Tabelas do Banco de Dados**: `pedidos, loja_pedido_itens, produtos, produto_variantes (baixa estoque), faturas, clientes, loja_carrinhos (limpeza)`
- **Alvo de Propagação Cross-Módulo**: PurchasesPage.tsx (Meus Pedidos), Admin OrdensCompraModule.tsx, Fornecedor Portal
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-025` — Botão 'Solicitar Devolução / Troca'
- **Domínio**: Marketplace & Pós-Venda
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/store/PurchasesPage.tsx` ──> Botão 'Solicitar Devolução / Troca'
  2. **Handler Local**: `handleRequestReturn`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('loja_solicitacoes', 'insert')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `loja_solicitacoes`
- **Alvo de Propagação Cross-Módulo**: Admin LojaTrocasModule.tsx (Fila de Moderação de Devoluções)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-026` — Botão 'Aprovar Solicitação de Devolução'
- **Domínio**: Marketplace & Pós-Venda
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/LojaTrocasModule.tsx` ──> Botão 'Aprovar Solicitação de Devolução'
  2. **Handler Local**: `handleApproveReturn`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_atualizar_solicitacao_loja')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_atualizar_solicitacao_loja`
  5. **Tabelas do Banco de Dados**: `loja_solicitacoes, loja_reembolsos, produto_variantes (restauração estoque), clientes (estorno saldo/pontos)`
- **Alvo de Propagação Cross-Módulo**: Client PurchasesPage.tsx, ClientFinanceiro.tsx (Saldo Estornado), ProdutosModule.tsx (Estoque)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-027` — Botão 'Salvar Produto' (Modal de Criação/Edição)
- **Domínio**: Marketplace & Catálogo
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/ProdutosModule.tsx` ──> Botão 'Salvar Produto' (Modal de Criação/Edição)
  2. **Handler Local**: `handleSaveProduct`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_save_product_catalog_v2')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_save_product_catalog_v2`
  5. **Tabelas do Banco de Dados**: `produtos, produto_variacao_grupos, produto_variacao_opcoes, produto_variantes`
- **Alvo de Propagação Cross-Módulo**: StoreHub.tsx (Catálogo Público), ProductPage.tsx (Grade de Venda)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-028` — Botão 'Criar Cupom de Desconto'
- **Domínio**: Marketplace & Descontos
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/CuponsLojaModule.tsx` ──> Botão 'Criar Cupom de Desconto'
  2. **Handler Local**: `handleCreateCoupon`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_create_store_coupon')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_create_store_coupon / PostgREST`
  5. **Tabelas do Banco de Dados**: `cupons_loja`
- **Alvo de Propagação Cross-Módulo**: CheckoutPage.tsx (Modal de Cupons Disponíveis) e StoreHub.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-029` — Botão 'Resgatar Benefício do Parceiro'
- **Domínio**: Parceiros & Benefícios
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientVouchers.tsx` ──> Botão 'Resgatar Benefício do Parceiro'
  2. **Handler Local**: `handleRedeemBenefit`
  3. **Método de Serviço / Hook**: `redeemPartnerBenefit`
  4. **Backend Endpoint / RPC**: `RPC gsa_public_resgatar_beneficio_parceiro`
  5. **Tabelas do Banco de Dados**: `parceiros_resgates, parceiros, parceiros_resgates_notificacoes`
- **Alvo de Propagação Cross-Módulo**: PartnersAdminModule.tsx / PartnerRedemptionDetailModal.tsx e WhatsApp do Cliente
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-030` — Botão 'Entrar com Recurso' (Quando Status = 'recusado')
- **Domínio**: Parceiros & Recursos
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/public/ProtocolConsultPage.tsx` ──> Botão 'Entrar com Recurso' (Quando Status = 'recusado')
  2. **Handler Local**: `handleStartAppeal`
  3. **Método de Serviço / Hook**: `requestPartnerAppealVerification`
  4. **Backend Endpoint / RPC**: `Edge Function gsa-auth-session ('request_partner_appeal')`
  5. **Tabelas do Banco de Dados**: `parceiros_resgates_recurso_desafios`
- **Alvo de Propagação Cross-Módulo**: WhatsApp do Cliente (Envio de PIN 2FA de 6 dígitos)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-031` — Botão 'Enviar Recurso com Evidências'
- **Domínio**: Parceiros & Recursos
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/public/ProtocolConsultPage.tsx` ──> Botão 'Enviar Recurso com Evidências'
  2. **Handler Local**: `handleSubmitAppeal`
  3. **Método de Serviço / Hook**: `completePartnerAppeal`
  4. **Backend Endpoint / RPC**: `Edge Function gsa-auth-session ('submit_partner_appeal')`
  5. **Tabelas do Banco de Dados**: `parceiros_resgates_recursos, parceiros_resgates_eventos, parceiros_resgates (status -> 'em_recurso')`
- **Alvo de Propagação Cross-Módulo**: Admin PartnerRedemptionDetailModal.tsx (Aba de Recursos Pendentes)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-032` — Botão 'Aceitar / Negar Recurso' (Julgamento Administrativo)
- **Domínio**: Parceiros & Recursos
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` ──> Botão 'Aceitar / Negar Recurso' (Julgamento Administrativo)
  2. **Handler Local**: `handleDecideAppeal`
  3. **Método de Serviço / Hook**: `decidePartnerAppeal`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_decide_partner_appeal`
  5. **Tabelas do Banco de Dados**: `parceiros_resgates_recursos, parceiros_resgates_eventos, parceiros_resgates_notificacoes, parceiros_resgates_public_status`
- **Alvo de Propagação Cross-Módulo**: ProtocolConsultPage.tsx (Status Deferido/Indeferido) e WhatsApp com UTF-8 estrito
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-033` — Botão 'Gerar Novo Link de Divulgação'
- **Domínio**: Programa de Afiliados
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Afiliado/AfiliadoDashboard.tsx` ──> Botão 'Gerar Novo Link de Divulgação'
  2. **Handler Local**: `handleCreateLink`
  3. **Método de Serviço / Hook**: `createAffiliateLink`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_create_affiliate_link`
  5. **Tabelas do Banco de Dados**: `gsa_afiliado_links, gsa_afiliados`
- **Alvo de Propagação Cross-Módulo**: AfiliadoDashboard.tsx (Lista de Links Ativos com Contador de Cliques)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-034` — Listener de URL (?ref=CODIGO) no Bootstrap
- **Domínio**: Programa de Afiliados
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/AffiliateTrackingBridge.tsx` ──> Listener de URL (?ref=CODIGO) no Bootstrap
  2. **Handler Local**: `captureAffiliateReferralFromLocation`
  3. **Método de Serviço / Hook**: `localStorage & Cookie Persistence / RPC gsa_public_record_affiliate_click`
  4. **Backend Endpoint / RPC**: `RPC gsa_public_record_affiliate_click`
  5. **Tabelas do Banco de Dados**: `gsa_afiliado_cliques, gsa_afiliado_links (incremento cliques)`
- **Alvo de Propagação Cross-Módulo**: AfiliadoDashboard.tsx (Contador de Cliques em Tempo Real) e Checkout de Compras
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-035` — Botão 'Liberar Comissões em Carência'
- **Domínio**: Programa de Afiliados
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/AffiliateAdminModule.tsx` ──> Botão 'Liberar Comissões em Carência'
  2. **Handler Local**: `handleReleaseCommissions`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_release_affiliate_commissions')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_release_affiliate_commissions`
  5. **Tabelas do Banco de Dados**: `afiliado_comissoes, gsa_afiliados (saldo_comissao)`
- **Alvo de Propagação Cross-Módulo**: AfiliadoDashboard.tsx (Saldo Disponível para Saque)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-036` — Botão 'Transferir Saldo para Outro Afiliado'
- **Domínio**: Programa de Afiliados
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Afiliado/AfiliadoDashboard.tsx` ──> Botão 'Transferir Saldo para Outro Afiliado'
  2. **Handler Local**: `handleTransferAffiliateBalance`
  3. **Método de Serviço / Hook**: `transferAffiliateBalance`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_transfer_affiliate_balance`
  5. **Tabelas do Banco de Dados**: `gsa_afiliado_transferencias, gsa_afiliados (origem e destino)`
- **Alvo de Propagação Cross-Módulo**: Extrato P2P de Ambos os Afiliados
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-037` — Botão 'Despachar para Prestador' (Após Aprovação do Orçamento)
- **Domínio**: Prestadores & Workstation
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/OrcamentosModule.tsx` ──> Botão 'Despachar para Prestador' (Após Aprovação do Orçamento)
  2. **Handler Local**: `handleDispatchToProvider`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_finalize_service_order')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_finalize_service_order`
  5. **Tabelas do Banco de Dados**: `ordens_servico, prestador_demandas, orcamentos`
- **Alvo de Propagação Cross-Módulo**: PrestadorDemandas.tsx (Nova Demanda na Fila do Prestador)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-038` — Botões de Ação na Demanda ('Aceitar' / 'Contraproposta' / 'Entregar')
- **Domínio**: Prestadores & Workstation
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Prestador/PrestadorDemandas.tsx` ──> Botões de Ação na Demanda ('Aceitar' / 'Contraproposta' / 'Entregar')
  2. **Handler Local**: `handleTransitionDemand`
  3. **Método de Serviço / Hook**: `providerOperations.transitionDemand`
  4. **Backend Endpoint / RPC**: `RPC gsa_provider_transition_demand`
  5. **Tabelas do Banco de Dados**: `prestador_demandas, demanda_comentarios, ordens_servico`
- **Alvo de Propagação Cross-Módulo**: Admin DemandasOpsSuperDomain.tsx e ClientServicos.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-039` — Botão 'Agendar Atendimento'
- **Domínio**: Prestadores & Workstation
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Prestador/PrestadorAgenda.tsx` ──> Botão 'Agendar Atendimento'
  2. **Handler Local**: `handleCreateSchedule`
  3. **Método de Serviço / Hook**: `providerOperations.createSchedule`
  4. **Backend Endpoint / RPC**: `RPC gsa_provider_create_schedule`
  5. **Tabelas do Banco de Dados**: `prestador_agendamentos`
- **Alvo de Propagação Cross-Módulo**: Calendário do Prestador e Linha do Tempo da OS
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-040` — Botão 'Solicitar Saque de Repasse'
- **Domínio**: Prestadores & Workstation
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Prestador/PrestadorFinanceiro.tsx` ──> Botão 'Solicitar Saque de Repasse'
  2. **Handler Local**: `handleRequestWithdrawal`
  3. **Método de Serviço / Hook**: `providerOperations.requestWithdrawal`
  4. **Backend Endpoint / RPC**: `RPC gsa_provider_request_withdrawal`
  5. **Tabelas do Banco de Dados**: `prestador_saques, prestadores (saldo_disponivel)`
- **Alvo de Propagação Cross-Módulo**: Admin FinanceiroModule.tsx (Contas a Pagar / Repasses de Prestadores)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-041` — Botão 'Propor Produto ao Catálogo'
- **Domínio**: Fornecedores & Procurement
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Fornecedor/FornecedorProdutos.tsx` ──> Botão 'Propor Produto ao Catálogo'
  2. **Handler Local**: `handleProposeProduct`
  3. **Método de Serviço / Hook**: `requestSupplierProduct`
  4. **Backend Endpoint / RPC**: `RPC gsa_supplier_request_product`
  5. **Tabelas do Banco de Dados**: `fornecedor_produtos, fornecedores`
- **Alvo de Propagação Cross-Módulo**: Admin FornecedoresModule.tsx (Fila de Homologação de Produtos)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-042` — Botão 'Enviar Remessa com NF-e' (Despacho de Pedido)
- **Domínio**: Fornecedores & Procurement
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Fornecedor/FornecedorRemessas.tsx` ──> Botão 'Enviar Remessa com NF-e' (Despacho de Pedido)
  2. **Handler Local**: `handleSubmitDelivery`
  3. **Método de Serviço / Hook**: `submitSupplierDelivery`
  4. **Backend Endpoint / RPC**: `RPC gsa_supplier_submit_delivery`
  5. **Tabelas do Banco de Dados**: `pedidos_compra, documentos_fornecedor, fornecedor_titulos`
- **Alvo de Propagação Cross-Módulo**: Admin FornecedoresModule.tsx (Conferência de Carga e NF-e)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-043` — Botão 'Homologar Recebimento e Integrar Estoque'
- **Domínio**: Fornecedores & Procurement
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/FornecedoresModule.tsx` ──> Botão 'Homologar Recebimento e Integrar Estoque'
  2. **Handler Local**: `handleReviewDelivery`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_review_supplier_delivery')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_review_supplier_delivery`
  5. **Tabelas do Banco de Dados**: `pedidos_compra, produtos, produto_variantes (incremento estoque), fornecedor_titulos`
- **Alvo de Propagação Cross-Módulo**: StoreHub.tsx (Estoque do Marketplace atualizado) e Financeiro Contas a Pagar
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-044` — Quadro Kanban (Arrastar demanda entre colunas)
- **Domínio**: Colaboradores & RBAC
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/DemandasColaboradorModule.tsx` ──> Quadro Kanban (Arrastar demanda entre colunas)
  2. **Handler Local**: `handleDropDemandPhase`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_collaborator_transition_demand')`
  4. **Backend Endpoint / RPC**: `RPC gsa_collaborator_transition_demand`
  5. **Tabelas do Banco de Dados**: `ordens_servico, demanda_comentarios`
- **Alvo de Propagação Cross-Módulo**: Admin DemandasOpsSuperDomain.tsx e ClientServicos.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-045` — Guarda de Rotas (Navegação interna no painel)
- **Domínio**: Colaboradores & RBAC
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/SecureAdminPanel.tsx` ──> Guarda de Rotas (Navegação interna no painel)
  2. **Handler Local**: `enforceCollaboratorRbac`
  3. **Método de Serviço / Hook**: `routeSecurity.isRouteAllowed`
  4. **Backend Endpoint / RPC**: `Client-side Guard + Realtime subscription em colaborador_modulos`
  5. **Tabelas do Banco de Dados**: `colaborador_modulos, colaboradores`
- **Alvo de Propagação Cross-Módulo**: Interceptação imediata com tela de Acesso Negado em caso de invasão de rota
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-046` — Botão 'Criar Pacote de Viagem'
- **Domínio**: GSA Viagens
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/TravelAdminModule.tsx` ──> Botão 'Criar Pacote de Viagem'
  2. **Handler Local**: `handleCreateTravelPackage`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_travel_create_package')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_travel_create_package`
  5. **Tabelas do Banco de Dados**: `gsa_viagens_pacotes, viagens_pacote_imagens`
- **Alvo de Propagação Cross-Módulo**: Marketplace Viagens (/marketplace/pacotes-viagem) e Home.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-047` — Botão 'Solicitar Reserva de Viagem'
- **Domínio**: GSA Viagens
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/marketplace/TravelPackageDetailModal.tsx` ──> Botão 'Solicitar Reserva de Viagem'
  2. **Handler Local**: `handleRequestTravelBooking`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_client_checkout_travel')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_checkout_travel`
  5. **Tabelas do Banco de Dados**: `viagens_solicitacoes_reserva, viagens_passageiros, faturas`
- **Alvo de Propagação Cross-Módulo**: Admin TravelAdminModule.tsx (Fila de Reservas de Turismo)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-048` — Botão 'Emitir Proposta de Plano de Saúde'
- **Domínio**: GSA Saúde & Seguros
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/saude/SaudeModule.tsx` ──> Botão 'Emitir Proposta de Plano de Saúde'
  2. **Handler Local**: `handleCreateHealthProposal`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_saude_salvar_proposta')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_saude_salvar_proposta`
  5. **Tabelas do Banco de Dados**: `saude_propostas, saude_beneficiarios, saude_contratos`
- **Alvo de Propagação Cross-Módulo**: ClientPortal (Área de Saúde) e Faturamento Recorrente
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-049` — Botão 'Registrar Sinistro de Seguro'
- **Domínio**: GSA Seguros
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/seguros/SegurosModule.tsx` ──> Botão 'Registrar Sinistro de Seguro'
  2. **Handler Local**: `handleRegisterClaim`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_seguros_registrar_sinistro')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_seguros_registrar_sinistro`
  5. **Tabelas do Banco de Dados**: `seguros_sinistros, seguros_sinistro_mensagens, seguros_documentos`
- **Alvo de Propagação Cross-Módulo**: ClientPortal (Acompanhamento de Sinistro) e Regulação Pericial
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-050` — Botão 'Aprovar Anúncio de Classificado' (Moderação)
- **Domínio**: Hub Classificados
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/ClassifiedsModule.tsx` ──> Botão 'Aprovar Anúncio de Classificado' (Moderação)
  2. **Handler Local**: `handleApproveClassifiedAd`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_classificados_moderar')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_classificados_moderar`
  5. **Tabelas do Banco de Dados**: `classificados_anuncios, classificados_midias`
- **Alvo de Propagação Cross-Módulo**: Marketplace Classificados (/marketplace/classificados) e Public Search
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-051` — Botão 'Criar Nova Campanha de Anúncio'
- **Domínio**: Publicidade & Ads
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/AdvertiserPortal.tsx` ──> Botão 'Criar Nova Campanha de Anúncio'
  2. **Handler Local**: `handleCreateAdCampaign`
  3. **Método de Serviço / Hook**: `callClientRpc('gsa_advertiser_create_campaign')`
  4. **Backend Endpoint / RPC**: `RPC gsa_advertiser_create_campaign / Edge gsa-ads-admin`
  5. **Tabelas do Banco de Dados**: `gsa_ad_campaigns, gsa_ad_creatives, gsa_ad_campaign_placements, faturas`
- **Alvo de Propagação Cross-Módulo**: Admin AdvertisingAdminModule.tsx e Motor de Entrega de Banners
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-052` — Botão 'Aprovar e Ativar Campanha'
- **Domínio**: Publicidade & Ads
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/AdvertisingAdminModule.tsx` ──> Botão 'Aprovar e Ativar Campanha'
  2. **Handler Local**: `handleApproveAdCampaign`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_approve_ad_campaign')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_approve_ad_campaign`
  5. **Tabelas do Banco de Dados**: `gsa_ad_campaigns, gsa_ad_delivery_events`
- **Alvo de Propagação Cross-Módulo**: AdvertisingSlot.tsx em todo o portal público e GSA TV Banners
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-053` — Botão 'Salvar Grade Semanal de Programação'
- **Domínio**: GSA TV & Playout
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/GsaTvControlRoom.tsx` ──> Botão 'Salvar Grade Semanal de Programação'
  2. **Handler Local**: `handleSaveTvSchedule`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_gsa_tv_mutate')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_gsa_tv_mutate`
  5. **Tabelas do Banco de Dados**: `gsa_tv_schedule_slots, gsa_tv_programs, gsa_tv_schedule_versions`
- **Alvo de Propagação Cross-Módulo**: Guia de Programação Público (EPG) e Daemon de Playout na VPS
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-054` — Botão 'Comutar Fonte Ao Vivo' (Chaveamento On-Air)
- **Domínio**: GSA TV & Playout
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/GsaTvLiveConsole.tsx` ──> Botão 'Comutar Fonte Ao Vivo' (Chaveamento On-Air)
  2. **Handler Local**: `handleSwitchLiveSource`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_gsa_tv_extended')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_gsa_tv_extended / Edge gsa-tv-proxy`
  5. **Tabelas do Banco de Dados**: `gsa_tv_channels (live_source_id), gsa_tv_as_run`
- **Alvo de Propagação Cross-Módulo**: Stream HLS Master e Player Web de Transmissão
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-055` — Botão 'Abrir Ticket de Atendimento'
- **Domínio**: Comunicação & Suporte
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientSuporte.tsx` ──> Botão 'Abrir Ticket de Atendimento'
  2. **Handler Local**: `handleCreateSupportTicket`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('tickets', 'insert')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `tickets, ticket_mensagens`
- **Alvo de Propagação Cross-Módulo**: Admin TicketsModule.tsx (Fila de Atendimento Omnichannel)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-056` — Botão 'Enviar Resposta ao Cliente'
- **Domínio**: Comunicação & Suporte
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/TicketsModule.tsx` ──> Botão 'Enviar Resposta ao Cliente'
  2. **Handler Local**: `handleSendTicketReply`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_ticket_reply')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_ticket_reply`
  5. **Tabelas do Banco de Dados**: `ticket_mensagens, tickets (status -> 'aguardando_cliente')`
- **Alvo de Propagação Cross-Módulo**: ClientSuporte.tsx (Chat em Tempo Real) e Notificação via WhatsApp
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-057` — Botão 'Candidatar-se à Vaga'
- **Domínio**: Recursos Humanos & Carreiras
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Careers/CareersPublicPage.tsx` ──> Botão 'Candidatar-se à Vaga'
  2. **Handler Local**: `handleSubmitApplication`
  3. **Método de Serviço / Hook**: `submitCareerApplication`
  4. **Backend Endpoint / RPC**: `Edge Function gsa-careers-notifications`
  5. **Tabelas do Banco de Dados**: `gsa_careers_applications, gsa_careers_application_history`
- **Alvo de Propagação Cross-Módulo**: Admin CareersAdminModule.tsx (Triagem de Candidatos de RH)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-058` — Disparador Automático de Mensagens Transacionais
- **Domínio**: Infraestrutura & VPS
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/utils/n8nWhatsApp.ts` ──> Disparador Automático de Mensagens Transacionais
  2. **Handler Local**: `sendTransactionalWhatsApp`
  3. **Método de Serviço / Hook**: `Cascata 3-Tier: vps-api -> Evolution API -> n8n`
  4. **Backend Endpoint / RPC**: `Edge vps-api / VPS 147.15.43.141:8080 (Evolution) / 5678 (n8n)`
  5. **Tabelas do Banco de Dados**: `whatsapp_pendencias_ativas, gsa_whatsapp_ramais`
- **Alvo de Propagação Cross-Módulo**: Aparelho WhatsApp do Destinatário com Encoding UTF-8 Estrito
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-059` — Serviço de Upload e Leitura de Documentos Seguros
- **Domínio**: Infraestrutura & Armazenamento
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/lib/privateStorage.ts` ──> Serviço de Upload e Leitura de Documentos Seguros
  2. **Handler Local**: `getPrivateR2Url`
  3. **Método de Serviço / Hook**: `Cloudflare R2 Worker (gsa-hub-r2-worker)`
  4. **Backend Endpoint / RPC**: `Cloudflare Worker / R2 Bucket 'gsa-private-documents'`
  5. **Tabelas do Banco de Dados**: `cliente_documentos, prestador_documentos`
- **Alvo de Propagação Cross-Módulo**: FileViewerProvider.tsx (Visualizador Protegido com URL Assinada de 15 Minutos)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-060` — SessionMutex Concurrency Guard (Fila FIFO por Número)
- **Domínio**: Infraestrutura & VPS Daemon
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `server_webhook.cjs (VPS Daemon)` ──> SessionMutex Concurrency Guard (Fila FIFO por Número)
  2. **Handler Local**: `SessionMutex.acquire`
  3. **Método de Serviço / Hook**: `Node.js In-Memory Mutex Lock`
  4. **Backend Endpoint / RPC**: `Porta 5680 / Gemini 3.5 Flash Lite Engine`
  5. **Tabelas do Banco de Dados**: `sistema_logs, faturas, produtos`
- **Alvo de Propagação Cross-Módulo**: WhatsApp Conversational Bot (Processamento Sequencial sem Race Conditions)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-061` — Botão 'Salvar Hero Banner'
- **Domínio**: Marketing & Campanhas
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/SiteCampaignAdminModule.tsx` ──> Botão 'Salvar Hero Banner'
  2. **Handler Local**: `handleSaveHeroBanner`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_save_hero_banner')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_save_hero_banner`
  5. **Tabelas do Banco de Dados**: `gsa_hero_banners`
- **Alvo de Propagação Cross-Módulo**: Home.tsx / SiteCampaignBootstrap.tsx (Banners rotativos da home)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-062` — Botão 'Disparar Scraping Agora'
- **Domínio**: Automação & Scraping
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/ScrapingAdminModule.tsx` ──> Botão 'Disparar Scraping Agora'
  2. **Handler Local**: `handleTriggerScrapingNow`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_trigger_scraping_now')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_trigger_scraping_now`
  5. **Tabelas do Banco de Dados**: `automacao_scraping_configs, automacao_scraping_logs`
- **Alvo de Propagação Cross-Módulo**: ScrapingExecutionMonitorModal.tsx (Progresso da Coleta em Tempo Real)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-063` — Botão 'Processar Fila de Pedidos Shopee'
- **Domínio**: Marketplace & Integração Shopee
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/ShopeeOperationsModule.tsx` ──> Botão 'Processar Fila de Pedidos Shopee'
  2. **Handler Local**: `handleProcessShopeeQueue`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_shopee_job')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_shopee_job`
  5. **Tabelas do Banco de Dados**: `shopee_orders_queue, pedidos, produtos (sincronização de estoque)`
- **Alvo de Propagação Cross-Módulo**: ProdutosModule.tsx (Estoque Sincronizado) e OrdensCompraModule.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-064` — Botão 'Convidar Amigo por WhatsApp'
- **Domínio**: CRM & Indique e Ganhe
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientIndiqueGanhe.tsx` ──> Botão 'Convidar Amigo por WhatsApp'
  2. **Handler Local**: `handleCreateReferral`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('indicacoes', 'insert')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `indicacoes, vouchers`
- **Alvo de Propagação Cross-Módulo**: IndicacoesModule.tsx (Admin) e Dashboard do Cliente Indicador
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-065` — Botão 'Resgatar Prêmio Físico com Pontos'
- **Domínio**: Fidelidade & Prêmios
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientPremios.tsx` ──> Botão 'Resgatar Prêmio Físico com Pontos'
  2. **Handler Local**: `handleRedeemPrize`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('cliente_premios', 'insert')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `cliente_premios, clientes (saldo_pontos), pontos_movimentacoes`
- **Alvo de Propagação Cross-Módulo**: PremiosModule.tsx (Admin Fila de Entrega) e Header de Pontos do Cliente
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-066` — Botão 'Cadastrar Plano de Assinatura Recorrente'
- **Domínio**: Operações & Assinaturas
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/OrdensAssinaturaModule.tsx` ──> Botão 'Cadastrar Plano de Assinatura Recorrente'
  2. **Handler Local**: `handleSaveSubscriptionPlan`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_save_subscription_catalog')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_save_subscription_catalog`
  5. **Tabelas do Banco de Dados**: `ordens_assinatura, assinaturas`
- **Alvo de Propagação Cross-Módulo**: ClientAssinaturas.tsx (Planos disponíveis para contratação)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-067` — Botão 'Emitir Nota Fiscal (NF-e / NFS-e)'
- **Domínio**: Financeiro & Fiscal
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/FiscalModule.tsx` ──> Botão 'Emitir Nota Fiscal (NF-e / NFS-e)'
  2. **Handler Local**: `handleEmitInvoiceFiscal`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_emitir_nota_fiscal')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_emitir_nota_fiscal`
  5. **Tabelas do Banco de Dados**: `ordens_fiscais, faturas`
- **Alvo de Propagação Cross-Módulo**: ClientFinanceiro.tsx (Disponibilização do DANFE / XML para o cliente)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-068` — Botão 'Salvar Regras de Precificação do Sistema'
- **Domínio**: Ferramentas & Precificação
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/CalculatorProAdminPanel.tsx` ──> Botão 'Salvar Regras de Precificação do Sistema'
  2. **Handler Local**: `handleSavePricingRules`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_save_calculator_pro_runtime_config')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_save_calculator_pro_runtime_config`
  5. **Tabelas do Banco de Dados**: `pricing_configs, system_settings`
- **Alvo de Propagação Cross-Módulo**: Calculadoras Públicas e Simuladores de Serviços do Grupo GSA
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-069` — Botão 'Executar Diagnóstico do Sistema'
- **Domínio**: Governança & Monitoria
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/SystemMonitorModule.tsx` ──> Botão 'Executar Diagnóstico do Sistema'
  2. **Handler Local**: `handleRunDiagnostics`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_system_snapshot')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_system_snapshot`
  5. **Tabelas do Banco de Dados**: `sistema_logs, gsa_audit_logs, gsa_session_blacklists`
- **Alvo de Propagação Cross-Módulo**: SystemStatusIndicator.tsx (Badge de Integridade no Topo do Painel)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-070` — Botão 'Testar Conexão com Evolution API'
- **Domínio**: Comunicação & Mensageria
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/WhatsAppHealthMonitor.tsx` ──> Botão 'Testar Conexão com Evolution API'
  2. **Handler Local**: `handleTestWhatsAppConnection`
  3. **Método de Serviço / Hook**: `whatsappHealthService.checkHealth`
  4. **Backend Endpoint / RPC**: `HTTP Direct VPS 147.15.43.141:8080 (/instance/connectionState)`
  5. **Tabelas do Banco de Dados**: `gsa_whatsapp_ramais`
- **Alvo de Propagação Cross-Módulo**: WhatsAppButton.tsx e Painel de Telemetria de Disparos
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-071` — Botão 'Contribuir com a Vaquinha'
- **Domínio**: Marketplace & Crowdfunding
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/marketplace/CrowdfundingModal.tsx` ──> Botão 'Contribuir com a Vaquinha'
  2. **Handler Local**: `handleContributeVaquinha`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('loja_vaquinha_contribuicoes', 'insert')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `loja_vaquinhas, loja_vaquinha_contribuicoes, faturas`
- **Alvo de Propagação Cross-Módulo**: Barra de Progresso da Vaquinha na Loja em Tempo Real
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-072` — Botão 'Registrar Licença de Conteúdo Audiovisual'
- **Domínio**: GSA TV & Direitos Autorais
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/GsaTvRights.tsx` ──> Botão 'Registrar Licença de Conteúdo Audiovisual'
  2. **Handler Local**: `handleSaveRightsRecord`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_save_rights_record')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_save_rights_record`
  5. **Tabelas do Banco de Dados**: `gsa_tv_rights_records, gsa_tv_rights_documents`
- **Alvo de Propagação Cross-Módulo**: GsaTvControlRoom.tsx (Validação de Copyright no Agendamento)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-073` — Botão 'Ativar Tarja / Lower-Third no Ar'
- **Domínio**: GSA TV & Grafismo On-Air
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/GsaTvGraphics.tsx` ──> Botão 'Ativar Tarja / Lower-Third no Ar'
  2. **Handler Local**: `handleTriggerOnAirGraphic`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_gsa_tv_mutate')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_gsa_tv_mutate`
  5. **Tabelas do Banco de Dados**: `gsa_tv_on_air_graphics, gsa_tv_graphic_templates`
- **Alvo de Propagação Cross-Módulo**: Camada de Grafismo HTML no Renderizador de Vídeo da VPS
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-074` — Seletor de Período Financeiro (Mês / Trimestre)
- **Domínio**: Financeiro & Business Intelligence
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/PainelRentabilidade.tsx` ──> Seletor de Período Financeiro (Mês / Trimestre)
  2. **Handler Local**: `handleLoadProfitabilityMetrics`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_financial_snapshot')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_financial_snapshot`
  5. **Tabelas do Banco de Dados**: `faturas, extrato_financeiro, pedidos`
- **Alvo de Propagação Cross-Módulo**: Gráficos do Recharts em PainelRentabilidade.tsx e Dashboard.tsx
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-075` — Botão 'Publicar Nova Vaga de Emprego'
- **Domínio**: Recursos Humanos & Gestão de Vagas
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/CareerVacanciesManager.tsx` ──> Botão 'Publicar Nova Vaga de Emprego'
  2. **Handler Local**: `handleSaveVacancy`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_save_career_vacancy')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_save_career_vacancy`
  5. **Tabelas do Banco de Dados**: `gsa_careers_vacancies`
- **Alvo de Propagação Cross-Módulo**: CareersPublicPage.tsx (Portal Trabalhe Conosco Público)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-076` — Botão 'Confirmar Desistência da Promoção'
- **Domínio**: CRM & Promoções
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/ClientCancelPromoModal.tsx` ──> Botão 'Confirmar Desistência da Promoção'
  2. **Handler Local**: `handleCancelPromotion`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('cliente_promocoes', 'update')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `cliente_promocoes`
- **Alvo de Propagação Cross-Módulo**: ClientPromocoes.tsx (Promoção desativada da lista de benefícios)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-077` — Botão 'Salvar Regra de Combo / Leve X Pague Y'
- **Domínio**: Marketplace & Combos Promocionais
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/admin/PromocaoQuantidadeForm.tsx` ──> Botão 'Salvar Regra de Combo / Leve X Pague Y'
  2. **Handler Local**: `handleSaveQuantityPromotion`
  3. **Método de Serviço / Hook**: `callAdminRpc('gsa_admin_save_promocao_quantidade')`
  4. **Backend Endpoint / RPC**: `RPC gsa_admin_save_promocao_quantidade`
  5. **Tabelas do Banco de Dados**: `promocoes_quantidade`
- **Alvo de Propagação Cross-Módulo**: StoreHub.tsx e CheckoutPage.tsx (Cálculo Automático de Desconto no Carrinho)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-078` — Botão 'Abrir Contestação de Limite / Lançamento'
- **Domínio**: Financeiro & Disputas de Crédito
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/components/client/CreditDisputeModal.tsx` ──> Botão 'Abrir Contestação de Limite / Lançamento'
  2. **Handler Local**: `handleOpenCreditDispute`
  3. **Método de Serviço / Hook**: `clientOperationalWrite('loja_credito_disputas', 'insert')`
  4. **Backend Endpoint / RPC**: `RPC gsa_client_operational_write`
  5. **Tabelas do Banco de Dados**: `loja_credito_disputas, loja_credito_solicitacoes`
- **Alvo de Propagação Cross-Módulo**: Admin CreditoModule.tsx (Fila de Moderação de Disputas de Crédito)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-079` — Botão 'Enviar Documentação Técnica de Prestador'
- **Domínio**: Prestadores & Conformidade KYC
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Prestador/ProviderAccessPage.tsx` ──> Botão 'Enviar Documentação Técnica de Prestador'
  2. **Handler Local**: `handleUploadProviderDocument`
  3. **Método de Serviço / Hook**: `providerOperations.uploadDocument`
  4. **Backend Endpoint / RPC**: `Supabase Storage 'documentos_prestador' / RPC gsa_provider_upload_document`
  5. **Tabelas do Banco de Dados**: `prestador_documentos, prestadores`
- **Alvo de Propagação Cross-Módulo**: PrestadoresModule.tsx (Admin Fila de Homologação de Técnicos)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

### Aresta: `EDGE-080` — Botão 'Solicitar Alteração de Conta Bancária / PIX'
- **Domínio**: Fornecedores & Governança Bancária
- **5-Tupla Canônica**:
  1. **Origem (UI)**: `src/pages/Fornecedor/FornecedorFinanceiro.tsx` ──> Botão 'Solicitar Alteração de Conta Bancária / PIX'
  2. **Handler Local**: `handleRequestBankChange`
  3. **Método de Serviço / Hook**: `updateSupplierProfile`
  4. **Backend Endpoint / RPC**: `RPC gsa_supplier_update_profile`
  5. **Tabelas do Banco de Dados**: `fornecedores, audit_logs`
- **Alvo de Propagação Cross-Módulo**: FornecedoresModule.tsx (Admin Quarentena de Segurança Bancária)
- **Status Canônico**: **`ANALISADO ESTATICAMENTE`**

---

## 5. CONCLUSÕES E PREPARAÇÃO PARA O MILESTONE 2

1. **Topologia 100% Mapeada**: As 80 arestas canônicas cobrem a totalidade das interações de dados e regras de negócio do GSA HUB.
2. **Rigor Científico de Status**: Nenhuma aresta recebeu status `VALIDADO` prematuro. O Milestone 2 executará os testes dinâmicos de ponta a ponta especificados na Matriz de Testes de Conexões.
