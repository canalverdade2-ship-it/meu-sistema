# Relatório de Auditoria de Realtime — Lote 3 (Componentes 49 a 72)

**Auditor:** Explorer R2 Batch 3  
**Data:** 2026-08-28  
**Escopo:** Componentes 49 a 72 do ecossistema GSA HUB  
**Diretório de Trabalho:** `.agents/explorer_r2_batch3`  

---

## 1. Resumo Executivo & Panorama do Lote

Foram auditados exaustivamente **24 componentes** (IDs 49 a 72) quanto ao uso e conformidade da infraestrutura Supabase Realtime (`useRealtimeSubscription`, `useRealtimeTable`, canais diretos `.channel()`).

### Classificação de Saúde:
- 🟢 **Conforme / OK (19 componentes):** 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 64, 68, 69, 70, 72.
- 🟡 **Alerta (2 componentes):** 63, 71 (Inscrições inertes sem callback `onChange`).
- 🔴 **Crítico (3 componentes):** 
  - **65 (`OrcamentosWorkstation.tsx`):** Inscrição duplicada na tabela `orcamentos` (hook legado `useRealtimeTable` + canal manual direto `supabase.channel()` com timestamp volátil em `useEffect`).
  - **66 (`OrdensAssinaturaModule.tsx`):** Violação grave de regras de Hooks do React — chamadas `useEffect` e `useRealtimeSubscription` foram aninhadas acidentalmente dentro do corpo assíncrono de `fetchOrdens()` sob a condição `if (filters.mes)`.
  - **67 (`OrdensCompraModule.tsx`):** Violação grave de regras de Hooks do React — chamadas `useEffect` e `useRealtimeSubscription` aninhadas dentro de `fetchOrdens()` sob `if (filters.mes)`.

---

## 2. Fichas Individuais de Auditoria (Componentes 49 a 72)

---

### Componente 49: FiscalView.tsx
- **Caminho:** `src/components/admin/super-domains/financeiro/FiscalView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 11, 83–88)
- **Tabelas monitoradas:** `ordens_fiscais`
- **Filtros aplicados:** Nenhum (broadcast da tabela inteira).
- **Eventos escutados:** `*` (INSERT, UPDATE, DELETE).
- **Status do Cleanup:** Gerenciado pelo hook `useRealtimeSubscription`.
- **Callback onChange:** `loadData` (estável, mas passado no array de `deps` `[loadData]`).
- **Debounce configurado:** ❌ Ausente (`debounceMs` não definido).
- **UI de Status de Conexão:** ❌ Silencioso (não exibe indicador de conexão).
- **Existência no Schema do Banco:** ✅ Confirmada (`ordens_fiscais` com REPLICA IDENTITY FULL).
- **Avaliação:** 🟢 **OK** (Recomenda-se adicionar `debounceMs: 300` e remover `[loadData]` do segundo argumento do hook para evitar reconexões desnecessárias ao alternar abas).

---

### Componente 50: FluxoCaixaView.tsx
- **Caminho:** `src/components/admin/super-domains/financeiro/FluxoCaixaView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 13, 113–121)
- **Tabelas monitoradas:** `saques`, `transferencias` (Array de 2 configs).
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `fetchSaques` e `fetchTransferencias`.
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (`saques` e `transferencias` presentes e ativas).
- **Avaliação:** 🟢 **OK** (Recomenda-se adicionar `debounceMs: 300` para amortecer concorrência de saques/transferências).

---

### Componente 51: FornecedoresModule.tsx
- **Caminho:** `src/components/admin/FornecedoresModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 11, 111–122)
- **Tabelas monitoradas (8 tabelas):** `fornecedores`, `ordens_compra`, `produto_fornecedor_config`, `produtos`, `fornecedor_produtos`, `fornecedor_pedidos`, `fornecedor_entregas`, `fornecedor_documentos`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `fetchData` / `fetchOrdensCompra`.
- **Debounce configurado:** ✅ Presente (`debounceMs: 300` em todas as 8 tabelas).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (todas as 8 tabelas existem nas migrações do banco).
- **Avaliação:** 🟢 **OK** (Excelente padrão de assinatura multi-tabela com debounce de 300ms).

---

### Componente 52: FornecedoresSection.tsx
- **Caminho:** `src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 17, 300–310)
- **Tabelas monitoradas (3 tabelas):** `parceiros`, `parceiros_resgates`, `fornecedores`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `fetchData` / `fetchResgates`.
- **Debounce configurado:** ✅ Presente (`debounceMs: 300`).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (`parceiros`, `parceiros_resgates`, `fornecedores`).
- **Avaliação:** 🟢 **OK**.

