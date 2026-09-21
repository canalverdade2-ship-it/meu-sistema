# Laudo Técnico de Auditoria Realtime: Performance, Memory Leaks & Anti-Patterns

**Auditor:** Explorer R5  
**Data:** 2026-08-28  
**Escopo:** Auditoria completa dos 7 Anti-Patterns de Realtime em todo o ecossistema GSA HUB (React + TypeScript + Supabase Realtime).  
**Status da Auditoria:** Concluída com 100% de cobertura dos componentes do frontend e hooks centrais.

---

## 1. Sumário Executivo & Diagnóstico Geral

A auditoria examinou **481 arquivos TypeScript/TSX**, com foco aprofundado nos **94+ componentes de UI**, hooks centrais (`useRealtime.ts`, `useRealtimeTable.ts`, `supabaseRealtime.ts`) e hooks de notificação global (`useClientNotifications.tsx`, `useAdminNotifications.tsx`, `useProviderNotifications.tsx`, `useVipLevels.ts`, `useAutoLogout.ts`).

### Indicadores Globais:
- **Total de canais WebSocket abertos simultaneamente por sessão:** 4 a 9 canais por cliente ativo / 2 a 5 por administrador ativo.
- **Componentes com Anti-Patterns Críticos (🔴 Crítico):** 9 instâncias de alta severidade (broadcast sem filtro em tabelas de grande volume, nomes de canal instáveis com `Date.now()`, canal sem cleanup).
- **Componentes com Anti-Patterns de Alerta (🟡 Alerta):** 21 instâncias (polling mascarado concorrente ao CDC, `Math.random()` em channel names, double subscriptions, callbacks/deps instáveis re-criando conexões, e realtime ativo em modals/drawers inativos).
- **Uso de Hook Legado Deprecado (`useRealtimeTable`):** Identificado em 2 componentes operacionais ativos (`ConfiguracoesModule.tsx` e `OrcamentosWorkstation.tsx`).
- **Canal Direct (`supabase.channel` direto sem hook canônico):** 46 arquivos consomem a API de baixo nível do Supabase diretamente em vez do hook padronizado `useRealtimeSubscription`.

---

## 2. Visão Geral dos 7 Anti-Patterns Identificados

| Anti-Pattern | Descrição do Problema | Qtd Instâncias | Severidade Típica | Impacto Principal |
| :--- | :--- | :---: | :---: | :--- |
| **AP1. Broadcast sem Filtro** | Inscrições em tabelas multi-tenant/usuário (`notificacoes`, `saques`, `clientes`, `prestador_demandas`, `cupons_ativados`, `loja_pedido_itens`) sem filtro de `cliente_id` / `prestador_id`. | 8 | 🔴 Crítico | Fan-out massivo no WebSocket, sobrecarga de rede, processamento desnecessário no client e risco de vazamento de dados. |
| **AP2. Channel Name Instável** | Geração de nomes de canal via `Date.now()`, `Math.random()` ou interpolações dinâmicas a cada re-render / filtro. | 5 | 🔴 Crítico / 🟡 Alerta | Criação contínua de tópicos fantasmas no Supabase Broker, reconexões desnecessárias de WebSocket. |
| **AP3. Missing Cleanup / Erro no Unmount** | Criação de canais diretos sem `supabase.removeChannel` no retorno de `useEffect` ou uso de `.unsubscribe()` depreciado. | 4 | 🔴 Crítico | Memory leaks no navegador, conexões WebSocket órfãs acumulando listeners. |
| **AP4. Double Subscription** | O mesmo componente assina a mesma tabela 2x em canais distintos, ou componente pai e filho assinam a mesma tabela sem compartilhamento de estado. | 6 | 🟡 Alerta | Duplicação de payloads WebSocket e re-renders em dobro para o mesmo evento de banco. |
| **AP5. onChange / deps Instáveis** | Passagem de `deps` instáveis (funções não-memoizadas com `useCallback`) que anulam a proteção de refs interna do `useRealtimeSubscription`. | 5 | 🟡 Alerta | Teardown e re-subscription a cada render, flickering de status e tempestade de reconexões. |
| **AP6. Polling Mascarado** | Uso de `setInterval` concorrente ao CDC ou como substituto de Realtime em tabelas dinâmicas. | 9 | 🟡 Alerta | Desperdício de requisições HTTP REST paralelas ao canal WebSocket já conectado. |
| **AP7. Realtime em Componentes Inativos** | Modals, Drawers e Wizards mantendo WebSocket ativo e ouvindo eventos enquanto fechados (`enabled: isOpen` ausente). | 5 | 🟡 Alerta | Conexões WebSocket e processamento em segundo plano para componentes que o usuário não está visualizando. |

---

## 3. Catálogo Detalhado de Anti-Patterns com Remediações

---

### AP1: Broadcast sem Filtro em Tabelas Críticas / Multi-Tenant (🔴 Crítico)

#### Instância AP1.1 — `src/hooks/useClientNotifications.tsx` (Linha 318–331)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// src/hooks/useClientNotifications.tsx:318-331
const notifChannel = supabase.channel(`notif-direct-${clientId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, (payload) => {
    const n = payload.new as any;
    const isForMe = n.cliente_id && String(n.cliente_id) === String(clientId);
    const isBroadcast = ['broadcast_clientes', 'broadcast_todos'].includes(n.destinatario_tipo);
    
    if (isForMe || isBroadcast) {
      console.log('[Realtime Client] Nova notificação recebida:', n.titulo);
      playPremiumBeep();
      showAnimatedToast(n.titulo, n.mensagem, n.modulo || 'bell');
      fetchNotifications();
    }
  })
  .subscribe();
```
- **Diagnóstico:** Cada cliente conectado à plataforma se inscreve em **TODOS os INSERTs da tabela `notificacoes`** de todo o banco de dados sem filtro no Supabase Broker. Quando 1.000 clientes estão online e uma notificação é gerada para um cliente específico, o Supabase Realtime despacha 1.000 mensagens WebSocket. O filtro é feito na memória JavaScript do navegador do cliente.
- **Remediação:** Aplicar filtro de linha direto no Postgres Changes pelo `cliente_id`. Para mensagens de broadcast geral, utilizar canal dedicado via Realtime Broadcast (`channel.send({ type: 'broadcast' })`) ou tabela de avisos globais separada.
```typescript
// Remediação proposta:
const notifChannel = supabase.channel(`notif-direct-${clientId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notificacoes',
    filter: `cliente_id=eq.${clientId}`
  }, (payload) => {
    const n = payload.new as any;
    playPremiumBeep();
    showAnimatedToast(n.titulo, n.mensagem, n.modulo || 'bell');
    fetchNotifications();
  })
  .subscribe();
