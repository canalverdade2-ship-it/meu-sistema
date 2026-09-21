# Relatório de Auditoria Técnica Realtime — Batch 1 (Componentes 1 a 24)

**Data da Auditoria:** 2026-08-28  
**Agente Responsável:** Explorer R2 Batch 1  
**Escopo de Auditoria:** Componentes 1 a 24 de 94 componentes mapeados no GSA HUB.  
**Diretório de Trabalho:** `.agents/explorer_r2_batch1`

---

## 1. Sumário Executivo do Lote 1 (Componentes 1 a 24)

| Total de Componentes | 🟢 OK | 🟡 Alerta | 🔴 Crítico |
| :---: | :---: | :---: | :---: |
| **24** | **15** | **8** | **1** |

### Destaques Críticos e Alertas:
1. 🔴 **CRÍTICO - Componente 4 (`AdvertisingAdminModule.tsx`)**: O componente está inscrito em tabelas inexistentes no banco (`advertising_requests`, `advertising_proposals`, `advertising_campaigns`, `advertising_creatives`, `advertising_payments`, `advertising_placements`). A infraestrutura real de publicidade utiliza o prefixo `gsa_ad_*` (`gsa_ad_requests`, `gsa_ad_proposals`, etc.). Portanto, **o realtime administrativo de publicidade nunca dispara**.
2. 🟡 **ALERTA - Componente 2 (`AdminPrestadorDocumentos.tsx`)**: O hook se inscreve no nome `documentos_prestador`, que é um bucket de storage R2/S3 e **não uma tabela SQL**. Eventos CDC do Postgres nunca serão disparados para este item.
3. 🟡 **ALERTA - Componente 8 (`AreaVipView.tsx`)**: Monitora a tabela `clientes` inteira sem nenhum filtro de linha e sem debounce (0ms), disparando re-fetch total de membros VIP a cada alteração em qualquer cliente do sistema.
4. 🟡 **ALERTA - Componente 12 (`CareersAdminModule.tsx`)**: Monitora a tabela fantasma `trabalhe_conosco` (legado) que não existe mais nas migrations.
5. 🟡 **ALERTA - Componente 17 (`ClientAreaVIP.tsx`)**: Possui **dupla subscrição ativa**: cria um canal cru `supabase.channel('client-vip-changes')` em um `useEffect` e também usa `useRealtimeSubscription` para as mesmas tabelas.

---

## 2. Fichas de Auditoria Detalhada (Cards 1 a 24)

---

### Componente 1: AcessosModule.tsx
- **Caminho do Arquivo:** `src/components/admin/AcessosModule.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `colaboradores`, `solicitacoes_exclusao`, `sistema_logs`
- **Filtros Aplicados:** Nenhum (Visualização Administrativa Global)
- **Eventos Ouvidos:** `*` (INSERT, UPDATE, DELETE)
- **Status de Cleanup:** ✅ Correto (Unmount limpo via `useRealtimeSubscription` e `supabase.removeChannel`)
- **Callback onChange:** Executa `loadData()` de forma unificada e desacoplada
- **Configuração de Debounce:** `debounceMs: 500` para todas as tabelas
- **Exibição de Status de Conexão na UI:** Silencioso (Sem badge visual)
- **Existência no Schema SQL:**
  - `colaboradores`: ✅ Existe
  - `solicitacoes_exclusao`: ✅ Existe
  - `sistema_logs`: ✅ Existe
- **Classificação:** 🟢 OK / 🟡 Alerta
- **Diagnóstico & Observações:** O componente adota o padrão canônico com debounce adequado de 500ms para evitar bursts durante auditorias. Contudo, a aba de "Funções e Permissões" não possui subscrição na tabela `funcoes` / `permissoes`.
- **Proposta de Melhoria:**
  ```tsx
  // Adicionar monitoramento para tabela de funções caso ocorram alterações administrativas em tempo real:
  useRealtimeSubscription([
    { table: 'colaboradores', onChange: loadData, debounceMs: 500 },
    { table: 'solicitacoes_exclusao', onChange: loadData, debounceMs: 500 },
    { table: 'sistema_logs', onChange: loadData, debounceMs: 500 },
    { table: 'funcoes', onChange: loadData, debounceMs: 500 },
  ], [loadData]);
  ```

---

### Componente 2: AdminPrestadorDocumentos.tsx
- **Caminho do Arquivo:** `src/components/admin/prestadores/AdminPrestadorDocumentos.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `prestador_documentos`, `documentos_prestador`
- **Filtros Aplicados:** `prestador_id=eq.${prestadorId}`
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto via `useRealtimeSubscription`
- **Callback onChange:** Executa `fetchDocs()`
- **Configuração de Debounce:** `debounceMs: 300`
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:**
  - `prestador_documentos`: ✅ Existe
  - `documentos_prestador`: ❌ **Inexistente como tabela** (É um Storage Bucket R2/S3!)