---

### Componente 53: GovernancaAcessosView.tsx
- **Caminho:** `src/components/admin/super-domains/governanca/GovernancaAcessosView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 118–123)
- **Tabelas monitoradas (4 tabelas):** `colaboradores`, `funcoes`, `solicitacoes_exclusao`, `admin_sessoes`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `loadData`.
- **Debounce configurado:** ❌ Ausente (recomenda-se 300ms devido ao tráfego frequente em `admin_sessoes`).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK**.

---

### Componente 54: GovernancaAuditoriaView.tsx
- **Caminho:** `src/components/admin/super-domains/governanca/GovernancaAuditoriaView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 124–128)
- **Tabelas monitoradas (3 tabelas):** `sistema_logs`, `solicitacoes_exclusao`, `system_settings`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `loadLogs`.
- **Debounce configurado:** ❌ Ausente (recomenda-se 500ms para evitar tempestade de re-render com inserções contínuas em `sistema_logs`).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK**.

---

### Componente 55: GovernancaConfiguracoesView.tsx
- **Caminho:** `src/components/admin/super-domains/governanca/GovernancaConfiguracoesView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 78–82)
- **Tabelas monitoradas (3 tabelas):** `system_settings`, `payment_methods`, `configuracoes`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `loadConfigs`.
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK**.

---

### Componente 56: GovernancaExecutiveDashboard.tsx
- **Caminho:** `src/components/admin/super-domains/governanca/GovernancaExecutiveDashboard.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 106–114)
- **Tabelas monitoradas (7 tabelas):** `clientes`, `faturas`, `saques`, `prestador_demandas`, `ordens_servico`, `colaboradores`, `sistema_logs`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `loadDashboardData` (executa RPC pesado `gsa_admin_dashboard_snapshot`).
- **Debounce configurado:** ❌ Ausente (recomenda-se fortemente `debounceMs: 500` devido ao custo computacional da RPC agregadora).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK**.

---

### Componente 57: GovernancaInfraView.tsx
- **Caminho:** `src/components/admin/super-domains/governanca/GovernancaInfraView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 11, 149–154)
- **Tabelas monitoradas (4 tabelas):** `colaboradores`, `clientes`, `system_settings`, `gsa_whatsapp_ramais`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `loadData`.
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK**.

---

### Componente 58: GsaSaudeView.tsx
- **Caminho:** `src/components/admin/super-domains/contratos/GsaSaudeView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 71–76)
- **Tabelas monitoradas:** `saude_contratos`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `fetchSaude`.
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (`saude_contratos`).
- **Avaliação:** 🟢 **OK**.

---

### Componente 59: GsaSegurosView.tsx
- **Caminho:** `src/components/admin/super-domains/contratos/GsaSegurosView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 73)
- **Tabelas monitoradas:** `seguros_apolices`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `fetchSeguros`.
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (`seguros_apolices`).
- **Avaliação:** 🟢 **OK**.

---

### Componente 60: GsaTvModule.tsx
- **Caminho:** `src/components/admin/GsaTvModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 57, 352–360)
- **Tabelas monitoradas (7 tabelas):** `gsa_tv_channels`, `gsa_tv_media_items`, `gsa_tv_schedule_slots`, `gsa_tv_playlists`, `gsa_tv_incidents`, `gsa_tv_audit_log`, `gsa_tv_jobs`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `loadRealData` (estabilizado via `useCallback`).
- **Debounce configurado:** ✅ Presente (`debounceMs: 500` em todas as 7 tabelas).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (migrações 001 a 008 do subsistema GSA TV).
- **Avaliação:** 🟢 **OK**.

---

### Componente 61: HubEmpresasView.tsx
- **Caminho:** `src/components/admin/super-domains/contratos/HubEmpresasView.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 97)
- **Tabelas monitoradas:** `clientes`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `fetchEmpresas`.
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK**.

---

### Componente 62: NovaDemandaModal.tsx
- **Caminho:** `src/components/admin/demandas/NovaDemandaModal.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 68–72)
- **Tabelas monitoradas (3 tabelas):** `ordens_servico`, `colaboradores`, `prestadores`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto (desinscreve ao fechar o modal).
- **Callback onChange:** `fetchData`.
- **Debounce configurado:** ✅ Presente (`debounceMs: 300`).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK**.