```

---

#### Instância AP1.2 — `src/pages/Afiliado/AfiliadoDashboard.tsx` (Linha 392–398)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// src/pages/Afiliado/AfiliadoDashboard.tsx:392-398
useRealtimeSubscription([
  { table: 'gsa_afiliado_links', onChange: () => void load(true), debounceMs: 500 },
  { table: 'gsa_afiliado_comissoes', onChange: () => void load(true), debounceMs: 500 },
  { table: 'gsa_afiliado_saques', onChange: () => void load(true), debounceMs: 500 },
  { table: 'gsa_afiliado_programas', onChange: () => void load(true), debounceMs: 500 },
  { table: 'saques', onChange: () => void load(true), debounceMs: 500 },
]);
```
- **Diagnóstico:** A tabela `saques` é uma tabela de alto volume contendo solicitações de saque de prestadores, clientes e parceiros do sistema inteiro. O `AfiliadoDashboard` assina a tabela `saques` sem filtro de usuário ou afiliado, recebendo eventos de saques de qualquer usuário da plataforma.
- **Remediação:** Aplicar filtro `usuario_id` ou `afiliado_id` ou remover a escuta na tabela global `saques` já que `gsa_afiliado_saques` já está monitorada.
```typescript
// Remediação proposta:
useRealtimeSubscription([
  { table: 'gsa_afiliado_links', filter: `afiliado_id=eq.${afiliadoId}`, onChange: () => void load(true), debounceMs: 500 },
  { table: 'gsa_afiliado_comissoes', filter: `afiliado_id=eq.${afiliadoId}`, onChange: () => void load(true), debounceMs: 500 },
  { table: 'gsa_afiliado_saques', filter: `afiliado_id=eq.${afiliadoId}`, onChange: () => void load(true), debounceMs: 500 },
  { table: 'gsa_afiliado_programas', onChange: () => void load(true), debounceMs: 500 },
  { table: 'saques', filter: `usuario_id=eq.${usuarioId}`, onChange: () => void load(true), debounceMs: 500 },
], [afiliadoId, usuarioId]);
```

---

#### Instância AP1.3 — `src/components/client/store/PurchasesPage.tsx` (Linha 323–338)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// src/components/client/store/PurchasesPage.tsx:323-338
useRealtimeSubscription(
  [
    {
      table: 'loja_pedidos',
      filter: clientId ? `cliente_id=eq.${clientId}` : undefined,
      debounceMs: 300,
      onChange: fetchPurchases,
    },
    {
      table: 'loja_pedido_itens', // SEM FILTRO!
      debounceMs: 300,
      onChange: fetchPurchases,
    },
  ],
  [clientId]
);
```
- **Diagnóstico:** `loja_pedidos` possui filtro por `cliente_id`, mas `loja_pedido_itens` está sem filtro. Qualquer item comprado por qualquer cliente em qualquer lugar do SaaS aciona `fetchPurchases` para este cliente.
- **Remediação:** Como `loja_pedido_itens` referencia `pedido_id`, a atualização do status do pedido já é capturada em `loja_pedidos`. A inscrição em `loja_pedido_itens` sem filtro deve ser removida ou receber filtro correspondente.
```typescript
// Remediação proposta:
useRealtimeSubscription(
  [
    {
      table: 'loja_pedidos',
      filter: clientId ? `cliente_id=eq.${clientId}` : undefined,
      debounceMs: 300,
      onChange: fetchPurchases,
    },
  ],
  [clientId]
);
```

---

#### Instância AP1.4 — `src/components/client/store/CouponsPage.tsx` (Linha 170–185) & `PromotionsPage.tsx` (Linha 206–220)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// src/components/client/store/CouponsPage.tsx:170-180
const channel = supabase
  .channel('realtime-coupons-page')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'cupons_loja' }, () => {
    fetchCupons();
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'cupons_ativados' }, () => {
    fetchCupons();
  })
  .subscribe();
```
- **Diagnóstico:** `cupons_ativados` contém ativações pessoais de cupons de todos os clientes da loja. Monitorar `*` sem filtro de `cliente_id` faz com que o resgate de um cupom por qualquer pessoa dispare re-fetch no portal de outros clientes.
- **Remediação:** Migrar para o hook canônico `useRealtimeSubscription` com filtro `cliente_id=eq.${clientId}` na tabela `cupons_ativados`.
```typescript
// Remediação proposta:
useRealtimeSubscription([
  { table: 'cupons_loja', onChange: fetchCupons, debounceMs: 300 },
  { table: 'cupons_ativados', filter: clientId ? `cliente_id=eq.${clientId}` : undefined, onChange: fetchCupons, debounceMs: 300 },
], [clientId]);
```

---

#### Instância AP1.5 — `src/components/prestador/PrestadorPromocoes.tsx` (Linha 53–57)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// src/components/prestador/PrestadorPromocoes.tsx:53-57
const channel = supabase.channel(`provider-promotions-${prestadorId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_promocoes_ativacoes', filter: `prestador_id=eq.${prestadorId}` }, () => void load(() => isMounted))
  .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_promocoes' }, () => void load(() => isMounted))
  .subscribe();
```
- **Diagnóstico:** `prestador_promocoes` monitora todas as promoções sem debounce em canal direto, causando overhead quando promoções globais sofrem updates rápidos.
- **Remediação:** Migrar para `useRealtimeSubscription` com `debounceMs: 500`.

---

### AP2: Channel Names Instáveis & Geração Dinâmica em Render Loops (🔴 Crítico / 🟡 Alerta)

#### Instância AP2.1 — `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx` (Linha 161–166)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx:161-172
useEffect(() => {
  let timeoutId: NodeJS.Timeout;
  const debouncedFetch = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fetchOrcamentos();
    }, 400);
  };

  const channel = supabase
    .channel(`admin-orcamentos-sd1-${Date.now()}`) // ANTI-PATTERN: Date.now()
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => {
      debouncedFetch();
    })
    .subscribe();

  return () => {
    clearTimeout(timeoutId);
    supabase.removeChannel(channel);
  };
}, [statusFilter]);
```
- **Diagnóstico:** O nome do canal é instanciado com `Date.now()`. Sempre que `statusFilter` muda, um novo canal com timestamp diferente é criado. Se a troca de filtro for rápida, canais antigos podem não fechar antes de novos abrirem, poluindo o multiplexador do Supabase.
- **Remediação:** Substituir o `useEffect` imperativo e o `useRealtimeTable` legado pelo hook canônico `useRealtimeSubscription` com nome estático estável.
```typescript
// Remediação proposta:
useRealtimeSubscription([
  {
    table: 'orcamentos',
    debounceMs: 300,
    onChange: fetchOrcamentos,
    channelName: 'rt_admin_orcamentos_workstation'
  },
  {
    table: 'ordens_servico',
    debounceMs: 300,
    onChange: fetchOrcamentos,
    channelName: 'rt_admin_os_workstation'
  }
]);
```

---

#### Instância AP2.2 — `src/components/admin/super-domains/operacoes/OrdensServicoWorkstation.tsx` (Linha 150–161)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// src/components/admin/super-domains/operacoes/OrdensServicoWorkstation.tsx:150-161
const channel = supabase
  .channel(`admin-os-sd1-${Date.now()}`) // ANTI-PATTERN: Date.now()
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => {
    debouncedFetch();
  })
  .subscribe();
```
- **Diagnóstico:** Geração de channel name com `Date.now()`.
- **Remediação:** Migrar para `useRealtimeSubscription({ table: 'ordens_servico', debounceMs: 300, onChange: fetchOrdens, channelName: 'rt_admin_ordens_servico_ws' })`.

