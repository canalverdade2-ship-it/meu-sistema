# Relatório de Auditoria de Lacunas de Cobertura Realtime (Gap Scan)
**Explorador:** Explorer R3  
**Data:** 2026-08-28  
**Repositório:** GSA HUB — Plataforma de Gestão de Serviços  
**Total de Arquivos Frontend Escaneados:** 481 arquivos TypeScript/TSX em `src/`  
**Total de Componentes com Realtime Ativo:** 141 arquivos  
**Total de Componentes/Páginas com Lacunas de Realtime Identificadas:** 29 módulos / candidatos  

---

## Sumário Executivo

A auditoria exaustiva de cobertura Realtime identificou que, embora o núcleo operacional e administrativo do GSA HUB possua 141 arquivos com integração via Supabase Realtime (`useRealtimeSubscription`, `useRealtime`, `useRealtimeTable`, `subscribeToTable` e canais dedicados), existem **áreas de alta colaboração e mutabilidade de dados que ainda operam com busca estática (`useEffect` com `supabase.from(...).select(...)`)**.

Essas lacunas afetam diretamente a experiência do usuário, forçando recarregamentos manuais de página (F5) em fluxos críticos como:
1. **Negociações e Classificados C2C (Marketplace):** Propostas, contrapropostas, moderação de anúncios, confirmações de venda e comissões.
2. **Marketplace de Viagens:** Emissão e disponibilização de vouchers de passagens aéreas e reservas em tempo real.
3. **E-Commerce e Engajamento da Loja:** Avaliações de produtos (social proof), cupons promocionais com limites de uso e sincronização de favoritos.
4. **Infraestrutura e Segurança de Sessão:** Rotação de ramais WhatsApp, indicador de conectividade em tempo real e revogação de acessos de colaboradores.
5. **Painéis de Relatórios e Cockpit Executivo:** Atualização dinâmica de KPIs diários e faturamento sem necessidade de clique no botão "Atualizar".

Abaixo detalha-se o catálogo estruturado com cada oportunidade identificada, a entidade de dados associada, o mecanismo atual, o impacto de negócio e a prescrição técnica exata de implementação.

---

## 1. Domínio: Classificados & Negociações P2P (C2C Marketplace)

### 1.1. `src/components/client/marketplace/classifieds/ClassifiedsClientDashboard.tsx`
* **Prioridade:** 🔴 P0 (Crítica)
* **Entidade de Dados / Tabelas Supabase:** `classificados_anuncios`, `classificados_propostas`, `classificados_transacoes`, `classificados_comissoes`
* **Mecanismo Atual de Fetch:** `Promise.all` estático dentro de `useEffect` (linhas 55–106), buscando simultaneamente anúncios do cliente, propostas enviadas/recebidas, transações de venda e comissões da GSA.
* **Impacto no Negócio / Benefício UX:** É a central de comando do vendedor e comprador de classificados. Quando uma nova proposta é recebida, o status de moderação do anúncio muda para "aprovado" ou uma venda é confirmada pela GSA, o usuário não recebe nenhuma atualização visual até sair e voltar da página.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription` (multi-tabela com array de configs)
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription([
      { table: 'classificados_anuncios', filter: `cliente_id=eq.${clientId}`, event: '*' },
      { table: 'classificados_propostas', filter: `vendedor_id=eq.${clientId}`, event: '*' },
      { table: 'classificados_propostas', filter: `comprador_id=eq.${clientId}`, event: '*' },
      { table: 'classificados_transacoes', filter: `vendedor_id=eq.${clientId}`, event: '*' },
      { table: 'classificados_comissoes', filter: `vendedor_id=eq.${clientId}`, event: '*' }
    ], [clientId]);
    ```
  * **Eventos:** `*` (INSERT, UPDATE, DELETE)
  * **Debounce:** 300ms

---

