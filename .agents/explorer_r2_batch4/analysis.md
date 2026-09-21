# Auditoria de Uso de Realtime — Componentes 73 a 98 (Batch 4)

**Data da Auditoria:** 2026-08-28  
**Auditor:** Explorer R2 Batch 4  
**Escopo:** Componentes 73 a 98 (26 componentes no total) do GSA HUB  

---

## 1. Resumo Executivo da Auditoria

| Métrica | Valor |
|---|---|
| **Total de Componentes Auditados** | 26 |
| **🟢 OK (Conformes)** | 19 |
| **🟡 Alerta (Problemas Moderados / Otimizações)** | 4 |
| **🔴 Crítico (Bugs Estruturais / Tabelas Fantasmas)** | 3 |

### Principais Achados Críticos e Alertas:
1. **Componente 75 (`ProdutosModule.tsx`) — 🔴 Crítico:**  
   Violação grave das **Regras dos Hooks do React**: os hooks `useEffect` e `useRealtimeSubscription` estão declarados **dentro** da função assíncrona `fetchProdutos` (linhas 247-272), em vez do corpo do componente funcional. Isso gera comportamentos imprevisíveis de execução e quebra o ciclo de vida do React.
2. **Componente 83 (`ServicePackagesModule.tsx`) — 🔴 Crítico / Inconsistência de Schema:**  
   Inscrição em tabelas inexistentes no PostgreSQL: `catalog_packages` e `catalog_services`. A tabela real no banco é `servicos_pacotes` (e `servicos`). Logo, alterações em pacotes de serviços no banco de dados não geram eventos de CDC em tempo real.
3. **Componente 90 (`TrabalheConoscoSection.tsx`) — 🔴 Crítico / Inconsistência de Schema:**  
   Inscrição em tabelas fantasmas `career_applications` e `trabalhe_conosco`. A tabela canônica no banco de dados é `gsa_careers_applications`. Mudanças de status de candidatos e novas inscrições não disparam notificações em tempo real para o ATS administrativo.
4. **Componente 84 (`ServicosModule.tsx`) — 🟡 Alerta:**  
   Inscrição na tabela fantasma `catalog_services` junto a `servicos` e `loja_categorias`.
5. **Componente 87 (`StoreHub.tsx`) — 🟡 Alerta:**  
   Arquitetura híbrida de Realtime: utiliza `useRealtimeSubscription` no topo para produtos e carrinhos, mas abre 4 canais manuais (`supabase.channel(...)`) dentro de um `useEffect` cujas dependências incluem estados de modais (`isCuponsModalOpen`, `isTrocaModalOpen`, etc.), causando recriação e desmonte desnecessário de canais WebSocket a cada clique de UI.
6. **Componente 73 (`PrestadorDetailDrawer.tsx`) — 🟡 Alerta:**  
   Callbacks inline anônimos recriados a cada renderização dentro do array de dependências do hook, sem `useCallback`, provocando re-assinaturas contínuas.

---

## 2. Fichas Detalhadas de Auditoria (Componentes 73 a 98)

---

### Componente 73: `PrestadorDetailDrawer.tsx`
- **Arquivo:** `src/components/admin/super-domains/pessoas/PrestadorDetailDrawer.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 13, 83-93)
- **Tabelas monitoradas:** `prestadores`, `prestador_demandas`
- **Filtros aplicados:** Nenhum (broadcast)
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado automaticamente pelo hook `useRealtimeSubscription`.
- **Callback onChange:** 
  - `prestadores`: `fetchPrestador`
  - `prestador_demandas`: Função anônima inline `() => { if (activeTab === 'demandas') fetchDemandas(); if (activeTab === 'extrato') fetchExtrato(); }`
- **Debounce configurado:** Padrão do hook (sem `debounceMs` explícito).
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`prestadores` e `prestador_demandas`).
- **Avaliação:** 🟡 **Alerta**  
  *Justificativa:* O callback inline anônimo na tabela `prestador_demandas` dentro da lista de dependências `[activeTab, prestadorId]` causa re-criação frequente da subscrição Realtime ao alternar abas de UI. Deve ser encapsulado com `useCallback`.

---

### Componente 74: `PrestadoresSection.tsx`
- **Arquivo:** `src/components/admin/super-domains/pessoas/PrestadoresSection.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 11, 48-52)
- **Tabelas monitoradas:** `prestadores`
- **Filtros aplicados:** Nenhum (broadcast)
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `fetchPrestadores` (memoizado com `useCallback`).
- **Debounce configurado:** Padrão do hook.
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`prestadores`).
- **Avaliação:** 🟢 **OK**