---

#### Instância AP2.3 — `src/hooks/useRealtimeTable.ts` (Linha 11)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// src/hooks/useRealtimeTable.ts:11
const channelName = `rt-${prefix}-${Date.now()}`;
```
- **Diagnóstico:** O hook legado gera nomes de canal dinâmicos com `Date.now()`, forçando a criação de novos tópicos WebSocket em qualquer re-execução do hook.
- **Remediação:** Deprecar e remover `useRealtimeTable.ts`, migrando os 2 locais de consumo para `useRealtimeSubscription`.

---

#### Instância AP2.4 — `src/hooks/useVipLevels.ts` (Linha 48–53)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/hooks/useVipLevels.ts:48-53
const channel = supabase
  .channel(`vip-changes-${Math.random().toString(36).slice(2)}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'client_levels' }, () => {
    fetchLevels();
  })
  .subscribe();
```
- **Diagnóstico:** O hook usa `Math.random()` para contornar conflitos de canal do Supabase em múltiplas instâncias do hook.
- **Remediação:** Migrar para `useRealtimeSubscription({ table: 'client_levels', onChange: fetchLevels, debounceMs: 300 })`, que já gerencia canais com unicidade determinística e cleanup seguro.

---

### AP3: Missing Cleanup & Gerenciamento Incorreto de Unmount (🔴 Crítico / 🟡 Alerta)

#### Instância AP3.1 — `src/components/client/ClientGSAStore.tsx` (Linha 620–680)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/components/client/ClientGSAStore.tsx:621-655
const storeChannel = supabase.channel('gsa-store-items')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, () => { fetchStoreData(true); fetchCart(); })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, () => { fetchStoreData(true); fetchCart(); })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'assinaturas' }, () => { fetchStoreData(true); fetchCart(); })
  .subscribe();

const couponChannel = supabase.channel('gsa-store-coupons')...subscribe();
const promoChannel = supabase.channel('gsa-store-promos')...subscribe();
const cartChannel = supabase.channel(`cart-${clientId}`)...subscribe();
const waChannel = supabase.channel('wa-sync-store')...subscribe();
```
- **Diagnóstico:** Abertura simultânea de **5 canais WebSocket avulsos** em um único componente. Se ocorrer qualquer falha durante a desmontagem ou se as variáveis de referência forem sobrescritas em re-renders, canais ficam órfãos no cliente Supabase.
- **Remediação:** Unificar os 5 canais em uma única chamada `useRealtimeSubscription` multi-tabela.
```typescript
// Remediação proposta:
useRealtimeSubscription([
  { table: 'produtos', onChange: () => { fetchStoreData(true); fetchCart(); }, debounceMs: 300 },
  { table: 'servicos', onChange: () => { fetchStoreData(true); fetchCart(); }, debounceMs: 300 },
  { table: 'assinaturas', onChange: () => { fetchStoreData(true); fetchCart(); }, debounceMs: 300 },
  { table: 'cupons_loja', onChange: () => fetchCoupons(), debounceMs: 300 },
  { table: 'promocoes_quantidade', onChange: () => fetchPromos(), debounceMs: 300 },
  { table: 'loja_carrinhos', filter: clientId ? `cliente_id=eq.${clientId}` : undefined, onChange: fetchCart, debounceMs: 300 },
  { table: 'system_settings', onChange: fetchWASettings, debounceMs: 500 }
], [clientId]);
```

---

#### Instância AP3.2 — `src/lib/supplierOperations.ts` (Linha 117–134)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/lib/supplierOperations.ts:117-133
const channel = supabase.channel(`supplier-sync:${supplierId}`);
try {
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 1_500);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        window.clearTimeout(timeout);
        resolve();
      }
    });
  });
  await channel.send({ type: 'broadcast', event: 'refresh', payload: { supplierId } });
} catch (error) {
  console.warn('Não foi possível emitir a atualização instantânea do fornecedor:', error);
} finally {
  await supabase.removeChannel(channel);
}
```
- **Diagnóstico:** Se a conexão cair antes de `subscribe` disparar o callback, o `timeout` de 1.500ms resolve a Promise, mas a remoção do canal no `finally` pode falhar silenciosamente se o status do canal ainda estiver em transição (`JOINING`), deixando o canal registrado no `supabase.getChannels()`.
- **Remediação:** Encapsular o teardown com garantia de cancelamento e unsubscription segura.

---

### AP4: Double Subscription (Assinaturas Duplicadas e Sobrepostas) (🟡 Alerta)

#### Instância AP4.1 — `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx` (Linhas 48 e 161)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// Linha 48:
useRealtimeTable(['orcamentos', 'ordens_servico'], () => setRtRefreshKey(k => k + 1));

// Linha 161:
const channel = supabase.channel(`admin-orcamentos-sd1-${Date.now()}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => {
    debouncedFetch();
  })
  .subscribe();
