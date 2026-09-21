# Relatório Técnico de Handoff — Frontend Architecture & API Integrations
**Agente Explorador:** `teamwork_preview_explorer_fe_1`  
**Data/Hora:** 2026-09-11T02:25:00Z  
**Repositório/Diretório:** `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`  
**Alvo da Investigação:** Arquitetura do Frontend React 19, Roteamento, Camada de Componentes e UI, Integrações Supabase & Realtime, Webhooks (WhatsApp/n8n/Evolution API), Storage (Cloudflare R2) e Microserviço Backend (`server_webhook*.cjs`).

---

## 1. Observation (Observações Diretas e Evidências do Código-Fonte)

### 1.1. Arquitetura de Entrada, Bootstrap e Ciclo de Vida da Aplicação
* **Ponto de Entrada (`src/main.tsx:1-23`):**
  - Renderiza em `StrictMode` com árvore de componentes encapsulada:
    `createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><SiteCampaignBootstrap /><App /></ErrorBoundary></StrictMode>)`.
  - Executa a atribuição inicial de tráfego de afiliados antes do bootstrap: `captureAffiliateReferralFromLocation()` (`src/main.tsx:13`).
  - Importa guardas de segurança para mensagens em tela (`./lib/clientFacingMessageGuard`) e os pacotes globais de estilização: `index.css`, `careers.css`, `gsa-store.css`, `supplier-portal.css`.

* **Núcleo de Provedores e Layouts (`src/App.tsx:490-795`):**
  - Hierarquia de Provedores Contextuais Globais:
    1. `<FileViewerProvider>` (`src/contexts/FileViewerContext.tsx`): Gerencia visualização centralizada de arquivos PDF, imagens e planilhas em modal acessível.
    2. `<QueryClientProvider client={queryClient}>` (`@tanstack/react-query: ^5.90.21`): Gerencia cache, invalidações e sincronização de dados de servidor.
    3. `<AffiliateTrackingBridge clientId={session.clientId} />` (`src/components/AffiliateTrackingBridge.tsx`): Sincroniza cookies/referrals de afiliados com a sessão ativa.
    4. `<ErrorBoundary>` (`src/components/ErrorBoundary.tsx`): Captura falhas de renderização React com opção de reload amigável.
    5. `<Suspense fallback={<RouteLoading />}>`: Carregamento preguiçoso de rotas com resiliência (`lazyWithRetry` em `src/lib/lazyWithRetry.ts`).
  - Widgets Globais Flutuantes e de Infraestrutura (`src/App.tsx:787-792`):
    - `<AdvertisingSlot placementCode="SITE_STICKY_BOTTOM" variant="sticky" />` (ativo em rotas públicas, marketplace e cliente).
    - `<FullscreenPrompt />` (sugerido quando a sessão está ativa).
    - `<WhatsAppButton />` (botão de atendimento direto ao cliente/prestador).
    - `<GSAChatbotWidget />` (widget de inteligência artificial GSA integrado ao site).
    - `<Toaster position="top-right" />` (`react-hot-toast: ^2.6.0`).

* **Mecanismo de Sessão e Desconexão Automática (`src/App.tsx:184-327`, `src/hooks/useAutoLogout.ts`):**
  - A sessão é orquestrada pelo `sessionService` (`src/lib/sessionService.ts`).
  - Restauração de sessão assíncrona (`sessionService.restoreSession()` em `App.tsx:337`) valida a integridade do token no banco via RPC `gsa_validate_session`.
  - Hook `useAutoLogout` executa ping a cada 15 segundos (`gsa_ping_session`) e escuta o evento global `window.addEventListener('gsa-session-revoked')` para deslogar imediatamente o usuário quando a conta for aberta em outro dispositivo (`superseded`) ou revogada pelo administrador.
  - Migração Automática de Carrinho de Visitante (`migrateGuestCartToAccount` em `src/App.tsx:39-153`):
    Ao logar, os itens salvos localmente em `gsa_pending_store_checkout` e cupons em `gsa_pending_store_coupons` são migrados atomicamente para a tabela `loja_carrinhos` no Supabase via `clientOperationalWrite`, com dedup de itens e validação de existência de IDs de produtos/serviços.