- **Classificação:** 🟡 Alerta
- **Diagnóstico & Observações:** O hook tenta assinar `postgres_changes` em `documentos_prestador`, gerando subscrição inócua e gerando ruído no WebSocket do Supabase. A tabela real que grava o metadado é apenas `prestador_documentos`.
- **Proposta de Correção:**
  ```tsx
  // Antes:
  useRealtimeSubscription([
    { table: 'prestador_documentos', filter: `prestador_id=eq.${prestadorId}`, onChange: fetchDocs, debounceMs: 300 },
    { table: 'documentos_prestador', filter: `prestador_id=eq.${prestadorId}`, onChange: fetchDocs, debounceMs: 300 },
  ], [prestadorId]);

  // Depois:
  useRealtimeSubscription([
    { table: 'prestador_documentos', filter: `prestador_id=eq.${prestadorId}`, onChange: fetchDocs, debounceMs: 300 },
  ], [prestadorId]);
  ```

---

### Componente 3: AdvertiserPortal.tsx
- **Caminho do Arquivo:** `src/pages/AdvertiserPortal.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `gsa_advertisers`, `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_payments`, `gsa_ad_negotiations`
- **Filtros Aplicados:** Nenhum (Monitora toda a base de anunciantes)
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `() => void loadAdvertiserContext(true)`
- **Configuração de Debounce:** `debounceMs: 500` em todas as tabelas
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 7 tabelas `gsa_ad_*` e `gsa_advertisers` existem no schema.
- **Classificação:** 🟡 Alerta
- **Diagnóstico & Observações:** No portal do anunciante autenticado, quando há um `advertiserId` ativo, a subscrição sem filtro faz broadcast de propostas e requisições de outros anunciantes para o cliente, re-executando a query.
- **Proposta de Correção:** Aplicar filtro de linha quando `advertiser?.id` estiver definido:
  ```tsx
  useRealtimeSubscription([
    { table: 'gsa_advertisers', filter: advertiser?.id ? `id=eq.${advertiser.id}` : undefined, onChange: () => void loadAdvertiserContext(true), debounceMs: 500 },
    { table: 'gsa_ad_requests', filter: advertiser?.id ? `advertiser_id=eq.${advertiser.id}` : undefined, onChange: () => void loadAdvertiserContext(true), debounceMs: 500 },
    { table: 'gsa_ad_proposals', onChange: () => void loadAdvertiserContext(true), debounceMs: 500 },
    { table: 'gsa_ad_campaigns', filter: advertiser?.id ? `advertiser_id=eq.${advertiser.id}` : undefined, onChange: () => void loadAdvertiserContext(true), debounceMs: 500 },
    { table: 'gsa_ad_creatives', onChange: () => void loadAdvertiserContext(true), debounceMs: 500 },
    { table: 'gsa_ad_payments', onChange: () => void loadAdvertiserContext(true), debounceMs: 500 },
    { table: 'gsa_ad_negotiations', onChange: () => void loadAdvertiserContext(true), debounceMs: 500 },
  ], [advertiser?.id]);
  ```

---

### Componente 4: AdvertisingAdminModule.tsx
- **Caminho do Arquivo:** `src/components/admin/AdvertisingAdminModule.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `advertising_requests`, `advertising_proposals`, `advertising_campaigns`, `advertising_creatives`, `advertising_payments`, `advertising_placements`
- **Filtros Aplicados:** Nenhum
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Estruturalmente correto, mas inútil
- **Callback onChange:** Executa `() => void loadSnapshot(true)`
- **Configuração de Debounce:** `debounceMs: 500`
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** ❌ **NENHUMA DAS TABELAS EXISTE COM ESSES NOMES!** (Nomes reais no PostgreSQL: `gsa_ad_requests`, `gsa_ad_proposals`, `gsa_ad_campaigns`, `gsa_ad_creatives`, `gsa_ad_payments`, `gsa_ad_placements`).
- **Classificação:** 🔴 **Crítico (Bug de Produção)**
- **Diagnóstico & Observações:** As tabelas subscritas pelo componente administrativo de publicidade foram alucinadas / desatualizadas em relação à migration `20260718100000_advertising_platform_complete.sql`. O painel administrativo **NUNCA recebe atualizações em tempo real** de novas propostas de anúncios, pagamentos ou campanhas criadas pelos clientes.
- **Proposta de Correção Imediata (P0):**
  ```tsx
  // Substituir em src/components/admin/AdvertisingAdminModule.tsx (linhas 130-137):
  useRealtimeSubscription([
    { table: 'gsa_ad_requests', onChange: () => void loadSnapshot(true), debounceMs: 500 },
    { table: 'gsa_ad_proposals', onChange: () => void loadSnapshot(true), debounceMs: 500 },
    { table: 'gsa_ad_campaigns', onChange: () => void loadSnapshot(true), debounceMs: 500 },
    { table: 'gsa_ad_creatives', onChange: () => void loadSnapshot(true), debounceMs: 500 },
    { table: 'gsa_ad_payments', onChange: () => void loadSnapshot(true), debounceMs: 500 },
    { table: 'gsa_ad_placements', onChange: () => void loadSnapshot(true), debounceMs: 500 },
  ]);
  ```