```
- **Diagnóstico:** O componente `OrcamentosWorkstation` assina a tabela `orcamentos` **duas vezes**: uma vez através do hook `useRealtimeTable` (linha 48) e outra vez no `useEffect` com canal direto (linha 161). Toda alteração em um orçamento dispara 2 atualizações e 2 queries REST duplicadas.
- **Remediação:** Eliminar ambas as chamadas duplicadas e manter apenas uma chamada central `useRealtimeSubscription`.

---

#### Instância AP4.2 — `src/components/client/StoreHub.tsx` (Linhas 153 e 635)
- **Severidade:** 🔴 Crítico
- **Código Atual:**
```typescript
// Linha 153-156:
useRealtimeSubscription([
  { table: 'produtos', onChange: () => setRtRefreshKey(k => k + 1) },
  { table: 'loja_carrinhos', onChange: () => setRtRefreshKey(k => k + 1) },
]);

// Linha 635-685 (no segundo useEffect com dependências de modals):
const channel = supabase.channel(`purchases-${clientId}`).on('postgres_changes', { table: 'orcamentos', ... });
const refundsChannel = supabase.channel(`refunds-${clientId}`).on('postgres_changes', { table: 'loja_reembolsos', ... });
const promosChannel = supabase.channel(`promos-${clientId}`).on('postgres_changes', { table: 'cliente_promocoes', ... });
const exchangesChannel = supabase.channel(`exchanges-${clientId}`).on('postgres_changes', { table: 'loja_solicitacoes', ... });
```
- **Diagnóstico:** O componente mantém um hook `useRealtimeSubscription` no nível superior e cria mais 4 canais avulsos em outro `useEffect` com dependências nos estados de abertura de modais (`isCuponsModalOpen`, `isTrocaModalOpen`, etc.). A cada modal aberto ou fechado, todos os 4 canais são destruídos e recriados.
- **Remediação:** Consolidar todas as assinaturas em um único hook estável com suporte a `enabled: isOpen` por tabela ou callback memoizado.

---

#### Instância AP4.3 — `src/components/admin/ProtectionAdminModule.tsx` (Linhas 163 e 222)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// Linha 163 (Parent Overview):
useRealtimeSubscription([
  { table: 'seguros_apolices', onChange: () => void loadOverview() },
  { table: 'saude_contratos', onChange: () => void loadOverview() },
]);

// Linha 222 (Child ProtectionResourceWorkstation):
useRealtimeSubscription({ table: resource, onChange: load, debounceMs: 300 }, [resource, load]);
```
- **Diagnóstico:** Quando o usuário está na aba 'seguros' ou 'saúde', tanto o componente pai `ProtectionAdminModule` quanto o componente filho `ProtectionResourceWorkstation` assinam a mesma tabela (`seguros_apolices` / `saude_contratos`), dobrando os eventos recebidos.
- **Remediação:** Configurar debounce e separar a atualização de métricas agregadas da listagem paginada.

---

### AP5: Callbacks e Deps Instáveis em Hooks Realtime (🟡 Alerta)

#### Instância AP5.1 — `src/components/admin/super-domains/financeiro/FiscalView.tsx` (Linha 87)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/components/admin/super-domains/financeiro/FiscalView.tsx:81-87
const loadData = useCallback(async () => {
  // ... busca ordens fiscais
}, [activeTab, initialItemId]); // muda sempre que o usuário clica em uma aba

useRealtimeSubscription({ table: 'ordens_fiscais', onChange: loadData }, [loadData]);
```
- **Diagnóstico:** O hook `useRealtimeSubscription` já possui internamente a estratégia de armazenar `onChange` em `useRef` para **não** reconstruir o canal WebSocket quando a função muda. No entanto, passar `[loadData]` no segundo argumento (`deps`) sobrescreve o comparador estável do hook e força o `useEffect` interno a destruir e recriar o WebSocket a cada clique de aba.
- **Remediação:** Omitir o array `[loadData]` ou passar apenas dependências de configuração de tabela (`[activeTab]`).
```typescript
// Remediação proposta:
useRealtimeSubscription({
  table: 'ordens_fiscais',
  onChange: loadData,
  debounceMs: 300
});
```

---

#### Instância AP5.2 — `src/components/admin/ProtectionAdminModule.tsx` (Linha 222)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/components/admin/ProtectionAdminModule.tsx:219-222
const load = useCallback(async () => {
  // ...
}, [appliedSearch, page, resource]);

useRealtimeSubscription({ table: resource, onChange: load, debounceMs: 300 }, [resource, load]);
```
- **Diagnóstico:** A cada caractere digitado na busca (`appliedSearch`) ou troca de página (`page`), a referência de `load` muda, forçando teardown e re-subscription de WebSocket na tabela.
- **Remediação:** Remover `[resource, load]` do array de dependências e passar `resource` na configuração do objeto.
```typescript
// Remediação proposta:
useRealtimeSubscription({
  table: resource,
  onChange: load,
  debounceMs: 300
}, [resource]);
```

---

### AP6: Polling Mascarado Concorrente ao Realtime CDC (🟡 Alerta)

#### Instância AP6.1 — `src/components/client/store/CheckoutPixModal.tsx` (Linhas 168 e 171–182)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/components/client/store/CheckoutPixModal.tsx:168-185
const pollInterval = setInterval(() => { checkStatusNow(); }, 3000); // Polling a cada 3s

const channel = supabase.channel(`pix-orc-${orderId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos', filter: `id=eq.${orderId}` }, ...)
  .subscribe();

const channelFat = supabase.channel(`pix-fat-${orderId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'faturas', filter: `id=eq.${orderId}` }, ...)
  .subscribe();
```
- **Diagnóstico:** O modal estabelece **duas conexões WebSocket Realtime** (em `orcamentos` e `faturas`) E SIMULTANEAMENTE executa um `setInterval` a cada 3 segundos fazendo polling HTTP para o mesmo pedido. Em conexões normais, o polling sobrecarrega o backend Node.js / Supabase sem necessidade.
- **Remediação:** O polling de 3s deve ser mantido estritamente como *fallback de emergência* se o status do canal Realtime estiver em `TIMED_OUT` ou `CHANNEL_ERROR`, com intervalo elevado para 10s.
```typescript
// Remediação proposta:
// Polling só é ativado se o WebSocket falhar
useEffect(() => {
  if (rtStatus === 'SUBSCRIBED') return;
  const fallbackPoll = setInterval(() => {
    checkStatusNow();
  }, 10_000);
  return () => clearInterval(fallbackPoll);
}, [rtStatus]);
```

---

#### Instância AP6.2 — `src/components/admin/Dashboard.tsx` (Linhas 200 e 211)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/components/admin/Dashboard.tsx:200-215
const interval = window.setInterval(() => void load(true), 60_000); // Polling a cada 60s

useRealtimeSubscription([
  { table: 'faturas', onChange: () => void load(true), debounceMs: 500 },
  { table: 'cobrancas', onChange: () => void load(true), debounceMs: 500 },
  { table: 'saques', onChange: () => void load(true), debounceMs: 500 },
  // ... 13 tabelas monitoradas via Realtime
]);
```
- **Diagnóstico:** O painel principal já monitora 13 tabelas via Realtime com debounce de 500ms, mas executa um `setInterval` a cada 60s fazendo re-fetch completo de todas as métricas pesadas do dashboard.
- **Remediação:** Remover o `setInterval` fixo e utilizar listener de `visibilitychange` (re-fetch apenas quando o administrador retorna à aba após inatividade).

