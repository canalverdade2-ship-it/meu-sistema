# Handoff Report — Explorer R5: Auditoria de Performance, Leaks & Anti-Patterns em GSA HUB Realtime

## 1. Observation

Durante a auditoria exaustiva em 481 arquivos da codebase (incluindo os 98 componentes de UI e hooks centrais de realtime), foram observadas diretamente as seguintes ocorrências:

1. **Uso de Hook Deprecado e Nomes de Canal com `Date.now()`:**
   - Em `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx`:
     - Linha 8: `import { useRealtimeTable } from '../../../../hooks/useRealtimeTable';`
     - Linha 48: `useRealtimeTable(['orcamentos', 'ordens_servico'], () => setRtRefreshKey(k => k + 1));`
     - Linha 162: `.channel(\`admin-orcamentos-sd1-${Date.now()}\`)`
   - Em `src/components/admin/super-domains/operacoes/OrdensServicoWorkstation.tsx`:
     - Linha 151: `.channel(\`admin-os-sd1-${Date.now()}\`)`
   - Em `src/components/admin/ConfiguracoesModule.tsx`:
     - Linha 27: `useRealtimeTable('system_settings', () => setRtRefreshKey(k => k + 1));`
   - Em `src/hooks/useRealtimeTable.ts`:
     - Linha 11: `const channelName = \`rt-${prefix}-${Date.now()}\`;`

2. **Broadcast sem Filtro em Tabelas Multi-Tenant e Críticas:**
   - Em `src/hooks/useClientNotifications.tsx`:
     - Linha 318–324: `.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, (payload) => { ... const isForMe = n.cliente_id && String(n.cliente_id) === String(clientId); ... })`
   - Em `src/pages/Afiliado/AfiliadoDashboard.tsx`:
     - Linha 397: `{ table: 'saques', onChange: () => void load(true), debounceMs: 500 }` (sem filtro por `usuario_id`/`afiliado_id`).
   - Em `src/components/client/store/PurchasesPage.tsx`:
     - Linha 329: `{ table: 'loja_pedido_itens', debounceMs: 300, onChange: fetchPurchases }` (sem filtro, enquanto `loja_pedidos` possui filtro).
   - Em `src/components/client/store/CouponsPage.tsx`:
     - Linha 174: `.on('postgres_changes', { event: '*', schema: 'public', table: 'cupons_ativados' }, () => { fetchCupons(); })` (sem filtro por `cliente_id`).
   - Em `src/components/admin/super-domains/pessoas/PrestadorDetailDrawer.tsx`:
     - Linha 66: `{ table: 'prestador_demandas', enabled: isOpen }` (sem filtro por `prestador_id`).

3. **Multi-Canais Avulsos e Assinaturas Duplicadas:**
   - Em `src/components/client/ClientGSAStore.tsx`:
     - Linhas 621, 629, 637, 647, 652: criação simultânea de 5 canais diretos (`gsa-store-items`, `gsa-store-coupons`, `gsa-store-promos`, `cart-${clientId}`, `wa-sync-store`).
   - Em `src/components/client/StoreHub.tsx`:
     - Linha 153–156: `useRealtimeSubscription([{ table: 'produtos' }, { table: 'loja_carrinhos' }])`
     - Linhas 635–685: Segundo `useEffect` criando 4 canais avulsos (`purchases-${clientId}`, `refunds-${clientId}`, `promos-${clientId}`, `exchanges-${clientId}`) re-disparados a cada abertura/fechamento de modal.
   - Em `src/components/prestador/`: Todos os 8 componentes (`PrestadorAgenda.tsx`, `PrestadorDemandas.tsx`, `PrestadorDocumentos.tsx`, `PrestadorFinanceiro.tsx`, `PrestadorPremios.tsx`, `PrestadorPromocoes.tsx`, `PrestadorSuporte.tsx`, `PrestadorVouchers.tsx`) utilizam `.channel()` direto em vez do hook canônico.

4. **Deps / Callbacks Instáveis causando Re-subscriptions Contínuas:**
   - Em `src/components/admin/super-domains/financeiro/FiscalView.tsx`:
     - Linha 87: `useRealtimeSubscription({ table: 'ordens_fiscais', onChange: loadData }, [loadData]);` onde `loadData` possui dependência em `[activeTab, initialItemId]`.
   - Em `src/components/admin/ProtectionAdminModule.tsx`:
     - Linha 222: `useRealtimeSubscription({ table: resource, onChange: load, debounceMs: 300 }, [resource, load]);` onde `load` depende de `[appliedSearch, page, resource]`.

5. **Polling Mascarado Concorrente ao Realtime:**
   - Em `src/components/client/store/CheckoutPixModal.tsx`:
     - Linha 168: `setInterval(() => { checkStatusNow(); }, 3000);` concorrendo com 2 canais Realtime em `orcamentos` e `faturas`.
   - Em `src/components/admin/Dashboard.tsx`:
     - Linha 200: `setInterval(() => void load(true), 60_000);` concorrendo com `useRealtimeSubscription` em 13 tabelas.
   - Em `src/components/campaigns/SiteCampaignBootstrap.tsx`:
     - Linha 40: `setInterval(refresh, 30_000);` para `site_campaigns`.