### 1.2. `src/components/client/marketplace/classifieds/MyNegotiationsPage.tsx`
* **Prioridade:** 🔴 P0 (Crítica)
* **Entidade de Dados / Tabelas Supabase:** `classificados_propostas` (com joins em `classificados_anuncios` e `classificados_transacoes`)
* **Mecanismo Atual de Fetch:** `fetchProposals` chamado em `useEffect` (linhas 13–39) nas dependências `[clientId, tab]`.
* **Impacto no Negócio / Benefício UX:** Negociação direta entre comprador e vendedor. Quando uma contraproposta é enviada ou a proposta é aceita/rejeitada, a tela precisa refletir a mudança no mesmo instante para evitar que o usuário tome ações conflitantes ou perca o timing do fechamento.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    const filterField = tab === 'comprando' ? 'comprador_id' : 'vendedor_id';
    useRealtimeSubscription({
      table: 'classificados_propostas',
      filter: `${filterField}=eq.${clientId}`,
      event: '*',
      onChange: fetchProposals,
      debounceMs: 200
    }, [clientId, tab]);
    ```
  * **Eventos:** `*`
  * **Debounce:** 200ms

---

### 1.3. `src/components/client/marketplace/classifieds/MyClassifiedSalesPage.tsx`
* **Prioridade:** 🔴 P0 (Crítica)
* **Entidade de Dados / Tabelas Supabase:** `classificados_transacoes` (join com `classificados_anuncios`)
* **Mecanismo Atual de Fetch:** `fetchSales` chamado em `useEffect` (linhas 38–74).
* **Impacto no Negócio / Benefício UX:** Acompanhamento do ciclo financeiro da venda (estados: `criada`, `aguardando_pagamento_ao_vendedor`, `comprovante_enviado`, `pagamento_confirmado`, `concluida`). O vendedor necessita saber em tempo real quando o comprador fez o Pix ou quando a GSA validou o repasse para proceder com a entrega do bem.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'classificados_transacoes',
      filter: `vendedor_id=eq.${clientId}`,
      event: '*',
      onChange: fetchSales,
      debounceMs: 250
    }, [clientId]);
    ```
  * **Eventos:** `*`
  * **Debounce:** 250ms

---

### 1.4. `src/components/client/marketplace/classifieds/MyClassifiedCommissionsPage.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `classificados_comissoes` (join com `classificados_transacoes`)
* **Mecanismo Atual de Fetch:** `fetchCommissions` chamado em `useEffect` (linhas 35–75).
* **Impacto no Negócio / Benefício UX:** Exibe as faturas e taxas de intermediação devidas pelo vendedor à plataforma. Quando o pagamento da comissão é processado, o status deve migrar de `pendente` para `paga` sem intervenção manual.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'classificados_comissoes',
      filter: `vendedor_id=eq.${clientId}`,
      event: '*',
      onChange: fetchCommissions,
      debounceMs: 250
    }, [clientId]);
    ```
  * **Eventos:** `*`
  * **Debounce:** 250ms

---

### 1.5. `src/components/client/marketplace/classifieds/MyClassifiedsPage.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `classificados_anuncios`, `classificados_ajustes`
* **Mecanismo Atual de Fetch:** `fetchMyAds` chamado em `useEffect` (linhas 18–36).
* **Impacto no Negócio / Benefício UX:** Painel onde o cliente acompanha seus anúncios submetidos. Quando o time de moderação da GSA aprova o anúncio, solicita ajustes em fotos/descrição ou quando o anúncio recebe propostas, o vendedor deve ver os badges atualizarem dinamicamente.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription([
      { table: 'classificados_anuncios', filter: `cliente_id=eq.${clientId}`, event: '*' },
      { table: 'classificados_ajustes', event: '*' }
    ], [clientId], { onChange: fetchMyAds, debounceMs: 300 });
    ```
  * **Eventos:** `*`
  * **Debounce:** 300ms

---

### 1.6. `src/components/client/marketplace/classifieds/ClassifiedDetailPage.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `classificados_anuncios`, `classificados_midias`
* **Mecanismo Atual de Fetch:** `fetchAdDetails` chamado em `useEffect` (linhas 27–57) baseado no `slug`.
* **Impacto no Negócio / Benefício UX:** Página pública do item anunciado. Se outro comprador fechar a compra ou o vendedor pausar o anúncio/alterar o preço, quem estiver navegando na página não deve ver dados obsoletos que induzam a erro na hora de enviar proposta.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'classificados_anuncios',
      filter: `slug=eq.${slug}`,
      event: 'UPDATE',
      onChange: fetchAdDetails,
      debounceMs: 300
    }, [slug]);
    ```
  * **Eventos:** `UPDATE`
  * **Debounce:** 300ms

---

### 1.7. Vitrines de Classificados (`GeneralClassifiedsPage.tsx`, `RealEstateMarketplacePage.tsx`, `VehiclesMarketplacePage.tsx`)
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `classificados_anuncios`
* **Mecanismo Atual de Fetch:** `useEffect` com consulta com `.eq('status', 'publicado')`.
* **Impacto no Negócio / Benefício UX:** Catálogo público de imóveis, veículos e produtos. Permite que novos itens apareçam e itens vendidos saiam do feed em tempo real com debounce seguro.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'classificados_anuncios',
      event: '*',
      onChange: fetchListings,
      debounceMs: 1000
    });
    ```
  * **Debounce:** 1000ms (evita oscilação de grid em grande volume de eventos)