---

### Componente 63: NovoPrestadorDrawer.tsx
- **Caminho:** `src/components/admin/super-domains/pessoas/NovoPrestadorDrawer.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 10, 27)
  ```tsx
  useRealtimeSubscription({ table: 'prestadores', enabled: isOpen });
  ```
- **Tabelas monitoradas:** `prestadores`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto (`enabled: isOpen` fecha canal quando gaveta é fechada).
- **Callback onChange:** ❌ **Ausente**. O hook foi chamado sem callback `onChange` ou `onPayload`.
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟡 **Alerta** (Inscrição inerte: mantém conexão aberta sem executar nenhuma ação quando eventos chegam. Como o drawer é apenas um formulário de criação de prestador, o hook pode ser removido com segurança ou receber um callback útil).

---

### Componente 64: OperacoesSuperDomain.tsx
- **Caminho:** `src/components/admin/super-domains/operacoes/OperacoesSuperDomain.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 9, 117–122)
- **Tabelas monitoradas (4 tabelas):** `orcamentos`, `ordens_servico`, `prestador_demandas`, `ordens_compra`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `fetchLiveMetrics`.
- **Debounce configurado:** ✅ Presente (`debounceMs: 400`).
- **UI de Status de Conexão:** Badge estático `online`.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK**.

---

### Componente 65: OrcamentosWorkstation.tsx
- **Caminho:** `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx`
- **Hook utilizado:** 🔴 Duplo mecanismo anti-padrão:
  1. `useRealtimeTable(['orcamentos', 'ordens_servico'], () => setRtRefreshKey(k => k + 1));` (linha 48, hook legado que altera estado não utilizado).
  2. Manual `supabase.channel('admin-orcamentos-sd1-' + Date.now())` dentro de `useEffect([statusFilter])` (linhas 152–172).
- **Tabelas monitoradas:** `orcamentos` (duplicada), `ordens_servico`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** Parcial/redundante.
- **Callback onChange:** `debouncedFetch` no canal manual; atualização inútil de `setRtRefreshKey` no hook legado.
- **Debounce configurado:** 400ms no canal manual; ausente no `useRealtimeTable`.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🔴 **Crítico** (Anti-padrão grave de dupla inscrição concorrente, uso de hook legado e criação de canal manual com timestamp volátil. Deve ser unificado em uma única chamada de `useRealtimeSubscription`).

---

### Componente 66: OrdensAssinaturaModule.tsx
- **Caminho:** `src/components/admin/OrdensAssinaturaModule.tsx`
- **Hook utilizado:** 🔴 `useRealtimeSubscription` e `useEffect` violando regras de Hooks do React (linhas 104–114).
  ```tsx
  if (filters.mes) {
    useEffect(() => {
      fetchOrdens();
    }, [activeTab, search, filters]);

    useRealtimeSubscription([
      { table: 'ordens_assinatura', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'assinaturas', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'faturas', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'orcamentos', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'clientes', onChange: fetchOrdens, debounceMs: 300 },
    ], [activeTab, search, filters]);
    ...
  }
  ```
- **Tabelas monitoradas (5 tabelas):** `ordens_assinatura`, `assinaturas`, `faturas`, `orcamentos`, `clientes`.
- **Filtros aplicados:** Nenhum no Realtime; no fetch há filtro condicional.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** 🔴 Quebrado caso o usuário selecione filtro de mês, pois o hook é chamado condicionalmente dentro de função assíncrona gerando exceção no runtime do React.
- **Debounce configurado:** `debounceMs: 300`.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🔴 **Crítico** (Bug de escopo: `useEffect` e `useRealtimeSubscription` colados indevidamente no meio do `fetchOrdens()` dentro de `if (filters.mes)`. Devem ser movidos para o nível superior do componente).

---