---

### Componente 5: AffiliateAdminModule.tsx
- **Caminho do Arquivo:** `src/components/admin/AffiliateAdminModule.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `gsa_afiliados`, `gsa_afiliado_programas`, `gsa_afiliado_comissoes`, `gsa_afiliado_saques`, `gsa_afiliado_links`, `indicacoes`
- **Filtros Aplicados:** Nenhum (Visão Geral de Administração)
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto via hook canônico
- **Callback onChange:** Executa `() => void load(true)`
- **Configuração de Debounce:** `debounceMs: 500` em todas as tabelas
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 6 tabelas existem no schema oficial.
- **Classificação:** 🟢 OK
- **Diagnóstico & Observações:** Implementação de referência para painéis administrativos. Monitora todas as entidades do domínio de afiliados com nomes canônicos e debounce de 500ms.

---

### Componente 6: AfiliadoDashboard.tsx
- **Caminho do Arquivo:** `src/pages/Afiliado/AfiliadoDashboard.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `gsa_afiliados`, `gsa_afiliado_links`, `gsa_afiliado_comissoes`, `gsa_afiliado_saques`, `gsa_afiliado_programas`, `saques`
- **Filtros Aplicados:**
  - `gsa_afiliados`: `filter: afData?.id ? id=eq.${afData.id} : undefined`
  - Demais: sem filtro explícito
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `() => void load(true)`
- **Configuração de Debounce:** `debounceMs: 500`
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as tabelas existem.
- **Classificação:** 🟢 OK / 🟡 Alerta
- **Diagnóstico & Observações:** A tabela principal `gsa_afiliados` é filtrada por ID do afiliado. Recomenda-se adicionar filtro por `afiliado_id` também em `gsa_afiliado_comissoes`, `gsa_afiliado_saques` e `gsa_afiliado_links` para otimização de tráfego em alta escala.

---