---

## 2. Domínio: Marketplace de Viagens & Turismo

### 2.1. `src/components/client/marketplace/travel/MyTripsPage.tsx`
* **Prioridade:** 🔴 P0 (Crítica)
* **Entidade de Dados / Tabelas Supabase:** `viagens_transacoes`, `viagens_vouchers`, `viagens_propostas`
* **Mecanismo Atual de Fetch:** `fetchTrips` estático em `useEffect` (linhas 38–82), com queries aninhadas.
* **Impacto no Negócio / Benefício UX:** O cliente acompanha a confirmação do pacote, reserva aérea e, principalmente, a emissão dos vouchers em PDF (`viagens_vouchers`). Quando a equipe de viagens faz o upload do bilhete e confirma a emissão, o botão de download do voucher deve aparecer instantaneamente para o viajante.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription([
      { table: 'viagens_transacoes', filter: `cliente_id=eq.${clientId}`, event: '*' },
      { table: 'viagens_vouchers', event: 'INSERT' }
    ], [clientId], { onChange: fetchTrips, debounceMs: 300 });
    ```
  * **Eventos:** `*` em transações, `INSERT` em vouchers
  * **Debounce:** 300ms

---

### 2.2. `src/components/client/marketplace/travel/TravelCategoryPage.tsx` & `TravelPackageDetailPage.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `viagens_pacotes`, `viagens_pacote_imagens`
* **Mecanismo Atual de Fetch:** `fetchPackages` estático em `useEffect` (linhas 52–75).
* **Impacto no Negócio / Benefício UX:** Atualização dinâmica de preços promocionais, pacotes esgotados e novos destinos internacionais/nacionais.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'viagens_pacotes',
      event: 'UPDATE',
      onChange: fetchPackages,
      debounceMs: 500
    }, [category]);
    ```

---

## 3. Domínio: E-Commerce Store & Engajamento do Cliente

### 3.1. `src/components/client/store/ProductReviews.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `loja_avaliacoes` (via `fetchProductReviews`), `clientes`
* **Mecanismo Atual de Fetch:** `loadReviews` em `useEffect` (linhas 79–82) sem listener de banco.
* **Impacto no Negócio / Benefício UX:** Social proof e reputação em tempo real. Quando um cliente publica uma avaliação ou clica em "curtir" uma avaliação existente, outros clientes visualizando a página do produto devem ver o feedback e a nota média recalculada ao vivo.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'loja_avaliacoes',
      filter: `produto_id=eq.${productId}`,
      event: '*',
      onChange: loadReviews,
      debounceMs: 300
    }, [productId]);
    ```
  * **Eventos:** `INSERT`, `UPDATE`, `DELETE`
  * **Debounce:** 300ms

---

### 3.2. `src/components/client/store/StoreHubCoupons.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `cupons_loja`, `cupons_ativados`, `orcamentos`
* **Mecanismo Atual de Fetch:** `fetchCupons` chamado apenas ao abrir o modal (`isOpen`) em `useEffect` (linhas 26–30).
* **Impacto no Negócio / Benefício UX:** Campanhas de cupons relâmpago com cota limitada de usos (`limite_usos`). Se o cupom esgotar enquanto o cliente está com o modal aberto ou se o marketing da GSA lançar um cupom de 50% durante uma live/campanha, a lista deve se atualizar instantaneamente.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription([
      { table: 'cupons_loja', event: '*' },
      { table: 'cupons_ativados', filter: clientId ? `cliente_id=eq.${clientId}` : undefined, event: '*' }
    ], [isOpen, clientId], { enabled: isOpen, onChange: fetchCupons, debounceMs: 300 });
    ```
  * **Filtro:** `enabled: isOpen` (garante que não haja consumo de canal com o modal fechado)
  * **Debounce:** 300ms

---

### 3.3. `src/components/client/store/WishlistPage.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `loja_favoritos`, `produtos`, `servicos`, `assinaturas`
* **Mecanismo Atual de Fetch:** `loadProductsForIds` via `useEffect` (linhas 16–90).
* **Impacto no Negócio / Benefício UX:** Sincronização entre abas e dispositivos. Quando o cliente clica no coração na loja em uma aba (ou no celular), a página de lista de desejos já aberta no desktop sincroniza automaticamente.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'loja_favoritos',
      filter: clientId ? `cliente_id=eq.${clientId}` : undefined,
      event: '*',
      onChange: () => { void fetchWishlistFromDb(clientId).then(loadProductsForIds); },
      enabled: Boolean(clientId),
      debounceMs: 250
    }, [clientId]);
    ```

---

### 3.4. `src/components/client/store/OrderReviewModal.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `loja_avaliacoes`
* **Mecanismo Atual de Fetch:** Consulta direta no submit e verificação de avaliação existente.
* **Impacto no Negócio / Benefício UX:** Evita duplicação de reviews e atualiza o estado de moderação.
* **Recomendação:** Assinatura em `loja_avaliacoes` filtrada por `orcamento_id=eq.${orderId}` com `debounceMs: 200`.