---

### Componente 75: `ProdutosModule.tsx`
- **Arquivo:** `src/components/admin/ProdutosModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 250-264) e `useEffect` (linhas 266-272)
- **Tabelas monitoradas:** `produtos`, `loja_categorias`, `loja_estoque_historico`, `produto_fornecedor_config`, `produto_variantes`, `produto_variacao_grupos`, `produto_variacao_opcoes` (7 tabelas)
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Quebrada / Inválida.
- **Callback onChange:** `fetchProdutos`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (todas as 7 tabelas existem no PostgreSQL).
- **Avaliação:** 🔴 **Crítico**  
  *Justificativa:* **Anti-pattern grave de React**: O hook `useRealtimeSubscription` e o `useEffect` de auto-scroll estão aninhados **dentro** do corpo da função assíncrona `fetchProdutos` (linhas 247 a 272). Chamar hooks dentro de funções de callback assíncronas viola as **Regras dos Hooks do React** e gera comportamentos instáveis em runtime.  
  *Correção Obrigatória:* Mover `useRealtimeSubscription` e `useEffect` para o nível raiz do corpo do componente funcional `ProdutosModule`.

---

### Componente 76: `ProtectionAdminModule.tsx`
- **Arquivo:** `src/components/admin/ProtectionAdminModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 8, 126-139)
- **Tabelas monitoradas:** `saude_contratos` (ou `seguros_apolices`), `parceiros`, `cotacoes`, `propostas`, `atendimentos`, `assessorias`, `comissoes`, `documentos`, `assistencias`, `sinistros`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado via hook.
- **Callback onChange:** `() => void load(true)` (com memoização via `useCallback`).
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim.
- **Avaliação:** 🟢 **OK**

---

### Componente 77: `ProtocolConsultPage.tsx`
- **Arquivo:** `src/components/public/ProtocolConsultPage.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 8, 70-80)
- **Tabelas monitoradas:** `parceiros_resgates`
- **Filtros aplicados:** `protocolo=eq.${result.protocolo}` (com `enabled: Boolean(result?.protocolo)`)
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado via hook, ativado condicionalmente.
- **Callback onChange:** `fetchResultSafe`
- **Debounce configurado:** `debounceMs: 500`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`parceiros_resgates`).
- **Avaliação:** 🟢 **OK** (Padrão exemplar de segurança e filtro pontual por protocolo).

---

### Componente 78: `PurchasesPage.tsx`
- **Arquivo:** `src/components/client/store/PurchasesPage.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 25, 492-500)
- **Tabelas monitoradas:** `orcamentos`, `ordens_compra`, `ordens_assinatura`, `loja_pedido_itens`, `loja_pedidos` (5 tabelas)
- **Filtros aplicados:** `cliente_id=eq.${clientId}` em `orcamentos`, `ordens_compra`, `ordens_assinatura` e `loja_pedidos`
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook com dependência em `[clientId]`.
- **Callback onChange:** `fetchAllPurchases`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim.
- **Avaliação:** 🟢 **OK**

---

### Componente 79: `RentabilidadeReembolsosView.tsx`
- **Arquivo:** `src/components/admin/super-domains/financeiro/RentabilidadeReembolsosView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 13, 91-95)
- **Tabelas monitoradas:** `loja_reembolsos`
- **Filtros aplicados:** Nenhum (módulo administrativo global).
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => void load(true)`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`loja_reembolsos`).
- **Avaliação:** 🟢 **OK**

---