### Componente 67: OrdensCompraModule.tsx
- **Caminho:** `src/components/admin/OrdensCompraModule.tsx`
- **Hook utilizado:** 🔴 `useRealtimeSubscription` e `useEffect` violando regras de Hooks do React (linhas 100–112).
  ```tsx
  if (filters.mes) {
    useEffect(() => {
      fetchOrdens();
    }, [activeTab, search, filters]);

    useRealtimeSubscription([
      { table: 'ordens_compra', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'produtos', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'faturas', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'cupons_loja', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'orcamentos', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'clientes', onChange: fetchOrdens, debounceMs: 300 },
      { table: 'pagamentos', onChange: fetchOrdens, debounceMs: 300 },
    ], [activeTab, search, filters]);
    ...
  }
  ```
- **Tabelas monitoradas (7 tabelas):** `ordens_compra`, `produtos`, `faturas`, `cupons_loja`, `orcamentos`, `clientes`, `pagamentos`.
- **Status do Cleanup:** 🔴 Quebrado sob ativação de filtro de mês (crash de Hook inválido).
- **Debounce configurado:** `debounceMs: 300`.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🔴 **Crítico** (Mesmo erro estrutural do Componente 66. Mover `useEffect` e `useRealtimeSubscription` para o nível raiz da função `OrdensCompraModule`).

---

### Componente 68: PartnersAdminModule.tsx
- **Caminho:** `src/components/admin/PartnersAdminModule.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 20, 130–134)
- **Tabelas monitoradas:** `parceiros`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `() => void load()`.
- **Debounce configurado:** ✅ Presente (`debounceMs: 300`).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (`parceiros`).
- **Avaliação:** 🟢 **OK**.

---

### Componente 69: PartnersPage.tsx
- **Caminho:** `src/components/public/PartnersPage.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 30, 139–143)
- **Tabelas monitoradas:** `parceiros`
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `() => setReloadKey((k) => k + 1)`.
- **Debounce configurado:** ✅ Presente (`debounceMs: 300`).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (`parceiros`).
- **Avaliação:** 🟢 **OK**.

---

### Componente 70: PaymentModal.tsx
- **Caminho:** `src/components/client/financeiro/PaymentModal.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 15, 85–104)
  ```tsx
  useRealtimeSubscription(
    [
      {
        table: 'clientes',
        filter: fatura?.cliente_id ? `id=eq.${fatura.cliente_id}` : undefined,
        enabled: isOpen && Boolean(fatura?.cliente_id),
        onChange: fetchClientData,
      },
      {
        table: 'vouchers',
        enabled: isOpen && Boolean(fatura?.cliente_id),
        onChange: () => {
          if (showVouchersList) {
            fetchAvailableVouchers();
          }
        },
      },
    ],
    [isOpen, fatura?.cliente_id, showVouchersList]
  );
  ```
- **Tabelas monitoradas:** `clientes`, `vouchers`.
- **Filtros aplicados:** ✅ `id=eq.${fatura.cliente_id}` na tabela `clientes` (filtro granular por linha).
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Perfeito (`enabled: isOpen`).
- **Callback onChange:** `fetchClientData` e `fetchAvailableVouchers` (sob condição).
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟢 **OK** (Exemplo de excelência no uso de filtro por linha e controle via `enabled`).

---

### Componente 71: PayoutClearanceDrawer.tsx
- **Caminho:** `src/components/admin/super-domains/pessoas/PayoutClearanceDrawer.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 13, 61–64)
  ```tsx
  useRealtimeSubscription([
    { table: 'prestador_saques', enabled: isOpen },
    { table: 'saques', enabled: isOpen }
  ]);
  ```
- **Tabelas monitoradas:** `prestador_saques`, `saques`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto (`enabled: isOpen`).
- **Callback onChange:** ❌ **Ausente**.
- **Debounce configurado:** ❌ Ausente.
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada.
- **Avaliação:** 🟡 **Alerta** (Inscrição inerte sem callback `onChange` ou `onPayload`).

---

### Componente 72: PessoasSuperDomain.tsx
- **Caminho:** `src/components/admin/super-domains/pessoas/PessoasSuperDomain.tsx`
- **Hook utilizado:** `useRealtimeSubscription` (linhas 14, 121–128)
- **Tabelas monitoradas (6 tabelas):** `prestadores`, `prestador_saques`, `saques`, `fornecedores`, `gsa_afiliados`, `career_applications`.
- **Filtros aplicados:** Nenhum.
- **Eventos escutados:** `*`.
- **Status do Cleanup:** ✅ Correto.
- **Callback onChange:** `fetchDomainMetrics`.
- **Debounce configurado:** ❌ Ausente (recomenda-se `debounceMs: 300`).
- **UI de Status de Conexão:** ❌ Silencioso.
- **Existência no Schema do Banco:** ✅ Confirmada (todas as 6 tabelas existem e estão ativas).
- **Avaliação:** 🟢 **OK**.