---

### 3.5. `src/components/client/store/BlogHome.tsx` & `BlogPostPage.tsx`
* **Prioridade:** 🟢 P3 (Baixa)
* **Entidade de Dados / Tabelas Supabase:** `blog_posts`
* **Mecanismo Atual de Fetch:** `useEffect` estático buscando posts publicados.
* **Impacto no Negócio / Benefício UX:** Publicação imediata de comunicados e novidades editoriais sem necessidade de revalidação de cache.
* **Recomendação:** `useRealtimeSubscription({ table: 'blog_posts', event: '*' }, [], { debounceMs: 1000 })`.

---

## 4. Domínio: Infraestrutura, Monitoramento & Segurança de Sessão

### 4.1. `src/components/admin/infra/WhatsAppQRCodeManager.tsx`
* **Prioridade:** 🔴 P0 (Crítica)
* **Entidade de Dados / Tabelas Supabase:** `system_settings` (`gsa_whatsapp_ramais_config`, `whatsapp_suporte_numero`), `gsa_whatsapp_ramais`
* **Mecanismo Atual de Fetch:** Funções `loadDeviceConfig` e `loadRamais` executadas apenas no mount (linhas 112–188).
* **Impacto no Negócio / Benefício UX:** O painel administra o pareamento do WhatsApp do sistema, status da conexão da VPS e ramais de transbordo (Comercial, Financeiro, SAC, etc.). Se a VPS desconectar, reconectar ou outro admin alterar os números de transbordo, a interface deve refletir os ramais e o status operacional live sem descompasso.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'system_settings',
      event: 'UPDATE',
      onChange: () => {
        void loadDeviceConfig();
        void loadRamais();
      },
      debounceMs: 300
    });
    ```

---

### 4.2. `src/components/admin/SystemStatusIndicator.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** Probing sintético em `clientes.select('id').limit(1)`
* **Mecanismo Atual de Fetch:** Executa uma query única no mount ou ao clicar no popover (linhas 43–77).
* **Impacto no Negócio / Benefício UX:** O indicador no header superior informa se o sistema está online, com alta latência ou desconectado. Ao invés de uma query estática que só roda quando o usuário clica, o componente deve monitorar o estado real da conexão WebSocket do Supabase (`SUBSCRIBED`, `CHANNEL_ERROR`, `CLOSED`, `TIMED_OUT`).
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:** Utilizar a subscription canônica para monitorar o status do canal e alternar o badge visual entre Verde (`SUBSCRIBED`), Amarelo (`TIMED_OUT`) e Vermelho (`CHANNEL_ERROR`/`CLOSED`) de forma 100% reativa.

---