### 1.2. Motor de Roteamento Customizado (`src/routing/`)
Diferente de SPAs tradicionais baseadas em `react-router-dom`, o projeto implementa um motor de roteamento autônomo, fortemente tipado e orientado à segurança:
* **`navigationService.ts:5-108`:** Classe Singleton que encapsula a History API do navegador (`window.history.pushState` e `replaceState`), com padrão Observer para notificar assinantes do React via `popstate`. Fornece utilitários de query params e sincronização de modais diretamente na URL (`openRouteModal`, `closeRouteModal`, `updateRouteQuery`).
* **`useAppLocation.ts:1-40`:** Hook reativo que escuta as mudanças de histórico e invoca o `matchRoute`.
* **`routeMatcher.ts:19-314`:** Parser determinístico que desmembra caminhos em `AppArea` (`'public' | 'marketplace' | 'client' | 'business' | 'admin' | 'provider' | 'supplier' | 'advertiser' | 'login' | 'unknown'`), identificando `module`, `submodule` e `itemId`.
* **`routeSecurity.ts:20-39`:** Função `isRouteAllowed` que aplica barreiras rigorosas de acesso baseadas no ator da sessão (`clientId`, `clientPersonType`, `adminAuth`, `adminType`, `colaboradorModulos`, `prestadorId`, `fornecedorId`). Impede que clientes PJ acessem rotas PF e vice-versa, e valida permissões modulares de colaboradores via `hasAdminModuleAccess`.
* **`safeReturnTo.ts:1-29`:** Previne vulnerabilidades de Open Redirect sanitizando e validando os destinos do parâmetro `returnTo`.

### 1.3. Arquitetura Visual, UI Libraries e Design System
* **Bibliotecas Base e Utilitários de Interface (`package.json`):**
  - **Framework CSS:** Tailwind CSS v4 (`@tailwindcss/vite: ^4.1.14`, `tailwindcss: ^4.1.14`).
  - **Primitivas Headless:** Coleção completa Radix UI (`@radix-ui/react-dialog`, `dropdown-menu`, `popover`, `select`, `tabs`, `tooltip`, `switch`, `checkbox`, `separator`, `slot`).
  - **Composição de Classes:** `clsx`, `tailwind-merge` e `class-variance-authority` (CVA).
  - **Animações:** `framer-motion: ^12.35.0` e `motion: ^12.23.24`.
  - **Gráficos e Dashboards:** `recharts: ^3.8.0`.
  - **Tabelas Complexas:** `@tanstack/react-table: ^9.1.2`.
  - **Documentação e Relatórios:** `jspdf: 4.2.1`, `jspdf-autotable: ^5.0.7`, `exceljs: ^4.4.0`, `papaparse: ^5.5.4`.
  - **Recursos Especiais:** Assinatura digital com `signature_pad: ^5.1.3`, leitor de código de barras/QR com `@zxing/browser: ^0.2.1`, terminal web com `xterm: ^5.3.0`.
* **Tokens de Design Enterprise (`src/index.css:1-98`):**
  - Variáveis CSS nativas definindo a paleta de cores institucional: `--brand: #4F46E5`, `--brand-hover: #4338CA`, `--canvas-bg: #F8FAFC`, `--surface-primary: #FFFFFF`, `--sidebar-bg: #0F0F0F`.
  - Estados semânticos completos: `--status-success-*` (esmeralda), `--status-warning-*` (âmbar), `--status-danger-*` (vermelho), `--status-info-*` (azul), `--status-neutral-*` (slate).
  - Escala de raios de curvatura (`--radius-xs` a `--radius-3xl`) e elevações multicamadas (`--shadow-xs` a `--shadow-modal`).
  - CSS Bundles dedicados por ecossistema: `careers.css`, `gsa-store.css`, `supplier-portal.css`, `affiliates.css`, `partners.css`.
