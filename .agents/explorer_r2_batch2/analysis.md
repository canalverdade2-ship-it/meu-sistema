# Relatório de Auditoria Técnica de Realtime — Lote 2 (Componentes 25 a 48)

**Data**: 28 de Agosto de 2026  
**Auditor**: Explorer R2 Batch 2  
**Escopo**: 24 componentes do GSA HUB (Componentes 25 a 48)  
**Diretório de Trabalho**: `.agents/explorer_r2_batch2`

---

## 1. Resumo Executivo e Sumário Estatístico

| Métrica | Valor |
|---|---|
| Total de Componentes Auditados | 24 |
| Componentes em Conformidade Total (🟢 OK) | 19 |
| Componentes com Alertas / Otimizações Recomendadas (🟡 Alerta) | 3 |
| Componentes com Vulnerabilidades / Erros Críticos (🔴 Crítico) | 2 |
| Componentes usando Hook Canônico `useRealtimeSubscription` | 23 |
| Componentes usando Hook Legado (`useRealtimeTable`) | 1 (`ConfiguracoesModule.tsx`) |
| Componentes com Criação Manual de Canais Supabase (`supabase.channel`) | 1 (`ClientServicos.tsx` em subcomponentes) |
| Total de Tabelas Monitoradas no Lote | 29 tabelas distintas |

### Classificação dos Componentes

- 🔴 **Crítico (2)**:
  - **Componente 26 (`ClientProfile.tsx`)**: Inscrição em tabela inexistente `documentos_cliente` (é um Storage Bucket, não tabela DB); callback em `clientes` não recarrega os dados do perfil do cliente.
  - **Componente 32 (`ConfiguracoesModule.tsx`)**: Uso de hook legado `useRealtimeTable` com bug de estado — `rtRefreshKey` não consta na lista de dependências do `useEffect`, fazendo com que atualizações no realtime nunca disparem o reload das configurações.
- 🟡 **Alerta (3)**:
  - **Componente 25 (`ClientProdutos.tsx`)**: Tabela `orcamentos` não monitorada em realtime apesar de ser consumida em `fetchOrders()`; `produtos` monitorada globalmente sem filtro.
  - **Componente 27 (`ClientServicos.tsx`)**: Broadcast global não filtrado de `os_notas` e `os_suporte_mensagens` no componente pai; subcomponentes filhos usam `supabase.channel()` direto com nomes estáticos de canal sujeitos a colisão.
  - **Componente 29 (`ClientTransferencias.tsx`)**: Tabela `transferencias` monitorada globalmente sem filtro de cliente (recebe eventos de todas as transferências do sistema).
- 🟢 **OK (19)**:
  - Componentes 28, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48.

---

## 2. Fichas Técnicas de Auditoria Detalhada (Componentes 25 a 48)

---

### Componente 25: `ClientProdutos.tsx`
- **Caminho**: `src/components/client/ClientProdutos.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 88–106)
- **Tabelas Monitoradas**:
  1. `ordens_compra` (filtro: `cliente_id=eq.${clientId}`)
  2. `produtos` (sem filtro — catálogo)
  3. `faturas` (filtro: `cliente_id=eq.${clientId}`)
- **Eventos Monitorados**: Padrão (`*`)
- **Limpeza de Subscrição (Cleanup)**: Gerenciada automaticamente via unmount pelo `useRealtimeSubscription`.
- **Callbacks `onChange` / `onPayload`**:
  - `ordens_compra` -> `fetchOrders()`
  - `produtos` -> `fetchProdutos()`
  - `faturas` -> `fetchFaturas()`
- **Debounce Configurado**: Não configurado explicitamente (utiliza o padrão do hook).
- **Indicador Visual de Status**: Silencioso (sem indicador na UI).
- **Existência no Schema do Banco**:
  - `ordens_compra`: ✅ Existe (`master_supabase_schema.sql:108`)
  - `produtos`: ✅ Existe (`master_supabase_schema.sql:84`)
  - `faturas`: ✅ Existe (`master_supabase_schema.sql:128`)
- **Avaliação**: 🟢 OK / 🟡 Alerta
- **Recomendações**:
  - `fetchOrders()` busca tanto `ordens_compra` quanto `orcamentos`. No entanto, a tabela `orcamentos` não está na lista de subscrições realtime do cliente. Recomenda-se adicionar `{ table: 'orcamentos', filter: 'cliente_id=eq.' + clientId, onChange: fetchOrders }`.

---

### Componente 26: `ClientProfile.tsx`
- **Caminho**: `src/components/client/ClientProfile.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 150–169)
- **Tabelas Monitoradas**:
  1. `cliente_documentos` (filtro: `cliente_id=eq.${cliente.id}`)
  2. `documentos_cliente` (filtro: `cliente_id=eq.${cliente.id}`) — ⚠️ **ERRO CRÍTICO**
  3. `clientes` (filtro: `id=eq.${cliente.id}`)