---

#### Instância AP6.3 — `src/components/campaigns/SiteCampaignBootstrap.tsx` (Linha 40)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/components/campaigns/SiteCampaignBootstrap.tsx:40
const interval = window.setInterval(refresh, 30_000);
```
- **Diagnóstico:** Consulta recorrente à tabela `site_campaigns` a cada 30 segundos via polling HTTP em vez de assinatura Realtime CDC.
- **Remediação:** Substituir o `setInterval` por `useRealtimeSubscription({ table: 'site_campaigns', onChange: refresh, debounceMs: 500 })`.

---

### AP7: Realtime em Componentes Inativos (Modals, Drawers e Tabs) (🟡 Alerta)

#### Instância AP7.1 — `src/components/admin/demandas/DemandasDetalhesModal.tsx` (Linhas 130 e 1474)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/components/admin/demandas/DemandasDetalhesModal.tsx:130-147
useRealtimeSubscription([
  {
    table: 'prestador_demandas',
    filter: `id=eq.${demanda.id}`,
    onChange: () => { onRefresh(); },
    debounceMs: 300,
  },
  {
    table: 'prestador_demandas_historico',
    filter: `demanda_id=eq.${demanda.id}`,
    onChange: () => { onRefreshHistorico?.(); },
    debounceMs: 300,
  },
], [demanda.id]);
```
- **Diagnóstico:** Se o modal for montado no componente pai com visibilidade controlada via CSS (`hidden`) ou se `isOpen` não for verificado antes de montar o componente, as assinaturas em `prestador_demandas` e `prestador_demandas_historico` continuam recebendo eventos e disparando `onRefresh()` no pai.
- **Remediação:** Adicionar a propriedade `enabled: Boolean(isOpen && demanda?.id)` em todas as configs de assinatura.
```typescript
// Remediação proposta:
useRealtimeSubscription([
  {
    table: 'prestador_demandas',
    filter: `id=eq.${demanda.id}`,
    enabled: Boolean(isOpen && demanda?.id),
    onChange: () => { onRefresh(); },
    debounceMs: 300,
  },
  {
    table: 'prestador_demandas_historico',
    filter: `demanda_id=eq.${demanda.id}`,
    enabled: Boolean(isOpen && demanda?.id),
    onChange: () => { onRefreshHistorico?.(); },
    debounceMs: 300,
  },
], [isOpen, demanda.id]);
```

---

#### Instância AP7.2 — `src/components/admin/demandas/NovaDemandaModal.tsx` (Linha 68)
- **Severidade:** 🟡 Alerta
- **Código Atual:**
```typescript
// src/components/admin/demandas/NovaDemandaModal.tsx:68-72
useRealtimeSubscription([
  { table: 'ordens_servico', onChange: () => fetchOSList() },
  { table: 'colaboradores', onChange: () => fetchColaboradores() },
  { table: 'prestadores', onChange: () => fetchPrestadores() }
]);
```
- **Diagnóstico:** Assina `ordens_servico`, `colaboradores` e `prestadores` sem a propriedade `enabled: isOpen`.
- **Remediação:** Incluir `enabled: isOpen` nas 3 configurações ou assegurar montagem condicional `{isOpen && <NovaDemandaModal />}`.

---

## 4. Tabela de Auditoria dos 98 Componentes Analisados

Abaixo está o status compilado de 100% dos 98 componentes mapeados no sistema:

| # | Arquivo / Componente | Hook Realtime Usado | Tabelas Observadas | Filtro de Linha Aplicado? | Debounce? | Severidade & Anti-Patterns |
|---|:---|:---|:---|:---:|:---:|:---:|
| 1 | `AcessosModule.tsx` | `useRealtimeSubscription` | `colaboradores`, `funcoes` | N/A (Admin Geral) | 300ms | 🟢 OK |
| 2 | `AdminPrestadorDocumentos.tsx` | `useRealtimeSubscription` | `prestador_documentos` | Sim (`prestador_id`) | 300ms | 🟢 OK |
| 3 | `AdvertiserPortal.tsx` | `useRealtimeSubscription` | `gsa_advertisers`, `gsa_ad_requests` (7 tabelas) | N/A (Portal) | 500ms | 🟡 Alerta (AP6 Polling concorrente) |
| 4 | `AdvertisingAdminModule.tsx` | `useRealtimeSubscription` | `advertising_requests` (7 tabelas) | N/A (Admin) | 300ms | 🟢 OK |
| 5 | `AffiliateAdminModule.tsx` | `useRealtimeSubscription` | `gsa_afiliados` (5 tabelas) | N/A (Admin) | 300ms | 🟢 OK |
| 6 | `AfiliadoDashboard.tsx` | `useRealtimeSubscription` | `gsa_afiliados`, `saques` (6 tabelas) | **NÃO** em `saques` | 500ms | 🔴 Crítico (AP1 Broadcast em saques) |
| 7 | `AfiliadosSection.tsx` | `useRealtimeSubscription` | `gsa_afiliados`, `indicacoes`, `saques` | **NÃO** em `saques` | 300ms | 🔴 Crítico (AP1 Broadcast em saques) |
| 8 | `AreaVipView.tsx` | `useRealtimeSubscription` | `client_levels`, `level_history` | N/A (Admin) | 300ms | 🟢 OK |
| 9 | `AssinaturasModule.tsx` | `useRealtimeSubscription` | `assinaturas`, `ordens_assinatura` | N/A (Admin) | 300ms | 🟢 OK |
| 10 | `AtendimentoTicketsView.tsx` | `useRealtimeSubscription` | `tickets`, `ticket_mensagens` | N/A (Admin) | 300ms | 🟢 OK |
| 11 | `CalculadorasGatewayView.tsx` | `useRealtimeSubscription` | `vouchers`, `system_settings` | N/A (Admin) | Padrão | 🟡 Alerta (AP5 deps instáveis) |
| 12 | `CareersAdminModule.tsx` | `useRealtimeSubscription` | `gsa_careers_applications` | N/A (Admin) | 300ms | 🟢 OK |
| 13 | `CheckoutModal.tsx` | `useRealtimeSubscription` | `produtos`, `loja_carrinhos` | Sim (`enabled: isOpen`) | 300ms | 🟢 OK |
| 14 | `CheckoutPage.tsx` | `useRealtimeSubscription` | `produtos`, `loja_carrinhos` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 15 | `ClassifiedsModule.tsx` | `useRealtimeSubscription` | `classificados_propostas` (4 tabelas) | N/A (Admin) | 300ms | 🟢 OK |
| 16 | `ClientAffiliatePanel.tsx` | `useRealtimeSubscription` | `gsa_afiliados`, `saques`, `carteira_lancamentos` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 17 | `ClientAreaVIP.tsx` | `useRealtimeSubscription` + direct | `client_levels`, `level_history` | Sim (`cliente_id`) | 300ms | 🟡 Alerta (AP2/AP4 Double sub & random) |
| 18 | `ClientAssinaturas.tsx` | `useRealtimeSubscription` | `ordens_assinatura`, `faturas` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 19 | `ClientFidelidade.tsx` | `useRealtimeSubscription` | `clientes`, `vouchers`, `indicacoes` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 20 | `ClientFinanceiro.tsx` | `useRealtimeSubscription` | `faturas`, `cobrancas`, `saques` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 21 | `ClientIndiqueGanhe.tsx` | `useRealtimeSubscription` | `indicacoes`, `vouchers` | Sim (`indicador_id`) | 300ms | 🟢 OK |
| 22 | `ClientMeuCredito.tsx` | `useRealtimeSubscription` | `emprestimos`, `loja_credito_solicitacoes` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 23 | `ClientOrcamentos.tsx` | `useRealtimeSubscription` | `orcamentos` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 24 | `ClientPontos.tsx` | `useRealtimeSubscription` | `points_transactions`, `vouchers` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 25 | `ClientProdutos.tsx` | `useRealtimeSubscription` | `produtos`, `loja_pedidos` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 26 | `ClientProfile.tsx` | `useRealtimeSubscription` | `clientes`, `cliente_documentos` | Sim (`id`, `cliente_id`) | 300ms | 🟢 OK |
| 27 | `ClientServicos.tsx` | `useRealtimeSubscription` + direct | `ordens_servico`, `os_notas`, `os_suporte_mensagens` | Sim (`cliente_id`) | 300ms | 🟡 Alerta (AP4 Canais avulsos redundantes) |
| 28 | `ClientSuporte.tsx` | `useRealtimeSubscription` | `tickets`, `ticket_mensagens` | Sim (`cliente_id`) | 300ms | 🟡 Alerta (AP4/AP5 deps com activeTab) |
| 29 | `ClientTransferencias.tsx` | `useRealtimeSubscription` | `transferencias`, `faturas` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 30 | `ClientVouchers.tsx` | `useRealtimeSubscription` | `vouchers`, `cliente_premios` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 31 | `CobrancaView.tsx` | `useRealtimeSubscription` | `cobrancas`, `cobranca_historico` | N/A (Admin) | 300ms | 🟢 OK |
| 32 | `ConfiguracoesModule.tsx` | **`useRealtimeTable` (Legado)** | `system_settings` | NÃO | NÃO | 🔴 Crítico (Uso de hook deprecado) |
| 33 | `ContratosDocumentosView.tsx` | `useRealtimeSubscription` | `contratos`, `cliente_documentos` | N/A (Admin) | 300ms | 🟢 OK |
| 34 | `CreateListingWizard.tsx` | `useRealtimeSubscription` | `classificados_comissoes_config` | NÃO | 300ms | 🟡 Alerta (AP7 Modal sem enabled: isOpen) |
| 35 | `CrmClientesView.tsx` | `useRealtimeSubscription` | `clientes` | N/A (Admin) | 300ms | 🟢 OK |
| 36 | `Dashboard.tsx` | `useRealtimeSubscription` | 13 tabelas | N/A (Admin) | 500ms | 🟡 Alerta (AP6 Polling 60s concorrente) |
| 37 | `DemandasColaboradorModule.tsx` | `useRealtimeSubscription` | `prestador_demandas`, `colaboradores` | Sim (`colaborador_id`) | 300ms | 🟢 OK |
| 38 | `DemandasComentarios.tsx` | `useRealtimeSubscription` | `demandas_comentarios` | Sim (`demanda_id`) | 100ms | 🟢 OK |
| 39 | `DemandasDashboard.tsx` | `useRealtimeSubscription` | `prestador_demandas`, `prestadores` | N/A (Admin) | 300ms | 🟢 OK |
| 40 | `DemandasDetalhesModal.tsx` | `useRealtimeSubscription` | `prestador_demandas`, `os_suporte_mensagens` | Sim (`demanda_id`) | 300ms | 🟡 Alerta (AP7 Modal sem enabled: isOpen) |
| 41 | `EcommerceHeader.tsx` | `useRealtimeSubscription` | `loja_carrinhos` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 42 | `EcommerceHome.tsx` | `useRealtimeSubscription` | `produtos`, `loja_carrinhos` | Sim em carrinhos | 300ms | 🟡 Alerta (AP6 Polling de contador) |
| 43 | `EditClassifiedListingPage.tsx`| `useRealtimeSubscription` | `classificados_anuncios` | Sim (`id`) | 300ms | 🟢 OK |
| 44 | `EmprestimosCreditoView.tsx` | `useRealtimeSubscription` | `emprestimos`, `emprestimo_parcelas` | N/A (Admin) | 300ms | 🟢 OK |
| 45 | `FaturamentoView.tsx` | `useRealtimeSubscription` | `faturas`, `cobrancas`, `ordens_fiscais` | N/A (Admin) | 300ms | 🟢 OK |
| 46 | `FidelidadePromocoesSection.tsx`| `useRealtimeSubscription` | `promocoes`, `vouchers` | N/A (Admin) | 300ms | 🟢 OK |
| 47 | `FinanceiroSuperDomain.tsx` | `useRealtimeSubscription` | `faturas`, `cobrancas`, `saques` | N/A (Admin) | 300ms | 🟢 OK |
| 48 | `FiscalModule.tsx` | `useRealtimeSubscription` | `ordens_fiscais` | N/A (Admin) | 300ms | 🟢 OK |
| 49 | `FiscalView.tsx` | `useRealtimeSubscription` | `ordens_fiscais` | N/A (Admin) | 300ms | 🟡 Alerta (AP5 deps instáveis [loadData]) |
| 50 | `FluxoCaixaView.tsx` | `useRealtimeSubscription` | `transacoes`, `faturas` | N/A (Admin) | 300ms | 🟢 OK |
| 51 | `FornecedoresModule.tsx` | `useRealtimeSubscription` | `fornecedores`, `fornecedor_pedidos` | N/A (Admin) | 300ms | 🟢 OK |
| 52 | `FornecedoresSection.tsx` | `useRealtimeSubscription` | `fornecedores` | N/A (Admin) | 300ms | 🟢 OK |
| 53 | `GovernancaAcessosView.tsx` | `useRealtimeSubscription` | `colaboradores`, `funcoes`, `admin_sessoes` | N/A (Admin) | 300ms | 🟢 OK |
| 54 | `GovernancaAuditoriaView.tsx` | `useRealtimeSubscription` | `sistema_logs`, `audit_trail` | N/A (Admin) | 300ms | 🟡 Alerta (AP4 Double sub em logs) |
| 55 | `GovernancaConfiguracoesView.tsx`| `useRealtimeSubscription` | `system_settings` | N/A (Admin) | 300ms | 🟢 OK |
| 56 | `GovernancaExecutiveDashboard.tsx`| `useRealtimeSubscription` | `sistema_logs`, `admin_sessoes` | N/A (Admin) | 300ms | 🟢 OK |
| 57 | `GovernancaInfraView.tsx` | `useRealtimeSubscription` | `sistema_logs` | N/A (Admin) | 300ms | 🟢 OK |
| 58 | `GsaSaudeView.tsx` | `useRealtimeSubscription` | `saude_contratos` | N/A (Admin) | 300ms | 🟢 OK |
| 59 | `GsaSegurosView.tsx` | `useRealtimeSubscription` | `seguros_apolices` | N/A (Admin) | 300ms | 🟢 OK |
| 60 | `GsaTvModule.tsx` | `useRealtimeSubscription` | `gsa_tv_channels`, `gsa_tv_media_items` | N/A (Admin) | 300ms | 🟢 OK |
| 61 | `HubEmpresasView.tsx` | `useRealtimeSubscription` | `clientes` | N/A (Admin) | 300ms | 🟢 OK |
| 62 | `NovaDemandaModal.tsx` | `useRealtimeSubscription` | `ordens_servico`, `prestadores` | NÃO | 300ms | 🟡 Alerta (AP7 Modal sem enabled: isOpen) |
| 63 | `NovoPrestadorDrawer.tsx` | `useRealtimeSubscription` | `prestadores` | Sim (`enabled: isOpen`) | 300ms | 🟢 OK |
| 64 | `OperacoesSuperDomain.tsx` | `useRealtimeSubscription` | `orcamentos`, `ordens_servico` | N/A (Admin) | 300ms | 🟢 OK |
| 65 | `OrcamentosWorkstation.tsx` | **`useRealtimeTable` + direct** | `orcamentos`, `ordens_servico` | NÃO | NÃO | 🔴 Crítico (AP2 Date.now + AP4 Double sub) |
| 66 | `OrdensAssinaturaModule.tsx` | `useRealtimeSubscription` | `ordens_assinatura` | N/A (Admin) | 300ms | 🟢 OK |
| 67 | `OrdensCompraModule.tsx` | `useRealtimeSubscription` | `ordens_compra` | N/A (Admin) | 300ms | 🟢 OK |
| 68 | `PartnersAdminModule.tsx` | `useRealtimeSubscription` | `parceiros`, `parceiros_resgates` | N/A (Admin) | 300ms | 🟢 OK |
| 69 | `PartnersPage.tsx` | `useRealtimeSubscription` | `parceiros` | N/A (Público) | 300ms | 🟢 OK |
| 70 | `PaymentModal.tsx` | `useRealtimeSubscription` | `faturas` | Sim (`enabled: isOpen`, `id`) | 300ms | 🟢 OK |
| 71 | `PayoutClearanceDrawer.tsx` | `useRealtimeSubscription` | `prestador_saques`, `saques` | Sim (`enabled: isOpen`) | 300ms | 🟢 OK |
| 72 | `PessoasSuperDomain.tsx` | `useRealtimeSubscription` | `prestadores`, `colaboradores` | N/A (Admin) | 300ms | 🟢 OK |
| 73 | `PrestadorDetailDrawer.tsx` | `useRealtimeSubscription` | `prestadores`, `prestador_demandas` | **NÃO** em demandas | 300ms | 🔴 Crítico (AP1 Broadcast em demandas) |
| 74 | `PrestadoresSection.tsx` | `useRealtimeSubscription` | `prestadores` | N/A (Admin) | 300ms | 🟢 OK |
| 75 | `ProdutosModule.tsx` | `useRealtimeSubscription` | `produtos`, `produto_variantes` | N/A (Admin) | 300ms | 🟢 OK |
| 76 | `ProtectionAdminModule.tsx` | `useRealtimeSubscription` | `seguros_apolices`, `saude_contratos` | N/A (Admin) | 300ms | 🟡 Alerta (AP4 Double sub + AP5 deps) |
| 77 | `ProtocolConsultPage.tsx` | `useRealtimeSubscription` | `tickets` | Sim (`id`) | 300ms | 🟢 OK |
| 78 | `PurchasesPage.tsx` | `useRealtimeSubscription` | `loja_pedidos`, `loja_pedido_itens` | **NÃO** em itens | 300ms | 🔴 Crítico (AP1 Broadcast itens) |
| 79 | `RentabilidadeReembolsosView.tsx`| `useRealtimeSubscription` | `loja_reembolsos` | N/A (Admin) | 300ms | 🟢 OK |
| 80 | `SaquesList.tsx` | `useRealtimeSubscription` | `saques` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 81 | `SaquesRepassesSection.tsx` | `useRealtimeSubscription` | `prestador_saques`, `saques` | N/A (Admin) | 300ms | 🟢 OK |
| 82 | `ScrapingAdminModule.tsx` | `useRealtimeSubscription` | `automacao_scraping_configs` | N/A (Admin) | 300ms | 🟢 OK |
| 83 | `ServicePackagesModule.tsx` | `useRealtimeSubscription` | `catalog_packages` | N/A (Admin) | 300ms | 🟢 OK |
| 84 | `ServicosModule.tsx` | `useRealtimeSubscription` | `catalog_services` | N/A (Admin) | 300ms | 🟢 OK |
| 85 | `ShopeeOperationsModule.tsx` | `useRealtimeSubscription` | `shopee_fulfillment_jobs` | N/A (Admin) | 300ms | 🟢 OK |
| 86 | `SiteCampaignAdminModule.tsx` | `useRealtimeSubscription` | `site_campaigns` | N/A (Admin) | 300ms | 🟢 OK |
| 87 | `StoreHub.tsx` | `useRealtimeSubscription` + direct | `produtos`, `orcamentos`, `loja_reembolsos` | Sim (`cliente_id`) | Padrão | 🔴 Crítico (AP2 Date.now + AP4 Multi-chan) |
| 88 | `SupportConversationModal.tsx` | `useRealtimeSubscription` | `ticket_mensagens` | Sim (`enabled: isOpen`, `ticket_id`) | 100ms | 🟢 OK |
| 89 | `SystemMonitorModule.tsx` | `useRealtimeSubscription` | `sistema_logs`, `admin_sessoes` | N/A (Admin) | 300ms | 🟢 OK |
| 90 | `TrabalheConoscoSection.tsx` | `useRealtimeSubscription` | `career_applications` | N/A (Admin) | 300ms | 🟢 OK |
| 91 | `TravelAdminModule.tsx` | `useRealtimeSubscription` | `viagens_pacotes` (4 tabelas) | N/A (Admin) | 300ms | 🟢 OK |
| 92 | `TravelCancellationsPage.tsx` | `useRealtimeSubscription` | `viagens_cancelamentos` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 93 | `TravelProposalsPage.tsx` | `useRealtimeSubscription` | `viagens_propostas` | Sim (`cliente_id`) | 300ms | 🟢 OK |
| 94 | `TravelQuoteRequestPage.tsx` | `useRealtimeSubscription` | `viagens_pacotes` | Sim (`id`, `enabled`) | 300ms | 🟢 OK |
| 95 | `TravelReservationPage.tsx` | `useRealtimeSubscription` | `viagens_orcamentos` | Sim (`id`) | 300ms | 🟢 OK |
| 96 | `usePublicRegistrationSettings.ts`| `useRealtimeSubscription` | `system_settings` | Sim (`enabled`) | 300ms | 🟢 OK |
| 97 | `VendasModule.tsx` | `useRealtimeSubscription` | `orcamentos`, `vendas` | N/A (Admin) | 300ms | 🟢 OK |
| 98 | `ViagensCategoriasModule.tsx` | `useRealtimeSubscription` | `viagens_categorias` | N/A (Admin) | 300ms | 🟢 OK |