### Componente 7: AfiliadosSection.tsx
- **Caminho do Arquivo:** `src/components/admin/super-domains/pessoas/AfiliadosSection.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `gsa_afiliados`, `indicacoes`, `saques`
- **Filtros Aplicados:** Nenhum (Módulo Admin Tático)
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `() => void load(true)`
- **Configuração de Debounce:** 0ms (Falta debounce explícito)
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Tabelas existem.
- **Classificação:** 🟡 Alerta
- **Diagnóstico & Observações:** Falta configurar debounce (`debounceMs: 300`) e faltam as tabelas específicas de saques e comissões do sistema de afiliados (`gsa_afiliado_saques`, `gsa_afiliado_comissoes`).
- **Proposta de Correção:**
  ```tsx
  useRealtimeSubscription([
    { table: 'gsa_afiliados', onChange: () => void load(true), debounceMs: 300 },
    { table: 'gsa_afiliado_comissoes', onChange: () => void load(true), debounceMs: 300 },
    { table: 'gsa_afiliado_saques', onChange: () => void load(true), debounceMs: 300 },
    { table: 'indicacoes', onChange: () => void load(true), debounceMs: 300 },
    { table: 'saques', onChange: () => void load(true), debounceMs: 300 },
  ], [load]);
  ```

---

### Componente 8: AreaVipView.tsx
- **Caminho do Arquivo:** `src/components/admin/super-domains/contratos/AreaVipView.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `clientes`
- **Filtros Aplicados:** Nenhum
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `fetchMembers`
- **Configuração de Debounce:** 0ms (Sem debounce)
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** `clientes` ✅ Existe
- **Classificação:** 🟡 Alerta
- **Diagnóstico & Observações:** Subscrição na tabela inteira `clientes` sem debounce. Em produção, qualquer atualização de cliente (login, endereço, saldo) refaz a query inteira da Área VIP sem necessidade imediata.
- **Proposta de Correção:** Adicionar `debounceMs: 500` e monitorar também `client_levels` e `assinaturas`.

---

### Componente 9: AssinaturasModule.tsx
- **Caminho do Arquivo:** `src/components/admin/AssinaturasModule.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `assinaturas`, `ordens_assinatura`, `loja_categorias`
- **Filtros Aplicados:** Nenhum (Catálogo Administrativo)
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `fetchAssinaturas` para assinaturas/ordens e `fetchCats` para categorias
- **Configuração de Debounce:** `debounceMs: 300` para todas as tabelas
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 3 tabelas existem.
- **Classificação:** 🟢 OK

---

### Componente 10: AtendimentoTicketsView.tsx
- **Caminho do Arquivo:** `src/components/admin/super-domains/contratos/AtendimentoTicketsView.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `tickets`, `ticket_mensagens`
- **Filtros Aplicados:** Nenhum (Fila Geral Omnichannel)
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `fetchTickets`
- **Configuração de Debounce:** 0ms (Padrão imediato para chat)
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** `tickets` e `ticket_mensagens` existem no schema oficial.
- **Classificação:** 🟢 OK / 🟡 Alerta
- **Diagnóstico & Observações:** Funcional e correto. Recomenda-se adicionar debounce leve (`debounceMs: 150`) para evitar re-execução em rajada caso mensagens cheguem em frações de segundo.

---

### Componente 11: CalculadorasGatewayView.tsx
- **Caminho do Arquivo:** `src/components/admin/super-domains/financeiro/CalculadorasGatewayView.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `vouchers`, `system_settings`
- **Filtros Aplicados:** Nenhum
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `loadSnapshot` via RPC `gsa_admin_calculator_pro_snapshot`
- **Configuração de Debounce:** 0ms
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** `vouchers` e `system_settings` existem.
- **Classificação:** 🟢 OK

---

### Componente 12: CareersAdminModule.tsx
- **Caminho do Arquivo:** `src/components/admin/CareersAdminModule.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `gsa_careers_applications`, `trabalhe_conosco`
- **Filtros Aplicados:** Nenhum
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `() => void fetchApplications(true)`
- **Configuração de Debounce:** `debounceMs: 500`
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:**
  - `gsa_careers_applications`: ✅ Existe
  - `trabalhe_conosco`: ❌ **Inexistente** (Tabela legada removida)
- **Classificação:** 🟡 Alerta
- **Diagnóstico & Observações:** A subscrição em `trabalhe_conosco` deve ser removida e substituída opcionalmente por `gsa_careers_application_history`.
- **Proposta de Correção:**
  ```tsx
  useRealtimeSubscription([
    { table: 'gsa_careers_applications', onChange: () => void fetchApplications(true), debounceMs: 500 },
    { table: 'gsa_careers_application_history', onChange: () => void fetchApplications(true), debounceMs: 500 },
  ]);
  ```

---