- **Eventos Monitorados**: Padrão (`*`)
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Callbacks `onChange` / `onPayload`**:
  - Todas as tabelas disparam `fetchDocumentos()`.
- **Debounce Configurado**: Não configurado.
- **Indicador Visual de Status**: Silencioso.
- **Existência no Schema do Banco**:
  - `cliente_documentos`: ✅ Existe (`master_supabase_schema.sql:64`)
  - `documentos_cliente`: ❌ **NÃO EXISTE**. É o nome do Storage Bucket no Supabase/R2, não uma tabela Postgres! O Supabase Realtime rejeita ou cria canal inoperante para essa entrada.
  - `clientes`: ✅ Existe (`master_supabase_schema.sql:46`)
- **Avaliação**: 🔴 Crítico / 🟡 Alerta
- **Problemas Identificados**:
  1. `documentos_cliente` registrado como tabela no Realtime causa erro de assinatura silencioso.
  2. Quando a tabela `clientes` sofre UPDATE (ex: alteração de endereço ou saldo pelo admin), o callback chama apenas `fetchDocumentos()`, deixando os dados do cliente na tela desatualizados (o prop `cliente` é estático e não é recarregado nem notifica o componente pai).
- **Recomendações**:
  - Remover a assinatura da pseudo-tabela `documentos_cliente`.
  - Adicionar callback no evento de `clientes` para disparar atualização dos dados cadastrais do cliente ou notificar o layout pai.

---

### Componente 27: `ClientServicos.tsx`
- **Caminho**: `src/components/client/ClientServicos.tsx`
- **Hooks Utilizados**:
  1. `useRealtimeSubscription` no componente principal `ClientServicos` (linhas 137–142).
  2. `supabase.channel('notas-updates')` manual no subcomponente `OSNotas` (linhas 535–546).
  3. `supabase.channel('os-suporte-chat')` manual no subcomponente `OSSuporteChat` (linhas 806–817).
- **Tabelas Monitoradas**:
  - Em `ClientServicos`: `ordens_servico` (filtro: `cliente_id=eq.${clientId}`), `orcamentos` (filtro: `cliente_id=eq.${clientId}`), `os_notas` (**SEM FILTRO**), `os_suporte_mensagens` (**SEM FILTRO**).
  - Em `OSNotas`: `os_notas` (filtro: `os_id=eq.${osId}`).
  - Em `OSSuporteChat`: `os_suporte_mensagens` (filtro: `os_id=eq.${osId}`).
- **Limpeza de Subscrição (Cleanup)**:
  - `ClientServicos`: Gerenciada pelo hook `useRealtimeSubscription`.
  - Subcomponentes: `supabase.removeChannel(channel)` no `useEffect` cleanup.
- **Avaliação**: 🟡 Alerta
- **Problemas Identificados**:
  1. No componente pai `ClientServicos`, `os_notas` e `os_suporte_mensagens` são assinadas globalmente sem filtro `os_id` ou `cliente_id`. Qualquer mensagem ou nota de qualquer cliente na plataforma inteira aciona o recarregamento de todas as ordens de serviço deste cliente.
  2. Uso de nomes fixos de canais (`'notas-updates'` e `'os-suporte-chat'`) em vez de canais com identificador único (`notas-updates-${osId}-${Date.now()}`), gerando risco de colisão de canais no client Supabase.
  3. Duplicação de subscrições entre o pai e os modais filhos.
- **Recomendações**:
  - Remover `os_notas` e `os_suporte_mensagens` do hook do componente pai, delegando a subscrição exclusivamente aos subcomponentes focados (`OSNotas` e `OSSuporteChat`), ou migrar ambos os subcomponentes para o hook canônico `useRealtimeSubscription`.

---