* **Ecossistemas Modulares Isolados:**
  - **Painel Administrativo (`src/components/admin/` - 69 módulos):** Dividido entre Gestão Financeira (`FinanceiroModule`, `CobrancaModule`, `CreditoModule`, `EmprestimosModule`, `ReembolsosModule`), E-commerce/Catálogo (`ProdutosModule`, `LojaCategoriasModule`, `CuponsLojaModule`, `LojaTrocasModule`, `OrdensCompraModule`), Operações & Serviços (`OrcamentosModule`, `ServicosModule`, `OrdensServicoModule`, `TicketsModule`), Mídia & TV (`GsaTvModule`, `GsaTvLiveConsole`, `GsaTvControlRoom`), e Monitoramento/Auditoria (`WhatsAppHealthMonitor`, `SystemMonitorModule`, `ScrapingAdminModule`).
  - **Portal do Cliente e Empresas (`src/components/client/` - 26 módulos):** Suporta modos PF e PJ com módulos de `StoreHub`, `ClientGSAStore`, `ClientFinanceiro`, `ClientOrcamentos`, `ClientEmprestimos`, `ClientMeuCredito`, `ClientAreaVIP`, `ClientPontos`, `ClientIndiqueGanhe`.
  - **Portal do Prestador (`src/pages/Prestador/`, `src/components/prestador/`):** Gestão de demandas de campo, agenda, documentação, saques e carteira.
  - **Portal do Fornecedor (`src/pages/Fornecedor/`):** Gestão de cotações, produtos fornecidos e faturamento B2B.
  - **Portal do Afiliado (`src/pages/Afiliado/`):** Rastreamento de links, relatórios de comissões em tempo real e solicitações de saque via PIX.

### 1.4. Camada de Integração com a API Supabase
* **Inicialização e Proxying do Cliente (`src/lib/supabase.ts:308-368`):**
  - Padrão **Lazy Initialization Proxy**: O cliente Supabase (`export const supabase = new Proxy(...)`) só inicializa sob demanda, prevenindo falhas de inicialização em tempo de build/import.
  - Endpoint de Produção: Aponta para a VPS dedicada via `VITE_SUPABASE_URL` com fallback oficial em `https://api.147-15-43-141.nip.io` e chave anon `SUPABASE_ANON_KEY_FALLBACK`.
  - Configurações do motor Realtime:
    `eventsPerSecond: 5`, `timeout: 30000`, `heartbeatIntervalMs: 30000`, e reconexão com backoff exponencial limitado a 30s: `(tries) => Math.min(1000 * Math.pow(2, tries), 30000)`.
  - Interceptador de Storage (`getStorageProxy`): Intercepta chamadas de storage. O bucket legado `emprestimos` é redirecionado para `gsa-private-documents` com prefixo `gsa-private://`. O bucket `documentos_cliente` impõe regras estritas de isolamento por ID de cliente no frontend (limite 10MB e extensões autorizadas).
  - Interceptador de RPC (`getRpcProxy`): Executa rollback automático de arquivos no storage caso RPCs como `gsa_admin_emprestimo_enviar_contrato` falhem após o upload.

* **Infraestrutura Realtime Canônica (`src/hooks/useRealtime.ts`):**
  - **Eliminação de Stale Closures:** Sincroniza `callbacksRef.current` em toda passagem de renderização (`useRealtime.ts:61-70`), garantindo que callbacks recebam sempre o estado e props frescos.
  - **Prevenção de Desincronização de Índices (Index Desync):** Ao filtrar configs inativas (`enabled === false`), o hook mapeia `{ config, originalIdx }` (`useRealtime.ts:118-122`), pareando payloads e debounce timers exatamente com os callbacks originais.
  - **Proteção Contra Race Conditions de Remount:** A subscrição compara `channelRef.current === channel` (`useRealtime.ts:208-222`), descartando canais ultrapassados em montagens rápidas.
  - **Cleanup Garantido:** Remove o canal ativo via `supabase.removeChannel(chan)` e limpa todos os timers de debounce no unmount.

* **Padronização de Chamadas Seguras (Zero-Trust Client Operations):**
  - `src/lib/clientRpc.ts`: Função `callClientRpc` valida a sessão local do cliente e injeta compulsoriamente `p_sessao_id` e `p_session_token`.
  - `src/lib/clientOperationalWrite.ts`: Em vez de inserts/updates diretos sujeitos a manipulação no cliente, as operações passam pela RPC `gsa_client_operational_write`, onde o banco valida o token e infere a identidade do ator.
  - `src/lib/adminRpc.ts`: Coleção de 770+ linhas de chamadas administrativas tipadas que verificam autorização via `p_sessao_id` e `p_session_token`, despachando `gsa-session-revoked` em caso de erro 401 ou JWT inválido.