---

## 3. Matriz Comparativa do Lote 3 (Componentes 49 a 72)

| # | Componente | Hook | Tabelas | Filtro | Debounce | Status | Avaliação |
|---|---|---|---|---|---|---|---|
| 49 | FiscalView.tsx | `useRealtimeSubscription` | `ordens_fiscais` | Não | Não | Silencioso | 🟢 OK |
| 50 | FluxoCaixaView.tsx | `useRealtimeSubscription` | `saques`, `transferencias` | Não | Não | Silencioso | 🟢 OK |
| 51 | FornecedoresModule.tsx | `useRealtimeSubscription` | 8 tabelas | Não | 300ms | Silencioso | 🟢 OK |
| 52 | FornecedoresSection.tsx | `useRealtimeSubscription` | `parceiros`, `parceiros_resgates`, `fornecedores` | Não | 300ms | Silencioso | 🟢 OK |
| 53 | GovernancaAcessosView.tsx | `useRealtimeSubscription` | `colaboradores`, `funcoes`, `solicitacoes_exclusao`, `admin_sessoes` | Não | Não | Silencioso | 🟢 OK |
| 54 | GovernancaAuditoriaView.tsx | `useRealtimeSubscription` | `sistema_logs`, `solicitacoes_exclusao`, `system_settings` | Não | Não | Silencioso | 🟢 OK |
| 55 | GovernancaConfiguracoesView.tsx | `useRealtimeSubscription` | `system_settings`, `payment_methods`, `configuracoes` | Não | Não | Silencioso | 🟢 OK |
| 56 | GovernancaExecutiveDashboard.tsx | `useRealtimeSubscription` | 7 tabelas | Não | Não | Silencioso | 🟢 OK |
| 57 | GovernancaInfraView.tsx | `useRealtimeSubscription` | `colaboradores`, `clientes`, `system_settings`, `gsa_whatsapp_ramais` | Não | Não | Silencioso | 🟢 OK |
| 58 | GsaSaudeView.tsx | `useRealtimeSubscription` | `saude_contratos` | Não | Não | Silencioso | 🟢 OK |
| 59 | GsaSegurosView.tsx | `useRealtimeSubscription` | `seguros_apolices` | Não | Não | Silencioso | 🟢 OK |
| 60 | GsaTvModule.tsx | `useRealtimeSubscription` | 7 tabelas `gsa_tv_*` | Não | 500ms | Silencioso | 🟢 OK |
| 61 | HubEmpresasView.tsx | `useRealtimeSubscription` | `clientes` | Não | Não | Silencioso | 🟢 OK |
| 62 | NovaDemandaModal.tsx | `useRealtimeSubscription` | `ordens_servico`, `colaboradores`, `prestadores` | Não | 300ms | Silencioso | 🟢 OK |
| 63 | NovoPrestadorDrawer.tsx | `useRealtimeSubscription` | `prestadores` | Não | Não | Silencioso | 🟡 Alerta (Inerte) |
| 64 | OperacoesSuperDomain.tsx | `useRealtimeSubscription` | `orcamentos`, `ordens_servico`, `prestador_demandas`, `ordens_compra` | Não | 400ms | Online Badge | 🟢 OK |
| 65 | OrcamentosWorkstation.tsx | `useRealtimeTable` + `.channel()` | `orcamentos` (2x), `ordens_servico` | Não | 400ms | Silencioso | 🔴 Crítico (Duplicidade) |
| 66 | OrdensAssinaturaModule.tsx | `useRealtimeSubscription` | 5 tabelas | Não | 300ms | Silencioso | 🔴 Crítico (Hook Rules) |
| 67 | OrdensCompraModule.tsx | `useRealtimeSubscription` | 7 tabelas | Não | 300ms | Silencioso | 🔴 Crítico (Hook Rules) |
| 68 | PartnersAdminModule.tsx | `useRealtimeSubscription` | `parceiros` | Não | 300ms | Silencioso | 🟢 OK |
| 69 | PartnersPage.tsx | `useRealtimeSubscription` | `parceiros` | Não | 300ms | Silencioso | 🟢 OK |
| 70 | PaymentModal.tsx | `useRealtimeSubscription` | `clientes`, `vouchers` | Sim (`id=eq...`) | Não | Silencioso | 🟢 OK |
| 71 | PayoutClearanceDrawer.tsx | `useRealtimeSubscription` | `prestador_saques`, `saques` | Não | Não | Silencioso | 🟡 Alerta (Inerte) |
| 72 | PessoasSuperDomain.tsx | `useRealtimeSubscription` | 6 tabelas | Não | Não | Silencioso | 🟢 OK |