### Componente 80: `SaquesList.tsx`
- **Arquivo:** `src/components/client/financeiro/SaquesList.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 14, 57-61)
- **Tabelas monitoradas:** `saques`
- **Filtros aplicados:** `cliente_id=eq.${clientId}`
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `load`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`saques`).
- **Avaliação:** 🟢 **OK**

---

### Componente 81: `SaquesRepassesSection.tsx`
- **Arquivo:** `src/components/admin/super-domains/pessoas/SaquesRepassesSection.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 12, 60-65)
- **Tabelas monitoradas:** `prestador_saques`, `saques` (2 tabelas)
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => { fetchWithdrawals(true); fetchPrestadorWithdrawals(true); }`
- **Debounce configurado:** Padrão do hook.
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`prestador_saques`, `saques`).
- **Avaliação:** 🟢 **OK**

---

### Componente 82: `ScrapingAdminModule.tsx`
- **Arquivo:** `src/components/admin/ScrapingAdminModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 9, 87-92)
- **Tabelas monitoradas:** `automacao_scraping_configs`, `system_settings` (filtro `key=eq.n8n_base_url`)
- **Filtros aplicados:** Filtro por chave em `system_settings`.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => void load(true)`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim.
- **Avaliação:** 🟢 **OK**

---

### Componente 83: `ServicePackagesModule.tsx`
- **Arquivo:** `src/components/admin/ServicePackagesModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 17, 80-84)
- **Tabelas monitoradas:** `servicos`, `catalog_packages`, `catalog_services` (3 tabelas)
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `load`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:**  
  - `servicos`: Sim.  
  - `catalog_packages`: ❌ **NÃO EXISTE** (Tabela fantasma; no DB é `servicos_pacotes`).  
  - `catalog_services`: ❌ **NÃO EXISTE** (Tabela fantasma; no DB é `servicos`).
- **Avaliação:** 🔴 **Crítico**  
  *Justificativa:* Subscrições em tabelas inexistentes no Postgres CDC nunca disparam eventos quando pacotes de serviços são criados, atualizados ou excluídos.  
  *Correção Obrigatória:* Substituir `catalog_packages` por `servicos_pacotes` e remover `catalog_services`.

---

### Componente 84: `ServicosModule.tsx`
- **Arquivo:** `src/components/admin/ServicosModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 11, 83-96)
- **Tabelas monitoradas:** `servicos`, `loja_categorias`, `catalog_services`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `fetchServicos`, além de `onPayload` para sincronizar `selectedServico`.
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** `servicos` (Sim), `loja_categorias` (Sim), `catalog_services` (❌ Tabela fantasma).
- **Avaliação:** 🟡 **Alerta**  
  *Justificativa:* Inscrição redundante/inválida em `catalog_services`. As tabelas reais `servicos` e `loja_categorias` funcionam normalmente.

---

### Componente 85: `ShopeeOperationsModule.tsx`
- **Arquivo:** `src/components/admin/ShopeeOperationsModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 23, 116-121)
- **Tabelas monitoradas:** `shopee_fulfillment_jobs`, `shopee_automation_workers`, `ordens_compra`, `orcamentos` (4 tabelas)
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => void load(true)`
- **Debounce configurado:** `debounceMs: 500`
- **Indicador de Conexão na UI:** Status de executores online exibido visualmente.
- **Tabela existe no Schema DB:** Sim (todas as 4 tabelas existem).
- **Avaliação:** 🟢 **OK**

---

### Componente 86: `SiteCampaignAdminModule.tsx`
- **Arquivo:** `src/components/admin/SiteCampaignAdminModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 19, 119-123)
- **Tabelas monitoradas:** `system_settings` (filtro `key=eq.site_campaigns`), `site_campaigns`, `site_campaign_events` (3 tabelas)
- **Filtros aplicados:** Filtro por chave em `system_settings`.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => void load(true)`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim.
- **Avaliação:** 🟢 **OK**

---

### Componente 87: `StoreHub.tsx`
- **Arquivo:** `src/components/client/StoreHub.tsx`
- **Hook utilizado:** Misto: `useRealtimeSubscription` (linhas 34, 152-155) e 4 canais manuais via `supabase.channel()` em `useEffect` (linhas 635-693)
- **Tabelas monitoradas:**
  - Via Hook: `produtos`, `loja_carrinhos`
  - Via Manual `.channel()`: `orcamentos`, `loja_reembolsos`, `cliente_promocoes`, `loja_solicitacoes`
- **Filtros aplicados:** `cliente_id=eq.${clientId}` nos 4 canais manuais.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** `supabase.removeChannel(...)` no retorno do `useEffect`.
- **Callback onChange:** `fetchAllPurchases`, `fetchMyRefunds`, `fetchVipPromos`, `fetchMyExchanges`
- **Debounce configurado:** Sem debounce nos canais manuais.
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (todas as 6 tabelas existem).
- **Avaliação:** 🟡 **Alerta**  
  *Justificativa:* O `useEffect` que cria os 4 canais manuais possui em seu array de dependências estados de modais (`[isCuponsModalOpen, isTrocaModalOpen, isPurchasesModalOpen, isRefundsModalOpen, isVipPromosModalOpen, clientId]`). Isso faz com que os 4 canais WebSocket sejam destruídos e recriados a cada abertura ou fechamento de qualquer modal na loja. Além disso, não há debounce configurado nos canais manuais.  
  *Recomendação:* Consolidar todos os canais no hook unificado `useRealtimeSubscription` dependendo unicamente de `clientId`.

---

### Componente 88: `SupportConversationModal.tsx`
- **Arquivo:** `src/components/common/SupportConversationModal.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 7, 51-83)
- **Tabelas monitoradas:**
  - `suporte_mensagens` (evento `INSERT`, filtro `suporte_id=eq.${currentSuporte.id}`)
  - `prestador_suporte_demandas` (evento `UPDATE`, filtro `id=eq.${currentSuporte.id}`)