### Componente 13: CheckoutModal.tsx
- **Caminho do Arquivo:** `src/components/client/store/CheckoutModal.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `clientes`, `cupons_ativados`, `cupons_loja`
- **Filtros Aplicados:**
  - `clientes`: `filter: clientId ? id=eq.${clientId} : undefined`
  - `cupons_ativados`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `cupons_loja`: sem filtro (catálogo geral de cupons)
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto (Condicionado a `enabled: isOpen && !!clientId`)
- **Callback onChange:** Executa `fetchSaldoPontos` / `fetchDadosCredito` e `fetchCoupons`
- **Configuração de Debounce:** `debounceMs: 150` em todas as tabelas
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as tabelas existem.
- **Classificação:** 🟢 OK (Excelente padrão: condicionado à abertura do modal, filtros por cliente e debounce de 150ms).

---

### Componente 14: CheckoutPage.tsx
- **Caminho do Arquivo:** `src/components/client/store/CheckoutPage.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `loja_carrinhos`, `clientes`, `produtos`, `cupons_loja`
- **Filtros Aplicados:**
  - `loja_carrinhos`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `clientes`: `filter: clientId ? id=eq.${clientId} : undefined`
  - `produtos` / `cupons_loja`: sem filtro
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto no unmount
- **Callback onChange:** Executa `fetchCartItems`, `fetchDadosCredito`, `fetchCoupons`
- **Configuração de Debounce:** 0ms
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 4 tabelas existem.
- **Classificação:** 🟢 OK / 🟡 Alerta (Recomenda-se adicionar `debounceMs: 300` para a tabela `produtos`).

---

### Componente 15: ClassifiedsModule.tsx
- **Caminho do Arquivo:** `src/components/admin/ClassifiedsModule.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `classificados_anuncios`, `classificados_propostas`, `classificados_mensagens`, `classificados_transacoes`, `classificados_midias`
- **Filtros Aplicados:** Nenhum (Moderação Administrativa)
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `load`
- **Configuração de Debounce:** `debounceMs: 300` em todas as 5 tabelas
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 5 tabelas existem no schema de classificados.
- **Classificação:** 🟢 OK

---

### Componente 16: ClientAffiliatePanel.tsx
- **Caminho do Arquivo:** `src/components/client/ClientAffiliatePanel.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `gsa_afiliados`, `saques`, `carteira_lancamentos`, `indicacoes`, `points_transactions`, `pontos_movimentacoes`
- **Filtros Aplicados:**
  - `saques`: `cliente_id=eq.${_clientId}`
  - `carteira_lancamentos`: `cliente_id=eq.${_clientId}`
  - `indicacoes`: `indicador_id=eq.${_clientId}`
  - `points_transactions`: `client_id=eq.${_clientId}`
  - `pontos_movimentacoes`: `cliente_id=eq.${_clientId}`
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `load(true)`
- **Configuração de Debounce:** 0ms
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 6 tabelas existem.
- **Classificação:** 🟢 OK / 🟡 Alerta (Recomenda-se adicionar `gsa_afiliado_comissoes` e `gsa_afiliado_saques` à lista de subscrições).

---

### Componente 17: ClientAreaVIP.tsx
- **Caminho do Arquivo:** `src/components/client/ClientAreaVIP.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` e canal cru `supabase.channel` (Duplicidade!)
- **Tabelas Monitoradas:**
  - No `useRealtimeSubscription`: `client_levels`, `assinaturas`
  - No `useEffect` manual: `client_levels` (global) e `level_history` (`filter: cliente_id=eq.${cliente.id}`)
- **Filtros Aplicados:** `level_history` com filtro de cliente; `client_levels` sem filtro
- **Eventos Ouvidos:** `*` e `INSERT`
- **Status de Cleanup:** ✅ Ambos possuem cleanup
- **Callback onChange:** `fetchLevels`, `fetchHistory`
- **Configuração de Debounce:** 0ms
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as tabelas existem.
- **Classificação:** 🟡 Alerta (Anti-pattern: Duplicação de canais e subscrição crua fora do hook canônico).
- **Proposta de Correção:** Unificar todas as subscrições no `useRealtimeSubscription`:
  ```tsx
  // Remover o useEffect com supabase.channel('client-vip-changes') e unificar em:
  useRealtimeSubscription([
    { table: 'client_levels', onChange: fetchLevels, debounceMs: 300 },
    { table: 'assinaturas', onChange: fetchLevels, debounceMs: 300 },
    { 
      table: 'level_history', 
      filter: cliente.id ? `cliente_id=eq.${cliente.id}` : undefined, 
      onChange: () => { fetchLevels(); fetchHistory(); },
      debounceMs: 300
    },
  ], [cliente.id]);
  ```