### Componente 28: `ClientSuporte.tsx`
- **Caminho**: `src/components/client/ClientSuporte.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (duas instâncias):
  - Instância 1 (linhas 83–93): Lista de tickets (`table: 'tickets'`, filtro: `cliente_id=eq.${clientId}`).
  - Instância 2 (linhas 162–178): Chat do ticket selecionado (`enabled: Boolean(selectedTicket?.id && isChatOpen)`), monitorando `ticket_mensagens` (filtro: `ticket_id=eq.${selectedTicket.id}`) e `tickets` (filtro: `id=eq.${selectedTicket.id}`).
- **Eventos Monitorados**: Padrão (`*`), com tratamento otimizado de payload INSERT em `onPayload` para mensagens novas.
- **Limpeza de Subscrição (Cleanup)**: Impecável, controlada condicionalmente por `enabled` e unmount.
- **Debounce**: Não requerido (chat em tempo real de baixa latência).
- **Indicador Visual de Status**: Silencioso.
- **Existência no Schema do Banco**: `tickets` e `ticket_mensagens` existem e estão ativas na publicação realtime.
- **Avaliação**: 🟢 OK (Padrão de referência para chat com realtime condicional).

---

### Componente 29: `ClientTransferencias.tsx`
- **Caminho**: `src/components/client/ClientTransferencias.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 67–93)
- **Tabelas Monitoradas**:
  1. `transferencias` (**SEM FILTRO**)
  2. `clientes` (filtro: `id=eq.${clientId}`)
  3. `pontos_movimentacoes` (filtro: `cliente_id=eq.${clientId}`)
  4. `saques` (filtro: `cliente_id=eq.${clientId}`)
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟡 Alerta
- **Problemas Identificados**:
  - A tabela `transferencias` não possui filtro de linha por cliente (`cliente_origem_id` / `cliente_destino_id`), recebendo notificações de todas as transferências de pontos/saldo de todos os usuários do sistema.
- **Recomendações**:
  - Dividir a subscrição de `transferencias` em dois filtros: `cliente_origem_id=eq.${clientId}` e `cliente_destino_id=eq.${clientId}`, ou configurar `debounceMs: 500` para mitigar recarregamentos excessivos.

---

### Componente 30: `ClientVouchers.tsx`
- **Caminho**: `src/components/client/ClientVouchers.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 50–77)
- **Tabelas Monitoradas**: `vouchers`, `cupons_loja`, `cupons_ativados`, `clientes` (filtro: `id=eq.${clientId}`).
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK / 🟡 Alerta
- **Problemas Identificados**:
  - Na configuração da tabela `vouchers`, tanto `onPayload` quanto `onChange` executam `fetchVouchers()`, gerando dupla execução da consulta a cada evento recebido.
- **Recomendações**:
  - Manter apenas `onChange: fetchVouchers` ou `onPayload`.

---

### Componente 31: `CobrancaView.tsx`
- **Caminho**: `src/components/admin/super-domains/financeiro/CobrancaView.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 181–185)
- **Tabelas Monitoradas**: `cobrancas`, `cobranca_historico`, `cobranca_acordo_parcelas`
- **Filtros**: Nenhum (visão administrativa completa de régua de cobrança).
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Existência no Schema do Banco**: Todas as tabelas existem no schema e possuem identidade de réplica ativa.
- **Avaliação**: 🟢 OK

---

### Componente 32: `ConfiguracoesModule.tsx`
- **Caminho**: `src/components/admin/ConfiguracoesModule.tsx`
- **Hook Utilizado**: `useRealtimeTable` (linhas 4 & 27 — **HOOK LEGADO**)
- **Tabelas Monitoradas**: `system_settings`
- **Avaliação**: 🔴 Crítico
- **Problemas Identificados**:
  1. O componente utiliza o hook obsoleto `useRealtimeTable` em vez do canônico `useRealtimeSubscription`.
  2. O hook legado atualiza o estado local `rtRefreshKey` via `setRtRefreshKey(k => k + 1)`. No entanto, o `useEffect` que executa a função `load()` possui a lista de dependências `[adminType]` (linha 42), omitindo `rtRefreshKey`. Como resultado, qualquer alteração na tabela `system_settings` nunca aciona a recarga das configurações na tela.
- **Recomendações**:
  - Migrar para `useRealtimeSubscription({ table: 'system_settings', onChange: () => void load() }, [load])`.

---

### Componente 33: `ContratosDocumentosView.tsx`
- **Caminho**: `src/components/admin/super-domains/contratos/ContratosDocumentosView.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linha 103)
- **Tabelas Monitoradas**: `contratos`
- **Filtros**: Nenhum (visão administrativa de contratos).
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Existência no Schema do Banco**: `public.contratos` existe (`20260826220000_production_remediation_consolidated.sql:20`).
- **Avaliação**: 🟢 OK

---

### Componente 34: `CreateListingWizard.tsx`
- **Caminho**: `src/components/client/marketplace/classifieds/CreateListingWizard.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 77–86)
- **Tabelas Monitoradas**: `classificados_comissoes_config`
- **Debounce**: `debounceMs: 300`
- **Filtros**: Nenhum (tabela de configuração de comissões de classificados por categoria).
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Existência no Schema do Banco**: `classificados_comissoes_config` existe e possui RLS habilitado.
- **Avaliação**: 🟢 OK