6. **Realtime em Modals/Drawers sem `enabled: isOpen`:**
   - Em `src/components/admin/demandas/DemandasDetalhesModal.tsx` (linhas 130 e 1474), `NovaDemandaModal.tsx` (linha 68) e `CreateListingWizard.tsx` (linha 77).

---

## 2. Logic Chain

1. **A partir da Observação 1:** A geração de nomes de canais com `Date.now()` em `OrcamentosWorkstation.tsx` e `OrdensServicoWorkstation.tsx` faz com que cada execução do hook gere uma nova string de tópico. O multiplexador de conexões do Supabase não consegue reutilizar o canal e aloca um novo canal no WebSocket, gerando acúmulo de canais e subscriptions duplicadas. O uso de `useRealtimeTable` em `ConfiguracoesModule.tsx` e `OrcamentosWorkstation.tsx` reintroduz esse comportamento em produção.
2. **A partir da Observação 2:** Quando um componente do portal do cliente (como `useClientNotifications.tsx` para `notificacoes` ou `PurchasesPage.tsx` para `loja_pedido_itens`) assina uma tabela sem `filter: 'cliente_id=eq.X'`, o Supabase Broker no servidor PostgreSQL despacha todos os eventos de todos os usuários para todos os WebSockets ativos. O filtro é postergado para a memória do client, sobrecarregando o tráfego de rede e a CPU do navegador.
3. **A partir da Observação 3:** A criação de múltiplos canais WebSocket avulsos em `ClientGSAStore.tsx` (5 canais) e `StoreHub.tsx` (4 canais em dependência de estado de modal) multiplica o número de handshakes e tópicos ativos. Em `StoreHub.tsx`, a troca de visibilidade de um modal desmonta e remonta 4 canais desnecessariamente.
4. **A partir da Observação 4:** O hook `useRealtimeSubscription` foi projetado para isolar callbacks instáveis através de `useRef` (`callbacksRef.current`). No entanto, ao passar `[loadData]` ou `[resource, load]` no parâmetro `deps`, o `useEffect` interno é forçado a re-executar, destruindo e recriando a conexão WebSocket a cada tecla digitada ou troca de aba.
5. **A partir da Observação 5:** O uso de `setInterval` concorrente ao WebSocket ativo duplica a carga no servidor (requisições HTTP REST periódicas competindo com pushes em tempo real).
6. **A partir da Observação 6:** Modais que não utilizam `enabled: isOpen` mantêm listeners ativos e processam eventos mesmo quando ocultos na interface.

---

## 3. Caveats

- **Ambiente de Produção vs Desenvolvimento:** Em ambiente local ou com poucos usuários simultâneos, os vazamentos de canal e o fan-out sem filtro em `notificacoes` não causam travamento visível imediato, mas sob concorrência de centenas de clientes simultâneos tornam-se gargalos críticos.
- **Tabelas de Configuração Global:** Tabelas como `system_settings`, `client_levels` e `site_campaigns` são de leitura pública ou compartilhada; para elas, a ausência de filtro por usuário é aceitável por design, desde que haja `debounceMs` para mitigar tempestades de eventos em alterações em lote.

---

## 4. Conclusion

O ecossistema Realtime do GSA HUB possui uma base sólida através do hook canônico `useRealtimeSubscription`, mas apresenta 9 vulnerabilidades críticas (P0) e 21 pontos de alerta (P1/P2) distribuídos entre componentes legados, portais de clientes e modais administrativos. A migração completa dos 2 arquivos restantes que usam `useRealtimeTable`, a remoção de `Date.now()` dos nomes de canal, a aplicação de filtros `cliente_id` em `notificacoes`, `saques` e `loja_pedido_itens`, e a consolidação de canais avulsos em `ClientGSAStore` e `StoreHub` restabelecerão a integridade, performance e estabilidade da camada em tempo real do sistema.

---

## 5. Verification Method

Para verificar independentemente todos os pontos levantados:

1. **Varredura Automatizada contra Anti-Patterns:**
   Executar o script Node criado em `.agents/explorer_r5_antipatterns/audit_scan.cjs`:
   ```bash
   node .agents/explorer_r5_antipatterns/audit_scan.cjs
   ```
   *Condição de invalidação:* Não encontrar instâncias de `useRealtimeTable` ou `Date.now()` dentro de `.channel()`.

2. **Validação da Suíte de Testes Existente:**
   ```bash
   npx vitest run src/tests/realtime-hook.test.ts
   ```

3. **Inspeção Manual dos Arquivos Críticos:**
   - Verificar `src/components/admin/super-domains/operacoes/OrcamentosWorkstation.tsx` linhas 48 e 162.
   - Verificar `src/hooks/useClientNotifications.tsx` linhas 318–331.
   - Verificar `src/components/client/store/PurchasesPage.tsx` linha 329.
   - Verificar `src/components/client/ClientGSAStore.tsx` linhas 620–680.