---

### Componente 18: ClientAssinaturas.tsx
- **Caminho do Arquivo:** `src/components/client/ClientAssinaturas.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `ordens_assinatura`, `faturas`, `assinaturas`
- **Filtros Aplicados:**
  - `ordens_assinatura`: `filter: cliente_id=eq.${clientId}`
  - `faturas`: `filter: cliente_id=eq.${clientId}`
  - `assinaturas`: sem filtro (catálogo)
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `fetchMinhasAssinaturas`
- **Configuração de Debounce:** 0ms
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 3 tabelas existem.
- **Classificação:** 🟢 OK

---

### Componente 19: ClientFidelidade.tsx
- **Caminho do Arquivo:** `src/components/client/ClientFidelidade.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `clientes`, `vouchers`, `indicacoes`, `pontos_movimentacoes`, `system_settings`
- **Filtros Aplicados:**
  - `clientes`: `filter: clientId ? id=eq.${clientId} : undefined`
  - `vouchers`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `indicacoes`: `filter: clientId ? indicador_id=eq.${clientId} : undefined`
  - `pontos_movimentacoes`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `system_settings`: sem filtro
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Atualização via re-render e hook de notificações acoplado
- **Configuração de Debounce:** 0ms
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 5 tabelas existem.
- **Classificação:** 🟢 OK

---

### Componente 20: ClientFinanceiro.tsx
- **Caminho do Arquivo:** `src/components/client/ClientFinanceiro.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `clientes`, `faturas`, `saques`, `transferencias`, `carteira_lancamentos`, `ordens_fiscais`, `tickets`, `system_settings`
- **Filtros Aplicados:**
  - `clientes`: `id=eq.${clientId}`
  - `faturas`: `cliente_id=eq.${clientId}`
  - `saques`: `cliente_id=eq.${clientId}`
  - `carteira_lancamentos`: `cliente_id=eq.${clientId}`
  - `ordens_fiscais`: `cliente_id=eq.${clientId}`
  - `tickets`: `cliente_id=eq.${clientId}`
  - `system_settings`: `key=eq.valor_minimo_saque`
  - `transferencias`: sem filtro
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** `fetchSaldo`, `checkFaturas`, `checkActiveRequest`, `fetchMinSaque`
- **Configuração de Debounce:** 0ms
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 8 tabelas existem.
- **Classificação:** 🟢 OK

---

### Componente 21: ClientIndiqueGanhe.tsx
- **Caminho do Arquivo:** `src/components/client/ClientIndiqueGanhe.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `indicacoes`, `vouchers`, `clientes`
- **Filtros Aplicados:**
  - `indicacoes`: `filter: clientId ? indicador_id=eq.${clientId} : undefined`
  - `clientes`: `filter: clientId ? id=eq.${clientId} : undefined`
  - `vouchers`: sem filtro
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange & onPayload:**
  - `onChange`: `fetchIndicacoes` / `fetchCliente`
  - `onPayload`: Atualiza o modal de detalhes `selectedIndicacao` em tempo real sem fechar a tela!
- **Configuração de Debounce:** `debounceMs: 150` em todas as tabelas
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 3 tabelas existem.
- **Classificação:** 🟢 OK (Excelente padrão de live patching via `onPayload`).

---