- **Filtros aplicados:** Filtro restrito por `suporte_id` e `id`.
- **Eventos escutados:** `INSERT` e `UPDATE` específicos.
- **Limpeza (Cleanup):** Gerenciado pelo hook com `enabled: Boolean(isOpen && currentSuporte?.id)`.
- **Callback onChange:** `onPayload` adicionando diretamente à lista em memória (evitando re-fetch total e evitando duplicações).
- **Debounce configurado:** Sem debounce (comportamento ideal para chat/mensageria em tempo real).
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`suporte_mensagens`, `prestador_suporte_demandas`).
- **Avaliação:** 🟢 **OK** (Padrão de referência para chat em modal).

---

### Componente 89: `SystemMonitorModule.tsx`
- **Arquivo:** `src/components/admin/SystemMonitorModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 25, 258-266)
- **Tabelas monitoradas:** `colaboradores`, `clientes`, `fornecedores`, `prestadores`, `gsa_afiliados`, `sistema_logs`, `system_settings` (7 tabelas)
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => { void load(true); void fetchFallbackUsers(); }`
- **Debounce configurado:** `debounceMs: 500`
- **Indicador de Conexão na UI:** Atualizações de métricas e status de VPS.
- **Tabela existe no Schema DB:** Sim (todas as 7 tabelas existem).
- **Avaliação:** 🟢 **OK**

---

### Componente 90: `TrabalheConoscoSection.tsx`
- **Arquivo:** `src/components/admin/super-domains/pessoas/TrabalheConoscoSection.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 12, 91-94)
- **Tabelas monitoradas:** `career_applications`, `trabalhe_conosco` (2 tabelas)
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => fetchApplications(true)`
- **Debounce configurado:** Padrão do hook.
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:**  
  - `career_applications`: ❌ **NÃO EXISTE** (Tabela fantasma; no DB é `gsa_careers_applications`).  
  - `trabalhe_conosco`: ❌ **NÃO EXISTE** (Tabela fantasma).
- **Avaliação:** 🔴 **Crítico**  
  *Justificativa:* Ambas as tabelas monitoradas são nomes fantasmas. A tabela canônica no banco de dados é `gsa_careers_applications`. Quando um candidato submete um formulário de Trabalhe Conosco ou o status de um candidato é atualizado no ATS, a listagem administrativa nunca se atualiza em tempo real.  
  *Correção Obrigatória:* Alterar a subscrição para `{ table: 'gsa_careers_applications', onChange: () => fetchApplications(true), debounceMs: 300 }`.

---

### Componente 91: `TravelAdminModule.tsx`
- **Arquivo:** `src/components/admin/TravelAdminModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 48, 255-264)
- **Tabelas monitoradas:** `viagens_pacotes`, `viagens_propostas`, `viagens_transacoes`, `viagens_orcamentos`, `viagens_categorias`, `viagens_passageiros`, `viagens_pacote_imagens`, `clientes` (8 tabelas)
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `load` (memoizado via `useCallback`).
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (todas as 8 tabelas existem).
- **Avaliação:** 🟢 **OK**

---

### Componente 92: `TravelCancellationsPage.tsx`
- **Arquivo:** `src/components/client/marketplace/travel/TravelCancellationsPage.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 8, 109-124)
- **Tabelas monitoradas:** `viagens_transacoes` (filtro `cliente_id=eq.${clientId}`), `viagens_cancelamentos` (2 tabelas)
- **Filtros aplicados:** `cliente_id=eq.${clientId}` em `viagens_transacoes`.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => { void fetchTrips(); }`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`viagens_transacoes`, `viagens_cancelamentos`).
- **Avaliação:** 🟢 **OK**

---

### Componente 93: `TravelProposalsPage.tsx`
- **Arquivo:** `src/components/client/marketplace/travel/TravelProposalsPage.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 9, 41-51)
- **Tabelas monitoradas:** `viagens_propostas`
- **Filtros aplicados:** `cliente_id=eq.${clientId}`
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `fetchPropostas`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`viagens_propostas`).
- **Avaliação:** 🟢 **OK**