### 4.3. `src/pages/AdminPanel.tsx` (Controle de Sessão e RBAC de Colaboradores)
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `colaboradores`
* **Mecanismo Atual de Fetch:** `useEffect` com consulta única a `colaboradores` para obter nome inicial (linhas 236–245).
* **Impacto no Negócio / Benefício UX:** Segurança de acesso: se um administrador master alterar os módulos permitidos de um colaborador ou inativar seu acesso na tabela `colaboradores`, o painel do colaborador ativo deve revogar a sessão ou atualizar as permissões de menu em tempo real.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração Recomendada:**
    ```typescript
    useRealtimeSubscription({
      table: 'colaboradores',
      filter: colaboradorId ? `id=eq.${colaboradorId}` : undefined,
      event: '*',
      enabled: adminType === 'colaborador' && Boolean(colaboradorId),
      onPayload: (payload) => {
        const next = payload.new as any;
        if (payload.eventType === 'DELETE' || next?.ativo === false || next?.status === 'inativo') {
          toast.error('Seu acesso foi revogado pelo administrador.');
          onLogout();
        }
      },
      debounceMs: 200
    }, [adminType, colaboradorId]);
    ```

---

### 4.4. `src/hooks/usePixDiscount.ts`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `system_settings` (`pix_discount_percentage`, `pix_discount_settings`)
* **Mecanismo Atual de Fetch:** `useEffect` com leitura de `system_settings` no mount.
* **Impacto no Negócio / Benefício UX:** Regra global de desconto Pix na loja e orçamentos. Quando o administrador altera o percentual de desconto no painel, os carrinhos e checkouts abertos no frontend de clientes devem recalcular os totais instantaneamente.
* **Recomendação Técnica:** `useRealtimeSubscription({ table: 'system_settings', filter: 'key=eq.pix_discount_settings', event: 'UPDATE' })` com `debounceMs: 300`.

---

### 4.5. `src/components/ui/GSAChatbotWidget.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `system_settings` (`gsa_whatsapp_ramais_config`, `whatsapp_suporte_numero`)
* **Mecanismo Atual de Fetch:** `useEffect` no mount para carregar o número oficial do bot flutuante.
* **Impacto no Negócio / Benefício UX:** Garante que o botão flutuante de WhatsApp no rodapé sempre direcione o lead/cliente para o ramal correto em caso de rotação de emergência de número.
* **Recomendação Técnica:** `useRealtimeSubscription({ table: 'system_settings', event: 'UPDATE', debounceMs: 500 })`.

---

## 5. Domínio: Relatórios Executivos, Financeiros & Operacionais (Cockpit Live)

Atualmente, todos os 15 componentes em `src/components/admin/relatorios/` operam via fetch sob demanda quando o filtro de período é alterado ou ao clicar no botão manual "Atualizar". Para visualização do dia corrente ("Hoje", "Semana Atual", "Mês Atual"), a adição de Realtime com debounce transforma os relatórios em um **Cockpit Operacional ao Vivo**.

### 5.1. `src/components/admin/relatorios/RelatorioFinanceiro.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `faturas`, `pagamentos`, `saques`, `transferencias`, `clientes`, `ordens_assinatura`, `assinaturas`
* **Mecanismo Atual de Fetch:** `carregar()` estático com 7 queries simultâneas via `Promise.all` em `useEffect` (linhas 15–81).
* **Impacto no Negócio / Benefício UX:** Permite que a diretoria financeira acompanhe faturamento do dia, volume de Pix recebido e solicitações de saque em tempo real na tela sem cliques repetitivos.
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração:**
    ```typescript
    useRealtimeSubscription([
      { table: 'faturas', event: '*' },
      { table: 'pagamentos', event: 'INSERT' },
      { table: 'saques', event: '*' },
      { table: 'transferencias', event: '*' }
    ], [periodo, dataInicio, dataFim], { onChange: carregar, debounceMs: 500 });
    ```

---

### 5.2. `src/components/admin/relatorios/RelatorioExecutivo.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `faturas`, `clientes`, `ordens_servico`, `saques`
* **Mecanismo Atual de Fetch:** `carregar()` em `useEffect` (linhas 30–82).
* **Impacto no Negócio / Benefício UX:** Visão consolidada de KPIs da empresa (novos clientes, faturas pagas, OS concluídas).
* **Recomendação Técnica:**
  * **Hook:** `useRealtimeSubscription`
  * **Configuração:** Multi-tabela em `faturas`, `clientes`, `ordens_servico`, `saques` com `debounceMs: 600`.