### Componente 22: ClientMeuCredito.tsx
- **Caminho do Arquivo:** `src/components/client/ClientMeuCredito.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `loja_credito_solicitacoes`, `loja_credito_movimentacoes`, `faturas`, `clientes`, `loja_credito_documentos`
- **Filtros Aplicados:**
  - `loja_credito_solicitacoes`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `loja_credito_movimentacoes`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `faturas`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `clientes`: `filter: clientId ? id=eq.${clientId} : undefined`
  - `loja_credito_documentos`: sem filtro
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `loadData()` e `onRefreshCliente()`
- **Configuração de Debounce:** 0ms
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 5 tabelas existem.
- **Classificação:** 🟢 OK

---

### Componente 23: ClientOrcamentos.tsx
- **Caminho do Arquivo:** `src/components/client/ClientOrcamentos.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `orcamentos`, `loja_avaliacoes`, `loja_solicitacoes`
- **Filtros Aplicados:**
  - `orcamentos`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `loja_avaliacoes`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
  - `loja_solicitacoes`: `filter: clientId ? cliente_id=eq.${clientId} : undefined`
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange & onPayload:**
  - `onChange`: `fetchOrcamentosRef.current()`
  - `onPayload`: Detecta transição de status de negociação e alerta o usuário em tempo real
- **Configuração de Debounce:** `debounceMs: 300` na tabela `orcamentos`
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** Todas as 3 tabelas existem.
- **Classificação:** 🟢 OK

---

### Componente 24: ClientPontos.tsx
- **Caminho do Arquivo:** `src/components/client/ClientPontos.tsx`
- **Hook Utilizado:** `useRealtimeSubscription` (Canônico)
- **Tabelas Monitoradas:** `clientes`, `pontos_movimentacoes`
- **Filtros Aplicados:**
  - `clientes`: `filter: clienteId ? id=eq.${clienteId} : undefined`
  - `pontos_movimentacoes`: `filter: clienteId ? cliente_id=eq.${clienteId} : undefined`
- **Eventos Ouvidos:** `*`
- **Status de Cleanup:** ✅ Correto
- **Callback onChange:** Executa `fetchData()`
- **Configuração de Debounce:** `debounceMs: 150` em ambas as tabelas
- **Exibição de Status de Conexão na UI:** Silencioso
- **Existência no Schema SQL:** `clientes` e `pontos_movimentacoes` existem.
- **Classificação:** 🟢 OK
- **Recomendação Opcional:** Adicionar também subscrição à tabela `points_transactions` com `filter: clienteId ? cliente_id=eq.${clienteId} : undefined` para sincronização completa com novas tabelas de microserviços.

---

## 3. Matriz Consolidada de Anti-Patterns Identificados no Lote 1

| Anti-Pattern Detectado | Componente(s) Afetado(s) | Severidade | Ação Recomendada |
| :--- | :--- | :---: | :--- |
| **Nomes de Tabela Inexistentes no PostgreSQL CDC** | `AdvertisingAdminModule.tsx` (Comp 4), `CareersAdminModule.tsx` (Comp 12) | 🔴 / 🟡 | Corrigir para os nomes reais de schema (`gsa_ad_*`, `gsa_careers_applications`). |
| **Bucket de Storage Subscrito como Tabela SQL** | `AdminPrestadorDocumentos.tsx` (Comp 2) | 🟡 | Remover `documentos_prestador` da subscrição CDC. |
| **Dupla Subscrição (Raw Channel + Hook)** | `ClientAreaVIP.tsx` (Comp 17) | 🟡 | Eliminar `supabase.channel()` manual e centralizar no `useRealtimeSubscription`. |
| **Broadcast sem Filtro em Tabela de Alto Volume** | `AreaVipView.tsx` (Comp 8), `AdvertiserPortal.tsx` (Comp 3) | 🟡 | Adicionar `debounceMs: 500` e filtros de ID onde aplicável. |
| **Ausência de Debounce em Componentes Críticos** | `AfiliadosSection.tsx` (Comp 7), `AtendimentoTicketsView.tsx` (Comp 10) | 🟡 | Configurar `debounceMs` entre 150ms e 300ms. |

---

## 4. Conclusão do Lote 1

O Lote 1 (Componentes 1 a 24) apresentou uma taxa expressiva de conformidade com o hook canônico `useRealtimeSubscription` (100% dos 24 componentes utilizam o hook canônico, sem nenhum uso do hook legado `useRealtimeTable`).

Porém, foram detectados 1 bug crítico de tabela fantasma em publicidade (`AdvertisingAdminModule.tsx`), 1 erro de subscrição em bucket de storage (`AdminPrestadorDocumentos.tsx`) e 1 caso de subscrição duplicada (`ClientAreaVIP.tsx`), cujas correções foram detalhadas nas fichas técnicas acima.