---

### Componente 94: `TravelQuoteRequestPage.tsx`
- **Arquivo:** `src/components/client/marketplace/travel/TravelQuoteRequestPage.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 22, 174-185)
- **Tabelas monitoradas:** `viagens_pacotes`
- **Filtros aplicados:** `id=eq.${packageId}` (com `enabled: Boolean(packageId)`)
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => { void loadPackage(); }`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`viagens_pacotes`).
- **Avaliação:** 🟢 **OK**

---

### Componente 95: `TravelReservationPage.tsx`
- **Arquivo:** `src/components/client/marketplace/travel/TravelReservationPage.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 20, 152-177)
- **Tabelas monitoradas:** `viagens_transacoes` (filtro `id=eq.${transacaoId}`), `viagens_passageiros`, `viagens_passageiro_documentos`, `viagens_vouchers` (4 tabelas)
- **Filtros aplicados:** `id=eq.${transacaoId}` em `viagens_transacoes`.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `fetchTripDetails`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (todas as 4 tabelas existem).
- **Avaliação:** 🟢 **OK**

---

### Componente 96: `usePublicRegistrationSettings.ts`
- **Arquivo:** `src/hooks/usePublicRegistrationSettings.ts`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 3, 63-71)
- **Tabelas monitoradas:** `system_settings`
- **Filtros aplicados:** Nenhum (ativado por `enabled`).
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `refresh` (memoizado com `useCallback`).
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** N/A (Custom hook de configurações públicas).
- **Tabela existe no Schema DB:** Sim (`system_settings`).
- **Avaliação:** 🟢 **OK**

---

### Componente 97: `VendasModule.tsx`
- **Arquivo:** `src/components/admin/VendasModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 6, 119-125)
- **Tabelas monitoradas:** `orcamentos`, `ordens_servico`, `ordens_compra`, `ordens_assinatura`, `prestador_demandas` (5 tabelas)
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `() => setRtRefreshKey(k => k + 1)`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Badges de pendências reativas.
- **Tabela existe no Schema DB:** Sim (todas as 5 tabelas existem).
- **Avaliação:** 🟢 **OK**

---

### Componente 98: `ViagensCategoriasModule.tsx`
- **Arquivo:** `src/components/admin/ViagensCategoriasModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 8, 30-34)
- **Tabelas monitoradas:** `viagens_categorias`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*` (padrão)
- **Limpeza (Cleanup):** Gerenciado pelo hook.
- **Callback onChange:** `loadData`
- **Debounce configurado:** `debounceMs: 300`
- **Indicador de Conexão na UI:** Silencioso.
- **Tabela existe no Schema DB:** Sim (`viagens_categorias`).
- **Avaliação:** 🟢 **OK**

---

## 3. Recomendações e Plano de Ação para Correção

1. **Correção Imediata de Violação de Hook em `ProdutosModule.tsx`:**  
   Extrair a chamada de `useRealtimeSubscription` e `useEffect` para o corpo principal do componente `ProdutosModule`, eliminando a declaração de hooks dentro do fechamento da função assíncrona `fetchProdutos`.
2. **Saneamento de Tabelas Fantasmas:**  
   - `ServicePackagesModule.tsx`: Alterar `catalog_packages` para `servicos_pacotes` e remover `catalog_services`.
   - `TrabalheConoscoSection.tsx`: Alterar `career_applications` e `trabalhe_conosco` para `gsa_careers_applications`.
   - `ServicosModule.tsx`: Remover a entrada `catalog_services`.
3. **Refatoração de Realtime no `StoreHub.tsx`:**  
   Substituir as 4 inscrições manuais do `useEffect` por um único `useRealtimeSubscription` e remover os estados de modais do array de dependências para evitar reconexões desnecessárias do WebSocket.