---

### 5.3. `src/components/admin/relatorios/RelatorioOS.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `ordens_servico`, `orcamentos`
* **Mecanismo Atual de Fetch:** `useEffect` com consulta estática.
* **Impacto no Negócio / Benefício UX:** Monitoramento operacional do fluxo de ordens de serviço e orçamentos aprovados.
* **Recomendação Técnica:** `useRealtimeSubscription([{ table: 'ordens_servico' }, { table: 'orcamentos' }], [periodo], { onChange: carregar, debounceMs: 500 })`.

---

### 5.4. `src/components/admin/relatorios/RelatorioCobranca.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `cobrancas`
* **Mecanismo Atual de Fetch:** `useEffect` com consulta estática.
* **Impacto no Negócio / Benefício UX:** Recuperação de crédito: atualiza em tempo real as dívidas quitadas ou novos clientes inadimplentes.
* **Recomendação Técnica:** `useRealtimeSubscription({ table: 'cobrancas', event: '*' }, [periodo], { onChange: carregar, debounceMs: 400 })`.

---

### 5.5. `src/components/admin/relatorios/RelatorioSuporte.tsx`
* **Prioridade:** 🟡 P1 (Alta)
* **Entidade de Dados / Tabelas Supabase:** `tickets`
* **Mecanismo Atual de Fetch:** `useEffect` com consulta estática.
* **Impacto no Negócio / Benefício UX:** Gestão de chamados e tempo de atendimento (SLA) em tempo real para a equipe de Helpdesk.
* **Recomendação Técnica:** `useRealtimeSubscription({ table: 'tickets', event: '*' }, [periodo], { onChange: carregar, debounceMs: 400 })`.

---

### 5.6. `src/components/admin/relatorios/RelatorioPrestadores.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `prestadores`, `prestador_demandas`, `prestador_faturas`, `prestador_saques`
* **Recomendação:** `useRealtimeSubscription([{ table: 'prestadores' }, { table: 'prestador_demandas' }, { table: 'prestador_saques' }], [periodo], { onChange: carregar, debounceMs: 500 })`.

---

### 5.7. `src/components/admin/relatorios/RelatorioLoja.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `faturas`, `produtos`, `loja_solicitacoes`
* **Recomendação:** `useRealtimeSubscription([{ table: 'faturas' }, { table: 'loja_solicitacoes' }], [periodo], { onChange: carregar, debounceMs: 500 })`.

---

### 5.8. `src/components/admin/relatorios/RelatorioEmprestimos.tsx`, `RelatorioCredito.tsx`, `RelatorioRentabilidade.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `emprestimos`, `emprestimo_parcelas`, `loja_credito_solicitacoes`, `faturas`
* **Recomendação:** `useRealtimeSubscription([{ table: 'emprestimos' }, { table: 'emprestimo_parcelas' }, { table: 'loja_credito_solicitacoes' }], [periodo], { onChange: carregar, debounceMs: 500 })`.

---

### 5.9. `src/components/admin/relatorios/RelatorioMarketing.tsx` & `RelatorioGamificacao.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `vouchers`, `indicacoes`, `promocoes`, `pontos_movimentacoes`, `cliente_premios`
* **Recomendação:** `useRealtimeSubscription([{ table: 'indicacoes' }, { table: 'vouchers' }, { table: 'pontos_movimentacoes' }], [periodo], { onChange: carregar, debounceMs: 500 })`.

---

### 5.10. `src/components/admin/relatorios/RelatorioFiscal.tsx` & `RelatorioOperacional.tsx`
* **Prioridade:** 🟢 P2 (Média)
* **Entidade de Dados / Tabelas Supabase:** `ordens_fiscais`, `solicitacoes_exclusao`, `colaboradores`, `ordens_assinatura`
* **Recomendação:** `useRealtimeSubscription([{ table: 'ordens_fiscais' }, { table: 'solicitacoes_exclusao' }], [periodo], { onChange: carregar, debounceMs: 500 })`.

---

## 6. Matriz de Priorização de Implementação (Roadmap)