---

### Componente 35: `CrmClientesView.tsx`
- **Caminho**: `src/components/admin/super-domains/contratos/CrmClientesView.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linha 149)
- **Tabelas Monitoradas**: `clientes`
- **Filtros**: Nenhum (visão administrativa CRM 360).
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Existência no Schema do Banco**: `clientes` existe com cobertura completa de replica identity.
- **Avaliação**: 🟢 OK

---

### Componente 36: `Dashboard.tsx` (Admin Central Dashboard)
- **Caminho**: `src/components/admin/Dashboard.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 211–225)
- **Tabelas Monitoradas (13 tabelas)**:
  `faturas`, `cobrancas`, `saques`, `emprestimos`, `orcamentos`, `ordens_servico`, `ordens_fiscais`, `tickets`, `clientes`, `ordens_compra`, `vouchers`, `prestador_demandas`, `promocoes`.
- **Debounce**: `debounceMs: 500` em todas as 13 tabelas.
- **Mecanismos de Resiliência**: Polling heartbeat de 60 segundos (`window.setInterval`) + listener de `visibilitychange` para abas em segundo plano.
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK (Excelente arquitetura de agregação e debouncing centralizado).

---

### Componente 37: `DemandasColaboradorModule.tsx`
- **Caminho**: `src/components/admin/DemandasColaboradorModule.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 149–166)
- **Tabelas Monitoradas (7 tabelas)**:
  `prestador_demandas`, `prestador_demandas_historico` (com `onPayload` granular para histórico da demanda aberta), `demanda_comentarios`, `os_notas`, `os_suporte_mensagens`, `colaboradores`, `prestadores`.
- **Debounce**: `debounceMs: 300` em todas as 7 tabelas.
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 38: `DemandasComentarios.tsx`
- **Caminho**: `src/components/admin/demandas/DemandasComentarios.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 39–44)
- **Tabelas Monitoradas**: `demanda_comentarios`
- **Filtros**: `filter: demanda_id=eq.${demandaId}` (filtro de linha granular).
- **Debounce**: `debounceMs: 100`
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 39: `DemandasDashboard.tsx`
- **Caminho**: `src/components/admin/demandas/DemandasDashboard.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 84–88)
- **Tabelas Monitoradas**: `prestador_demandas`, `colaboradores`, `prestadores`.
- **Debounce**: `debounceMs: 300`
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 40: `DemandasDetalhesModal.tsx`
- **Caminho**: `src/components/admin/demandas/DemandasDetalhesModal.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 130–147)
- **Tabelas Monitoradas**:
  1. `prestador_demandas` (filtro: `id=eq.${demanda.id}`)
  2. `prestador_demandas_historico` (filtro: `demanda_id=eq.${demanda.id}`)