### 1.5. Integrações Externas e Webhooks
* **Notificações Administrativas WhatsApp (`src/utils/n8nWhatsApp.ts`):**
  - Recupera configurações dinamicamente via RPC `gsa_admin_settings_snapshot` (ou fallback na tabela `system_settings`).
  - Executa cascata de envio com 3 níveis:
    1. Chamada à Edge Function `vps-api` (`action: 'send-whatsapp'`).
    2. Fallback direto à Evolution API na VPS (`http://147.15.43.141:8080/message/sendText/GSA_WhatsApp`, com headers `apikey: gsa_hub_evolution_token_2026` e `charset=utf-8`).
    3. Fallback ao Webhook do n8n (`http://147.15.43.141:5678/webhook/send-whatsapp`).

* **Notificações ao Cliente e Variação Anti-Ban (`src/lib/whatsappNotificationService.ts`):**
  - Gerador de templates estruturados cobrindo **28 tipos contextuais** (`orcamento`, `os`, `compra`, `fatura`, `emprestimo`, `extrato`, etc.).
  - Motor de Variação Dinâmica (`src/lib/whatsappVariationService.ts`): Aplica saudações/despedidas dinâmicas, randomização de URLs (`randomizeMessageUrls`), injeção de caracteres invisíveis (`injectZeroWidthEntropy`) e variação de bytes em PDFs (`pdfVariationEngine`) para prevenir bloqueios de spam.
  - Coreografia de Presença: Simula comportamento humano disparando confirmação de leitura (`markMessageAsRead`), presença disponível, e ciclo de digitação (`composing` por 4s -> `paused` por 2s -> `composing` por 3s) antes do disparo da mensagem.
  - Sistema de Fila e Circuit Breaker (`src/lib/whatsappHealthService.ts`): Monitora o estado da Evolution API (`/instance/connectionState/GSA_WhatsApp`). Se a conexão cair, pausa o despacho e enfileira as mensagens no `localStorage` (`gsa_whatsapp_pending_queue`) sem perda de dados.

* **Microserviço Backend VPS (`server_webhook.cjs` / `server_webhook_vps_live.cjs`):**
  - Servidor Node.js autônomo (9.600+ linhas) operando na porta 5680 da VPS.
  - **SessionMutex (`server_webhook.cjs:45-84`):** Fila FIFO por número de telefone que serializa o processamento de mensagens concorrentes recebidas de um mesmo usuário, prevenindo deadlocks e race conditions na base de dados.
  - **Inteligência Artificial Nativa:** Integrado diretamente com a API Google Gemini (`gemini-3.5-flash-lite`), operando com prompt de sistema empresarial e cache dinâmico de catálogo de produtos e serviços renovado a cada 5 minutos.
  - Processa webhooks transacionais da Meta WhatsApp Cloud API e da Evolution API, gerenciando menus interativos, pedidos, consultas de faturas e protocolos.

* **Camada de Storage em Cloudflare R2 (`src/lib/r2Storage.ts`, `src/lib/privateStorage.ts`, `src/lib/providerStorage.ts`):**
  - Substitui o storage local pelo Cloudflare R2 com CDN pública (`https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev`) e worker de intermediação segura (`gsa-hub-r2-worker.r2-handler.workers.dev`).
  - Mapeia 14 categorias de buckets para prefixos `public/` e `private/`.
  - Uploads autenticados exigem envio dos headers `x-gsa-session-id`, `x-gsa-session-token` e JWT `Authorization: Bearer`.
  - Documentos privados geram URLs assinadas temporárias através do worker.

---

## 2. Logic Chain (Cadeia de Raciocínio Lógico)

1. **Da inicialização preguiçosa e isolamento à estabilidade da aplicação:**
   - *Observação:* `src/lib/supabase.ts` utiliza Proxy para instanciar o cliente Supabase apenas sob demanda e limpa tokens legados do localStorage; `src/routing/` substitui o react-router por um catálogo declarativo e centralizado.
   - *Raciocínio:* Isso desacopla o ciclo de vida do cliente HTTP/WS do carregamento estático dos módulos, impedindo que falhas de conectividade com a VPS quebrem a renderização inicial das páginas públicas do GSA HUB.

2. **Da segurança em camadas ao princípio do Zero-Trust no Frontend:**
   - *Observação:* Nem `clientOperationalWrite.ts` nem `callClientRpc.ts` confiam em `cliente_id` vindo de parâmetros de tela; ambos exigem e transmitem `p_sessao_id` e `p_session_token`.
   - *Raciocínio:* O frontend trata o navegador como um ambiente não confiável. Qualquer tentativa de adulteração de estado no React não surte efeito no banco de dados, pois a autorização e a identidade do cliente são extraídas e validadas criptograficamente pelas RPCs no PostgreSQL.