| Fase | Prioridade | Módulo / Arquivo | Tabelas Alvo | Justificativa |
| :--- | :---: | :--- | :--- | :--- |
| **Fase 1** | 🔴 P0 | `ClassifiedsClientDashboard.tsx` | `classificados_anuncios`, `classificados_propostas`, `classificados_transacoes`, `classificados_comissoes` | Cockpit central de negociação e comissões |
| **Fase 1** | 🔴 P0 | `MyNegotiationsPage.tsx` | `classificados_propostas` | Negociação ativa de ofertas e contrapropostas |
| **Fase 1** | 🔴 P0 | `MyClassifiedSalesPage.tsx` | `classificados_transacoes` | Confirmação de recebimento de pagamentos |
| **Fase 1** | 🔴 P0 | `MyTripsPage.tsx` | `viagens_transacoes`, `viagens_vouchers` | Liberação imediata de vouchers emitidos |
| **Fase 1** | 🔴 P0 | `WhatsAppQRCodeManager.tsx` | `system_settings`, `gsa_whatsapp_ramais` | Monitoramento live da VPS de WhatsApp |
| **Fase 2** | 🟡 P1 | `MyClassifiedsPage.tsx` | `classificados_anuncios`, `classificados_ajustes` | Moderação e ajustes de anúncios |
| **Fase 2** | 🟡 P1 | `MyClassifiedCommissionsPage.tsx` | `classificados_comissoes` | Quitação de comissões GSA |
| **Fase 2** | 🟡 P1 | `ProductReviews.tsx` | `loja_avaliacoes` | Social proof e notas de produtos ao vivo |
| **Fase 2** | 🟡 P1 | `StoreHubCoupons.tsx` | `cupons_loja`, `cupons_ativados` | Cupons com limite de resgate |
| **Fase 2** | 🟡 P1 | `SystemStatusIndicator.tsx` | Supabase Channel Status | Indicador real de saúde da conexão WebSocket |
| **Fase 2** | 🟡 P1 | `AdminPanel.tsx` (RBAC) | `colaboradores` | Revogação instantânea de sessões e permissões |
| **Fase 2** | 🟡 P1 | `RelatorioFinanceiro.tsx` | `faturas`, `pagamentos`, `saques` | Cockpit financeiro ao vivo |
| **Fase 2** | 🟡 P1 | `RelatorioExecutivo.tsx` | `faturas`, `clientes`, `ordens_servico` | KPIs executivos diários |
| **Fase 3** | 🟢 P2 | `WishlistPage.tsx` | `loja_favoritos` | Sincronização multi-aba de favoritos |
| **Fase 3** | 🟢 P2 | Vitrines Classificados/Viagens | `classificados_anuncios`, `viagens_pacotes` | Atualização de catálogo (1000ms debounce) |
| **Fase 3** | 🟢 P2 | Demais Relatórios Administrativos | `cobrancas`, `tickets`, `emprestimos`, etc. | Atualização automática sob demanda |

---

## 7. Diretrizes Técnicas para a Implementação

1. **Uso Exclusivo do Hook Canônico:** Todas as novas implementações devem utilizar exclusivamente `useRealtimeSubscription` (ou o helper `useRealtime`), importado de `src/hooks/useRealtime` ou `src/lib/supabaseRealtime`. O hook legado `useRealtimeTable` não deve ser utilizado em nenhum cenário novo.
2. **Filtros de Linha Obrigatórios:** Para dados específicos de um cliente, vendedor ou usuário, **sempre aplicar o filtro de linha** (ex: `filter: 'cliente_id=eq.${clientId}'` ou `filter: 'vendedor_id=eq.${clientId}'`). Evitar broadcast global em tabelas transacionais de alto volume.
3. **Debounce Apropriado:**
   * Operações individuais e modais (detalhes, negociações): **200ms – 300ms**
   * Dashboards e relatórios consolidados: **500ms – 600ms**
   * Vitrines e catálogos públicos: **1000ms**
4. **Controle de Montagem (`enabled`):** Em modais e abas condicionais (ex: `StoreHubCoupons`), configurar a flag `enabled: isOpen` para destruir a subscription enquanto o modal estiver fechado, prevenindo vazamentos de WebSocket e consumo inútil de banda.