- **Debounce**: `debounceMs: 300`
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 41: `EcommerceHeader.tsx`
- **Caminho**: `src/components/client/store/EcommerceHeader.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 234–271)
- **Tabelas Monitoradas**:
  1. `loja_carrinhos` (filtro: `cliente_id=eq.${clientId}`)
  2. `clientes` (filtro: `id=eq.${clientId}`)
- **Debounce**: `debounceMs: 100`
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 42: `EcommerceHome.tsx`
- **Caminho**: `src/components/client/store/EcommerceHome.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 416–437)
- **Tabelas Monitoradas**:
  1. `produtos` (debounce: 300ms, sem filtro — vitrine global)
  2. `loja_carrinhos` (filtro: `cliente_id=eq.${clientId}`)
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 43: `EditClassifiedListingPage.tsx`
- **Caminho**: `src/components/client/marketplace/classifieds/EditClassifiedListingPage.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 84–100)
- **Tabelas Monitoradas**:
  1. `classificados_anuncios` (filtro: `id=eq.${anuncioId}`)
  2. `classificados_midias` (filtro: `anuncio_id=eq.${anuncioId}`)
- **Debounce**: `debounceMs: 300`
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 44: `EmprestimosCreditoView.tsx`
- **Caminho**: `src/components/admin/super-domains/financeiro/EmprestimosCreditoView.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 134–138)
- **Tabelas Monitoradas**: `emprestimos`, `emprestimo_parcelas`, `loja_credito_solicitacoes`.
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 45: `FaturamentoView.tsx`
- **Caminho**: `src/components/admin/super-domains/financeiro/FaturamentoView.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 169–173)
- **Tabelas Monitoradas**: `faturas`, `cobrancas`, `ordens_fiscais`.
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 46: `FidelidadePromocoesSection.tsx`
- **Caminho**: `src/components/admin/super-domains/pessoas/FidelidadePromocoesSection.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 173–180)
- **Tabelas Monitoradas (6 tabelas)**:
  `vouchers`, `cliente_premios`, `pontos_movimentacoes`, `cupons_loja`, `loja_solicitacoes`, `indicacoes`.
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 47: `FinanceiroSuperDomain.tsx`
- **Caminho**: `src/components/admin/super-domains/financeiro/FinanceiroSuperDomain.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 115–120)
- **Tabelas Monitoradas**: `faturas`, `saques`, `cobrancas`, `ordens_fiscais`.
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

### Componente 48: `FiscalModule.tsx`
- **Caminho**: `src/components/admin/FiscalModule.tsx`
- **Hook Utilizado**: `useRealtimeSubscription` (linhas 82–85)
- **Tabelas Monitoradas**: `ordens_fiscais`, `faturas` (com `debounceMs: 300`).
- **Limpeza de Subscrição (Cleanup)**: Gerenciada pelo hook.
- **Avaliação**: 🟢 OK

---

## 3. Matriz de Cobertura e Recomendações de Correção

| Componente | Arquivo | Status | Correção Proposta |
|---|---|---|---|
| 25. ClientProdutos | `src/components/client/ClientProdutos.tsx` | 🟢 / 🟡 | Adicionar subscrição em `orcamentos` com filtro por `clientId`. |
| 26. ClientProfile | `src/components/client/ClientProfile.tsx` | 🔴 Crítico | Remover pseudo-tabela `documentos_cliente`; atualizar dados do cliente no evento da tabela `clientes`. |
| 27. ClientServicos | `src/components/client/ClientServicos.tsx` | 🟡 Alerta | Remover broadcast global de `os_notas` e `os_suporte_mensagens` do pai; usar IDs dinâmicos de canal nos filhos. |
| 28. ClientSuporte | `src/components/client/ClientSuporte.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 29. ClientTransferencias | `src/components/client/ClientTransferencias.tsx` | 🟡 Alerta | Filtrar `transferencias` por `cliente_origem_id` e `cliente_destino_id` ou adicionar `debounceMs: 500`. |
| 30. ClientVouchers | `src/components/client/ClientVouchers.tsx` | 🟢 / 🟡 | Remover chamada redundante a `fetchVouchers()` no `onPayload`. |
| 31. CobrancaView | `src/components/admin/super-domains/financeiro/CobrancaView.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 32. ConfiguracoesModule | `src/components/admin/ConfiguracoesModule.tsx` | 🔴 Crítico | Migrar de `useRealtimeTable` para `useRealtimeSubscription` e passar callback `load` corretamente. |
| 33. ContratosDocumentosView | `src/components/admin/super-domains/contratos/ContratosDocumentosView.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 34. CreateListingWizard | `src/components/client/marketplace/classifieds/CreateListingWizard.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 35. CrmClientesView | `src/components/admin/super-domains/contratos/CrmClientesView.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 36. Dashboard | `src/components/admin/Dashboard.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 37. DemandasColaboradorModule | `src/components/admin/DemandasColaboradorModule.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 38. DemandasComentarios | `src/components/admin/demandas/DemandasComentarios.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 39. DemandasDashboard | `src/components/admin/demandas/DemandasDashboard.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 40. DemandasDetalhesModal | `src/components/admin/demandas/DemandasDetalhesModal.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 41. EcommerceHeader | `src/components/client/store/EcommerceHeader.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 42. EcommerceHome | `src/components/client/store/EcommerceHome.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 43. EditClassifiedListingPage | `src/components/client/marketplace/classifieds/EditClassifiedListingPage.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 44. EmprestimosCreditoView | `src/components/admin/super-domains/financeiro/EmprestimosCreditoView.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 45. FaturamentoView | `src/components/admin/super-domains/financeiro/FaturamentoView.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 46. FidelidadePromocoesSection | `src/components/admin/super-domains/pessoas/FidelidadePromocoesSection.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 47. FinanceiroSuperDomain | `src/components/admin/super-domains/financeiro/FinanceiroSuperDomain.tsx` | 🟢 OK | Nenhuma ação necessária. |
| 48. FiscalModule | `src/components/admin/FiscalModule.tsx` | 🟢 OK | Nenhuma ação necessária. |