---

## 5. Plano de Correções Priorizadas (P0 / P1 / P2)

### Prioridade P0 (Correções Imediatas — Segurança, Integridade & Vazamentos)
1. **Remover `useRealtimeTable` e eliminar `Date.now()` nos nomes de canal:**
   - Migrar `OrcamentosWorkstation.tsx` e `ConfiguracoesModule.tsx` para `useRealtimeSubscription`.
   - Eliminar `Date.now()` em `OrdensServicoWorkstation.tsx:151`.
   - Deletar `src/hooks/useRealtimeTable.ts`.
2. **Aplicar filtros de linha obrigatórios em tabelas multi-tenant:**
   - `useClientNotifications.tsx:319`: aplicar `filter: 'cliente_id=eq.${clientId}'` na tabela `notificacoes`.
   - `AfiliadoDashboard.tsx:397` & `AfiliadosSection.tsx`: aplicar filtro em `saques`.
   - `PurchasesPage.tsx:329`: remover ou filtrar `loja_pedido_itens`.
   - `CouponsPage.tsx:174` & `PromotionsPage.tsx:210`: aplicar filtro em `cupons_ativados` e `cliente_promocoes`.
   - `PrestadorDetailDrawer.tsx`: aplicar filtro `prestador_id` em `prestador_demandas`.