3. **Da resolução de Stale Closures no Realtime à sincronia perfeita dos painéis:**
   - *Observação:* Em `src/hooks/useRealtime.ts`, `callbacksRef.current` é atualizado a cada renderização e `originalIdx` preserva a ordem dos listeners mesmo quando há itens com `enabled: false`.
   - *Raciocínio:* Os dados das notificações, orçamentos e faturas mantêm-se em tempo real sem render loops e sem que callbacks antigos executem chamadas com referências desatualizadas.

4. **Da resiliência nos disparos de WhatsApp ao atendimento contínuo:**
   - *Observação:* Tanto em `n8nWhatsApp.ts` quanto em `whatsappNotificationService.ts`, o fluxo tenta a Evolution API, a Edge Function `vps-api` e o Webhook do n8n em cascata com verificação de saúde e encoding estrito `charset=utf-8`.
   - *Raciocínio:* Falhas parciais em um dos canais de mensageria da VPS não interrompem a entrega de notificações críticas de transações financeiras, confirmação de PIX ou avisos de recursos de resgate aos clientes.

---

## 3. Caveats (Ressalvas e Limitações do Escopo)

1. **Credenciais do Cloudflare R2:** Os segredos da API S3/R2 estão configurados e protegidos dentro do Cloudflare Worker (`gsa-hub-r2-worker`). O frontend interage com o worker apenas via headers de sessão e URLs públicas/assinadas.
2. **Dependência de Serviços na VPS:** O ecossistema assume que na VPS Oracle (`147.15.43.141`) estão em execução a Evolution API (porta 8080), o n8n (porta 5678), o Supabase PostgREST (porta 3001/8000) e o microserviço `server_webhook.cjs` (porta 5680). A indisponibilidade de portas na VPS ativa os fallbacks locais documentados.
3. **Ambiente Local vs. Produção:** Em desenvolvimento local sem conexão ativa à VPS, os hooks Realtime utilizam polling e fallback resiliente sem provocar crash na aplicação.

---

## 4. Conclusion (Conclusão e Diagnóstico Técnico)

A arquitetura de Frontend e Integrações de API do sistema GSA HUB apresenta um nível excepcional de maturidade técnica, robustez e separação de responsabilidades:
- **Modularidade de Perfis:** Isolamento estrito entre os 6 papéis do ecossistema (Admin/Colaborador, Cliente PF, Cliente PJ/Empresa, Prestador, Fornecedor e Afiliado).
- **Integridade Concorrencial:** Prevenção de race conditions tanto no cliente (via debounced realtime e deduplicação de migração de carrinho) quanto no backend (via `SessionMutex` no webhook da VPS).
- **Camada Transacional Protegida:** Adoção unificada de RPCs com validação de sessão atômica (`p_sessao_id` + `p_session_token`) e eliminação de mutações diretas via API REST.
- **Mensageria com Variação Dinâmica:** Sistema de WhatsApp de alta entregabilidade com anti-ban, simulação de presença e redundância tripla.

---

## 5. Verification Method (Método de Verificação e Validação Independente)

Para auditar e validar independentemente a integridade de todas as conclusões deste laudo:

1. **Executar Verificação de Contratos Realtime:**
   ```bash
   npm run test:realtime
   ```
   *Resultado esperado:* Validação com sucesso de todos os contratos de canais, filtros de linha obrigatórios e ausência de memory leaks (`REALTIME_RESILIENCE_CONTRACTS_OK`).

2. **Executar Auditoria Estrita de Tipos TypeScript:**
   ```bash
   npm run typecheck:strict
   ```
   *Resultado esperado:* Compilação limpa sem erros de tipagem em `src/App.tsx`, `src/routing/*`, `src/hooks/*` e `src/lib/*`.

3. **Inspecionar Arquivos Chave de Integração:**
   - Verificar proxy e fallbacks em: `src/lib/supabase.ts` (linhas 308-368).
   - Verificar controle de stale closures e índice em: `src/hooks/useRealtime.ts` (linhas 58-71 e 118-138).
   - Verificar proteção de concorrência por telefone em: `server_webhook.cjs` (linhas 44-84).
   - Verificar cascata de fallbacks do WhatsApp em: `src/lib/whatsappNotificationService.ts` (linhas 1201-1330).