---

## 4. Propostas de Correção de Código (Snippets)

### 4.1 Correção para Componente 65 (`OrcamentosWorkstation.tsx`)
Substituir a declaração dupla por uma chamada única e limpa de `useRealtimeSubscription`:

```tsx
// ANTES (OrcamentosWorkstation.tsx linhas 8, 47-48, 152-172):
import { useRealtimeTable } from '../../../../hooks/useRealtimeTable';
...
const [, setRtRefreshKey] = useState(0);
useRealtimeTable(['orcamentos', 'ordens_servico'], () => setRtRefreshKey(k => k + 1));
...
useEffect(() => {
  let timeoutId: NodeJS.Timeout;
  const debouncedFetch = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fetchOrcamentos();
    }, 400);
  };

  const channel = supabase
    .channel(`admin-orcamentos-sd1-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => {
      debouncedFetch();
    })
    .subscribe();

  return () => {
    clearTimeout(timeoutId);
    supabase.removeChannel(channel);
  };
}, [statusFilter]);

// DEPOIS (Canônico):
import { useRealtimeSubscription } from '../../../../hooks/useRealtime';
...
useRealtimeSubscription([
  { table: 'orcamentos', onChange: fetchOrcamentos, debounceMs: 400 },
  { table: 'ordens_servico', onChange: fetchOrcamentos, debounceMs: 400 }
]);
```

---

### 4.2 Correção para Componentes 66 e 67 (`OrdensAssinaturaModule.tsx` e `OrdensCompraModule.tsx`)
Mover o `useEffect` e o `useRealtimeSubscription` de dentro da função `fetchOrdens()` para o nível superior do componente:

```tsx
// DEPOIS (Nível Raiz do Componente):
export function OrdensAssinaturaModule({ ... }) {
  // Estados...
  
  const fetchOrdens = async () => {
    let selectStr = '*, assinaturas(nome, valor), clientes(nome), faturas(*), orcamentos(*)';
    if (search) {
      selectStr = '*, assinaturas!inner(nome, valor), clientes(nome), faturas(*), orcamentos(*)';
    }

    let query = supabase.from('ordens_assinatura').select(selectStr);

    if (activeTab === 'processamento') {
      query = query.in('status', ['em_analise', 'pendente', 'pago']);
    } else if (activeTab === 'concluido') {
      query = query.in('status', ['concluido', 'em_cancelamento']);
    } else {
      query = query.eq('status', 'cancelado');
    }
    
    if (search) {
      query = query.ilike('assinaturas.nome', `%${search}%`);
    }

    if (filters.mes) {
      const year = filters.ano || new Date().getFullYear();
      const startDate = `${year}-${filters.mes}-01`;
      const endDate = `${year}-${filters.mes}-${String(new Date(Number(year), Number(filters.mes), 0).getDate()).padStart(2, '0')}`;
      query = query.gte('data_criacao', startDate).lte('data_criacao', endDate);
    }

    const { data, error } = await query.order('data_criacao', { ascending: false });
    if (error) {
      console.error('Error fetching ordens_assinatura:', error);
      toast.error('Erro ao carregar ordens de assinatura.');
    }
    if (data) {
      setOrdens(data);
    }
  };

  useEffect(() => {
    fetchOrdens();
  }, [activeTab, search, filters]);

  useRealtimeSubscription([
    { table: 'ordens_assinatura', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'assinaturas', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'faturas', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'orcamentos', onChange: fetchOrdens, debounceMs: 300 },
    { table: 'clientes', onChange: fetchOrdens, debounceMs: 300 },
  ]);
```