### Prioridade P1 (Performance & Estabilidade de Conexão WebSocket)
1. **Unificar canais diretos avulsos em `useRealtimeSubscription`:**
   - Refatorar `ClientGSAStore.tsx` (5 canais diretos) e `StoreHub.tsx` (4 canais em useEffect secundário) para uma única instância consolidada do hook canônico.
   - Refatorar os 8 componentes de `src/components/prestador/` para usar `useRealtimeSubscription`.
2. **Eliminar dependências de funções instáveis nos hooks:**
   - Corrigir `FiscalView.tsx:87` e `ProtectionAdminModule.tsx:222` removendo callbacks não memoizados do array de `deps`.
3. **Adicionar controle de inatividade (`enabled: isOpen`) em Modals e Drawers:**
   - `DemandasDetalhesModal.tsx`, `NovaDemandaModal.tsx`, `CreateListingWizard.tsx`.

### Prioridade P2 (Otimizações & Limpeza Arquitetural)
1. **Desativar Polling Concorrente Mascarado:**
   - Condicionar o `setInterval` de `CheckoutPixModal.tsx` apenas a falhas do Realtime.
   - Substituir polling fixo no `Dashboard.tsx` por listener de `visibilitychange`.
   - Migrar `SiteCampaignBootstrap.tsx` de `setInterval` para Realtime CDC.
2. **Remover Workaround com `Math.random()` em `useVipLevels.ts`:**
   - Utilizar a infraestrutura canônica estável do `useRealtimeSubscription`.

---

## 6. Métodos de Verificação Independente

Para validar a integridade após a aplicação das correções:
1. **Executar o script de teste e validação estática:**
   ```bash
   npx vitest run src/tests/realtime-hook.test.ts
   ```
2. **Executar varredura estática contra padrões depreciados:**
   ```bash
   node -e "const fs = require('fs'); const txt = fs.readFileSync('src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx', 'utf8'); if (txt.includes('Date.now()') || txt.includes('useRealtimeTable')) process.exit(1); console.log('PASS');"
   ```
3. **Auditoria de Conexões WebSocket no Navegador:**
   - Abrir o Chrome DevTools -> Network -> WS.
   - Filtrar por `realtime/v1/websocket`.
   - Confirmar que:
     - Nenhuma mensagem `postgres_changes` de outros clientes/prestadores trafega no canal.
     - A abertura de modais ou digitação em campos de busca não emite novas mensagens `phx_join` de reconexão.
