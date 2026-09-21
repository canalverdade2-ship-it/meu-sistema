# INVENTÁRIO COMPLETO DO SISTEMA GSA HUB

**Documento Oficial**: `INVENTARIO_COMPLETO.md`  
**Milestone**: Milestone 1 — Baseline Inicial, Inventário de Escopo e Grafo de Conexões (R1)  
**Data da Auditoria**: 2026-09-16  
**Status Canônico de Todos os Itens**: **`ANALISADO ESTATICAMENTE`** (Zero alegações de `VALIDADO`)  
**Metodologia**: Varredura estática profunda da árvore de código-fonte frontend (`src/`), esquemas e migrações SQL (`master_supabase_schema.sql`, `supabase/migrations/`), Edge Functions (`supabase/functions/`) e microserviço daemon VPS (`server_webhook.cjs`).

---

## 1. RESUMO QUANTITATIVO GERAL RECONCILIADO

| Camada Arquitetural | Categoria do Inventário | Prefixo Canônico de ID | Total Descoberto e Catalogado | Status Canônico |
|---|---|---|---|---|
| **Frontend UI** | Super-Domínios / Módulos de Alto Nível | `UI-MOD-*` | **15 módulos** | ANALISADO ESTATICAMENTE |
| **Frontend UI** | Telas, Rotas e Subvisões do Roteador | `UI-PAGE-*` | **72 telas/rotas** | ANALISADO ESTATICAMENTE |
| **Frontend UI** | Formulários Estruturados com Validação | `UI-FORM-*` | **54 formulários** | ANALISADO ESTATICAMENTE |
| **Frontend UI** | Botões Críticos e Disparadores de Ação | `UI-BTN-*` | **118 botões** | ANALISADO ESTATICAMENTE |
| **Frontend UI** | Tabelas de Dados e Grids Operacionais | `UI-TBL-*` | **42 tabelas** | ANALISADO ESTATICAMENTE |
| **Frontend UI** | Modais, Drawers e Caixas de Diálogo | `UI-MDL-*` | **48 modais** | ANALISADO ESTATICAMENTE |
| **Backend & DB** | Tabelas Relacionais do PostgreSQL (17 domínios) | `DB-TBL-*` | **294 tabelas** | ANALISADO ESTATICAMENTE |
| **Backend & DB** | Stored Procedures e Funções Transacionais | `DB-RPC-*` | **692 RPCs** | ANALISADO ESTATICAMENTE |
| **Backend & API** | Supabase Edge Functions Serverless (Deno) | `API-EDGE-*` | **17 funções** | ANALISADO ESTATICAMENTE |
| **Backend & API** | Rotas e Webhooks do Microserviço VPS | `API-WH-*` | **15 rotas** | ANALISADO ESTATICAMENTE |
| **Backend & API** | Endpoints de Serviços Externos Integrados | `API-END-*` | **10 integrações** | ANALISADO ESTATICAMENTE |
| **Total Global** | **Itens Estruturais Catalogados** | — | **1.377 elementos** | **ANALISADO ESTATICAMENTE** |

---

## 2. INVENTÁRIO DE MÓDULOS E SUPER-DOMÍNIOS (`UI-MOD-*` — 15 MÓDULOS)

| ID | Nome do Módulo | Descrição Funcional | Diretório / Componente Principal |
| `UI-MOD-01` | **Portal Público & Vitrine** | Apresentação institucional, serviços, blog, ferramentas gratuitas e parceiros. | `src/pages/Home.tsx`, `src/components/public/` |
| `UI-MOD-02` | **Autenticação & Sessões** | Autenticação por PIN/documento de PF, PJ, prestadores, fornecedores, afiliados e gestão. | `src/pages/ClientLoginPage.tsx`, `RestrictedAccessHubPage.tsx` |
| `UI-MOD-03` | **Marketplace & E-Commerce (Loja)** | Catálogo de produtos, variantes, assinaturas, carrinho, cupons e checkout de 3 etapas. | `src/components/client/store/`, `StoreHub.tsx` |
| `UI-MOD-04` | **Portal do Cliente (PF)** | Dashboard do consumidor, extrato, faturas, vouchers, pontos VIP, empréstimos e suporte. | `src/pages/ClientPortal.tsx` (portalVariant="personal") |
| `UI-MOD-05` | **GSA HUB Empresas (PJ)** | Gestão de contas corporativas PJ, crédito PJ, faturamento consolidado e contratos. | `src/pages/ClientPortal.tsx` (portalVariant="business") |
| `UI-MOD-06` | **Portal do Prestador** | Gestão de demandas de campo, contrapropostas, entrega de OS, agenda e saques PIX. | `src/pages/Prestador/`, `src/components/prestador/` |
| `UI-MOD-07` | **Portal do Fornecedor** | Catálogo B2B de mercadorias, pedidos de compra corporativos, remessa de NF-e e títulos. | `src/pages/Fornecedor/FornecedorDashboard.tsx` |
| `UI-MOD-08` | **Programa de Afiliados** | Geração de links parametrizados, métricas de conversão, carência de 30 dias e saques. | `src/pages/Afiliado/AfiliadoDashboard.tsx` |
| `UI-MOD-09` | **Portal do Anunciante** | Ad server corporativo, solicitações de mídia, criativos, métricas diárias e pagamentos. | `src/pages/AdvertiserPortal.tsx` |
| `UI-MOD-10` | **Painel Administrativo & Governança** | Gestão de colaboradores, auditoria forense, configurações mestres e saúde do sistema. | `src/pages/SecureAdminPanel.tsx`, `AdminPanel.tsx` |
| `UI-MOD-11` | **Super-Domínio Operações & Workstation** | Orçamentos comerciais, ordens de serviço, despacho e Kanban de colaboradores. | `src/components/admin/super-domains/operacoes/` |
| `UI-MOD-12` | **Super-Domínio Financeiro & Fintech** | Faturamento, fluxo de caixa, conciliação bancária, cobrança, protestos e fiscal. | `src/components/admin/super-domains/financeiro/` |
| `UI-MOD-13` | **GSA TV Master Control & IA Broadcast** | Playout linear, grade semanal, ingest de mídias, gerador de telejornais via Gemini. | `src/components/admin/gsa-tv/` |
| `UI-MOD-14` | **Verticais Especializadas** | Módulos integrados de GSA Viagens, GSA Saúde, GSA Seguros e Hub Classificados. | `src/components/admin/TravelAdminModule.tsx`, `ProtectionAdminModule.tsx`, `ClassifiedsModule.tsx` |
| `UI-MOD-15` | **Recrutamento & Carreiras (RH)** | Portal público de vagas, formulário de candidatura e gestão administrativa de RH. | `src/pages/Careers/`, `src/components/admin/CareersAdminModule.tsx` |

---

## 3. CATÁLOGO EXAUSTIVO DE ROTAS E PÁGINAS (`UI-PAGE-*` — 72 TELAS)

| ID | Rota Canônica | Área | Módulo / Submódulo | Componente React Responsável | Controle de Acesso / Guard |
| `UI-PAGE-001` | `/` | `public` | `home` | `Home.tsx` | Acesso público |
| `UI-PAGE-002` | `/privacidade` | `public` | `privacy` | `PrivacyPolicyPage.tsx` | Acesso público |
| `UI-PAGE-003` | `/servicos-e-assinaturas` | `public` | `services` | `Home.tsx` (`initialPublicPage='services'`) | Acesso público |
| `UI-PAGE-004` | `/servicos-e-assinaturas/:id` | `public` | `services` | `Home.tsx` (`initialServiceSlug`) | Acesso público |
| `UI-PAGE-005` | `/servicos-gratuitos` | `public` | `free-tools` | `FreeToolsPage.tsx` | Acesso público |
| `UI-PAGE-006` | `/criacao-de-site-e-sistemas` | `public` | `systems` | `SystemsPageFinal.tsx` | Acesso público |
| `UI-PAGE-007` | `/identidade-e-web-design` | `public` | `systems` | `BrandJourneyPage.tsx` | Acesso público |
| `UI-PAGE-008` | `/nossos-parceiros` | `public` | `partners` | `PartnersPage.tsx` | Acesso público |
| `UI-PAGE-009` | `/nossos-parceiros/:slug` | `public` | `partners` | `PartnersPage.tsx` | Acesso público |
| `UI-PAGE-010` | `/nossos-parceiros/solicitar` | `public` | `partners` | `PartnerApplicationPage.tsx` | Acesso público |
| `UI-PAGE-011` | `/consulta-protocolo` | `public` | `protocolConsult` | `ProtocolConsultPage.tsx` | Acesso público / Realtime |
| `UI-PAGE-012` | `/anuncios` | `public` | `ads` | `AdvertisingPage.tsx` | Acesso público |
| `UI-PAGE-013` | `/anuncie` | `public` | `advertise` | `AdvertisingPage.tsx` | Acesso público |
| `UI-PAGE-014` | `/afiliados` | `public` | `affiliates` | `AffiliatePublicPage.tsx` | Acesso público |
| `UI-PAGE-015` | `/trabalhe-conosco` | `public` | `careers` | `CareersLandingPage.tsx` | Acesso público |
| `UI-PAGE-016` | `/programa-vip` | `public` | `vip` | `PublicVIPPresentationPage.tsx` | Acesso público |
| `UI-PAGE-017` | `/login` | `login` | `root` | `Home.tsx` (`loginOnly={true}`) | Acesso público |
| `UI-PAGE-018` | `/login/pessoa-fisica` | `login` | `cliente` / `pessoa-fisica` | `ClientLoginPage.tsx` (`personType="pf"`) | Acesso público |
| `UI-PAGE-019` | `/login/empresa` | `login` | `empresa` | `ClientLoginPage.tsx` (`personType="pj"`) | Acesso público |
| `UI-PAGE-020` | `/login/empresa/cadastro` | `login` | `empresa/cadastro` | `BusinessRegistrationPage.tsx` | Acesso público |
| `UI-PAGE-021` | `/login/acesso-restrito` | `login` | `acesso-restrito` | `RestrictedAccessHubPage.tsx` | Acesso público |
| `UI-PAGE-022` | `/login/admin` | `login` | `admin` | `RestrictedAccessHubPage.tsx` (`role="gestao"`) | Acesso público |
| `UI-PAGE-023` | `/login/colaborador` | `login` | `colaborador` | `RestrictedAccessHubPage.tsx` (`role="colaborador"`) | Acesso público |
| `UI-PAGE-024` | `/login/prestador` | `login` | `prestador` | `ProviderAccessPage.tsx` (`mode="login"`) | Acesso público |
| `UI-PAGE-025` | `/login/prestador/cadastro` | `login` | `prestador/cadastro` | `ProviderAccessPage.tsx` (`mode="register"`) | Acesso público |
| `UI-PAGE-026` | `/fornecedor/login` | `login` | `fornecedor` | `FornecedorAccessPage.tsx` | Acesso público |
| `UI-PAGE-027` | `/afiliados/login` | `login` | `afiliado` | `AffiliateAccessPage.tsx` | Acesso público |
| `UI-PAGE-028` | `/anuncios/login` | `advertiser` | `login` | `AdvertiserPortal.tsx` | Acesso público |
| `UI-PAGE-029` | `/trabalhe-conosco/acesso` | `public` | `careers/acesso` | `CareersAccessPage.tsx` | Acesso público |
| `UI-PAGE-030` | `/marketplace` | `marketplace` | `root` | `MarketplaceGSAStore.tsx` | Acesso público / Convidado |
| `UI-PAGE-031` | `/marketplace/loja` | `marketplace` | `store` | `MarketplaceGSAStore.tsx` | Acesso público |
| `UI-PAGE-032` | `/marketplace/loja/produtos` | `marketplace` | `loja-produtos` | `EcommerceHome.tsx` / `ProductPage.tsx` | Acesso público |
| `UI-PAGE-033` | `/marketplace/loja/checkout` | `marketplace` | `loja-checkout` | `CheckoutPage.tsx` | Requer autenticação / migração |
| `UI-PAGE-034` | `/marketplace/loja/compras` | `marketplace` | `loja-compras` | `PurchasesPage.tsx` | Requer cliente autenticado |
| `UI-PAGE-035` | `/marketplace/loja/cupons` | `marketplace` | `loja-cupons` | `CouponsPage.tsx` | Acesso público / Cliente |
| `UI-PAGE-036` | `/marketplace/loja/vaquinha/:codigo` | `marketplace` | `loja-vaquinha` | `VaquinhaPublicPage.tsx` | Acesso público |
| `UI-PAGE-037` | `/marketplace/menu/pacotes-viagem` | `marketplace` | `pacotes-viagem` | `MarketplaceGSAStore.tsx` (`travel`) | Acesso público |
| `UI-PAGE-038` | `/marketplace/menu/classificados` | `marketplace` | `classificados` | `ClassifiedsHubPage.tsx` | Acesso público |
| `UI-PAGE-039` | `/marketplace/menu/saude` | `marketplace` | `saude` | `MarketplaceGSAStore.tsx` (`saude`) | Acesso público |
| `UI-PAGE-040` | `/marketplace/menu/seguros` | `marketplace` | `seguros` | `MarketplaceGSAStore.tsx` (`seguros`) | Acesso público |
| `UI-PAGE-041` | `/cliente/dashboard` | `client` | `dashboard` | `ClientDashboard.tsx` | Cliente PF autenticado |
| `UI-PAGE-042` | `/cliente/perfil` | `client` | `perfil` | `ClientProfile.tsx` | Cliente PF autenticado |
| `UI-PAGE-043` | `/cliente/servicos-e-assinaturas` | `client` | `servicos_assinaturas` | `ClientServicosAssinaturas.tsx` | Cliente PF autenticado |
| `UI-PAGE-044` | `/cliente/financeiro` | `client` | `financeiro` | `ClientFinanceiro.tsx` | Cliente PF autenticado |
| `UI-PAGE-045` | `/cliente/financeiro/faturas` | `client` | `financeiro/faturas` | `FaturasList.tsx` | Cliente PF autenticado |
| `UI-PAGE-046` | `/cliente/financeiro/saques` | `client` | `financeiro/saques` | `SaquesList.tsx` | Cliente PF autenticado |
| `UI-PAGE-047` | `/cliente/financeiro/credito` | `client` | `financeiro/credito` | `ClientMeuCredito.tsx` | Cliente PF autenticado |
| `UI-PAGE-048` | `/cliente/financeiro/emprestimos` | `client` | `financeiro/emprestimos` | `ClientEmprestimos.tsx` | Cliente PF autenticado |
| `UI-PAGE-049` | `/cliente/fidelidade` | `client` | `fidelidade` | `ClientFidelidade.tsx` | Cliente PF autenticado |
| `UI-PAGE-050` | `/cliente/suporte` | `client` | `suporte` | `ClientSuporte.tsx` | Cliente PF autenticado |
| `UI-PAGE-051` | `/empresa/dashboard` | `business` | `dashboard` | `ClientDashboard.tsx` (variant="business") | Cliente PJ autenticado |
| `UI-PAGE-052` | `/empresa/financeiro` | `business` | `financeiro` | `ClientFinanceiro.tsx` | Cliente PJ autenticado |
| `UI-PAGE-053` | `/prestador` | `provider` | `home` | `ProviderLandingPage.tsx` | Acesso público |
| `UI-PAGE-054` | `/prestador/dashboard` | `provider` | `dashboard` | `PrestadorDashboard.tsx` | Prestador ativo autenticado |
| `UI-PAGE-055` | `/prestador/demandas` | `provider` | `demandas` | `PrestadorDemandas.tsx` | Prestador ativo autenticado |
| `UI-PAGE-056` | `/prestador/agenda` | `provider` | `agenda` | `PrestadorAgenda.tsx` | Prestador ativo autenticado |
| `UI-PAGE-057` | `/prestador/financeiro` | `provider` | `financeiro` | `PrestadorFinanceiro.tsx` | Prestador ativo autenticado |
| `UI-PAGE-058` | `/fornecedor` | `supplier` | `home` | `FornecedorLandingPage.tsx` | Acesso público |
| `UI-PAGE-059` | `/fornecedor/dashboard` | `supplier` | `dashboard` | `FornecedorDashboard.tsx` | Fornecedor ativo autenticado |
| `UI-PAGE-060` | `/fornecedor/produtos` | `supplier` | `produtos` | `FornecedorDashboard.tsx` (`produtos`) | Fornecedor ativo autenticado |
| `UI-PAGE-061` | `/fornecedor/pedidos` | `supplier` | `pedidos` | `FornecedorDashboard.tsx` (`pedidos`) | Fornecedor ativo autenticado |
| `UI-PAGE-062` | `/fornecedor/entregas` | `supplier` | `entregas` | `FornecedorDashboard.tsx` (`entregas`) | Fornecedor ativo autenticado |
| `UI-PAGE-063` | `/afiliados/dashboard` | `public` | `affiliates/dashboard` | `AfiliadoDashboard.tsx` | Afiliado autenticado |
| `UI-PAGE-064` | `/anuncios/campanhas` | `advertiser` | `campaigns` | `AdvertiserPortal.tsx` | Anunciante autenticado |
| `UI-PAGE-065` | `/admin/dashboard` | `admin` | `dashboard` | `Dashboard.tsx` / `CollaboratorDashboard.tsx` | Admin ou Colaborador |
| `UI-PAGE-066` | `/admin/cadastros/clientes` | `admin` | `cadastro/clientes` | `ClientesModule.tsx` | Admin / RBAC autorizado |
| `UI-PAGE-067` | `/admin/cadastros/prestadores` | `admin` | `cadastro/prestadores` | `PrestadoresSection.tsx` | Admin / RBAC autorizado |
| `UI-PAGE-068` | `/admin/fornecedores` | `admin` | `fornecedores` | `FornecedoresModule.tsx` | Admin / RBAC autorizado |
| `UI-PAGE-069` | `/admin/operacoes/orcamentos` | `admin` | `operacoes/orcamentos` | `OrcamentosWorkstation.tsx` | Admin / RBAC autorizado |
| `UI-PAGE-070` | `/admin/financeiro` | `admin` | `financeiro` | `FinanceiroSuperDomain.tsx` | Admin / RBAC autorizado |
| `UI-PAGE-071` | `/admin/acessos` | `admin` | `acessos` | `AcessosModule.tsx` | Exclusivo Admin Master |
| `UI-PAGE-072` | `/admin/gsa-tv` | `admin` | `gsa-tv` | `GsaTvModule.tsx` | Exclusivo Admin Master / TV |

---

## 4. CATÁLOGO DE FORMULÁRIOS & REGRAS DE VALIDAÇÃO (`UI-FORM-*` — 54 FORMULÁRIOS)

| ID do Form | Módulo / Tela | Finalidade de Negócio | Campos do Formulário | Tipos de Entrada | Validações & Restrições Estritas |
| `UI-FORM-001` | `UI-MOD-02` / `ClientLoginPage` | Identificação de Cliente PF/PJ | `documentValue` (CPF ou CNPJ) | `text` com máscara dinâmica | Não vazio; 11 dígitos para CPF (`validarCPF`); 14 dígitos para CNPJ (`validarCNPJ`). |
| `UI-FORM-002` | `UI-MOD-02` / `ClientLoginPage` | Autenticação por PIN (PF/PJ) | `pin` (Senha numérica) | `PinInput` (4 inputs `password` numéricos) | Exatamente 4 dígitos numéricos; bloqueio após 5 tentativas incorretas (`attemptsLeft`). |
| `UI-FORM-003` | `UI-MOD-02` / `ClientLoginPage` | Recuperação de Senha (Stage 1) | `documentValue`, `recoveryEmail` | `text` mascarado, `email` | CPF/CNPJ válido; `validarEmail` compatível com regex RFC 5322. |
| `UI-FORM-004` | `UI-MOD-02` / `ClientLoginPage` | Redefinição de Senha (Stage 2) | `recoveryCode`, `pin`, `pinConfirm` | `text` numérico, `password` | Código de 6 dígitos enviado por WhatsApp/E-mail; PIN 4 dígitos; Confirmação idêntica. |
| `UI-FORM-005` | `UI-MOD-02` / `ClientLoginPage` | Primeiro Acesso (Confirmação) | `firstAccessCode`, `pin`, `pinConfirm` | `text` numérico, `password` | Desafio de 6 dígitos; criação de novo PIN de 4 dígitos com confirmação estrita. |
| `UI-FORM-006` | `UI-MOD-02` / `BusinessRegistrationPage` | Autorização Prévia de Cadastro | `voucherInput` (Celular ou Voucher) | `text` / `tel` com máscara | Não vazio; consulta via RPC `gsa_public_lookup_referral`; celular com DDD (11 dígitos). |
| `UI-FORM-007` | `UI-MOD-02` / `BusinessRegistrationPage` | Dados Cadastrais da Empresa PJ | `cnpj`, `nome`, `email`, `telefone`, `cep`, `numero`, `endereco`, `bairro`, `cidade`, `estado`, `confirmed` | `text`, `email`, `tel`, `checkbox` | CNPJ válido; Razão Social >= 3 caracteres; e-mail válido; CEP 8 dígitos com auto-preenchimento ViaCEP; UF com 2 caracteres; aceite do termo obrigatório. |
| `UI-FORM-008` | `UI-MOD-02` / `BusinessRegistrationPage` | Validação WhatsApp 2FA | `verificationCode` | `text` numérico (6 dígitos) | Exatamente 6 dígitos; limite de 5 tentativas; tempo de expiração de 10 minutos. |
| `UI-FORM-009` | `UI-MOD-02` / `BusinessRegistrationPage` | Criação de PIN da Empresa | `accessPin`, `confirmPin` | `password` numérico (4 dígitos) | 4 dígitos numéricos; ambos os campos devem coincidir perfeitamente. |
| `UI-FORM-010` | `UI-MOD-02` / `RestrictedAccessHubPage` | Autenticação Gestão / Colaborador | `role`, `code` (Credencial Master / Token) | `radio/card`, `password` (toggle ver/ocultar) | Código não vazio; autorização via RPC `gsa_login_admin` ou `gsa_login_colaborador`. |
| `UI-FORM-011` | `UI-MOD-02` / `ProviderAccessPage` | Cadastro de Novo Prestador | `tipo_cadastro` ('cpf'/'cnpj'), `nome_razao`, `nome_responsavel`, `documento`, `email`, `telefone`, `cep`, `numero`, `area_servico` | `radio`, `text`, `email`, `tel` | CPF (11) ou CNPJ (14) válido; e-mail corporativo válido; telefone celular válido; área de serviço obrigatória. |
| `UI-FORM-012` | `UI-MOD-02` / `FornecedorAccessPage` | Pré-Cadastro de Fornecedor B2B | `tipo_pessoa`, `documento`, `razao_social`, `nome_fantasia`, `inscricao_estadual`, `responsavel_nome`, `email`, `telefone`, `cep`, `endereco`, `numero`, `bairro`, `cidade`, `estado`, `consent` | `radio`, `text`, `email`, `tel`, `checkbox` | CNPJ ou CPF válido; validação de e-mail; busca automática de CEP via ViaCEP; consentimento legal marcado. |
| `UI-FORM-013` | `UI-MOD-02` / `AffiliateAccessPage` | Ativação do Perfil de Afiliado | `documento`, `nome`, `email`, `telefone`, `nome_divulgacao`, `pix_tipo`, `pix_chave`, `pin`, `pin_confirmacao`, `termos_aceitos` | `text`, `email`, `tel`, `select`, `password`, `checkbox` | Documento válido existente em clientes; nome divulgação >= 3 chars; chave PIX validada conforme tipo; PIN 4 dígitos; aceite formal dos termos. |
| `UI-FORM-014` | `UI-MOD-01` / `ProtocolConsultPage` | Consulta de Protocolo de Resgate | `inputCodigo` | `text` com caixa alta forçada | Não vazio; formato padronizado (ex: PROT-RES-2026-XXXXXX); sanitização contra XSS. |
| `UI-FORM-015` | `UI-MOD-01` / `ProtocolConsultPage` | Submissão de Recurso de Benefício | `appealText`, `appealFiles`, `appealCode` | `textarea`, `file` múltiplo, `text` numérico | Contestação entre 20 e 4000 caracteres; até 3 arquivos (PNG, JPG, PDF) de no máximo 5MB cada; código 2FA de 6 dígitos via WhatsApp. |
| `UI-FORM-016` | `UI-MOD-01` / `AdvertisingPage` | Solicitação de Veiculação de Ads | `company_name`, `contact_name`, `email`, `phone`, `placements`, `budget`, `objective` | `text`, `email`, `tel`, `checkboxes`, `number`, `textarea` | Razão social obrigatória; e-mail válido; telefone com DDD; pelo menos 1 placement selecionado; orçamento >= 0. |
| `UI-FORM-017` | `UI-MOD-01` / `PartnerApplicationModal`| Candidatura a Parceiro de Convênio | `nome_fantasia`, `razao_social`, `cnpj`, `email`, `telefone`, `categoria`, `descricao_beneficio`, `logo`, `banner` | `text`, `email`, `tel`, `select`, `textarea`, `file` | CNPJ válido; e-mail comercial válido; telefone com DDD; arquivos de imagem até 2MB. |
| `UI-FORM-018` | `UI-MOD-01` / `PartnerBenefitRedeemModal`| Resgate de Benefício de Parceiro | `nome_completo`, `telefone`, `email` | `text`, `tel`, `email` | Nome >= 3 caracteres; telefone celular (11 dígitos); e-mail válido. |
| `UI-FORM-019` | `UI-MOD-03` / `CheckoutPage` (Etapa 1)| Endereço de Entrega do Pedido | `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf` | `text` mascarado, `text` | CEP válido (8 dígitos); auto-preenchimento ViaCEP; número e logradouro obrigatórios para itens físicos. |
| `UI-FORM-020` | `UI-MOD-03` / `CheckoutPage` (Etapa 1)| Aplicação de Cupom da Loja | `cupomDescInput`, `cupomEntInput` | `text` em caixa alta | Não vazio; validação server-side de validade, estoque do cupom e valor mínimo. |
| `UI-FORM-021` | `UI-MOD-03` / `CheckoutPage` (Etapa 2)| Dedução Financeira & Pagamento | `usarPontos`, `usarSaldoCarteira`, `formaPagamento`, `numParcelas`, `parcelasCartao` | `checkbox`, `radio`, `select` | Saldo em carteira não pode exceder o saldo disponível do cliente; pontos limitados ao total; parcelas de 1 a 12x. |
| `UI-FORM-022` | `UI-MOD-03` / `ProductReviews` | Avaliação de Produto Recebido | `rating`, `comentario`, `fotos` | `star-rating` (1 a 5), `textarea`, `file` | Nota entre 1 e 5 estrelas; comentário min 10 caracteres; imagens até 5MB. |
| `UI-FORM-023` | `UI-MOD-03` / `StoreHubPurchases` | Solicitação de Troca ou Devolução | `itensSelecionados`, `tipo` ('troca'/'devolucao'), `motivo`, `evidencias` | `checkboxes`, `radio`, `textarea`, `file` | Pelo menos 1 item selecionado; motivo detalhado min 15 caracteres; fotos do produto anexadas. |
| `UI-FORM-024` | `UI-MOD-04` / `ClientProfile` | Atualização Cadastral do Cliente | `nome`, `email`, `telefone`, `endereco`, `bairro`, `cidade`, `estado`, `cep` | `text`, `email`, `tel` | Nome completo obrigatório; e-mail válido; telefone com DDD; CEP 8 dígitos. |
| `UI-FORM-025` | `UI-MOD-04` / `ClientSuporte` | Abertura de Chamado / Ticket | `assunto`, `categoria`, `prioridade`, `mensagem`, `anexos` | `text`, `select`, `textarea`, `file` | Assunto min 5 caracteres; categoria obrigatória; mensagem min 15 caracteres. |
| `UI-FORM-026` | `UI-MOD-04` / `SaquesList` | Solicitação de Saque PIX (Cliente) | `valor`, `chavePix`, `tipoChave` | `number/currency`, `text`, `select` | Valor >= R$ 50,00 (piso mínimo); valor <= saldo disponível; chave PIX válida conforme o tipo. |
| `UI-FORM-027` | `UI-MOD-04` / `ClientTransferencias`| Transferência P2P de Saldo/Pontos | `tipo` ('saldo'/'pontos'), `destinatario` (CPF/CNPJ/Código), `valor` | `radio`, `text`, `number/currency` | Destinatário não pode ser o próprio cliente; valor > 0; valor <= saldo líquido. |
| `UI-FORM-028` | `UI-MOD-04` / `ClientPontos` | Conversão de Pontos em Dinheiro | `pontosAConverter` | `number` inteiro | Mínimo de pontos configurado na empresa (ex: 100); valor inteiro positivo <= saldo de pontos. |
| `UI-FORM-029` | `UI-MOD-04` / `ClientMeuCredito` | Solicitação de Aumento de Crédito | `valorSolicitado`, `rendaComprovada`, `comprovanteRenda`, `documentoIdentidade` | `currency`, `currency`, `file` | Valor solicitado > 0; envio obrigatório de comprovante de renda (PDF/PNG até 10MB). |
| `UI-FORM-030` | `UI-MOD-04` / `CreditWithdrawalModal`| Saque de Limite de Crédito Loja | `valor`, `chavePix`, `documentoIdentidade` | `currency`, `text`, `file` | Valor <= limite de crédito disponível; chave PIX válida; documento KYC anexado. |
| `UI-FORM-031` | `UI-MOD-04` / `CreditDisputeModal` | Contestação de Lançamento de Crédito | `motivo`, `detalhes`, `evidencias` | `select`, `textarea`, `file` | Motivo obrigatório; justificativa min 20 caracteres. |
| `UI-FORM-032` | `UI-MOD-04` / `ClientEmprestimos` | Simulação e Contratação de Empréstimo | `valor`, `parcelas`, `termoAceite`, `documentosKYC` | `currency`, `select` (1 a 36), `checkbox`, `file` | Valor dentro da margem de crédito aprovada; parcelas válidas; aceite formal dos termos. |
| `UI-FORM-033` | `UI-MOD-06` / `PrestadorDemandas` | Contraproposta de Demanda (Técnico) | `valor_proposto_prestador`, `justificativa` | `currency`, `textarea` | Valor proposto > 0; justificativa obrigatória. |
| `UI-FORM-034` | `UI-MOD-06` / `PrestadorDemandas` | Entrega de Ordem de Serviço | `deliveryDate`, `deliveryNotes`, `resultLink`, `files` | `datetime-local`, `textarea`, `url`, `file` | Data/hora válida; notas técnicas min 10 caracteres; link ou upload de fotos da execução. |
| `UI-FORM-035` | `UI-MOD-06` / `PrestadorAgenda` | Agendamento sem Conflitos de Campo | `data`, `hora_inicio`, `hora_fim`, `demanda_id`, `observacoes` | `date`, `time`, `time`, `select`, `textarea` | Data futura; `hora_fim > hora_inicio`; verificação server-side contra sobreposição. |
| `UI-FORM-036` | `UI-MOD-06` / `PrestadorFinanceiro` | Solicitação de Saque PIX (Prestador) | `valor`, `chavePix` | `currency`, `text` | Valor <= saldo disponível em conta; piso mínimo respeitado. |
| `UI-FORM-037` | `UI-MOD-06` / `PrestadorDocumentos`| Upload de Documentos KYC do Prestador | `tipo_documento` (CNH/Alvará), `arquivo` | `select`, `file` | Arquivo em formato PDF/JPG/PNG de até 10MB. |
| `UI-FORM-038` | `UI-MOD-07` / `FornecedorDashboard` | Proposta de Novo Produto ao Catálogo | `nome`, `codigo_referencia`, `descricao`, `preco_custo`, `preco_sugerido`, `categoria_id`, `fotos` | `text`, `text`, `textarea`, `currency`, `currency`, `select`, `file` | Nome >= 3 caracteres; custo > 0; preço sugerido >= custo; foto obrigatória. |
| `UI-FORM-039` | `UI-MOD-07` / `FornecedorDashboard` | Despacho de Remessa e Envio de NF-e | `numero_nfe`, `chave_acesso_nfe`, `transportadora`, `codigo_rastreio`, `arquivo_xml`, `arquivo_pdf` | `text`, `text` (44 dígitos), `text`, `text`, `file` (.xml), `file` (.pdf) | Chave da NF-e com exatamente 44 dígitos numéricos; XML e PDF válidos até 10MB. |
| `UI-FORM-040` | `UI-MOD-07` / `FornecedorDashboard` | Atualização Bancária em Quarentena | `banco`, `agencia`, `conta`, `chave_pix`, `comprovante_titularidade` | `text`, `text`, `text`, `text`, `file` | Dados bancários válidos com o mesmo CNPJ homologado; quarentena administrativa. |
| `UI-FORM-041` | `UI-MOD-08` / `AfiliadoDashboard` | Criação de Link de Afiliado | `titulo`, `destino`, `tag_campanha` | `text`, `url/select`, `text` | Título >= 3 caracteres; destino deve ser uma URL interna válida do GSA HUB. |
| `UI-FORM-042` | `UI-MOD-08` / `AfiliadoDashboard` | Solicitação de Saque de Comissões | `valor`, `confirmacaoPix` | `currency`, `text` | Valor >= R$ 50,00; saldo liberado após carência de 30 dias. |
| `UI-FORM-043` | `UI-MOD-09` / `AdvertiserPortal` | Submissão de Peça Criativa (Ad) | `campaign_id`, `placement_id`, `type` ('image'/'video'), `title`, `asset_file`, `destination_url` | `select`, `select`, `radio`, `text`, `file`, `url` | URL de destino com protocolo HTTPS válido; imagem (PNG/JPG/WEBP até 5MB) ou vídeo (MP4 até 50MB). |
| `UI-FORM-044` | `UI-MOD-10` / `AcessosModule` | Cadastro / Edição de Colaborador | `nome`, `email`, `telefone`, `funcao_id`, `modulos` | `text`, `email`, `tel`, `select`, `checkboxes` | Nome min 3 caracteres; e-mail corporativo válido; telefone com DDD; pelo menos 1 módulo concedido. |
| `UI-FORM-045` | `UI-MOD-10` / `AcessosModule` | Solicitação de Exclusão (Dois Homens)| `tabela`, `registro_id`, `motivo` | `text`, `uuid`, `textarea` | Motivo de exclusão obrigatório com justificativa detalhada. |
| `UI-FORM-046` | `UI-MOD-10` / `ConfiguracoesModule` | Parâmetros Globais do Sistema | Chaves de configuração allowlist (ex: `taxa_conversao_pontos`, `valor_minimo_saque`) | `number`, `text`, `switch` | Validação contra allowlist fechada do PostgreSQL via RPC `gsa_admin_update_settings_secure`. |
| `UI-FORM-047` | `UI-MOD-11` / `OrcamentosModule` | Criação de Proposta Comercial | `cliente_id`, `servico_id`, `valor_total`, `desconto`, `validade`, `observacoes` | `select/search`, `select`, `currency`, `currency`, `date`, `textarea` | Cliente e serviço obrigatórios; valor total > 0; data de validade futura. |
| `UI-FORM-048` | `UI-MOD-11` / `ProdutosModule` | Cadastro de Produto com Variantes | `nome`, `codigo_produto`, `descricao`, `preco`, `estoque`, `categoria_id`, `variacoes` | `text`, `text`, `textarea`, `currency`, `number`, `select`, `dynamic-options` | Nome obrigatório; SKU de cada variante único; estoque >= 0; preço > 0. |
| `UI-FORM-049` | `UI-MOD-11` / `PromocaoQuantidadeForm`| Configuração de Promoção / Combo | `nome`, `tipo_promocao`, `produto_gatilho_id`, `quantidade_minima`, `desconto_valor`, `nivel_minimo_id` | `text`, `select`, `select`, `number`, `currency`, `select` | Quantidade mínima >= 2; desconto > 0; tipo de promoção homologado na engine. |
| `UI-FORM-050` | `UI-MOD-12` / `FaturamentoView` | Emissão Manual de Fatura | `cliente_id`, `valor_total`, `data_vencimento`, `tipo`, `descricao` | `select`, `currency`, `date`, `select`, `textarea` | Cliente obrigatório; valor > 0; vencimento igual ou superior à data corrente. |
| `UI-FORM-051` | `UI-MOD-12` / `CobrancaView` | Criação de Acordo de Pagamento | `cobranca_id`, `valor_original`, `valor_acordo`, `numero_parcelas`, `vencimento_primeira_parcela` | `hidden`, `currency`, `currency`, `select`, `date` | Valor do acordo > 0; parcelas de 1 a 24x; vencimento futuro. |
| `UI-FORM-052` | `UI-MOD-13` / `GsaTvScheduleTab` | Inserção de Slot na Grade Semanal | `dia_semana`, `hora_inicio`, `programa_id`, `duracao_minutos`, `tipo_bloco` | `select`, `time`, `select`, `number`, `select` | Duração >= 1 minuto; verificação de continuidade e colisão de horário. |
| `UI-FORM-053` | `UI-MOD-13` / `GsaTvAiStudioTab` | Criação de Projeto de Telejornal IA | `titulo_edicao`, `apresentador_virtual_id`, `prompt_editorial`, `fontes_noticias`, `voz_id` | `text`, `select`, `textarea`, `checkboxes`, `select` | Título min 5 caracteres; apresentador homologado; voz Fish Audio ativa. |
| `UI-FORM-054` | `UI-MOD-15` / `CareersLandingPage` | Candidatura Pública a Vaga de Emprego| `vaga_id`, `nome_completo`, `email`, `telefone`, `linkedin_url`, `curriculo_file`, `pretensao_salarial` | `hidden`, `text`, `email`, `tel`, `url`, `file` (.pdf), `currency` | E-mail e telefone válidos; arquivo PDF do currículo até 10MB; nome completo min 3 chars. |

---

## 5. CATÁLOGO DE BOTÕES & PROTEÇÃO CONTRA CONCORRÊNCIA (`UI-BTN-*` — 118 BOTÕES)

| ID do Botão | Componente / Localização | Texto / Rótulo Visual | Ação Executada / RPC de Destino | Indicador de Carregamento | Desabilitado Durante Envio | Proteção Contra Duplo Clique / Debounce |
| `UI-BTN-001` | `ClientLoginPage` (Stage 1) | "Continuar" | Avança para digitação do PIN | Spinner `Loader2` | `disabled={!isDocumentValid || loading}` | Bloqueio síncrono via `setLoading(true)` |
| `UI-BTN-002` | `ClientLoginPage` (Stage 2) | "Entrar" (Automático no 4º dígito) | `sessionService.loginWithPin` | Spinner de validação | Desabilitado durante requisição | Guarda `if (pin.length !== 4 || loading) return;` |
| `UI-BTN-003` | `BusinessRegistrationPage` | "Validar autorização" | `gsa_public_lookup_referral` | Spinner `Loader2` | `disabled={loading}` | Trava booleana `loading` |
| `UI-BTN-004` | `BusinessRegistrationPage` | "Concluir Cadastro" | `gsa_public_register_client` | Spinner `Loader2` | `disabled={loading || !confirmed}` | Idempotency key enviada na criação |
| `UI-BTN-005` | `RestrictedAccessHubPage` | "Entrar na gestão" / "Entrar como colaborador" | `loginAdmin` / `loginColaborador` | Ícone `Loader2` animado | `disabled={loading || !code.trim()}` | Guarda `if (!code.trim() || loading) return;` |
| `UI-BTN-006` | `ProviderAccessPage` | "Entrar no Portal do Prestador" | `loginWithPin('prestador')` | Spinner de autenticação | `disabled={loading || providerPin.length !== 4}`| Limpeza de PIN em caso de erro |
| `UI-BTN-007` | `FornecedorAccessPage` | "Entrar no Portal" | `loginWithPin('fornecedor')` | Spinner `Loader2` | `disabled={loading || pin.length !== 4}` | Bloqueio no início da função assíncrona |
| `UI-BTN-008` | `FornecedorAccessPage` | "Enviar cadastro para análise" | `gsa_public_register_supplier` | Spinner `Loader2` | `disabled={loading || !consent}` | Idempotência e bloqueio de múltiplos envios |
| `UI-BTN-009` | `AffiliateAccessPage` | "Ativar perfil de afiliado" | `sessionService.registerAffiliate`| Spinner `Loader2` | `disabled={loading || !form.termos_aceitos}` | Trava `setLoading(true)` |
| `UI-BTN-010` | `ProtocolConsultPage` | "Consultar" | `gsa_public_consultar_protocolo`| Spinner `Loader2` | `disabled={loading || !inputCodigo.trim()}` | Debounce de 50ms na subscrição Realtime |
| `UI-BTN-011` | `ProtocolConsultPage` | "Entrar com recurso" | Abre modal de contestação | N/A | `disabled={result.recurso !== null}` | Bloqueado se recurso já existente (uso único) |
| `UI-BTN-012` | `ProtocolConsultPage` | "Continuar e receber código" | `requestPartnerAppealVerification` | Spinner `Loader2` | `disabled={appealBusy || appealText.length < 20}` | Limite de tentativas no backend (máx 5) |
| `UI-BTN-013` | `ProtocolConsultPage` | "Confirmar e enviar recurso" | `submitPartnerAppeal` | Spinner `Loader2` | `disabled={appealBusy || appealCode.length !== 6}` | `idempotencyKey: crypto.randomUUID()` |
| `UI-BTN-014` | `PartnerBenefitRedeemModal` | "Resgatar Benefício" | `gsa_public_resgatar_parceiro` | Spinner animado | `disabled={loading}` | Trava síncrona com modal persistente |
| `UI-BTN-015` | `CheckoutPage` (Etapa 1) | "Avançar para Pagamento" | Valida frete e avança etapa | Transição instantânea | `disabled={temProdutos && !enderecoValido}`| Validação estrita de campos de endereço |
| `UI-BTN-016` | `CheckoutPage` (Etapa 2) | "Avançar para Resumo do Pedido" | Valida saldo/pontos e avança | Transição instantânea | `disabled={!formaPagamento}` | Validação de suficiência de saldo |
| `UI-BTN-017` | `CheckoutPage` (Etapa 3) | "Confirmar e Finalizar Pedido" | `gsa_client_checkout_store` | Spinner `Loader2` + texto alternado | `disabled={isSubmitting}` | **Dupla proteção**: `isSubmittingRef.current = true` + `checkoutRequestId.current = generateUUID()` |
| `UI-BTN-018` | `CheckoutPixModal` | "Copiar Código Pix" | Copia Pix Copia-e-Cola | Feedback visual com ícone de Check | N/A | Feedback temporizado de 2.500ms |
| `UI-BTN-019` | `CartDrawer` | "Finalizar Compra" | Navega para rota de checkout | Redirecionamento | `disabled={cartItems.length === 0}` | Prevenção de checkout com carrinho vazio |
| `UI-BTN-020` | `CartDrawer` | "Remover Item" | Remove SKU do carrinho | Atualização otimista | `disabled={deletingId === item.id}` | Mutação atômica via `clientOperationalWrite` |
| `UI-BTN-021` | `ClientFinanceiro` | "Solicitar Saque" | `gsa_client_request_withdrawal` | Spinner `Loader2` | `disabled={submitting || valor < 50}` | Bloqueio durante roundtrip de RPC |
| `UI-BTN-022` | `ClientFinanceiro` | "Pagar Fatura com Saldo" | `gsa_client_pagar_fatura` | Spinner `Loader2` | `disabled={submitting || saldo < valor}` | `FOR UPDATE` lock no PostgreSQL |
| `UI-BTN-023` | `ClientTransferencias` | "Confirmar Transferência" | `gsa_client_transfer_balance` | Spinner `Loader2` | `disabled={submitting || !destinatario}` | Janela de cancelamento reversível configurada |
| `UI-BTN-024` | `ClientPontos` | "Converter Pontos em Saldo" | `gsa_converter_pontos_carteira` | Confetti animado + Spinner | `disabled={converting || pontos < 100}` | Mutação única com trava de saldo anti-tampering |
| `UI-BTN-025` | `ClientMeuCredito` | "Solicitar Saque do Crédito" | `gsa_client_request_credit_payout` | Spinner `Loader2` | `disabled={submitting || valor > disponivel}`| Quarentena e auditoria de documentos |
| `UI-BTN-026` | `PrestadorDemandas` | "Aceitar Demanda" | `gsa_provider_transition_demand('accept')` | Spinner `Loader2` | `disabled={submitting}` | Máquina de estados no PostgreSQL |
| `UI-BTN-027` | `PrestadorDemandas` | "Enviar Contraproposta" | `gsa_provider_transition_demand('counteroffer')` | Spinner `Loader2` | `disabled={submitting || !counterValue}` | Validação de valor positivo |
| `UI-BTN-028` | `PrestadorDemandas` | "Concluir e Entregar OS" | `gsa_provider_transition_demand('deliver')` | Spinner `Loader2` | `disabled={submitting || !deliveryNotes}` | Upload multipart prévio com rollback |
| `UI-BTN-029` | `PrestadorFinanceiro` | "Solicitar Repasse PIX" | `gsa_provider_request_withdrawal` | Spinner `Loader2` | `disabled={submitting || valor <= 0}` | Validação server-side de saldo disponível |
| `UI-BTN-030` | `FornecedorDashboard` | "Submeter Novo Produto" | `gsa_supplier_request_product` | Spinner `Loader2` | `disabled={saving}` | Homologação administrativa pendente |
| `UI-BTN-031` | `FornecedorDashboard` | "Confirmar Despacho & NF-e" | `gsa_supplier_submit_delivery` | Spinner `Loader2` | `disabled={saving || !nfeNumber}` | Incremento de estoque condicionado a aceite |
| `UI-BTN-032` | `AfiliadoDashboard` | "Gerar Link de Divulgação" | `gsa_client_create_affiliate_link` | Feedback visual + cópia | `disabled={saving || !titulo}` | Link único com hash determinístico |
| `UI-BTN-033` | `AfiliadoDashboard` | "Solicitar Saque PIX" | `gsa_client_request_affiliate_payout` | Spinner `Loader2` | `disabled={saving || valor < 50}` | Carência de 30 dias obrigatória |
| `UI-BTN-034` | `PartnerRedemptionDetailModal`| "Aprovar Resgate" | `gsa_admin_set_partner_redemption_status` | Spinner `Loader2` | `disabled={isApproving}` | Envio de WhatsApp transacional com UTF-8 |
| `UI-BTN-035` | `PartnerRedemptionDetailModal`| "Recusar Resgate" | `gsa_admin_set_partner_redemption_status` | Spinner `Loader2` | `disabled={isRejecting || !rejectReason}` | Justificativa gravada na linha do resgate |
| `UI-BTN-036` | `PartnerRedemptionDetailModal`| "Aceitar Recurso (Deferir)" | `gsa_admin_decide_partner_appeal` | Spinner `Loader2` | `disabled={isDecidingAppeal}` | Status passa para `deferido` com notificação |
| `UI-BTN-037` | `PartnerRedemptionDetailModal`| "Negar Recurso (Indeferir)" | `gsa_admin_decide_partner_appeal` | Spinner `Loader2` | `disabled={isDecidingAppeal || !appealReason}`| Decisão irrecorrível final |
| `UI-BTN-038` | `AcessosModule` | "Salvar Colaborador" | `gsa_admin_save_collaborator` | Spinner `Loader2` | `disabled={saving || !nome}` | Validação RBAC no banco de dados |
| `UI-BTN-039` | `AcessosModule` | "Rotacionar Credencial" | `gsa_admin_rotate_collaborator_credential`| Confirmação em 2 etapas | `disabled={saving}` | Revoga imediatamente todas as sessões ativas |
| `UI-BTN-040` | `GsaTvMasterControl` | "Corte de Emergência (Filler)" | `gsa_admin_gsa_tv_emergency_cut` | Ícone de Alerta pulsante | `disabled={isCutting}` | Chamada direta ao Daemon na VPS porta 5680 |
| `UI-BTN-041` | `ClientLoginPage` | "Esqueci minha senha / Recuperar PIN" | `Navegação para fluxo de recuperação` | Nenhum | `disabled={loading}` | Trava booleana |
| `UI-BTN-042` | `ClientLoginPage` | "Enviar código de recuperação WhatsApp" | `gsa_public_request_password_recovery` | Spinner Loader2 | `disabled={loading || !recoveryEmail}` | Idempotency key |
| `UI-BTN-043` | `BusinessRegistrationPage` | "Consultar CEP (ViaCEP)" | `consultarCEP (ViaCEP API)` | Spinner Loader2 | `disabled={loadingCep || cep.length !== 8}` | Cache local e debounce 300ms |
| `UI-BTN-044` | `BusinessRegistrationPage` | "Enviar código 2FA WhatsApp" | `gsa_public_send_challenge_sms` | Spinner Loader2 | `disabled={loading || phone.length !== 11}` | Rate limit de 60s |
| `UI-BTN-045` | `ClientPortal` | "Salvar Endereço e Contato" | `gsa_client_update_profile` | Spinner Loader2 | `disabled={isSaving}` | Trava booleana de submissão |
| `UI-BTN-046` | `ClientPortal` | "Copiar Código de Indicação" | `navigator.clipboard.writeText` | Feedback visual de cópia | `Habilitado` | Timeout de 2000ms de feedback |
| `UI-BTN-047` | `ClientPortal` | "Baixar Comprovante PDF" | `gsa-free-tools (Geração PDF)` | Spinner Loader2 | `disabled={isGeneratingPdf}` | Guarda booleana |
| `UI-BTN-048` | `ClientExtrato` | "Exportar Extrato (CSV / PDF)" | `exportTransactionsCsv / exportTransactionsPdf` | Spinner Loader2 | `disabled={isExporting}` | Guarda booleana |
| `UI-BTN-049` | `ClientExtrato` | "Filtrar por Tipo de Transação" | `setFilterType e recarregamento de query` | Skeleton loading | `Habilitado` | Debounce de 200ms |
| `UI-BTN-050` | `ClientFinanceiro` | "Pagar com Carteira (Modal Quitação)" | `gsa_client_pagar_fatura` | Spinner Loader2 | `disabled={isPaying || saldoInsuficiente}` | Idempotência e lock ACID |
| `UI-BTN-051` | `ClientFinanceiro` | "Gerar PIX Instantâneo (Fatura)" | `gsa-payments / gsa_client_gerar_pix_fatura` | Spinner Loader2 | `disabled={isGeneratingPix}` | Reuso de QR code ativo |
| `UI-BTN-052` | `ClientTransferencias` | "Reverter Transferência P2P" | `gsa_client_reverter_transferencia` | Spinner Loader2 | `disabled={isReverting || foraDoPrazo}` | Validação de tolerância de 5 minutos |
| `UI-BTN-053` | `CreditWithdrawalModal` | "Solicitar Saque de Crédito" | `gsa_client_request_credit_withdrawal` | Spinner Loader2 | `disabled={isSubmitting || valorInvalido}` | Trava booleana e lock atômico |
| `UI-BTN-054` | `CreditWithdrawalsAdminPanel` | "Marcar Saque como Pago" | `gsa_admin_complete_credit_withdrawal` | Spinner Loader2 | `disabled={isUpdating}` | Confirmação modal em 2 etapas |
| `UI-BTN-055` | `ClientMeuCredito` | "Solicitar Empréstimo Pessoal" | `gsa_client_request_loan` | Spinner Loader2 | `disabled={isRequesting || semLimite}` | Verificação prévia de score de crédito |
| `UI-BTN-056` | `EmprestimosModule` | "Aprovar Proposta de Empréstimo" | `gsa_admin_approve_loan` | Spinner Loader2 | `disabled={isProcessing}` | Auditoria compulsória de autorização |
| `UI-BTN-057` | `CobrancaModule` | "Gerar Acordo de Renegociação" | `gsa_admin_create_debt_settlement` | Spinner Loader2 | `disabled={isSubmitting || !valorValido}` | Cálculo server-side de juros e multas |
| `UI-BTN-058` | `ProductPage` | "Adicionar ao Carrinho / Comprar Agora" | `cartStore.addItem / navigateToCheckout` | Ícone animado | `disabled={produtoEsgotado}` | Debounce 150ms |
| `UI-BTN-059` | `PurchasesPage` | "Solicitar Devolução / Troca" | `gsa_client_request_store_refund` | Spinner Loader2 | `disabled={isSubmitting || prazoExcedido}` | Guarda booleana de envio |
| `UI-BTN-060` | `LojaTrocasModule` | "Aprovar Solicitação de Devolução" | `gsa_admin_atualizar_solicitacao_loja` | Spinner Loader2 | `disabled={isApproving}` | Estorno atômico de estoque, carteira e pontos |
| `UI-BTN-061` | `ProdutosModule` | "Salvar Produto (Novo / Edição)" | `gsa_admin_upsert_product` | Spinner Loader2 | `disabled={isSaving || !tituloValido}` | Idempotency key |
| `UI-BTN-062` | `CuponsLojaModule` | "Criar Cupom de Desconto" | `gsa_admin_create_coupon` | Spinner Loader2 | `disabled={isSaving || !codigoValido}` | Checagem de unicidade de código |
| `UI-BTN-063` | `ClientVouchers` | "Resgatar Benefício do Parceiro" | `gsa_client_redeem_partner_benefit` | Spinner Loader2 | `disabled={isRedeeming || semSaldoPontos}` | Geração de protocolo criptográfico unívoco |
| `UI-BTN-064` | `AffiliateAdminModule` | "Liberar Comissões em Carência" | `gsa_admin_release_affiliate_commissions` | Spinner Loader2 | `disabled={isReleasing}` | Processamento em lote via RPC |
| `UI-BTN-065` | `AfiliadoDashboard` | "Transferir Saldo para Outro Afiliado" | `gsa_client_transfer_affiliate_balance` | Spinner Loader2 | `disabled={isTransferring || !afiliadoDestino}` | Validação de PIN e rate limiting |
| `UI-BTN-066` | `OrcamentosModule` | "Despachar para Prestador" | `gsa_admin_dispatch_order_to_provider` | Spinner Loader2 | `disabled={isDispatching || !prestadorSelecionado}` | Notificação push em tempo real |
| `UI-BTN-067` | `PrestadorAgenda` | "Agendar Atendimento" | `gsa_provider_create_schedule` | Spinner Loader2 | `disabled={isSaving || conflitoHorario}` | Verificação server-side anti-colisão |
| `UI-BTN-068` | `FornecedoresModule` | "Homologar Recebimento e Integrar Estoque" | `gsa_admin_receive_supplier_shipment` | Spinner Loader2 | `disabled={isReceiving}` | Incremento atômico de estoque físico |
| `UI-BTN-069` | `TravelAdminModule` | "Criar Pacote de Viagem" | `gsa_admin_create_travel_package` | Spinner Loader2 | `disabled={isSaving || !titulo}` | Guarda booleana de envio |
| `UI-BTN-070` | `TravelPackageDetailModal` | "Solicitar Reserva de Viagem" | `gsa_client_book_travel_package` | Spinner Loader2 | `disabled={isBooking}` | Criação de protocolo de reserva em faturas |
| `UI-BTN-071` | `SaudeModule` | "Emitir Proposta de Plano de Saúde" | `gsa_admin_create_health_quote` | Spinner Loader2 | `disabled={isSubmitting}` | Validação de faixa etária e tabela de preços |
| `UI-BTN-072` | `SegurosModule` | "Registrar Sinistro de Seguro" | `gsa_client_report_insurance_claim` | Spinner Loader2 | `disabled={isSubmitting || !apoliceAtiva}` | Upload seguro de evidências |
| `UI-BTN-073` | `ClassifiedsModule` | "Aprovar Anúncio de Classificado" | `gsa_admin_approve_classified_ad` | Spinner Loader2 | `disabled={isModerating}` | Atualização de status com publicação instantânea |
| `UI-BTN-074` | `AdvertiserPortal` | "Criar Nova Campanha de Anúncio" | `gsa-ads-admin (Edge Function)` | Spinner Loader2 | `disabled={isCreating || semSaldo}` | Validação dimensional de criativos |
| `UI-BTN-075` | `AdvertisingAdminModule` | "Aprovar e Ativar Campanha de Mídia" | `gsa_admin_approve_ad_campaign` | Spinner Loader2 | `disabled={isActivating}` | Injeção na rotação do ad server |
| `UI-BTN-076` | `GsaTvControlRoom` | "Salvar Grade Semanal de Programação" | `gsa_admin_save_tv_schedule` | Spinner Loader2 | `disabled={isSaving || sobreposicaoDetectada}` | Validação temporal contínua da grade |
| `UI-BTN-077` | `GsaTvLiveConsole` | "Comutar Fonte Ao Vivo (Chaveamento)" | `gsa_admin_switch_tv_source` | Feedback visual no console | `disabled={isSwitching}` | Comando assíncrono para o VPS live runner |
| `UI-BTN-078` | `ClientSuporte` | "Abrir Ticket de Atendimento" | `gsa_client_create_support_ticket` | Spinner Loader2 | `disabled={isSubmitting || !mensagem}` | Idempotency key e notificação aos atendentes |
| `UI-BTN-079` | `TicketsModule` | "Enviar Resposta ao Cliente (Ticket)" | `gsa_admin_reply_support_ticket` | Spinner Loader2 | `disabled={isSending || !resposta}` | Disparo integrado por e-mail/WhatsApp |
| `UI-BTN-080` | `CareersPublicPage` | "Candidatar-se à Vaga" | `gsa_public_submit_career_application` | Spinner Loader2 | `disabled={isSubmitting || !curriculoValido}` | Bloqueio de submissão duplicada por CPF |
| `UI-BTN-081` | `SiteCampaignAdminModule` | "Salvar Hero Banner" | `gsa_admin_save_hero_banner` | Spinner Loader2 | `disabled={isSaving}` | Purge automático de cache da CDN Cloudflare |
| `UI-BTN-082` | `ScrapingAdminModule` | "Disparar Scraping Agora" | `gsa_admin_trigger_scraping_job` | Spinner Loader2 | `disabled={isRunning}` | Lock de fila de execução única |
| `UI-BTN-083` | `ShopeeOperationsModule` | "Processar Fila de Pedidos Shopee" | `gsa_admin_process_shopee_orders` | Spinner Loader2 | `disabled={isProcessing}` | Iteração com rate limiting de API externa |
| `UI-BTN-084` | `ClientIndiqueGanhe` | "Convidar Amigo por WhatsApp" | `openWhatsAppShareLink` | Nenhum (deep-link) | `Habilitado` | Geração prévia de short-link parametrizado |
| `UI-BTN-085` | `ClientPremios` | "Resgatar Prêmio Físico com Pontos" | `gsa_client_redeem_loyalty_prize` | Spinner Loader2 | `disabled={isRedeeming || pontosInsuficientes}` | Lock atômico de débito de pontos |
| `UI-BTN-086` | `OrdensAssinaturaModule` | "Cadastrar Plano de Assinatura Recorrente" | `gsa_admin_create_subscription_plan` | Spinner Loader2 | `disabled={isSaving}` | Validação de periodicidade e valor positivo |
| `UI-BTN-087` | `FiscalModule` | "Emitir Nota Fiscal (NF-e / NFS-e)" | `gsa_admin_emit_invoice_fiscal` | Spinner Loader2 | `disabled={isEmitting}` | Comunicação síncrona com API de mensageria fiscal |
| `UI-BTN-088` | `CalculatorProAdminPanel` | "Salvar Regras de Precificação" | `gsa_admin_save_pricing_matrix` | Spinner Loader2 | `disabled={isSaving}` | Validação de margens mínimas |
| `UI-BTN-089` | `SystemMonitorModule` | "Executar Diagnóstico do Sistema" | `gsa_admin_run_system_health_check` | Spinner Loader2 | `disabled={isChecking}` | Execução sequencial de probes com timeout |
| `UI-BTN-090` | `WhatsAppHealthMonitor` | "Testar Conexão com Evolution API" | `whatsappHealthService.checkConnectionState` | Spinner Loader2 | `disabled={isTesting}` | Cooldown de 5 segundos entre testes |
| `UI-BTN-091` | `CrowdfundingModal` | "Contribuir com a Vaquinha" | `gsa_client_donate_crowdfunding` | Spinner Loader2 | `disabled={isDonating || valorInvalido}` | Débito atômico ou geração de PIX de doação |
| `UI-BTN-092` | `GsaTvRights` | "Registrar Licença Audiovisual" | `gsa_admin_register_tv_rights` | Spinner Loader2 | `disabled={isSaving}` | Validação de termo de vigência |
| `UI-BTN-093` | `GsaTvGraphics` | "Ativar Tarja / Lower-Third no Ar" | `gsa_admin_trigger_tv_graphic` | Feedback visual no switcher | `disabled={isActivating}` | Push de WebSocket para o player receptor |
| `UI-BTN-094` | `PainelRentabilidade` | "Filtrar Período Financeiro" | `setFinancialPeriodFilter` | Skeleton loading | `Habilitado` | Debounce de 250ms |
| `UI-BTN-095` | `CareerVacanciesManager` | "Publicar Nova Vaga de Emprego" | `gsa_admin_publish_job_vacancy` | Spinner Loader2 | `disabled={isPublishing}` | Disponibilização instantânea no portal público |
| `UI-BTN-096` | `ClientCancelPromoModal` | "Confirmar Desistência da Promoção" | `gsa_client_cancel_promotion_subscription` | Spinner Loader2 | `disabled={isCancelling}` | Confirmação com digitação de motivo |
| `UI-BTN-097` | `PromocaoQuantidadeForm` | "Salvar Regra de Combo / Quantidade" | `gsa_admin_save_quantity_promo_rule` | Spinner Loader2 | `disabled={isSaving}` | Validação de conflito de promoções ativas |
| `UI-BTN-098` | `CreditDisputeModal` | "Abrir Contestação de Limite / Lançamento" | `gsa_client_open_credit_dispute` | Spinner Loader2 | `disabled={isSubmitting || !motivo}` | Abertura formal de processo administrativo |
| `UI-BTN-099` | `ProviderAccessPage` | "Enviar Documentação KYC de Prestador" | `gsa_provider_submit_kyc_documents` | Spinner Loader2 | `disabled={isUploading || !documentosCompletos}` | Upload para Cloudflare R2 com hash SHA256 |
| `UI-BTN-100` | `FornecedorFinanceiro` | "Solicitar Alteração de Conta Bancária / PIX" | `gsa_supplier_request_bank_change` | Spinner Loader2 | `disabled={isSubmitting || !chavePixValida}` | Exigência de 2FA e aprovação pelo financeiro |
| `UI-BTN-101` | `FreeToolsPage` | "Processar Arquivo / Converter PDF" | `gsa-free-tools (Conversão)` | Spinner Loader2 | `disabled={isProcessing || !arquivoSelecionado}` | Bloqueio durante upload e conversão |
| `UI-BTN-102` | `FreeToolsPage` | "Baixar Arquivo Processado" | `downloadGeneratedBlob` | Feedback de download | `Habilitado` | Prevenção de múltiplos cliques |
| `UI-BTN-103` | `SystemsPageFinal` | "Solicitar Orçamento de Sistema" | `gsa-public-budget (Envio)` | Spinner Loader2 | `disabled={isSubmitting}` | Rate limit de 1 proposta por IP/minuto |
| `UI-BTN-104` | `BrandJourneyPage` | "Solicitar Consultoria de Marca" | `gsa-public-budget (Envio)` | Spinner Loader2 | `disabled={isSubmitting}` | Rate limit de envio |
| `UI-BTN-105` | `PartnersPage` | "Filtrar por Categoria de Parceiro" | `setSelectedPartnerCategory` | Indicador de transição | `Habilitado` | Debounce 100ms |
| `UI-BTN-106` | `PartnerApplicationPage` | "Enviar Proposta de Parceria B2B" | `gsa-partner-application (Envio)` | Spinner Loader2 | `disabled={isSubmitting || !termos}` | Idempotency key |
| `UI-BTN-107` | `AffiliatePublicPage` | "Cadastrar-se como Afiliado" | `sessionService.registerAffiliate` | Spinner Loader2 | `disabled={isSubmitting}` | Validação de documento única |
| `UI-BTN-108` | `OrcamentosWorkstation` | "Aprovar Orçamento Comercial" | `gsa_admin_approve_commercial_budget` | Spinner Loader2 | `disabled={isApproving}` | Conversão atômica em Ordem de Serviço |
| `UI-BTN-109` | `OrcamentosWorkstation` | "Rejeitar / Cancelar Orçamento Comercial" | `gsa_admin_reject_commercial_budget` | Spinner Loader2 | `disabled={isRejecting || !motivoCancelamento}` | Confirmação modal com justificativa |
| `UI-BTN-110` | `DemandasWorkstation` | "Atribuir Demanda a Colaborador" | `gsa_admin_assign_demand_collaborator` | Spinner Loader2 | `disabled={isAssigning}` | Notificação instantânea via Realtime |
| `UI-BTN-111` | `FinancialDashboard` | "Executar Conciliação Bancária" | `gsa_admin_run_bank_reconciliation` | Spinner Loader2 | `disabled={isReconciling}` | Processamento assíncrono em lote |
| `UI-BTN-112` | `FinancialDashboard` | "Exportar Relatório DRE / Balancete" | `gsa_admin_export_dre_report` | Spinner Loader2 | `disabled={isExporting}` | Download protegido de planilha |
| `UI-BTN-113` | `CareersAdminModule` | "Alterar Status de Candidato" | `gsa_admin_update_applicant_status` | Spinner Loader2 | `disabled={isUpdating}` | Gatilho de e-mail/WhatsApp transacional |
| `UI-BTN-114` | `CareersAdminModule` | "Agendar Entrevista com Candidato" | `gsa_admin_schedule_job_interview` | Spinner Loader2 | `disabled={isScheduling}` | Criação de convite com link de conferência |
| `UI-BTN-115` | `AdminPanel` | "Exportar Trilha de Auditoria (Logs)" | `gsa_admin_export_audit_logs` | Spinner Loader2 | `disabled={isExporting}` | Geração de arquivo JSON/CSV com checksum |
| `UI-BTN-116` | `AdminPanel` | "Encerrar Todas as Sessões Concorrentes" | `gsa_admin_revoke_all_sessions` | Spinner Loader2 | `disabled={isRevoking}` | Confirmação crítica com senha master |
| `UI-BTN-117` | `ConfiguracoesModule` | "Salvar Configurações Gerais do Sistema" | `gsa_admin_save_system_settings` | Spinner Loader2 | `disabled={isSaving}` | Validação de parâmetros JSON no PostgreSQL |
| `UI-BTN-118` | `ClientVIPModal` | "Assinar Plano VIP Anual" | `gsa_client_subscribe_vip_annual` | Spinner Loader2 | `disabled={isSubscribing || semSaldo}` | Ativação imediata de benefícios e cashback |

---

## 6. CATÁLOGO DE TABELAS DE DADOS & GRIDS OPERACIONAIS (`UI-TBL-*` — 42 TABELAS)

| ID da Tabela | Módulo / Componente | Entidade de Dados Representada | Colunas Principais | Filtros Disponíveis | Paginação / Ordenação |
| `UI-TBL-001` | `UI-MOD-04` / `FaturasList` | Faturas do Cliente (`faturas`) | Código, Data de Vencimento, Valor Original, Descontos, Valor Pendente, Status, Ações | Por status (`pendente`, `paga`, `vencida`, `cancelada`) | Paginação cliente 10 itens/pág; ordem decrescente de vencimento |
| `UI-TBL-002` | `UI-MOD-04` / `ExtratoList` | Extrato Financeiro (`extrato_financeiro`)| Data/Hora, Descrição, Tipo (Crédito/Débito), Valor, Saldo Resultante | Por tipo, por mês/ano selecionado | Rolagem contínua com ordenação temporal decrescente |
| `UI-TBL-003` | `UI-MOD-04` / `SaquesList` | Saques Solicitados (`saques`) | Protocolo, Data, Valor Solicitado, Taxa VIP, Valor Líquido, Chave PIX, Status | Por status (`pendente`, `aprovado`, `recusado`, `pago`) | Limite 50 registros mais recentes |
| `UI-TBL-004` | `UI-MOD-04` / `NotasFiscaisList` | Notas Fiscais (`ordens_fiscais`) | Número da NF, Série, Data de Emissão, Valor Tributável, PDF/XML | Busca por número de NF | Ordem decrescente de emissão |
| `UI-TBL-005` | `UI-MOD-04` / `ClientOrcamentos` | Orçamentos Comerciais (`orcamentos`) | Código, Serviço/Produto, Valor Total, Fase de Negociação, Validade, Status | Por status (`aberto`, `aprovado`, `em_revisao`, `cancelado`)| Ordem por atualização recente |
| `UI-TBL-006` | `UI-MOD-04` / `ClientVouchers` | Cupons e Vouchers do Cliente (`vouchers`)| Código do Voucher, Categoria, Desconto, Validade, Limite de Uso, Status | Ativos vs. Utilizados/Expirados | Filtro por vigência |
| `UI-TBL-007` | `UI-MOD-04` / `ClientPremios` | Resgates de Prêmios (`cliente_premios`) | Prêmio, Custo em Pontos, Data do Resgate, Status de Entrega | Por status de fulfillment | Ordem decrescente de resgate |
| `UI-TBL-008` | `UI-MOD-04` / `PurchasesPage` | Pedidos da Loja (`pedidos` / `orcamentos`)| Código do Pedido, Data, Total, Itens, Modalidade de Pagamento, Status | Por status de entrega e pagamento | 10 pedidos por página com expansão de detalhes |
| `UI-TBL-009` | `UI-MOD-06` / `PrestadorDemandas` | Demandas do Técnico (`prestador_demandas`)| Código da OS, Cliente/Região, Valor Proposto, Valor Final, Prazo, Status | Por abas: Abertas, Ativas, Concluídas | Até 100 demandas simultâneas com Realtime |
| `UI-TBL-010` | `UI-MOD-06` / `PrestadorAgenda` | Agendamentos de Campo (`prestador_agendamentos`)| Data, Horário de Início, Horário de Fim, Demanda/OS, Endereço, Status | Visão semanal / diária | Ordenação cronológica linear |
| `UI-TBL-011` | `UI-MOD-07` / `FornecedorDashboard` | Pedidos de Compra GSA (`pedidos_compra`) | Código, Data de Emissão, Qtd Itens, Valor Total, Status, Ações | Todos, Pendentes de Despacho, Despachados | Ordenação por data de pedido decrescente |
| `UI-TBL-012` | `UI-MOD-07` / `FornecedorDashboard` | Remessas & Entregas (`fornecedor_entregas`) | NF-e, Transportadora, Código de Rastreio, Data de Envio, Aceite Admin | Por status de recebimento na GSA | Ordem temporal decrescente |
| `UI-TBL-013` | `UI-MOD-07` / `FornecedorDashboard` | Títulos a Receber (`fornecedor_titulos`) | Título, Pedido Vinculado, Vencimento, Valor Líquido, Status, Comprovante | A Vencer vs. Liquidados | Ordem decrescente de vencimento |
| `UI-TBL-014` | `UI-MOD-08` / `AfiliadoDashboard` | Links Parametrizados (`gsa_afiliado_links`)| Título, Link Completo, Cliques Totais, Conversões, Taxa de Cliques | Busca por título / tag | Ordem por número de cliques ou data |
| `UI-TBL-015` | `UI-MOD-08` / `AfiliadoDashboard` | Histórico de Comissões (`afiliado_comissoes`)| Pedido/Origem, Data, Valor da Venda, % Comissão, Valor Comissão, Liberação | Pendentes (Carência 30d), Liberadas, Pagas | 20 registros por página |
| `UI-TBL-016` | `UI-MOD-08` / `AfiliadoDashboard` | Histórico de Saques (`gsa_afiliado_saques`)| Data do Pedido, Valor, Chave PIX, Status, Data do Pagamento, Comprovante | Todos, Em Análise, Pagos, Recusados | Ordem decrescente |
| `UI-TBL-017` | `UI-MOD-09` / `AdvertiserPortal` | Campanhas Publicitárias (`gsa_ad_campaigns`)| Nome da Campanha, Posicionamento, Período, Orçamento, Impressões, Status | Rascunho, Ativa, Pausada, Concluída | Paginação servidor 15 itens/pág |
| `UI-TBL-018` | `UI-MOD-09` / `AdvertiserPortal` | Criativos Submetidos (`gsa_ad_creatives`)| Prévia Visual, Dimensões, Formato, Status de Aprovação, CTR Médio | Aprovados, Em Análise, Rejeitados | Grid responsivo de cards com lightbox |
| `UI-TBL-019` | `UI-MOD-10` / `ClientesModule` | Cadastro Mestre de Clientes (`clientes`)| Código, Nome/Razão, CPF/CNPJ, E-mail, Celular, Saldo, Pontos VIP, Status | Por status (`ativo`, `inativo`, `bloqueado`), por tipo (PF/PJ)| Paginação 20 itens/pág com busca textual instantânea |
| `UI-TBL-020` | `UI-MOD-10` / `PrestadoresSection`| Prestadores Homologados (`prestadores`) | Nome, Documento, Área de Atuação, Telefone, Saldo, Status, Auditoria | Pendente, Ativo, Bloqueado, Suspenso | Busca por nome e especialidade técnica |
| `UI-TBL-021` | `UI-MOD-10` / `FornecedoresSection` | Fornecedores Cadastrados (`fornecedores`) | Razão Social, CNPJ, Contato, E-mail, Score de Qualidade, Status | Homologados, Pendentes, Em Quarentena | Ordenação por razão social ou data |
| `UI-TBL-022` | `UI-MOD-10` / `PartnersAdminModule`| Resgates de Convênios (`parceiros_resgates`)| Protocolo, Parceiro, Solicitante, Telefone, SLA Restante, Status, Ações | Pendente, Em Análise, Concluído, Recusado, Em Recurso | Countdown regressivo em tempo real nas linhas |
| `UI-TBL-023` | `UI-MOD-10` / `AcessosModule` | Colaboradores Internos (`colaboradores`)| Nome, E-mail, Telefone, Função/Cargo, Módulos Permitidos, Status, Ações | Ativos vs. Inativos | Gestão com rotação de credenciais |
| `UI-TBL-024` | `UI-MOD-10` / `AcessosModule` | Fila de Exclusão Segura (`solicitacoes_exclusao`)| Solicitante, Tabela, ID do Registro, Motivo, Data, Aval de 2º Homem | Pendente vs. Processado | Apenas administradores master |
| `UI-TBL-025` | `UI-MOD-10` / `SystemMonitorModule` | Sessões de Acesso Ativas (`sistema_sessoes`)| Ator, Tipo, Origem/IP, Dispositivo, Token Hint, Início, Expiração, Status | Ativas vs. Revogadas | Opção de revogação de sessão remota |
| `UI-TBL-026` | `UI-MOD-11` / `OrcamentosWorkstation`| Esteira Comercial (`orcamentos`) | Código, Cliente, Itens, Valor Total, Margem de Lucro, Status, Ações | Por fase comercial (Cliente vs. Admin) | Kanban interativo e visão em lista tabular |
| `UI-TBL-027` | `UI-MOD-11` / `OrdensServicoWorkstation`| Ordens de Serviço (`ordens_servico`) | Código da OS, Orçamento Origem, Prestador Atribuído, Prazo, Status | Em Andamento, Concluída, Bloqueada | Abertura de drawer de despacho técnico |
| `UI-TBL-028` | `UI-MOD-11` / `ProdutosModule` | Produtos do Catálogo (`produtos`) | Código, Nome, Categoria, Preço Base, Estoque Físico, Variantes, Status | Ativos vs. Inativos, controle de estoque | Edição inline de estoque e preço |
| `UI-TBL-029` | `UI-MOD-11` / `LojaTrocasModule` | Pós-Venda: Devoluções (`loja_solicitacoes`)| Protocolo, Cliente, Pedido Origem, Tipo (Troca/Devolução), Valor, Status | Pendente, Em Análise, Aprovado, Concluído | Disparo de estorno atômico |
| `UI-TBL-030` | `UI-MOD-12` / `FaturamentoView` | Faturamento Global (`faturas`) | Fatura, Cliente, Emissão, Vencimento, Valor Total, Saldo Pendente, Status | Por status financeiro e período | Exportação em PDF/Excel com totais consolidados |
| `UI-TBL-031` | `UI-MOD-12` / `FluxoCaixaView` | Livro-Razão Contábil (`carteira_lancamentos`)| Data, Ator, Tipo (Entrada/Saída), Descrição, Valor, Saldo Consolidado | Filtro por tipo de lançamento contábil | Conciliação bancária em tempo real |
| `UI-TBL-032` | `UI-MOD-12` / `CobrancaView` | Devedores & Inadimplência (`cobrancas`) | Cliente, Fatura Atrasada, Dias de Atraso, Valor Original, Acordo Ativo | Abertas, Em Acordo, Protestadas | Disparo em massa de notificações WhatsApp |
| `UI-TBL-033` | `UI-MOD-12` / `FiscalView` | Emissões Fiscais (`ordens_fiscais`) | Número, Série, Destinatário, CFOP, Base de Cálculo, Impostos, Status | Transmitida, Rejeitada, Pendente | Download em lote de XMLs assinados |
| `UI-TBL-034` | `UI-MOD-12` / `CreditWithdrawalsAdminPanel`| Saques de Limite de Crédito | Solicitante, Limite Concedido, Valor Requisitado, Chave PIX, Documentos | Pendentes de Aval vs. Pagos | Ações de julgamento e liquidação PIX |
| `UI-TBL-035` | `UI-MOD-12` / `CreditDisputesAdminPanel` | Disputas de Crédito Loja | Protocolo, Cliente, Valor em Disputa, Motivo, Data, Decisão | Em Aberto vs. Julgadas | Julgamento com crédito ou cancelamento |
| `UI-TBL-036` | `UI-MOD-13` / `GsaTvScheduleTab` | Grade Semanal de Playout (`gsa_tv_schedule_slots`)| Dia da Semana, Hora de Início, Duração, Programa, Bloco Comercial, Status | Segunda a Domingo | Validação de sobreposição em tempo real |
| `UI-TBL-037` | `UI-MOD-13` / `GsaTvLibraryTab` | Acervo de Mídias (`gsa_tv_media_items`) | Título, Categoria (News/Viral/Faith/Lifestyle/SFX), Duração, Resolução, Áudio | Busca por nome e categoria | Pré-visualização de vídeo e áudio player nativo |
| `UI-TBL-038` | `UI-MOD-13` / `GsaTvMasterControl` | AS-RUN Broadcast Log (`gsa_tv_as_run`) | Data/Hora Exata, Programa, Tipo (Conteúdo/Break), Duração Real, Status | Logs diários de playout | Auditoria de cumprimento de grade publicitária |
| `UI-TBL-039` | `UI-MOD-14` / `TravelAdminModule` | Pacotes de Viagem (`gsa_viagens_pacotes`)| Título, Destino, Saída, Retorno, Valor por Passageiro, Vagas, Status | Nacionais, Internacionais, Excursões | Controle de disponibilidade de hotel/aéreo |
| `UI-TBL-040` | `UI-MOD-14` / `ClassifiedsModule` | Anúncios de Classificados | Título, Categoria (Imóveis/Veículos/Geral), Anunciante, Valor, Moderação | Pendente de Moderação, Aprovado, Pausado | Aprovação ou rejeição com justificativa |
| `UI-TBL-041` | `UI-MOD-14` / `ProtectionAdminModule` | Apólices de Seguros / Contratos Saúde | Número da Apólice, Segurado/Titular, Operadora, Prêmio/Mensalidade, Vigência | Por ramo de cobertura e status de contrato | Visualização de beneficiários e dependentes |
| `UI-TBL-042` | `UI-MOD-15` / `CareersAdminModule` | Candidaturas a Vagas (`gsa_careers_applications`)| Candidato, Vaga Almejada, E-mail, Telefone, Data de Inscrição, Currículo, Status| Triagem, Entrevista, Aprovado, Banco de Talentos| Download de currículo e disparo de WhatsApp |

---

## 7. CATÁLOGO DE MODAIS, DRAWERS & DIÁLOGOS (`UI-MDL-*` — 48 MODAIS)

| ID do Modal | Componente / Localização | Título / Função | Elemento de Disparo | Comportamento de Fechamento | Ação Primária Executada |
| `UI-MDL-001` | `ProtocolConsultPage` | Recurso de Contestação de Benefício | Botão "Entrar com recurso" | Botão 'X' ou backdrop (bloqueado se busy) | `submitPartnerAppeal` com upload de provas |
| `UI-MDL-002` | `PartnerBenefitRedeemModal` | Resgate do Cupom/Voucher do Parceiro | Botão "Resgatar Benefício" no card | Botão 'X' e backdrop | Gera protocolo e inicia SLA de 24h |
| `UI-MDL-003` | `PartnerApplicationModal` | Solicitação de Credenciamento Parceiro | Botão "Seja um Parceiro" | Botão 'X' e backdrop | Envia formulário B2B para moderação |
| `UI-MDL-004` | `PartnerRedemptionDetailModal`| Julgamento Administrativo do Resgate | Clique na linha da tabela de resgates | Botão 'X' ou tecla Escape | Aprova, recusa ou decide recurso do cliente |
| `UI-MDL-005` | `CheckoutPixModal` | QR Code PIX Instantâneo InfinitePay | Conclusão do Checkout via PIX | Botão "Já Realizei o Pagamento" / 'X' | Exibe QR Code e código copia-e-cola |
| `UI-MDL-006` | `AvailableCouponsModal` | Seleção de Cupons Disponíveis | Botão "Selecionar Cupom" no Checkout | Botão "Aplicar Cupom" ou 'X' | Injeta código de desconto no resumo financeiro |
| `UI-MDL-007` | `CartDrawer` | Gaveta Lateral do Carrinho | Ícone da Sacola no Topo | Botão fechar, backdrop ou tecla Esc | Atualiza quantidades e avança para checkout |
| `UI-MDL-008` | `ProductDetailsModal` | Ficha Técnica e Variantes do Produto | Clique no card do produto na vitrine | Botão 'X' ou backdrop | Seleção de cor/tamanho e inclusão no carrinho |
| `UI-MDL-009` | `FilterModal` | Filtros Avançados de Catálogo | Botão "Filtros" na Loja | Botão "Aplicar Filtros" ou limpar | Atualiza listagem por faixa de preço/categoria |
| `UI-MDL-010` | `QuantityModal` | Seleção de Combo / Desconto em Massa | Clique no selo de promoção por quantidade | Botão "Adicionar Combo ao Carrinho" | Aplica regras da engine de promoção |
| `UI-MDL-011` | `GroupBuyModal` | Vaquinha Coletiva de Produto | Botão "Comprar em Grupo / Vaquinha" | Botão 'X' ou conclusão | Gera link público compartilhável da vaquinha |
| `UI-MDL-012` | `OrderReviewModal` | Confirmação e Avaliação de Pedido | Botão "Confirmar Recebimento" | Botão "Enviar Avaliação" | Registra estrelas e depoimento do cliente |
| `UI-MDL-013` | `SubscriptionDurationModal` | Escolha de Período da Assinatura | Botão "Assinar Plano" | Botão "Confirmar Plano" | Injeta prazo_meses (1, 6, 12 meses) no carrinho |
| `UI-MDL-014` | `PaymentModal` | Central de Liquidação de Fatura | Botão "Pagar Fatura" no portal do cliente | Botão fechar / cancelamento | Permite pagar com carteira, PIX ou cartão |
| `UI-MDL-015` | `CreditWithdrawalModal` | Saque do Limite da GSA Store | Botão "Sacar Limite" no Meu Crédito | Botão 'X' ou confirmação | Registra pedido de repasse PIX em quarentena |
| `UI-MDL-016` | `CreditDisputeModal` | Contestação de Lançamento de Crédito | Botão "Contestar Compra" | Botão "Submeter Contestação" | Cria chamado na esteira de risco |
| `UI-MDL-017` | `NovoPrestadorDrawer` | Cadastro e Despacho de Novo Prestador | Botão "Novo Prestador" no painel | Botão 'X' ou backdrop | Salva cadastro e credencial inicial |
| `UI-MDL-018` | `PrestadorDetailDrawer` | Prontuário Forense do Prestador | Clique na linha da tabela de prestadores | Botão 'X' ou tecla Escape | Consulta histórico, avaliações e demandas |
| `UI-MDL-019` | `PayoutClearanceDrawer` | Liberação de Repasses Financeiros | Botão "Liberar Repasses" | Botão "Confirmar Transferência PIX" | Audita chave e liquida títulos em lote |
| `UI-MDL-020` | `AdminCommandPalette` | Paleta Global de Comandos (Ctrl+K) | Tecla `Ctrl+K` ou `Cmd+K` | Tecla `Escape` ou clique fora | Navegação instantânea e atalhos rápidos |
| `UI-MDL-021` | `ConfirmDialog` | Confirmação de Operações Críticas | Disparado em deleções ou estornos | Botões "Confirmar" e "Cancelar" | Modal de guarda contra ações acidentais |
| `UI-MDL-022` | `FileViewerContext` (Modal Global)| Visualizador de Documentos e PDFs | Clique em qualquer anexo ou nota fiscal | Botão fechar ou backdrop | Renderização segura de PDFs e imagens do R2 |
| `UI-MDL-023` | `ScrapingExecutionMonitorModal`| Monitor em Tempo Real do Scraper | Botão "Monitorar Extração" | Botão "Fechar Monitor" | Telemetria de scraping Shopee e logs |
| `UI-MDL-024` | `NovaFaturaModal` | Emissão de Fatura Avulsa | Botão "Nova Fatura" no financeiro | Botão 'X' ou submissão | Cria título a receber com QR Code PIX |
| `UI-MDL-025` | `NovoAcordoModal` | Formalização de Renegociação de Dívida | Botão "Propor Acordo" na cobrança | Botão "Gerar Acordo" | Cria parcelamento e suspende protesto |
| `UI-MDL-026` | `CollaboratorModal` | Cadastro de Colaborador RBAC | Botão "Novo Colaborador" em Acessos | Botão 'X' ou salvar | Cria credencial e permissões modulares |
| `UI-MDL-027` | `FunctionModal` | Definição de Cargos e Permissões | Botão "Nova Função" em Acessos | Botão 'X' ou salvar | Configura matriz de autorização de função |
| `UI-MDL-028` | `DeletionRequestReviewModal` | Julgamento da Regra dos Dois Homens | Clique em pedido pendente de exclusão | Botão "Aprovar Deleção" ou "Rejeitar" | Exclusão física/lógica após segundo aval |
| `UI-MDL-029` | `ProductRequestModal` | Submissão de Produto pelo Fornecedor | Botão "Sugerir Produto" no portal B2B | Botão 'X' ou enviar | Envia item com fotos para homologação |
| `UI-MDL-030` | `DeliveryModal` | Remessa de Compra com Nota Fiscal | Botão "Despachar Entrega" no pedido B2B | Botão "Concluir Remessa" | Faz upload de XML/PDF da NF-e e rastreio |
| `UI-MDL-031` | `SupplierProfileModal` | Atualização Bancária do Fornecedor | Botão "Editar Dados Bancários" | Botão "Salvar Alterações" | Envia dados bancários para quarentena |
| `UI-MDL-032` | `AffiliateLinkModal` | Criação Rápida de Link Referral | Botão "Criar Link" no painel do afiliado | Botão "Gerar e Copiar Link" | Salva link parametrizado com código único |
| `UI-MDL-033` | `AffiliatePayoutModal` | Solicitação de Saque PIX de Comissões | Botão "Solicitar Saque PIX" | Botão "Confirmar Resgate" | Valida valor mínimo e cria ordem de saque |
| `UI-MDL-034` | `CreativeUploadModal` | Upload de Mídia pelo Anunciante | Botão "Novo Criativo" no portal de Ads | Botão "Enviar para Revisão" | Envia imagem/vídeo para conformidade |
| `UI-MDL-035` | `AdProposalNegotiationModal` | Negociação de Proposta Publicitária | Botão "Enviar Contraproposta de Ads" | Botão "Enviar Proposta" | Cria nova versão de proposta com SLA |
| `UI-MDL-036` | `GsaTvMediaUploadModal` | Ingest de Arquivo de Vídeo / Áudio | Botão "Upload de Mídia" no acervo | Barra de progresso com cancelamento | Extração de metadados FFprobe e salvamento |
| `UI-MDL-037` | `GsaTvUrlImportModal` | Ingestão Remota via URL / YouTube | Botão "Importar de URL" na TV | Botão "Iniciar Download" | Download na VPS para cache local da emissora |
| `UI-MDL-038` | `GsaTvScheduleSlotModal` | Inclusão de Bloco na Grade Linear | Botão "Adicionar Bloco" na grade | Botão "Salvar Slot" | Valida ausência de choques de horário |
| `UI-MDL-039` | `GsaTvAiProjectModal` | Geração de Matéria de IA | Botão "Nova Matéria IA" no estúdio | Botão "Renderizar Edição" | Dispara worker de IA no microserviço VPS |
| `UI-MDL-040` | `GsaTvEmergencySlateModal` | Inserção de Vinheta / Slide de Alerta | Botão "Slide de Emergência" no switcher| Confirmação obrigatória em 2 etapas | Corte imediato de sinal para evitar silêncio |
| `UI-MDL-041` | `WhatsAppHealthModal` | Diagnóstico de Conexão da Evolution API| Clique no indicador de status do WhatsApp| Botão "Reconectar Instância" | Mostra QR Code de reconexão da Evolution |
| `UI-MDL-042` | `SiteCampaignModal` | Criação de Banner Promocional | Botão "Novo Banner" na gestão de campanhas| Botão "Salvar e Agendar" | Define datas de início/fim e URL de clique |
| `UI-MDL-043` | `TravelBookingModal` | Reserva de Pacote de Viagem | Botão "Reservar Viagem" no marketplace | Botão "Concluir Reserva" | Registra passageiros e emite fatura |
| `UI-MDL-044` | `HealthQuoteModal` | Cotação de Plano de Saúde | Botão "Cotar Plano" no portal | Botão "Gerar Cotação" | Calcula valores por faixa etária de vidas |
| `UI-MDL-045` | `InsuranceQuoteModal` | Cotação de Apólice de Seguros | Botão "Simular Seguro" | Botão "Solicitar Proposta" | Envia dados do bem/veículo para corretora |
| `UI-MDL-046` | `ClassifiedsOfferModal` | Envio de Proposta em Classificado | Botão "Fazer Oferta" no anúncio | Botão "Enviar Oferta ao Vendedor" | Inicia negociação com custódia de valor |
| `UI-MDL-047` | `CareersApplicationModal` | Inscrição Rápida em Vaga de Emprego | Botão "Candidatar-se" no portal de vagas | Botão "Enviar Candidatura" | Grava dados e enfileira notificação de RH |
| `UI-MDL-048` | `FullscreenPrompt` | Prompt de Instalação PWA / Tela Cheia | Ativado em dispositivos móveis | Botão dispensar ou "Entrar em Tela Cheia" | Otimiza experiência imersiva no celular |

---

## 8. DISTRIBUIÇÃO DAS 294 TABELAS POR DOMÍNIO DE NEGÓCIO

| Domínio | Nome do Domínio | Qtd Tabelas | Faixa de Identificadores |
|---|---|---|---|
| **Domínio 1** | Autenticação, Sessões & Governança de Segurança | 55 | `DB-TBL-001` a `DB-TBL-055` |
| **Domínio 2** | CRM & Clientes (Identidade, VIP, Indicações, Bloqueios) | 9 | `DB-TBL-056` a `DB-TBL-064` |
| **Domínio 3** | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) | 17 | `DB-TBL-065` a `DB-TBL-081` |
| **Domínio 4** | Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos) | 31 | `DB-TBL-082` a `DB-TBL-112` |
| **Domínio 5** | Programa de Parceiros & Resgates de Benefícios | 7 | `DB-TBL-113` a `DB-TBL-119` |
| **Domínio 6** | Programa de Afiliados (Links, Conversões, Comissões, Saques) | 10 | `DB-TBL-120` a `DB-TBL-129` |
| **Domínio 7** | Prestadores de Serviços & Workstation (Demandas, OS, Repasses) | 20 | `DB-TBL-130` a `DB-TBL-149` |
| **Domínio 8** | Fornecedores & Procurement (Cotações, Pedidos de Compra) | 8 | `DB-TBL-150` a `DB-TBL-157` |
| **Domínio 9** | Colaboradores & Perfis Administrativos (RBAC) | 4 | `DB-TBL-158` a `DB-TBL-161` |
| **Domínio 10** | GSA Viagens (Pacotes, Reservas, Propostas, Bilhetes) | 13 | `DB-TBL-162` a `DB-TBL-174` |
| **Domínio 11** | GSA Saúde (Planos, Cotações, Propostas, Vidas) | 16 | `DB-TBL-175` a `DB-TBL-190` |
| **Domínio 12** | GSA Seguros (Apólices, Sinistros, Cotações, Ramos) | 18 | `DB-TBL-191` a `DB-TBL-208` |
| **Domínio 13** | Hub Classificados (Anúncios, Propostas, Moderação) | 11 | `DB-TBL-209` a `DB-TBL-219` |
| **Domínio 14** | Plataforma de Publicidade & Ads (Campanhas, Criativos) | 16 | `DB-TBL-220` a `DB-TBL-235` |
| **Domínio 15** | GSA TV & Streaming (Grade, Acervo, Mídias, IA Editorial) | 45 | `DB-TBL-236` a `DB-TBL-280` |
| **Domínio 16** | Marketing, Campanhas & Vaquinhas Coletivas | 2 | `DB-TBL-281` a `DB-TBL-282` |
| **Domínio 17** | Comunicação, Suporte & RH (Tickets, WhatsApp Outbox, Carreiras) | 12 | `DB-TBL-283` a `DB-TBL-294` |
| **TOTAL** | **17 Domínios Integrados** | **294 Tabelas** | **`DB-TBL-001` a `DB-TBL-294`** |

---

## 9. CATÁLOGO COMPLETO DE TABELAS DO BANCO DE DADOS (`DB-TBL-*` — 294 TABELAS)

| ID da Tabela | Nome da Tabela | Qtd Colunas | Chave Primária | Domínio de Aplicação |
|---|---|---|---|---|
| `DB-TBL-001` | `assinaturas` | 9 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-002` | `contas_pagar` | 18 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-003` | `empresa` | 9 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-004` | `gsa_access_tokens` | 7 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-005` | `gsa_admin_audit_events` | 9 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-006` | `gsa_admin_mutation_requests` | 8 | `request_id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-007` | `gsa_admin_notification_state` | 9 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-008` | `gsa_admin_operation_requests` | 13 | `request_id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-009` | `gsa_admin_permissions` | 5 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-010` | `gsa_advertisers` | 17 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-011` | `gsa_afiliados` | 14 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-012` | `gsa_audit_trail` | 9 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-013` | `gsa_auth_attempts` | 5 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-014` | `gsa_auth_attempts` | 6 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-015` | `gsa_auth_identities` | 7 | `ator_tipo, ator_id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-016` | `gsa_auth_rate_limits` | 6 | `bucket_key` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-017` | `gsa_auth_rate_limits` | 5 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-018` | `gsa_calculator_pro_events` | 9 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-019` | `gsa_calculator_pro_grants` | 15 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-020` | `gsa_calculator_pro_payments` | 20 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-021` | `gsa_calculator_pro_products` | 10 | `tool_id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-022` | `gsa_calculator_pro_runtime_config` | 5 | `config_key` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-023` | `gsa_calculator_pro_sessions` | 10 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-024` | `gsa_calculator_pro_vouchers` | 12 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-025` | `gsa_catalogo_legado_arquivo` | 7 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-026` | `gsa_client_operation_requests` | 7 | `request_id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-027` | `gsa_client_recovery_challenges` | 7 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-028` | `gsa_device_fingerprints` | 6 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-029` | `gsa_ip_allowlist` | 4 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-030` | `gsa_ip_blocklist` | 5 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-031` | `gsa_login_challenges` | 7 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-032` | `gsa_password_history` | 4 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-033` | `gsa_provider_audit_events` | 7 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-034` | `gsa_provider_registration_challenges` | 11 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-035` | `gsa_public_budget_rate_limits` | 5 | `fingerprint` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-036` | `gsa_public_rate_limits` | 4 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-037` | `gsa_refresh_tokens` | 6 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-038` | `gsa_role_assignments` | 5 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-039` | `gsa_security_logs` | 8 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-040` | `gsa_service_package_items` | 5 | `pacote_id, servico_id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-041` | `gsa_service_packages` | 12 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-042` | `gsa_session_events` | 7 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-043` | `gsa_session_revocations` | 5 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-044` | `gsa_site_campaign_events` | 12 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-045` | `gsa_site_campaign_history` | 9 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-046` | `gsa_site_campaign_permissions` | 7 | `collaborator_id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-047` | `gsa_site_campaigns` | 44 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-048` | `gsa_travel_operation_requests` | 8 | `request_id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-049` | `gsa_two_factor_tokens` | 6 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-050` | `gsa_user_sessions` | 6 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-051` | `gsa_voucher_resgates` | 5 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-052` | `gsa_whatsapp_ramais` | 9 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-053` | `payment_webhook_events` | 8 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-054` | `pedido_compra_fornecedor_itens` | 12 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-055` | `system_settings` | 7 | `id` | Autenticação, Sessões & Governança de Segurança |
| `DB-TBL-056` | `client_levels` | 8 | `id` | CRM & Clientes |
| `DB-TBL-057` | `cliente_notas_admin` | 6 | `id` | CRM & Clientes |
| `DB-TBL-058` | `cliente_premios` | 9 | `id` | CRM & Clientes |
| `DB-TBL-059` | `cliente_promocoes` | 13 | `id` | CRM & Clientes |
| `DB-TBL-060` | `clientes` | 41 | `id` | CRM & Clientes |
| `DB-TBL-061` | `clientes_identidades_historicas` | 10 | `id` | CRM & Clientes |
| `DB-TBL-062` | `indicacoes` | 14 | `id` | CRM & Clientes |
| `DB-TBL-063` | `level_history` | 6 | `id` | CRM & Clientes |
| `DB-TBL-064` | `vouchers` | 19 | `id` | CRM & Clientes |
| `DB-TBL-065` | `carteira_estornos` | 6 | `id` | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) |
| `DB-TBL-066` | `carteira_lancamentos` | 7 | `id` | Financeiro & Fintech |
| `DB-TBL-067` | `carteira_lancamentos_bloqueados` | 7 | `id` | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) |
| `DB-TBL-068` | `contratos` | 19 | `id` | Financeiro & Fintech |
| `DB-TBL-069` | `extrato_financeiro` | 8 | `id` | Financeiro & Fintech |
| `DB-TBL-070` | `faturas` | 26 | `id` | Financeiro & Fintech |
| `DB-TBL-071` | `faturas_juros_multas` | 6 | `id` | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) |
| `DB-TBL-072` | `faturas_parcelas` | 8 | `id` | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) |
| `DB-TBL-073` | `fintech_payout_batches` | 6 | `id` | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) |
| `DB-TBL-074` | `fintech_reconciliation_logs` | 8 | `id` | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) |
| `DB-TBL-075` | `formas_pagamento` | 6 | `id` | Financeiro & Fintech |
| `DB-TBL-076` | `pagamentos` | 7 | `id` | Financeiro & Fintech |
| `DB-TBL-077` | `points_transactions` | 7 | `id` | Financeiro & Fintech |
| `DB-TBL-078` | `pontos_movimentacoes` | 10 | `id` | Financeiro & Fintech |
| `DB-TBL-079` | `saques` | 14 | `id` | Financeiro & Fintech |
| `DB-TBL-080` | `transacoes_pix_split` | 7 | `id` | Financeiro & Fintech (Faturas, Carteira, Saques, Empréstimos) |
| `DB-TBL-081` | `transferencias` | 13 | `id` | Financeiro & Fintech |
| `DB-TBL-082` | `loja_avaliacoes` | 17 | `id` | Marketplace & E-commerce |
| `DB-TBL-083` | `loja_carrinho_cupons` | 5 | `id` | Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos) |
| `DB-TBL-084` | `loja_comprovantes_devolucao` | 6 | `id` | Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos) |
| `DB-TBL-085` | `loja_credito_cancelamentos_limite` | 16 | `id` | Marketplace & E-commerce |
| `DB-TBL-086` | `loja_credito_contestacao_eventos` | 10 | `id` | Marketplace & E-commerce |
| `DB-TBL-087` | `loja_credito_contestacoes` | 26 | `id` | Marketplace & E-commerce |
| `DB-TBL-088` | `loja_credito_saque_eventos` | 10 | `id` | Marketplace & E-commerce |
| `DB-TBL-089` | `loja_credito_saques` | 32 | `id` | Marketplace & E-commerce |
| `DB-TBL-090` | `loja_favoritos` | 5 | `id` | Marketplace & E-commerce |
| `DB-TBL-091` | `loja_pedido_itens` | 23 | `id` | Marketplace & E-commerce |
| `DB-TBL-092` | `loja_pedidos_historico_status` | 6 | `id` | Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos) |
| `DB-TBL-093` | `loja_promocoes_regras` | 6 | `id` | Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos) |
| `DB-TBL-094` | `loja_vaquinha_contribuicoes` | 13 | `id` | Marketplace & E-commerce |
| `DB-TBL-095` | `loja_vaquinhas` | 19 | `id` | Marketplace & E-commerce |
| `DB-TBL-096` | `produto_desconto_cota_movimentos` | 11 | `id` | Marketplace & E-commerce |
| `DB-TBL-097` | `produto_fornecedor_config` | 17 | `produto_id` | Marketplace & E-commerce |
| `DB-TBL-098` | `produto_importacao_origem` | 10 | `id` | Marketplace & E-commerce |
| `DB-TBL-099` | `produto_variacao_grupos` | 10 | `id` | Marketplace & E-commerce |
| `DB-TBL-100` | `produto_variacao_opcoes` | 12 | `id` | Marketplace & E-commerce |
| `DB-TBL-101` | `produto_variante_opcoes` | 5 | `variante_id, grupo_id` | Marketplace & E-commerce |
| `DB-TBL-102` | `produto_variantes` | 18 | `id` | Marketplace & E-commerce |
| `DB-TBL-103` | `produtos` | 17 | `id` | Marketplace & E-commerce |
| `DB-TBL-104` | `produtos_variantes_estoque` | 7 | `id` | Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos) |
| `DB-TBL-105` | `promocoes` | 11 | `id` | Marketplace & E-commerce |
| `DB-TBL-106` | `promocoes_quantidade` | 24 | `id` | Marketplace & E-commerce |
| `DB-TBL-107` | `promocoes_quantidade_ativadas` | 4 | `id` | Marketplace & E-commerce |
| `DB-TBL-108` | `promocoes_quantidade_uso` | 9 | `id` | Marketplace & E-commerce |
| `DB-TBL-109` | `shopee_automation_workers` | 11 | `id` | Marketplace & E-commerce |
| `DB-TBL-110` | `shopee_fulfillment_events` | 10 | `id` | Marketplace & E-commerce |
| `DB-TBL-111` | `shopee_fulfillment_job_items` | 19 | `id` | Marketplace & E-commerce |
| `DB-TBL-112` | `shopee_fulfillment_jobs` | 25 | `id` | Marketplace & E-commerce |
| `DB-TBL-113` | `parceiros` | 41 | `id` | Programa de Parceiros & Resgates |
| `DB-TBL-114` | `parceiros_resgates` | 14 | `id` | Programa de Parceiros & Resgates |
| `DB-TBL-115` | `parceiros_resgates_eventos` | 12 | `id` | Programa de Parceiros & Resgates |
| `DB-TBL-116` | `parceiros_resgates_notificacoes` | 16 | `id` | Programa de Parceiros & Resgates |
| `DB-TBL-117` | `parceiros_resgates_public_status` | 4 | `resgate_id` | Programa de Parceiros & Resgates |
| `DB-TBL-118` | `parceiros_resgates_recurso_desafios` | 7 | `id` | Programa de Parceiros & Resgates |
| `DB-TBL-119` | `parceiros_resgates_recursos` | 14 | `id` | Programa de Parceiros & Resgates |
| `DB-TBL-120` | `gsa_afiliado_atribuicoes` | 12 | `id` | Programa de Afiliados |
| `DB-TBL-121` | `gsa_afiliado_cliques` | 11 | `id` | Programa de Afiliados |
| `DB-TBL-122` | `gsa_afiliado_comissao_eventos` | 10 | `id` | Programa de Afiliados |
| `DB-TBL-123` | `gsa_afiliado_comissoes` | 15 | `id` | Programa de Afiliados |
| `DB-TBL-124` | `gsa_afiliado_conversoes` | 18 | `id` | Programa de Afiliados |
| `DB-TBL-125` | `gsa_afiliado_links` | 10 | `id` | Programa de Afiliados |
| `DB-TBL-126` | `gsa_afiliado_pontos_eventos` | 11 | `id` | Programa de Afiliados |
| `DB-TBL-127` | `gsa_afiliado_programas` | 16 | `id` | Programa de Afiliados |
| `DB-TBL-128` | `gsa_afiliado_saques` | 17 | `id` | Programa de Afiliados |
| `DB-TBL-129` | `gsa_afiliado_transferencias` | 17 | `id` | Programa de Afiliados |
| `DB-TBL-130` | `demandas_historico_interacoes` | 6 | `id` | Prestadores de Serviços & Workstation (Demandas, OS, Repasses) |
| `DB-TBL-131` | `orcamento_timeline` | 14 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-132` | `orcamentos` | 35 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-133` | `ordens_assinatura` | 14 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-134` | `ordens_compra` | 10 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-135` | `ordens_servico` | 13 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-136` | `prestador_agendamentos` | 9 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-137` | `prestador_demandas` | 24 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-138` | `prestador_documentos` | 9 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-139` | `prestador_faturas` | 10 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-140` | `prestador_historico` | 6 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-141` | `prestador_saques` | 8 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-142` | `prestador_suporte_demandas` | 9 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-143` | `prestador_transacoes` | 9 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-144` | `prestadores` | 17 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-145` | `prestadores_disponibilidade_slots` | 6 | `id` | Prestadores de Serviços & Workstation (Demandas, OS, Repasses) |
| `DB-TBL-146` | `prestadores_especialidades` | 5 | `id` | Prestadores de Serviços & Workstation (Demandas, OS, Repasses) |
| `DB-TBL-147` | `prestadores_repasses_historico` | 7 | `id` | Prestadores de Serviços & Workstation (Demandas, OS, Repasses) |
| `DB-TBL-148` | `servicos` | 9 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-149` | `servicos_pacotes` | 13 | `id` | Prestadores de Serviços & Workstation |
| `DB-TBL-150` | `fornecedor_auditoria` | 10 | `id` | Fornecedores & Procurement |
| `DB-TBL-151` | `fornecedor_entrega_itens` | 9 | `id` | Fornecedores & Procurement |
| `DB-TBL-152` | `fornecedor_entregas` | 23 | `id` | Fornecedores & Procurement |
| `DB-TBL-153` | `fornecedor_notificacoes` | 8 | `id` | Fornecedores & Procurement |
| `DB-TBL-154` | `fornecedor_produto_solicitacoes` | 21 | `id` | Fornecedores & Procurement |
| `DB-TBL-155` | `fornecedor_produtos` | 12 | `id` | Fornecedores & Procurement |
| `DB-TBL-156` | `fornecedores` | 30 | `id` | Fornecedores & Procurement |
| `DB-TBL-157` | `pedidos_compra_fornecedor` | 19 | `id` | Fornecedores & Procurement |
| `DB-TBL-158` | `colaborador_modulos` | 2 | `colaborador_id, modulo_id` | Colaboradores & RBAC |
| `DB-TBL-159` | `colaboradores` | 10 | `id` | Colaboradores & RBAC |
| `DB-TBL-160` | `funcoes` | 4 | `id` | Colaboradores & RBAC |
| `DB-TBL-161` | `solicitacoes_exclusao` | 8 | `id` | Colaboradores & RBAC |
| `DB-TBL-162` | `viagens_cancelamentos` | 12 | `id` | GSA Viagens |
| `DB-TBL-163` | `viagens_configuracoes` | 15 | `id` | GSA Viagens |
| `DB-TBL-164` | `viagens_fornecedores` | 13 | `id` | GSA Viagens |
| `DB-TBL-165` | `viagens_orcamentos` | 27 | `id` | GSA Viagens |
| `DB-TBL-166` | `viagens_pacote_imagens` | 6 | `id` | GSA Viagens |
| `DB-TBL-167` | `viagens_pacotes` | 41 | `id` | GSA Viagens |
| `DB-TBL-168` | `viagens_passageiro_documentos` | 9 | `id` | GSA Viagens |
| `DB-TBL-169` | `viagens_passageiros` | 20 | `id` | GSA Viagens |
| `DB-TBL-170` | `viagens_propostas` | 20 | `id` | GSA Viagens |
| `DB-TBL-171` | `viagens_solicitacoes_reserva` | 14 | `id` | GSA Viagens |
| `DB-TBL-172` | `viagens_transacao_parcelas` | 10 | `id` | GSA Viagens |
| `DB-TBL-173` | `viagens_transacoes` | 16 | `id` | GSA Viagens |
| `DB-TBL-174` | `viagens_vouchers` | 6 | `id` | GSA Viagens |
| `DB-TBL-175` | `saude_aceites` | 3 | `id` | GSA Saúde |
| `DB-TBL-176` | `saude_assessorias` | 5 | `id` | GSA Saúde |
| `DB-TBL-177` | `saude_atendimento_mensagens` | 2 | `id` | GSA Saúde |
| `DB-TBL-178` | `saude_atendimentos` | 4 | `id` | GSA Saúde |
| `DB-TBL-179` | `saude_auditoria` | 2 | `id` | GSA Saúde |
| `DB-TBL-180` | `saude_comissoes` | 5 | `id` | GSA Saúde |
| `DB-TBL-181` | `saude_configuracoes` | 4 | `id` | GSA Saúde |
| `DB-TBL-182` | `saude_contratos` | 6 | `id` | GSA Saúde |
| `DB-TBL-183` | `saude_cotacao_beneficiarios` | 3 | `id` | GSA Saúde |
| `DB-TBL-184` | `saude_cotacoes` | 11 | `id` | GSA Saúde |
| `DB-TBL-185` | `saude_dependentes` | 4 | `id` | GSA Saúde |
| `DB-TBL-186` | `saude_documentos` | 4 | `id` | GSA Saúde |
| `DB-TBL-187` | `saude_parceiros` | 4 | `id` | GSA Saúde |
| `DB-TBL-188` | `saude_produto_redes` | 2 | `id` | GSA Saúde |
| `DB-TBL-189` | `saude_produtos` | 7 | `id` | GSA Saúde |
| `DB-TBL-190` | `saude_propostas` | 14 | `id` | GSA Saúde |
| `DB-TBL-191` | `seguros_aceites` | 3 | `id` | GSA Seguros |
| `DB-TBL-192` | `seguros_apolices` | 6 | `id` | GSA Seguros |
| `DB-TBL-193` | `seguros_assessorias` | 5 | `id` | GSA Seguros |
| `DB-TBL-194` | `seguros_assistencias` | 4 | `id` | GSA Seguros |
| `DB-TBL-195` | `seguros_atendimento_mensagens` | 2 | `id` | GSA Seguros |
| `DB-TBL-196` | `seguros_atendimentos` | 4 | `id` | GSA Seguros |
| `DB-TBL-197` | `seguros_auditoria` | 2 | `id` | GSA Seguros |
| `DB-TBL-198` | `seguros_comissoes` | 5 | `id` | GSA Seguros |
| `DB-TBL-199` | `seguros_configuracoes` | 3 | `id` | GSA Seguros |
| `DB-TBL-200` | `seguros_cotacao_dados` | 2 | `id` | GSA Seguros |
| `DB-TBL-201` | `seguros_cotacoes` | 11 | `id` | GSA Seguros |
| `DB-TBL-202` | `seguros_documentos` | 4 | `id` | GSA Seguros |
| `DB-TBL-203` | `seguros_ofertas` | 4 | `id` | GSA Seguros |
| `DB-TBL-204` | `seguros_parceiros` | 12 | `id` | GSA Seguros |
| `DB-TBL-205` | `seguros_produtos` | 16 | `id` | GSA Seguros |
| `DB-TBL-206` | `seguros_propostas` | 16 | `id` | GSA Seguros |
| `DB-TBL-207` | `seguros_sinistro_mensagens` | 2 | `id` | GSA Seguros |
| `DB-TBL-208` | `seguros_sinistros` | 5 | `id` | GSA Seguros |
| `DB-TBL-209` | `classificados_ajustes` | 9 | `id` | Hub Classificados |
| `DB-TBL-210` | `classificados_anuncio_midias` | 6 | `id` | Hub Classificados |
| `DB-TBL-211` | `classificados_anuncios` | 17 | `id` | Hub Classificados |
| `DB-TBL-212` | `classificados_comissoes` | 12 | `id` | Hub Classificados |
| `DB-TBL-213` | `classificados_comissoes_config` | 6 | `categoria` | Hub Classificados |
| `DB-TBL-214` | `classificados_comprovantes` | 6 | `id` | Hub Classificados |
| `DB-TBL-215` | `classificados_configuracoes` | 8 | `id` | Hub Classificados |
| `DB-TBL-216` | `classificados_mensagens` | 14 | `id` | Hub Classificados |
| `DB-TBL-217` | `classificados_midias` | 6 | `id` | Hub Classificados |
| `DB-TBL-218` | `classificados_propostas` | 16 | `id` | Hub Classificados |
| `DB-TBL-219` | `classificados_transacoes` | 20 | `id` | Hub Classificados |
| `DB-TBL-220` | `gsa_ad_audit_logs` | 8 | `id` | Publicidade & Ads |
| `DB-TBL-221` | `gsa_ad_campaign_placements` | 4 | `campaign_id, placement_id` | Publicidade & Ads |
| `DB-TBL-222` | `gsa_ad_campaigns` | 18 | `id` | Publicidade & Ads |
| `DB-TBL-223` | `gsa_ad_creatives` | 17 | `id` | Publicidade & Ads |
| `DB-TBL-224` | `gsa_ad_daily_metrics` | 9 | `campaign_id, placement_id, metric_date` | Publicidade & Ads |
| `DB-TBL-225` | `gsa_ad_delivery_events` | 16 | `id` | Publicidade & Ads |
| `DB-TBL-226` | `gsa_ad_maintenance_state` | 3 | `task_name` | Publicidade & Ads |
| `DB-TBL-227` | `gsa_ad_negotiations` | 7 | `id` | Publicidade & Ads |
| `DB-TBL-228` | `gsa_ad_payment_events` | 7 | `id` | Publicidade & Ads |
| `DB-TBL-229` | `gsa_ad_payments` | 18 | `id` | Publicidade & Ads |
| `DB-TBL-230` | `gsa_ad_placements` | 16 | `id` | Publicidade & Ads |
| `DB-TBL-231` | `gsa_ad_proposal_versions` | 18 | `id` | Publicidade & Ads |
| `DB-TBL-232` | `gsa_ad_proposals` | 12 | `id` | Publicidade & Ads |
| `DB-TBL-233` | `gsa_ad_rate_limit_buckets` | 5 | `scope_hash, action, bucket_start` | Publicidade & Ads |
| `DB-TBL-234` | `gsa_ad_request_placements` | 2 | `request_id, placement_id` | Publicidade & Ads |
| `DB-TBL-235` | `gsa_ad_requests` | 24 | `id` | Publicidade & Ads |
| `DB-TBL-236` | `gsa_tv_ad_assets` | 2 | `campaign_id, media_item_id` | GSA TV & Streaming |
| `DB-TBL-237` | `gsa_tv_ad_campaigns` | 6 | `id` | GSA TV & Streaming |
| `DB-TBL-238` | `gsa_tv_ai_assets` | 5 | `id` | GSA TV & Streaming |
| `DB-TBL-239` | `gsa_tv_ai_jobs` | 16 | `id` | GSA TV & Streaming |
| `DB-TBL-240` | `gsa_tv_ai_memory` | 10 | `id` | GSA TV & Streaming |
| `DB-TBL-241` | `gsa_tv_ai_presenters` | 6 | `id` | GSA TV & Streaming |
| `DB-TBL-242` | `gsa_tv_ai_projects` | 16 | `id` | GSA TV & Streaming |
| `DB-TBL-243` | `gsa_tv_ai_provider_secrets` | 8 | `channel_id, provider` | GSA TV & Streaming |
| `DB-TBL-244` | `gsa_tv_ai_usage` | 13 | `id` | GSA TV & Streaming |
| `DB-TBL-245` | `gsa_tv_alert_deliveries` | 11 | `id` | GSA TV & Streaming |
| `DB-TBL-246` | `gsa_tv_alert_settings` | 7 | `channel_id` | GSA TV & Streaming |
| `DB-TBL-247` | `gsa_tv_as_run` | 5 | `id` | GSA TV & Streaming |
| `DB-TBL-248` | `gsa_tv_audit_log` | 9 | `id` | GSA TV & Streaming |
| `DB-TBL-249` | `gsa_tv_backup_runs` | 10 | `id` | GSA TV & Streaming |
| `DB-TBL-250` | `gsa_tv_campaigns` | 13 | `id` | GSA TV & Streaming |
| `DB-TBL-251` | `gsa_tv_channel_secrets` | 7 | `channel_id` | GSA TV & Streaming |
| `DB-TBL-252` | `gsa_tv_channels` | 12 | `id` | GSA TV & Streaming |
| `DB-TBL-253` | `gsa_tv_comments` | 6 | `id` | GSA TV & Streaming |
| `DB-TBL-254` | `gsa_tv_editorial_items` | 14 | `id` | GSA TV & Streaming |
| `DB-TBL-255` | `gsa_tv_editorial_policies` | 7 | `id` | GSA TV & Streaming |
| `DB-TBL-256` | `gsa_tv_editorial_sources` | 19 | `id` | GSA TV & Streaming |
| `DB-TBL-257` | `gsa_tv_episodes` | 4 | `id` | GSA TV & Streaming |
| `DB-TBL-258` | `gsa_tv_execution_log` | 13 | `id` | GSA TV & Streaming |
| `DB-TBL-259` | `gsa_tv_graphic_templates` | 3 | `id` | GSA TV & Streaming |
| `DB-TBL-260` | `gsa_tv_graphics` | 10 | `id` | GSA TV & Streaming |
| `DB-TBL-261` | `gsa_tv_identity_assets` | 4 | `id` | GSA TV & Streaming |
| `DB-TBL-262` | `gsa_tv_incidents` | 8 | `id` | GSA TV & Streaming |
| `DB-TBL-263` | `gsa_tv_jobs` | 9 | `id` | GSA TV & Streaming |
| `DB-TBL-264` | `gsa_tv_live_recordings` | 11 | `id` | GSA TV & Streaming |
| `DB-TBL-265` | `gsa_tv_live_source_secrets` | 4 | `source_id` | GSA TV & Streaming |
| `DB-TBL-266` | `gsa_tv_live_sources` | 15 | `id` | GSA TV & Streaming |
| `DB-TBL-267` | `gsa_tv_media_items` | 22 | `id` | GSA TV & Streaming |
| `DB-TBL-268` | `gsa_tv_on_air_graphics` | 4 | `id` | GSA TV & Streaming |
| `DB-TBL-269` | `gsa_tv_playlists` | 7 | `id` | GSA TV & Streaming |
| `DB-TBL-270` | `gsa_tv_program_blocks` | 7 | `id` | GSA TV & Streaming |
| `DB-TBL-271` | `gsa_tv_program_source_links` | 7 | `program_id, source_id` | GSA TV & Streaming |
| `DB-TBL-272` | `gsa_tv_programs` | 4 | `id` | GSA TV & Streaming |
| `DB-TBL-273` | `gsa_tv_rights_documents` | 12 | `id` | GSA TV & Streaming |
| `DB-TBL-274` | `gsa_tv_rights_records` | 5 | `id` | GSA TV & Streaming |
| `DB-TBL-275` | `gsa_tv_schedule_slots` | 11 | `id` | GSA TV & Streaming |
| `DB-TBL-276` | `gsa_tv_schedule_versions` | 5 | `id` | GSA TV & Streaming |
| `DB-TBL-277` | `gsa_tv_series` | 3 | `id` | GSA TV & Streaming |
| `DB-TBL-278` | `gsa_tv_virtual_presenters` | 12 | `id` | GSA TV & Streaming |
| `DB-TBL-279` | `gsa_tv_watchdog_samples` | 14 | `id` | GSA TV & Streaming |
| `DB-TBL-280` | `gsa_tv_weekly_grid_slots` | 12 | `id` | GSA TV & Streaming |
| `DB-TBL-281` | `blog_posts` | 9 | `id` | Marketing & Campanhas |
| `DB-TBL-282` | `gsa_hero_banners` | 15 | `id` | Marketing & Campanhas |
| `DB-TBL-283` | `gsa_careers_application_history` | 11 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-284` | `gsa_careers_applications` | 19 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-285` | `gsa_careers_notification_outbox` | 14 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-286` | `gsa_careers_vacancies` | 19 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-287` | `notificacao_leituras` | 4 | `notificacao_id, ator_tipo, ator_id` | Comunicação, Suporte & RH |
| `DB-TBL-288` | `notificacoes` | 13 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-289` | `os_notas` | 4 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-290` | `os_suporte_mensagens` | 8 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-291` | `suporte_mensagens` | 6 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-292` | `ticket_mensagens` | 9 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-293` | `tickets` | 11 | `id` | Comunicação, Suporte & RH |
| `DB-TBL-294` | `whatsapp_pendencias_ativas` | 11 | `id` | Comunicação, Suporte & RH |

---

## 10. CATÁLOGO COMPLETO DE STORED PROCEDURES / RPCS (`DB-RPC-*` — 692 FUNÇÕES)

| ID da RPC | Nome da Função PostgreSQL | Argumentos | Retorno | Security Definer |
|---|---|---|---|---|
| `DB-RPC-001` | `aceitar_quitacao_credito_loja` | `p_orcamento_id uuid, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-002` | `aceitar_quitacao_emprestimo` | `p_emprestimo_id uuid, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-003` | `aprovar_orcamento_cliente` | `p_orcamento_id uuid, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-004` | `assinar_area_vip_cliente` | `payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-005` | `cancelar_saque_cliente` | `p_saque_id uuid, p_cliente_id uuid, p_motivo text DEFAULT 'Cancelado pelo cliente'` | `jsonb` | **SIM** |
| `DB-RPC-006` | `cancelar_transferencia_cliente` | `p_transferencia_id uuid, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-007` | `checkout_pedido` | `payload json` | `json` | NÃO |
| `DB-RPC-008` | `cliente_operational_write` | `p_cliente_id uuid, p_table text, p_action text, p_data jsonb DEFAULT '{}'::jsonb, p_filter jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-009` | `converter_pontos_cliente` | `payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-010` | `delete_client_cascade` | `p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-011` | `estornar_transferencia_cliente` | `p_transferencia_id uuid, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-012` | `fn_criar_notificacao_automatica` | `` | `TRIGGER` | NÃO |
| `DB-RPC-013` | `fn_faturas_sync_valor_final_pendente` | `` | `TRIGGER` | NÃO |
| `DB-RPC-014` | `fn_gsa_auto_check_vip_level` | `` | `TRIGGER` | NÃO |
| `DB-RPC-015` | `fn_processar_pagamento_quitacao_emprestimo` | `` | `TRIGGER` | NÃO |
| `DB-RPC-016` | `fn_processar_upgrade_nivel_automatico` | `` | `TRIGGER` | NÃO |
| `DB-RPC-017` | `generate_promo_code` | `` | `TRIGGER` | NÃO |
| `DB-RPC-018` | `generate_system_code` | `` | `TRIGGER` | NÃO |
| `DB-RPC-019` | `gerar_fatura_parcela_emprestimo` | `p_parcela_id uuid, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-020` | `gerar_fatura_pedido_store` | `p_orcamento_id uuid, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-021` | `gerar_faturas_assinaturas_diario` | `` | `void` | NÃO |
| `DB-RPC-022` | `get_system_metrics` | `` | `TABLE` | **SIM** |
| `DB-RPC-023` | `gsa_accept_travel_proposal` | `p_sessao_id UUID, p_session_token TEXT, p_proposta_id UUID` | `JSONB` | **SIM** |
| `DB-RPC-024` | `gsa_admin_access_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_limit integer DEFAULT 500` | `jsonb` | **SIM** |
| `DB-RPC-025` | `gsa_admin_activate_subscription` | `p_sessao_id UUID, p_session_token TEXT, p_request_id UUID, p_ordem_assinatura_id UUID` | `JSONB` | **SIM** |
| `DB-RPC-026` | `gsa_admin_add_demand_comment` | `p_sessao_id uuid,p_session_token text,p_demanda_id uuid,p_mensagem text, p_arquivos_urls jsonb,p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-027` | `gsa_admin_add_demand_history` | `p_sessao_id uuid, p_session_token text, p_demanda_id uuid, p_tipo_evento text, p_motivo text, p_colaborador_destino_id uuid, p_prestador_origem_id uuid, p_prestador_destino_id uuid, p_valor_proposto numeric, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-028` | `gsa_admin_add_os_note` | `p_sessao_id uuid, p_session_token text, p_os_id uuid, p_nota text, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-029` | `gsa_admin_adjust_affiliate_balance` | `p_sessao_id uuid, p_session_token text, p_afiliado_id uuid, p_tipo text, p_valor numeric, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-030` | `gsa_admin_adjust_points` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_pontos integer, p_descricao text` | `jsonb` | **SIM** |
| `DB-RPC-031` | `gsa_admin_adjust_product_stock` | `p_sessao_id UUID, p_session_token TEXT, p_request_id UUID, p_produto_id UUID, p_tipo TEXT, p_quantidade INTEGER, p_motivo TEXT` | `JSONB` | **SIM** |
| `DB-RPC-032` | `gsa_admin_advertising_overview` | `` | `jsonb` | **SIM** |
| `DB-RPC-033` | `gsa_admin_affiliate_snapshot` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-034` | `gsa_admin_ajustar_limite_credito_cliente` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_novo_limite_total numeric, p_descricao text` | `jsonb` | **SIM** |
| `DB-RPC-035` | `gsa_admin_ajustar_limite_manual` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_novo_total numeric, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-036` | `gsa_admin_ajustar_saldo_cliente` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_tipo text, p_valor numeric, p_descricao text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-037` | `gsa_admin_allowed_setting_keys` | `` | `text[]` | NÃO |
| `DB-RPC-038` | `gsa_admin_alterar_status_cliente` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_status text` | `jsonb` | **SIM** |
| `DB-RPC-039` | `gsa_admin_aplicar_ajuste_fatura` | `p_sessao_id uuid, p_session_token text, p_fatura_id uuid, p_desconto numeric, p_acrescimo numeric, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-040` | `gsa_admin_approve_budget` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_request_id uuid DEFAULT NULL, p_orcamento_id uuid DEFAULT NULL, p_approval_kind text DEFAULT 'standard'` | `jsonb` | **SIM** |
| `DB-RPC-041` | `gsa_admin_approve_preapproved_credit_100` | `p_sessao_id uuid,p_session_token text,p_solicitacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-042` | `gsa_admin_aprovar_aumento_credito` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid, p_limite_aprovado numeric` | `jsonb` | **SIM** |
| `DB-RPC-043` | `gsa_admin_aprovar_solicitacao_limite` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid, p_novo_limite numeric DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-044` | `gsa_admin_archive_catalog_items` | `p_sessao_id UUID, p_session_token TEXT, p_tipo TEXT, p_ids UUID[]` | `JSONB` | **SIM** |
| `DB-RPC-045` | `gsa_admin_assert_module` | `p_module text` | `void` | **SIM** |
| `DB-RPC-046` | `gsa_admin_atualizar_dados_cliente` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_patch jsonb` | `jsonb` | **SIM** |
| `DB-RPC-047` | `gsa_admin_atualizar_documento_credito` | `p_sessao_id uuid, p_session_token text, p_documento_id uuid, p_status text, p_observacao text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-048` | `gsa_admin_atualizar_solicitacao_loja` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid, p_novo_status text, p_resposta_admin text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-049` | `gsa_admin_atualizar_status_cliente` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_acao text, p_motivo text DEFAULT NULL, p_valor boolean DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-050` | `gsa_admin_authorize_product_url_import` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-051` | `gsa_admin_baixar_cobranca_manual` | `p_sessao_id uuid, p_session_token text, p_cobranca_id uuid, p_valor_pago numeric, p_data_pagamento date DEFAULT current_date, p_forma_pagamento text DEFAULT 'pix'` | `jsonb` | **SIM** |
| `DB-RPC-052` | `gsa_admin_baixar_fatura` | `p_sessao_id uuid, p_session_token text, p_fatura_id uuid, p_metodo text DEFAULT 'manual', p_data_pagamento timestamptz DEFAULT now(), p_observacoes text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-053` | `gsa_admin_baixar_parcela_cobranca` | `p_sessao_id uuid, p_session_token text, p_parcela_id uuid, p_data_pagamento date DEFAULT current_date, p_forma_pagamento text DEFAULT 'pix'` | `jsonb` | **SIM** |
| `DB-RPC-054` | `gsa_admin_calculator_pro_snapshot` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-055` | `gsa_admin_can_configure` | `p_sessao_id uuid, p_session_token text` | `TABLE` | **SIM** |
| `DB-RPC-056` | `gsa_admin_cancel_partner_redemption` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_resgate_id uuid DEFAULT NULL, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-057` | `gsa_admin_cancel_store_order` | `p_sessao_id UUID, p_session_token TEXT, p_request_id UUID, p_ordem_compra_id UUID, p_motivo TEXT` | `JSONB` | **SIM** |
| `DB-RPC-058` | `gsa_admin_cancel_subscription` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_ordem_assinatura_id uuid, p_data_cancelamento date, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-059` | `gsa_admin_cancel_subscription_order` | `p_sessao_id uuid, p_session_token text, p_request_id text, p_order_id uuid, p_data_cancelamento date, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-060` | `gsa_admin_cancelar_acordo_cobranca` | `p_sessao_id uuid, p_session_token text, p_cobranca_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-061` | `gsa_admin_cancelar_demanda` | `p_sessao_id uuid, p_session_token text, p_demanda_id uuid, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-062` | `gsa_admin_cancelar_fatura` | `p_sessao_id uuid, p_session_token text, p_fatura_id uuid, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-063` | `gsa_admin_cancelar_os` | `p_sessao_id uuid, p_session_token text, p_os_id uuid, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-064` | `gsa_admin_change_access_code` | `p_sessao_id uuid, p_session_token text, p_current_code text, p_new_code text` | `boolean` | **SIM** |
| `DB-RPC-065` | `gsa_admin_check_existing_supplier_products` | `p_sessao_id uuid, p_session_token text, p_urls text[]` | `TABLE` | NÃO |
| `DB-RPC-066` | `gsa_admin_check_product_barcode` | `p_sessao_id uuid, p_session_token text, p_codigo_barras text, p_produto_id uuid DEFAULT NULL` | `TABLE` | **SIM** |
| `DB-RPC-067` | `gsa_admin_claim_mutation` | `p_request_id uuid, p_actor_type text, p_actor_id uuid, p_operation text, p_resource text` | `jsonb` | **SIM** |
| `DB-RPC-068` | `gsa_admin_classified_action` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_entity text DEFAULT NULL, p_id uuid DEFAULT NULL, p_related_id uuid DEFAULT NULL, p_action text DEFAULT NULL, p_reason text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-069` | `gsa_admin_clear_access_history` | `p_sessao_id uuid, p_session_token text, p_period text DEFAULT 'hoje', p_start timestamptz DEFAULT NULL, p_end timestamptz DEFAULT NULL` | `TABLE` | **SIM** |
| `DB-RPC-070` | `gsa_admin_complete_mutation` | `p_request_id uuid, p_result jsonb` | `jsonb` | **SIM** |
| `DB-RPC-071` | `gsa_admin_complete_partner_redemption` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_resgate_id uuid DEFAULT NULL, p_link_ativacao text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-072` | `gsa_admin_concluir_os_e_faturar` | `p_sessao_id uuid, p_session_token text, p_os_id uuid, p_data_vencimento date DEFAULT (current_date + 5), p_observacao text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-073` | `gsa_admin_configure_ad_payment` | `p_payment_id uuid, p_provider text, p_provider_reference text, p_checkout_url text, p_pix_code text, p_due_at timestamptz` | `jsonb` | **SIM** |
| `DB-RPC-074` | `gsa_admin_confirm_career_notification` | `p_sessao_id uuid,p_session_token text,p_application_id uuid,p_status text, p_success boolean,p_error text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-075` | `gsa_admin_context` | `` | `jsonb` | **SIM** |
| `DB-RPC-076` | `gsa_admin_create_ad_proposal` | `p_request_id uuid, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-077` | `gsa_admin_create_calculator_pro_voucher` | `p_sessao_id uuid, p_session_token text, p_tool_id text, p_expires_at timestamptz DEFAULT NULL, p_observacoes text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-078` | `gsa_admin_create_crm_client` | `p_sessao_id uuid, p_session_token text, p_payload jsonb, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-079` | `gsa_admin_create_protection_proposal` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_domain text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-080` | `gsa_admin_create_provider` | `p_sessao_id uuid, p_session_token text, p_payload jsonb, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-081` | `gsa_admin_create_provider_demand` | `p_sessao_id uuid, p_session_token text, p_payload jsonb, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-082` | `gsa_admin_create_supplier_order` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_supplier_id uuid, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-083` | `gsa_admin_credit_dispute_details` | `p_sessao_id uuid, p_session_token text, p_contestacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-084` | `gsa_admin_credit_disputes` | `p_sessao_id uuid, p_session_token text, p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-085` | `gsa_admin_credit_limit_cancellations` | `p_sessao_id uuid, p_session_token text, p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-086` | `gsa_admin_credit_withdrawal_details` | `p_sessao_id uuid,p_session_token text,p_saque_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-087` | `gsa_admin_credit_withdrawals` | `p_sessao_id uuid,p_session_token text,p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-088` | `gsa_admin_criar_cliente` | `p_sessao_id uuid, p_session_token text, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-089` | `gsa_admin_criar_cobranca_fatura` | `p_sessao_id uuid, p_session_token text, p_fatura_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-090` | `gsa_admin_criar_fatura_manual` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_valor_total numeric, p_data_vencimento date, p_data_emissao date, p_descricao text, p_os_id uuid DEFAULT NULL, p_ordem_compra_id uuid DEFAULT NULL, p_ordem_assinatura_id uuid DEFAULT NULL, p_categoria text DEFAULT 'servico'` | `jsonb` | **SIM** |
| `DB-RPC-091` | `gsa_admin_dashboard_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-092` | `gsa_admin_dashboard_snapshot_pre_ticket_compat` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-093` | `gsa_admin_decide_affiliate_payout` | `p_sessao_id uuid, p_session_token text, p_payout_id uuid, p_action text, p_notes text DEFAULT NULL, p_paid_at timestamptz DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-094` | `gsa_admin_decide_credit_dispute` | `p_sessao_id uuid, p_session_token text, p_contestacao_id uuid, p_decisao text, p_valor_deferido numeric DEFAULT NULL, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-095` | `gsa_admin_decide_credit_limit_cancellation` | `p_sessao_id uuid, p_session_token text, p_cancelamento_id uuid, p_aprovar boolean, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-096` | `gsa_admin_decide_credit_withdrawal` | `p_sessao_id uuid,p_session_token text,p_saque_id uuid,p_aprovar boolean,p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-097` | `gsa_admin_decide_partner_appeal` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_recurso_id uuid DEFAULT NULL, p_decisao text DEFAULT NULL, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-098` | `gsa_admin_definir_parcelamento_credito` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_opcao_pagamento_parcelado boolean` | `jsonb` | **SIM** |
| `DB-RPC-099` | `gsa_admin_delete_batch` | `p_sessao_id uuid, p_session_token text, p_entity_type text, p_entity_ids uuid[], p_reason text DEFAULT 'Exclusão em lote administrativa'` | `jsonb` | **SIM** |
| `DB-RPC-100` | `gsa_admin_delete_entity_cascade` | `p_sessao_id uuid, p_session_token text, p_entity_type text, p_entity_id uuid, p_reason text DEFAULT 'Exclusão administrativa em cascata'` | `jsonb` | **SIM** |
| `DB-RPC-101` | `gsa_admin_delete_partner_redemption` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_resgate_id uuid DEFAULT NULL, p_confirmation text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-102` | `gsa_admin_delete_products_bulk` | `p_sessao_id UUID, p_session_token TEXT, p_ids UUID[]` | `JSONB` | **SIM** |
| `DB-RPC-103` | `gsa_admin_delete_record_secure` | `p_sessao_id uuid, p_session_token text, p_table text, p_id uuid` | `boolean` | **SIM** |
| `DB-RPC-104` | `gsa_admin_delete_service_package` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_package_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-105` | `gsa_admin_delete_site_campaign` | `p_campaign_id uuid, p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-106` | `gsa_admin_delete_store_coupon` | `p_sessao_id uuid, p_session_token text, p_cupom_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-107` | `gsa_admin_delete_travel_category` | `p_sessao_id uuid, p_session_token text, p_categoria_id uuid, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-108` | `gsa_admin_desbloquear_pin_cliente` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-109` | `gsa_admin_duplicate_site_campaign` | `p_campaign_id uuid, p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-110` | `gsa_admin_emprestimo_add_historico` | `p_emprestimo_id uuid, p_orcamento_id uuid, p_tipo_acao text, p_descricao text, p_usuario_tipo text DEFAULT 'admin', p_usuario_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT NULL` | `void` | **SIM** |
| `DB-RPC-111` | `gsa_admin_emprestimo_aprovar` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-112` | `gsa_admin_emprestimo_atualizar_documento` | `p_sessao_id uuid, p_session_token text, p_documento_id uuid, p_status text, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-113` | `gsa_admin_emprestimo_atualizar_status` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid, p_status text, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-114` | `gsa_admin_emprestimo_enviar_comentario` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid, p_autor_id uuid, p_mensagem text` | `jsonb` | **SIM** |
| `DB-RPC-115` | `gsa_admin_emprestimo_enviar_contrato` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid, p_contrato_url text` | `jsonb` | **SIM** |
| `DB-RPC-116` | `gsa_admin_emprestimo_enviar_oferta_quitacao` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid, p_valor_quitacao_acordo numeric` | `jsonb` | **SIM** |
| `DB-RPC-117` | `gsa_admin_emprestimo_enviar_proposta` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid, p_valor_aprovado numeric, p_juros_total_percentual numeric, p_max_parcelas_liberado integer, p_taxa_servico numeric, p_proposta_mensagem text, p_validade_dias integer` | `jsonb` | **SIM** |
| `DB-RPC-118` | `gsa_admin_emprestimo_salvar_observacao` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid, p_observacoes_admin text` | `jsonb` | **SIM** |
| `DB-RPC-119` | `gsa_admin_ensure_calculator_pro_products` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-120` | `gsa_admin_enviar_fatura_cobranca` | `p_sessao_id uuid, p_session_token text, p_fatura_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-121` | `gsa_admin_enviar_oferta_quitacao_credito` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid, p_valor_quitacao_acordo numeric` | `jsonb` | **SIM** |
| `DB-RPC-122` | `gsa_admin_excluir_cobranca` | `p_sessao_id uuid, p_session_token text, p_cobranca_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-123` | `gsa_admin_extend_subscription` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_ordem_assinatura_id uuid, p_meses integer` | `jsonb` | **SIM** |
| `DB-RPC-124` | `gsa_admin_fiscal_update` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_ordem_id uuid DEFAULT NULL, p_action text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-125` | `gsa_admin_gerar_acordo_cobranca` | `p_sessao_id uuid, p_session_token text, p_cobranca_id uuid, p_parcelas integer, p_dt_primeiro_venc date, p_desconto numeric DEFAULT 0, p_tipo_desconto text DEFAULT 'fixo', p_observacoes text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-126` | `gsa_admin_get_advertiser_invite_target` | `p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-127` | `gsa_admin_get_career_application` | `p_sessao_id uuid, p_session_token text, p_application_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-128` | `gsa_admin_get_career_resume_reference` | `p_sessao_id uuid, p_session_token text, p_application_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-129` | `gsa_admin_get_classified_detail` | `p_anuncio_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-130` | `gsa_admin_get_client_deletion_inventory` | `p_sessao_id uuid, p_session_token text, p_client_ids uuid[]` | `jsonb` | **SIM** |
| `DB-RPC-131` | `gsa_admin_get_context_secure` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-132` | `gsa_admin_get_pendency_counts_secure` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-133` | `gsa_admin_get_product_supplier_config` | `p_sessao_id uuid, p_session_token text, p_produto_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-134` | `gsa_admin_get_product_variations` | `p_sessao_id uuid, p_session_token text, p_produto_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-135` | `gsa_admin_grant_calculator_pro` | `p_sessao_id uuid, p_session_token text, p_cliente_id uuid, p_tool_id text, p_valid_until timestamptz, p_observacoes text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-136` | `gsa_admin_gsa_tv_advertising_mutate` | `p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,p_action text DEFAULT '',p_payload jsonb DEFAULT '{}'` | `jsonb` | **SIM** |
| `DB-RPC-137` | `gsa_admin_gsa_tv_advertising_snapshot` | `p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-138` | `gsa_admin_gsa_tv_domain_mutate` | `p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,p_action text DEFAULT '',p_payload jsonb DEFAULT '{}'` | `jsonb` | **SIM** |
| `DB-RPC-139` | `gsa_admin_gsa_tv_domain_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-140` | `gsa_admin_gsa_tv_extended` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-141` | `gsa_admin_gsa_tv_extended_mutate` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_action text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-142` | `gsa_admin_gsa_tv_live_command` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_command text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-143` | `gsa_admin_gsa_tv_mutate` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_action text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-144` | `gsa_admin_gsa_tv_operations_mutate` | `p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL, p_action text DEFAULT '',p_payload jsonb DEFAULT '{}'` | `jsonb` | **SIM** |
| `DB-RPC-145` | `gsa_admin_gsa_tv_operations_snapshot` | `p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-146` | `gsa_admin_gsa_tv_schedule_mutate` | `p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,p_action text DEFAULT '',p_payload jsonb DEFAULT '{}'` | `jsonb` | **SIM** |
| `DB-RPC-147` | `gsa_admin_gsa_tv_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-148` | `gsa_admin_has_module` | `p_module text` | `boolean` | **SIM** |
| `DB-RPC-149` | `gsa_admin_import_products_batch` | `p_sessao_id uuid, p_session_token text, p_items jsonb` | `jsonb` | NÃO |
| `DB-RPC-150` | `gsa_admin_import_products_batch_v2` | `p_sessao_id uuid, p_session_token text, p_items jsonb` | `jsonb` | **SIM** |
| `DB-RPC-151` | `gsa_admin_import_products_batch_v3` | `p_sessao_id uuid, p_session_token text, p_items jsonb` | `jsonb` | **SIM** |
| `DB-RPC-152` | `gsa_admin_import_service_catalog` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_packages jsonb DEFAULT '[]'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-153` | `gsa_admin_liberar_credito_contrato` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-154` | `gsa_admin_link_advertiser_auth` | `p_advertiser_id uuid, p_auth_user_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-155` | `gsa_admin_list_ad_requests` | `p_status text DEFAULT NULL` | `SETOF` | **SIM** |
| `DB-RPC-156` | `gsa_admin_list_career_applications` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-157` | `gsa_admin_list_career_vacancies` | `p_sessao_id uuid,p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-158` | `gsa_admin_list_notifications` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_limit integer DEFAULT 50` | `jsonb` | **SIM** |
| `DB-RPC-159` | `gsa_admin_list_partner_redemptions` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_partner_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-160` | `gsa_admin_list_resource` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_resource text DEFAULT NULL, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50, p_search text DEFAULT NULL, p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-161` | `gsa_admin_list_store_refunds` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-162` | `gsa_admin_log_scraping_step` | `p_sessao_id text DEFAULT NULL, p_session_token text DEFAULT NULL, p_automacao_id uuid DEFAULT NULL, p_passo text DEFAULT 'progresso', p_status text DEFAULT 'em_andamento', p_mensagem text DEFAULT '', p_progresso integer DEFAULT 50, p_detalhes jsonb DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-163` | `gsa_admin_mark_ad_payment` | `p_payment_id uuid, p_status text, p_provider_reference text DEFAULT NULL, p_payment_method text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-164` | `gsa_admin_mark_all_notifications` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_dismiss boolean DEFAULT false` | `jsonb` | **SIM** |
| `DB-RPC-165` | `gsa_admin_mark_credit_withdrawal_paid` | `p_sessao_id uuid,p_session_token text,p_saque_id uuid,p_referencia_pagamento text` | `jsonb` | **SIM** |
| `DB-RPC-166` | `gsa_admin_marketplace_actor` | `p_sessao_id uuid, p_session_token text, p_module text DEFAULT 'financeiro'` | `TABLE` | **SIM** |
| `DB-RPC-167` | `gsa_admin_mudar_status_cobranca` | `p_sessao_id uuid, p_session_token text, p_cobranca_id uuid, p_status text, p_nivel_cobranca integer DEFAULT 1` | `jsonb` | **SIM** |
| `DB-RPC-168` | `gsa_admin_notification_has_access` | `p_tipo text,p_link text` | `boolean` | **SIM** |
| `DB-RPC-169` | `gsa_admin_notification_visible` | `p_module text, p_destinatario_tipo text, p_colaborador_id text` | `boolean` | **SIM** |
| `DB-RPC-170` | `gsa_admin_partners_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-171` | `gsa_admin_patch_marketplace_budget` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid, p_patch jsonb` | `jsonb` | **SIM** |
| `DB-RPC-172` | `gsa_admin_patch_marketplace_product` | `p_sessao_id uuid, p_session_token text, p_produto_id uuid, p_patch jsonb` | `jsonb` | **SIM** |
| `DB-RPC-173` | `gsa_admin_preaprovar_credito` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid, p_limite_aprovado numeric, p_opcao_pagamento_parcelado boolean, p_max_parcelas integer, p_contrato_url text` | `jsonb` | **SIM** |
| `DB-RPC-174` | `gsa_admin_private_document_allowed` | `p_name text` | `boolean` | **SIM** |
| `DB-RPC-175` | `gsa_admin_process_store_refund` | `p_sessao_id uuid, p_session_token text, p_reembolso_id uuid, p_acao text, p_metodo text DEFAULT NULL, p_referencia text DEFAULT NULL, p_comprovante_url text DEFAULT NULL, p_observacoes text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-176` | `gsa_admin_process_travel_refund` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_request_id uuid DEFAULT NULL, p_transacao_id uuid DEFAULT NULL, p_action text DEFAULT NULL, p_valor_bruto numeric DEFAULT NULL, p_taxas numeric DEFAULT 0, p_resposta text DEFAULT NULL, p_comprovante text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-177` | `gsa_admin_processar_saque` | `p_sessao_id uuid, p_session_token text, p_saque_id uuid, p_acao text, p_motivo text DEFAULT NULL, p_data_pagamento date DEFAULT CURRENT_DATE` | `jsonb` | **SIM** |
| `DB-RPC-178` | `gsa_admin_processar_saque_prestador` | `p_sessao_id uuid, p_session_token text, p_saque_id uuid, p_acao text, p_motivo text DEFAULT NULL, p_data_pagamento date DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-179` | `gsa_admin_processar_transferencia` | `p_sessao_id uuid, p_session_token text, p_transferencia_id uuid, p_acao text, p_motivo text DEFAULT NULL, p_data_pagamento date DEFAULT CURRENT_DATE` | `jsonb` | **SIM** |
| `DB-RPC-180` | `gsa_admin_processar_transferencia_legacy_20260829` | `p_sessao_id uuid, p_session_token text, p_transferencia_id uuid, p_acao text, p_motivo text DEFAULT NULL, p_data_pagamento date DEFAULT CURRENT_DATE` | `jsonb` | **SIM** |
| `DB-RPC-181` | `gsa_admin_protestar_cobranca` | `p_sessao_id uuid, p_session_token text, p_cobranca_id uuid, p_data_protesto date, p_nome_cartorio text` | `jsonb` | **SIM** |
| `DB-RPC-182` | `gsa_admin_recusar_credito` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid, p_motivo text, p_nova_tentativa_apos date` | `jsonb` | **SIM** |
| `DB-RPC-183` | `gsa_admin_registrar_cobranca_historico` | `p_sessao_id uuid, p_session_token text, p_cobranca_id uuid, p_tipo_acao text, p_descricao text, p_canal text DEFAULT 'manual', p_promessa_pagamento boolean DEFAULT false, p_data_promessa date DEFAULT NULL, p_valor_envolvido numeric DEFAULT NULL, p_atualizar_ultimo_contato boolean DEFAULT false` | `jsonb` | **SIM** |
| `DB-RPC-184` | `gsa_admin_rejeitar_contrato_credito` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-185` | `gsa_admin_release_affiliate_commissions` | `p_sessao_id uuid, p_session_token text, p_afiliado_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-186` | `gsa_admin_release_discount_quota` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-187` | `gsa_admin_replace_collaborator_modules` | `p_sessao_id uuid, p_session_token text, p_colaborador_id uuid, p_modulos text[]` | `jsonb` | **SIM** |
| `DB-RPC-188` | `gsa_admin_request_classified_adjustments` | `p_anuncio_id uuid, p_campos jsonb, p_observacao text` | `jsonb` | **SIM** |
| `DB-RPC-189` | `gsa_admin_request_credit_dispute_documents` | `p_sessao_id uuid, p_session_token text, p_contestacao_id uuid, p_mensagem text` | `jsonb` | **SIM** |
| `DB-RPC-190` | `gsa_admin_reset_actor_pin` | `p_sessao_id uuid, p_session_token text, p_actor_id uuid, p_actor_type text` | `boolean` | **SIM** |
| `DB-RPC-191` | `gsa_admin_resolve_travel_cancellation` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_request_id uuid DEFAULT NULL, p_cancelamento_id uuid DEFAULT NULL, p_decision text DEFAULT NULL, p_taxas numeric DEFAULT 0, p_valor_reembolso numeric DEFAULT NULL, p_resposta text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-192` | `gsa_admin_resource_config` | `p_resource text` | `jsonb` | **SIM** |
| `DB-RPC-193` | `gsa_admin_restrict_collaborator_to_module` | `p_module text` | `boolean` | **SIM** |
| `DB-RPC-194` | `gsa_admin_review_ad_creative` | `p_creative_id uuid, p_approved boolean, p_reason text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-195` | `gsa_admin_review_credit_dispute` | `p_sessao_id uuid, p_session_token text, p_contestacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-196` | `gsa_admin_review_credit_limit_cancellation` | `p_sessao_id uuid, p_session_token text, p_cancelamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-197` | `gsa_admin_review_deletion_request` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_request_id uuid DEFAULT NULL, p_decision text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-198` | `gsa_admin_review_supplier_bank_change` | `p_sessao_id uuid, p_session_token text, p_supplier_id uuid, p_approve boolean, p_reason text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-199` | `gsa_admin_review_supplier_delivery` | `p_sessao_id uuid, p_session_token text, p_delivery_id uuid, p_action text, p_reason text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-200` | `gsa_admin_review_supplier_product` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_action text, p_reason text DEFAULT NULL, p_product_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-201` | `gsa_admin_revoke_calculator_pro_grant` | `p_sessao_id uuid, p_session_token text, p_grant_id uuid, p_reason text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-202` | `gsa_admin_rotate_collaborator_credential` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_colaborador_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-203` | `gsa_admin_sanitize_dashboard_list` | `p_kind text, p_items jsonb` | `jsonb` | NÃO |
| `DB-RPC-204` | `gsa_admin_save_calculator_pro_product` | `p_sessao_id uuid, p_session_token text, p_tool_id text, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-205` | `gsa_admin_save_calculator_pro_runtime_config` | `p_sessao_id uuid, p_session_token text, p_infinitepay_handle text` | `jsonb` | **SIM** |
| `DB-RPC-206` | `gsa_admin_save_collaborator` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb, p_modules text[] DEFAULT ARRAY[]::text[]` | `jsonb` | **SIM** |
| `DB-RPC-207` | `gsa_admin_save_company` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-208` | `gsa_admin_save_function` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_id uuid DEFAULT NULL, p_nome text DEFAULT NULL, p_descricao text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-209` | `gsa_admin_save_partner` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_partner_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-210` | `gsa_admin_save_payment_method` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-211` | `gsa_admin_save_product_catalog` | `p_sessao_id UUID, p_session_token TEXT, p_produto_id UUID, p_payload JSONB, p_fornecedor JSONB DEFAULT NULL` | `JSONB` | **SIM** |
| `DB-RPC-212` | `gsa_admin_save_product_catalog_v2` | `p_sessao_id uuid, p_session_token text, p_produto_id uuid, p_payload jsonb, p_fornecedor jsonb DEFAULT NULL, p_variacoes jsonb DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-213` | `gsa_admin_save_protection_entity` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_domain text DEFAULT NULL, p_kind text DEFAULT NULL, p_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-214` | `gsa_admin_save_scraping_config` | `p_sessao_id text, p_session_token text, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-215` | `gsa_admin_save_service_package` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_package_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-216` | `gsa_admin_save_store_coupon` | `p_sessao_id uuid, p_session_token text, p_cupom_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-217` | `gsa_admin_save_subscription_catalog` | `p_sessao_id UUID, p_session_token TEXT, p_assinatura_id UUID, p_payload JSONB` | `JSONB` | **SIM** |
| `DB-RPC-218` | `gsa_admin_save_travel_category` | `p_sessao_id text, p_session_token text, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-219` | `gsa_admin_search_calculator_pro_clients` | `p_sessao_id uuid, p_session_token text, p_query text` | `jsonb` | **SIM** |
| `DB-RPC-220` | `gsa_admin_search_clients` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_search text DEFAULT NULL, p_limit integer DEFAULT 10` | `jsonb` | **SIM** |
| `DB-RPC-221` | `gsa_admin_send_os_support_message` | `p_sessao_id uuid, p_session_token text, p_os_id uuid, p_mensagem text, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-222` | `gsa_admin_sensitive_change_audit` | `` | `trigger` | **SIM** |
| `DB-RPC-223` | `gsa_admin_service_catalog_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-224` | `gsa_admin_service_mutation` | `p_sessao_id uuid, p_session_token text, p_action text, p_servico_id uuid, p_payload jsonb, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-225` | `gsa_admin_session_actor` | `p_sessao_id uuid, p_session_token text` | `TABLE` | **SIM** |
| `DB-RPC-226` | `gsa_admin_session_assert_module` | `p_sessao_id uuid, p_session_token text, p_module text` | `TABLE` | **SIM** |
| `DB-RPC-227` | `gsa_admin_session_change_audit` | `` | `trigger` | **SIM** |
| `DB-RPC-228` | `gsa_admin_set_affiliate_status` | `p_sessao_id uuid, p_session_token text, p_affiliate_id uuid, p_status text, p_reason text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-229` | `gsa_admin_set_calculator_pro_voucher_status` | `p_sessao_id uuid, p_session_token text, p_voucher_id uuid, p_status text` | `jsonb` | **SIM** |
| `DB-RPC-230` | `gsa_admin_set_collaborator_status` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_colaborador_id uuid DEFAULT NULL, p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-231` | `gsa_admin_set_notification_state` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_notification_id text DEFAULT NULL, p_read boolean DEFAULT true, p_dismiss boolean DEFAULT false` | `jsonb` | **SIM** |
| `DB-RPC-232` | `gsa_admin_set_partner_redemption_status` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_resgate_id uuid DEFAULT NULL, p_status text DEFAULT NULL, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-233` | `gsa_admin_set_partner_status` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_partner_id uuid DEFAULT NULL, p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-234` | `gsa_admin_set_product_discount` | `p_sessao_id uuid, p_session_token text, p_produto_id uuid, p_ativo boolean, p_tipo text, p_valor numeric` | `jsonb` | **SIM** |
| `DB-RPC-235` | `gsa_admin_set_site_campaign_permissions` | `p_collaborator_id uuid, p_enabled boolean, p_allowed_actions text[] DEFAULT ARRAY[]::text[], p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-236` | `gsa_admin_set_site_campaign_status` | `p_campaign_id uuid, p_action text, p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-237` | `gsa_admin_settings_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-238` | `gsa_admin_shopee_create_worker` | `p_sessao_id uuid, p_session_token text, p_nome text` | `jsonb` | **SIM** |
| `DB-RPC-239` | `gsa_admin_shopee_job` | `p_sessao_id uuid, p_session_token text, p_job_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-240` | `gsa_admin_shopee_queue` | `p_sessao_id uuid, p_session_token text, p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-241` | `gsa_admin_shopee_update_job` | `p_sessao_id uuid, p_session_token text, p_job_id uuid, p_status text, p_note text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-242` | `gsa_admin_shopee_workers` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-243` | `gsa_admin_site_campaign_my_permissions` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-244` | `gsa_admin_site_campaign_permission_overview` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-245` | `gsa_admin_site_campaigns_overview` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-246` | `gsa_admin_solicitar_documento_credito` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid, p_nome_documento text, p_observacao text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-247` | `gsa_admin_supplier_financial_anomalies` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-248` | `gsa_admin_supplier_set_status` | `p_sessao_id uuid, p_session_token text, p_supplier_id uuid, p_status text, p_reason text DEFAULT NULL, p_pin text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-249` | `gsa_admin_supplier_snapshot` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-250` | `gsa_admin_sync_product_variations` | `p_sessao_id uuid, p_session_token text, p_produto_id uuid, p_variacoes jsonb` | `jsonb` | **SIM** |
| `DB-RPC-251` | `gsa_admin_system_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-252` | `gsa_admin_table_module` | `p_table text` | `text` | NÃO |
| `DB-RPC-253` | `gsa_admin_ticket_is_in_progress` | `p_status text` | `boolean` | NÃO |
| `DB-RPC-254` | `gsa_admin_transition_provider_demand` | `p_sessao_id uuid, p_session_token text, p_demanda_id uuid, p_expected_status text, p_patch jsonb, p_event_type text, p_event_reason text, p_colaborador_destino_id uuid, p_prestador_origem_id uuid, p_prestador_destino_id uuid, p_valor_proposto numeric, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-255` | `gsa_admin_transition_store_order` | `p_sessao_id UUID, p_session_token TEXT, p_request_id UUID, p_ordem_compra_id UUID, p_novo_status TEXT` | `JSONB` | **SIM** |
| `DB-RPC-256` | `gsa_admin_travel_cancellation_list` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_search text DEFAULT NULL, p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-257` | `gsa_admin_travel_create_package` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-258` | `gsa_admin_travel_create_proposal` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_quote_id uuid DEFAULT NULL, p_title text DEFAULT NULL, p_total numeric DEFAULT NULL, p_max_installments integer DEFAULT 1, p_acceptance_hours integer DEFAULT 48, p_payment_days integer DEFAULT 2, p_conditions text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-259` | `gsa_admin_travel_link_lead` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_quote_id uuid DEFAULT NULL, p_client_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-260` | `gsa_admin_travel_list` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_kind text DEFAULT 'solicitacoes', p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_search text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-261` | `gsa_admin_travel_update_status` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_entity text DEFAULT NULL, p_id uuid DEFAULT NULL, p_status text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-262` | `gsa_admin_trigger_scraping_now` | `p_sessao_id text, p_session_token text, p_automacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-263` | `gsa_admin_update_ad_campaign_status` | `p_campaign_id uuid, p_status text` | `jsonb` | **SIM** |
| `DB-RPC-264` | `gsa_admin_update_ad_placement` | `p_placement_id uuid, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-265` | `gsa_admin_update_ad_proposal_status` | `p_proposal_id uuid, p_status text, p_message text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-266` | `gsa_admin_update_ad_request_status` | `p_request_id uuid, p_status text` | `jsonb` | **SIM** |
| `DB-RPC-267` | `gsa_admin_update_affiliate_details` | `p_sessao_id uuid, p_session_token text, p_affiliate_id uuid, p_nome_divulgacao text, p_codigo_publico text DEFAULT NULL, p_pix_tipo text DEFAULT NULL, p_pix_chave text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-268` | `gsa_admin_update_affiliate_points_settings` | `p_sessao_id uuid, p_session_token text, p_rate numeric, p_minimum integer, p_active boolean` | `jsonb` | **SIM** |
| `DB-RPC-269` | `gsa_admin_update_affiliate_program` | `p_sessao_id uuid, p_session_token text, p_program_id uuid, p_patch jsonb` | `jsonb` | **SIM** |
| `DB-RPC-270` | `gsa_admin_update_career_application` | `p_sessao_id uuid, p_session_token text, p_application_id uuid, p_status text, p_internal_notes text DEFAULT NULL, p_interview_at timestamptz DEFAULT NULL, p_interview_location text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-271` | `gsa_admin_update_classified_commission` | `p_categoria text, p_percentual numeric, p_ativo boolean DEFAULT true` | `jsonb` | **SIM** |
| `DB-RPC-272` | `gsa_admin_update_global_saque_minimo` | `p_sessao_id uuid, p_session_token text, p_valor numeric` | `jsonb` | **SIM** |
| `DB-RPC-273` | `gsa_admin_update_provider_demand` | `p_sessao_id uuid, p_session_token text, p_demanda_id uuid, p_expected_status text, p_patch jsonb, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-274` | `gsa_admin_update_resource_status` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_resource text DEFAULT NULL, p_id uuid DEFAULT NULL, p_status text DEFAULT NULL, p_reason text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-275` | `gsa_admin_update_settings_secure` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_settings jsonb DEFAULT '[]'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-276` | `gsa_admin_update_store_order_notes` | `p_sessao_id uuid, p_session_token text, p_ordem_compra_id uuid, p_observacoes text` | `jsonb` | **SIM** |
| `DB-RPC-277` | `gsa_admin_update_supplier_payable` | `p_sessao_id uuid, p_session_token text, p_payable_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-278` | `gsa_admin_upsert_career_vacancy` | `p_sessao_id uuid,p_session_token text,p_vacancy_id uuid,p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-279` | `gsa_admin_upsert_product_supplier_config` | `p_sessao_id uuid, p_session_token text, p_produto_id uuid, p_dados jsonb` | `jsonb` | **SIM** |
| `DB-RPC-280` | `gsa_admin_upsert_settings` | `p_sessao_id uuid, p_session_token text, p_settings jsonb` | `boolean` | **SIM** |
| `DB-RPC-281` | `gsa_admin_upsert_site_campaign` | `p_campaign_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb, p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-282` | `gsa_admin_validate_context` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-283` | `gsa_admin_whatsapp_mutation` | `p_sessao_id uuid, p_session_token text, p_action text, p_payload jsonb, p_request_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-284` | `gsa_admin_write_audit` | `p_module text, p_action text, p_target_type text DEFAULT NULL, p_target_id uuid DEFAULT NULL, p_details jsonb DEFAULT '{}'::jsonb` | `uuid` | **SIM** |
| `DB-RPC-285` | `gsa_ads_apply_payment_state` | `` | `trigger` | **SIM** |
| `DB-RPC-286` | `gsa_ads_assert_inventory` | `p_campaign_id uuid, p_placement_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_share_percent numeric` | `void` | **SIM** |
| `DB-RPC-287` | `gsa_ads_claim_protocol_for_user` | `p_protocol text, p_auth_user_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-288` | `gsa_ads_configure_payment_checkout` | `p_payment_id uuid,p_provider text,p_provider_reference text,p_checkout_url text,p_due_at timestamptz` | `jsonb` | **SIM** |
| `DB-RPC-289` | `gsa_ads_consume_rate_limit` | `p_scope_hash text, p_action text, p_limit integer, p_window_seconds integer DEFAULT 60` | `boolean` | **SIM** |
| `DB-RPC-290` | `gsa_ads_guard_campaign_transition` | `` | `trigger` | NÃO |
| `DB-RPC-291` | `gsa_ads_guard_creative_immutable` | `` | `trigger` | NÃO |
| `DB-RPC-292` | `gsa_ads_guard_payment_transition` | `` | `trigger` | NÃO |
| `DB-RPC-293` | `gsa_ads_guard_proposal_transition` | `` | `trigger` | NÃO |
| `DB-RPC-294` | `gsa_ads_guard_proposal_version_immutable` | `` | `trigger` | NÃO |
| `DB-RPC-295` | `gsa_ads_list_orphan_creative_paths` | `` | `TABLE` | **SIM** |
| `DB-RPC-296` | `gsa_ads_payment_transition_allowed` | `p_old text, p_new text` | `boolean` | NÃO |
| `DB-RPC-297` | `gsa_ads_process_payment_event` | `p_provider text, p_event_id text, p_reference text, p_status text, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-298` | `gsa_ads_record_event` | `p_event_token uuid, p_event_type text` | `jsonb` | **SIM** |
| `DB-RPC-299` | `gsa_ads_refresh_campaign_states` | `` | `jsonb` | **SIM** |
| `DB-RPC-300` | `gsa_ads_route_matches` | `p_pattern text, p_route text` | `boolean` | NÃO |
| `DB-RPC-301` | `gsa_ads_serve` | `p_placement_code text, p_viewer_hash text, p_session_hash text, p_route text, p_device text` | `jsonb` | **SIM** |
| `DB-RPC-302` | `gsa_ads_sync_campaign_state` | `p_campaign_id uuid, p_resume boolean DEFAULT false` | `text` | **SIM** |
| `DB-RPC-303` | `gsa_ads_touch_updated_at` | `` | `trigger` | NÃO |
| `DB-RPC-304` | `gsa_ads_valid_cpf_cnpj` | `p_value text` | `boolean` | NÃO |
| `DB-RPC-305` | `gsa_ads_validate_creative_object` | `p_advertiser_id uuid, p_campaign_id uuid, p_kind text, p_storage_path text` | `boolean` | **SIM** |
| `DB-RPC-306` | `gsa_advertiser_accept_proposal` | `p_proposal_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-307` | `gsa_advertiser_counter_proposal` | `p_proposal_id uuid, p_amount numeric, p_message text` | `jsonb` | **SIM** |
| `DB-RPC-308` | `gsa_advertiser_payment_checkout_context` | `p_payment_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-309` | `gsa_advertiser_portal_snapshot` | `` | `jsonb` | **SIM** |
| `DB-RPC-310` | `gsa_advertiser_reject_proposal` | `p_proposal_id uuid, p_message text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-311` | `gsa_advertiser_save_creative` | `p_creative_id uuid, p_campaign_id uuid, p_kind text, p_storage_path text, p_target_url text, p_headline text, p_body text, p_alt_text text, p_width integer, p_height integer, p_duration_seconds numeric` | `jsonb` | **SIM** |
| `DB-RPC-312` | `gsa_advertiser_submit_creative` | `p_creative_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-313` | `gsa_advertiser_update_profile` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-314` | `gsa_affiliate_activate_client_profile` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-315` | `gsa_affiliate_available_balance` | `p_afiliado_id uuid` | `numeric` | **SIM** |
| `DB-RPC-316` | `gsa_affiliate_award_points` | `` | `trigger` | **SIM** |
| `DB-RPC-317` | `gsa_affiliate_conversion_from_business_event` | `` | `trigger` | **SIM** |
| `DB-RPC-318` | `gsa_affiliate_current_attribution` | `p_cliente_id uuid, p_programa_codigo text` | `uuid` | **SIM** |
| `DB-RPC-319` | `gsa_affiliate_destination_allowed` | `p_programa_id uuid, p_destino text` | `boolean` | **SIM** |
| `DB-RPC-320` | `gsa_affiliate_freeze_attribution` | `` | `trigger` | **SIM** |
| `DB-RPC-321` | `gsa_affiliate_hash` | `p_value text` | `text` | NÃO |
| `DB-RPC-322` | `gsa_affiliate_json_numeric` | `p_row jsonb, p_keys text[]` | `numeric` | **SIM** |
| `DB-RPC-323` | `gsa_affiliate_new_code` | `p_prefix text` | `text` | NÃO |
| `DB-RPC-324` | `gsa_affiliate_normalize_pix_type` | `p_type text, p_key text` | `text` | NÃO |
| `DB-RPC-325` | `gsa_affiliate_record_conversion` | `p_atribuicao_id uuid, p_programa_codigo text, p_origem_tipo text, p_origem_id uuid, p_evento text, p_valor_bruto numeric, p_base_elegivel numeric, p_metadata jsonb DEFAULT '{}'::jsonb` | `uuid` | **SIM** |
| `DB-RPC-326` | `gsa_affiliate_release_due_commissions` | `` | `integer` | **SIM** |
| `DB-RPC-327` | `gsa_affiliate_reverse_points` | `` | `trigger` | **SIM** |
| `DB-RPC-328` | `gsa_affiliate_reverse_source` | `p_programa_codigo text, p_origem_tipo text, p_origem_id uuid, p_motivo text DEFAULT 'cancelamento'` | `integer` | **SIM** |
| `DB-RPC-329` | `gsa_affiliate_touch_updated_at` | `` | `trigger` | NÃO |
| `DB-RPC-330` | `gsa_apply_credit_dispute_block` | `` | `trigger` | **SIM** |
| `DB-RPC-331` | `gsa_apply_credit_limit_cancellation_block` | `` | `trigger` | **SIM** |
| `DB-RPC-332` | `gsa_apply_points_internal` | `p_cliente_id uuid, p_pontos integer, p_descricao text, p_tipo text, p_fatura_id uuid DEFAULT NULL, p_notificar boolean DEFAULT true` | `jsonb` | **SIM** |
| `DB-RPC-333` | `gsa_assert_auth_rate_limit` | `p_escopo text, p_identificador text, p_limite integer DEFAULT 10, p_janela interval DEFAULT interval '15 minutes'` | `text` | **SIM** |
| `DB-RPC-334` | `gsa_assert_current_provider` | `` | `uuid` | **SIM** |
| `DB-RPC-335` | `gsa_assert_current_provider_active` | `` | `uuid` | **SIM** |
| `DB-RPC-336` | `gsa_assert_current_supplier` | `` | `uuid` | **SIM** |
| `DB-RPC-337` | `gsa_assert_public_rate_limit` | `p_escopo text, p_identificador text, p_limite integer, p_janela interval` | `void` | **SIM** |
| `DB-RPC-338` | `gsa_auth_rate_limit_check` | `p_bucket_key text, p_limit integer, p_window_seconds integer, p_block_seconds integer` | `jsonb` | **SIM** |
| `DB-RPC-339` | `gsa_begin_client_recovery` | `p_documento TEXT, p_email TEXT, p_challenge_id UUID` | `JSONB` | **SIM** |
| `DB-RPC-340` | `gsa_begin_partner_appeal_challenge` | `p_codigo text, p_challenge_id uuid, p_code_hash text` | `jsonb` | **SIM** |
| `DB-RPC-341` | `gsa_block_collaborator_access_module` | `` | `trigger` | **SIM** |
| `DB-RPC-342` | `gsa_bot_find_partner_redemption` | `p_parceiro_id uuid, p_email text DEFAULT NULL, p_telefone text DEFAULT NULL` | `TABLE` | **SIM** |
| `DB-RPC-343` | `gsa_calculate_product_discount_percentage` | `p_valor numeric, p_effective_price numeric` | `numeric` | NÃO |
| `DB-RPC-344` | `gsa_calculate_product_effective_price` | `p_valor numeric, p_desconto_ativo boolean, p_desconto_tipo text, p_desconto_valor numeric` | `numeric` | NÃO |
| `DB-RPC-345` | `gsa_calculator_create_session_internal` | `p_tool_id text, p_visitor_hash text, p_cliente_id uuid, p_source text, p_grant_id uuid, p_token_hash text, p_expires_at timestamptz` | `jsonb` | **SIM** |
| `DB-RPC-346` | `gsa_calculator_finalize_payment_internal` | `p_order_nsu text, p_transaction_nsu text, p_invoice_slug text, p_receipt_url text, p_capture_method text, p_paid_amount_centavos integer, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-347` | `gsa_calculator_pro_enforce_product_state` | `` | `trigger` | **SIM** |
| `DB-RPC-348` | `gsa_calculator_pro_expire_records` | `` | `jsonb` | **SIM** |
| `DB-RPC-349` | `gsa_calculator_pro_limit_checkout_attempts` | `` | `trigger` | **SIM** |
| `DB-RPC-350` | `gsa_calculator_pro_require_settings_access` | `p_sessao_id uuid, p_session_token text` | `void` | **SIM** |
| `DB-RPC-351` | `gsa_calculator_pro_runtime_config_touch` | `` | `trigger` | NÃO |
| `DB-RPC-352` | `gsa_calculator_pro_touch_updated_at` | `` | `trigger` | NÃO |
| `DB-RPC-353` | `gsa_calculator_redeem_voucher_and_create_session_internal` | `p_code_hash text, p_tool_id text, p_visitor_hash text, p_cliente_id uuid, p_token_hash text` | `jsonb` | **SIM** |
| `DB-RPC-354` | `gsa_calculator_redeem_voucher_internal` | `p_code_hash text, p_tool_id text, p_visitor_hash text, p_cliente_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-355` | `gsa_careers_admin_context` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-356` | `gsa_careers_enqueue_status_notification` | `` | `trigger` | **SIM** |
| `DB-RPC-357` | `gsa_careers_is_admin_actor` | `` | `boolean` | **SIM** |
| `DB-RPC-358` | `gsa_careers_rate_limit` | `p_scope text,p_identity text,p_limit integer,p_window interval` | `void` | **SIM** |
| `DB-RPC-359` | `gsa_careers_resume_path_is_expected` | `p_path text` | `boolean` | **SIM** |
| `DB-RPC-360` | `gsa_careers_validate_cpf` | `p_document text` | `boolean` | NÃO |
| `DB-RPC-361` | `gsa_change_own_pin` | `p_sessao_id uuid, p_session_token text, p_current_pin text, p_new_pin text` | `boolean` | **SIM** |
| `DB-RPC-362` | `gsa_check_active_session` | `p_ator_id uuid` | `TABLE` | **SIM** |
| `DB-RPC-363` | `gsa_claim_partner_appeal_notifications` | `p_limit integer DEFAULT 20` | `jsonb` | **SIM** |
| `DB-RPC-364` | `gsa_classified_proposal_moderation_guard` | `` | `trigger` | NÃO |
| `DB-RPC-365` | `gsa_cleanup_deleted_travel_document_metadata` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-366` | `gsa_client_accept_loan_settlement` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-367` | `gsa_client_accept_store_credit_settlement` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-368` | `gsa_client_activate_store_coupon` | `p_sessao_id uuid, p_session_token text, p_cupom_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-369` | `gsa_client_affiliate_snapshot` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-370` | `gsa_client_affiliate_transfers` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-371` | `gsa_client_approve_budget` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-372` | `gsa_client_bind_affiliate_click` | `p_sessao_id uuid, p_session_token text, p_click_token text` | `jsonb` | **SIM** |
| `DB-RPC-373` | `gsa_client_cancel_affiliate_payout` | `p_sessao_id uuid, p_session_token text, p_saque_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-374` | `gsa_client_cancel_credit_dispute` | `p_sessao_id uuid, p_session_token text, p_contestacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-375` | `gsa_client_cancel_credit_increase_request` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-376` | `gsa_client_cancel_credit_withdrawal` | `p_sessao_id uuid,p_session_token text,p_saque_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-377` | `gsa_client_cancel_loan_under_review` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-378` | `gsa_client_cancel_store_order` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-379` | `gsa_client_cancel_subscription` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_ordem_assinatura_id uuid, p_data_cancelamento date` | `jsonb` | **SIM** |
| `DB-RPC-380` | `gsa_client_cancel_support_ticket` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_ticket_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-381` | `gsa_client_cancel_transfer` | `p_sessao_id uuid, p_session_token text, p_transferencia_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-382` | `gsa_client_cancel_withdrawal` | `p_sessao_id uuid, p_session_token text, p_saque_id uuid, p_motivo text DEFAULT 'Cancelado pelo cliente'` | `jsonb` | **SIM** |
| `DB-RPC-383` | `gsa_client_checkout_store` | `p_sessao_id uuid, p_session_token text, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-384` | `gsa_client_checkout_travel` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-385` | `gsa_client_classified_context` | `p_sessao_id uuid, p_session_token text` | `uuid` | **SIM** |
| `DB-RPC-386` | `gsa_client_classified_create_proposal` | `p_sessao_id uuid, p_session_token text, p_anuncio_id uuid, p_valor numeric, p_mensagem text, p_request_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-387` | `gsa_client_classified_list_messages` | `p_sessao_id uuid, p_session_token text, p_proposta_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-388` | `gsa_client_classified_send_message` | `p_sessao_id uuid, p_session_token text, p_proposta_id uuid, p_mensagem text` | `jsonb` | **SIM** |
| `DB-RPC-389` | `gsa_client_convert_points` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_pontos integer` | `jsonb` | **SIM** |
| `DB-RPC-390` | `gsa_client_create_affiliate_link` | `p_sessao_id uuid, p_session_token text, p_programa_codigo text, p_destino text, p_titulo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-391` | `gsa_client_create_credit_dispute` | `p_sessao_id uuid, p_session_token text, p_movimentacao_id uuid, p_motivo text, p_descricao text, p_anexos jsonb DEFAULT '[]'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-392` | `gsa_client_create_credit_withdrawal` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_valor numeric, p_pix_tipo text, p_pix_chave text` | `jsonb` | **SIM** |
| `DB-RPC-393` | `gsa_client_create_service_quote` | `p_sessao_id uuid, p_session_token text, p_item_type text, p_item_id uuid, p_description text, p_priority text DEFAULT 'baixa', p_attachments jsonb DEFAULT '[]'::jsonb, p_promotion_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-394` | `gsa_client_credit_dispute_details` | `p_sessao_id uuid, p_session_token text, p_contestacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-395` | `gsa_client_credit_disputes` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-396` | `gsa_client_credit_limit_cancellations` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-397` | `gsa_client_credit_withdrawal_quote` | `p_sessao_id uuid, p_session_token text, p_valor numeric DEFAULT 0` | `jsonb` | **SIM** |
| `DB-RPC-398` | `gsa_client_credit_withdrawals` | `p_sessao_id uuid,p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-399` | `gsa_client_deactivate_account` | `p_sessao_id uuid, p_session_token text, p_reason text, p_permanent boolean DEFAULT false` | `jsonb` | **SIM** |
| `DB-RPC-400` | `gsa_client_extend_subscription` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_ordem_assinatura_id uuid, p_meses integer` | `jsonb` | **SIM** |
| `DB-RPC-401` | `gsa_client_generate_loan_installment_invoice` | `p_sessao_id uuid, p_session_token text, p_parcela_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-402` | `gsa_client_generate_store_invoice` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-403` | `gsa_client_get_notification_read_ids` | `p_sessao_id UUID, p_session_token TEXT, p_notification_ids UUID[]` | `JSONB` | **SIM** |
| `DB-RPC-404` | `gsa_client_join_affiliate` | `p_sessao_id uuid, p_session_token text, p_nome_divulgacao text, p_pix_tipo text, p_pix_chave text, p_termos_versao text` | `jsonb` | **SIM** |
| `DB-RPC-405` | `gsa_client_lookup_affiliate_transfer_target` | `p_sessao_id uuid, p_session_token text, p_identificador text` | `jsonb` | **SIM** |
| `DB-RPC-406` | `gsa_client_lookup_transfer_recipient` | `p_sessao_id uuid, p_session_token text, p_tipo_documento text, p_documento text` | `jsonb` | **SIM** |
| `DB-RPC-407` | `gsa_client_mark_notification_read` | `p_sessao_id UUID, p_session_token TEXT, p_notification_id UUID` | `JSONB` | **SIM** |
| `DB-RPC-408` | `gsa_client_notify_admin` | `p_sessao_id uuid, p_session_token text, p_titulo text, p_mensagem text, p_modulo text DEFAULT 'sistema', p_acao_origem text DEFAULT 'sistema', p_tab text DEFAULT NULL, p_item_id text DEFAULT NULL, p_prioridade text DEFAULT 'normal', p_contexto jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-409` | `gsa_client_notify_self` | `p_sessao_id uuid, p_session_token text, p_titulo text, p_mensagem text, p_modulo text, p_acao_origem text, p_tab text DEFAULT NULL, p_item_id text DEFAULT NULL, p_prioridade text DEFAULT 'normal', p_contexto jsonb DEFAULT '{}'::jsonb, p_tipo text DEFAULT 'sistema'` | `jsonb` | **SIM** |
| `DB-RPC-410` | `gsa_client_operational_write` | `p_sessao_id UUID, p_session_token TEXT, p_table TEXT, p_action TEXT, p_data JSONB DEFAULT '{}'::JSONB, p_filter JSONB DEFAULT '{}'::JSONB` | `JSONB` | **SIM** |
| `DB-RPC-411` | `gsa_client_pagar_fatura` | `p_sessao_id uuid, p_session_token text, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-412` | `gsa_client_process_scheduled_credit_release` | `p_sessao_id UUID, p_session_token TEXT` | `JSONB` | **SIM** |
| `DB-RPC-413` | `gsa_client_process_welcome_bonus` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-414` | `gsa_client_profile_access_state` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-415` | `gsa_client_record_is_blocked` | `p_cliente JSONB` | `BOOLEAN` | **SIM** |
| `DB-RPC-416` | `gsa_client_redeem_affiliate_points` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_pontos numeric` | `jsonb` | **SIM** |
| `DB-RPC-417` | `gsa_client_redeem_wallet_voucher` | `p_sessao_id uuid, p_session_token text, p_voucher_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-418` | `gsa_client_reject_loan_settlement` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-419` | `gsa_client_reject_store_credit_settlement` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-420` | `gsa_client_release_signed_credit` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-421` | `gsa_client_request_affiliate_payout` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_valor numeric` | `jsonb` | **SIM** |
| `DB-RPC-422` | `gsa_client_request_credit_limit_cancellation` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-423` | `gsa_client_request_loan_settlement` | `p_sessao_id uuid, p_session_token text, p_emprestimo_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-424` | `gsa_client_request_preapproved_credit_100` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-425` | `gsa_client_request_store_credit_settlement` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-426` | `gsa_client_request_store_exchange` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_orcamento_id uuid, p_tipo text, p_motivo text, p_imagens_anexo jsonb, p_metodo_entrega text, p_itens_devolvidos jsonb, p_opcao_substituicao text, p_novos_produtos jsonb` | `jsonb` | **SIM** |
| `DB-RPC-427` | `gsa_client_request_transfer` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_destino_id uuid, p_tipo text, p_valor numeric, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-428` | `gsa_client_request_withdrawal` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_tipo_chave_pix text, p_chave_pix text` | `jsonb` | **SIM** |
| `DB-RPC-429` | `gsa_client_reverse_received_affiliate_transfer` | `p_sessao_id uuid, p_session_token text, p_transferencia_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-430` | `gsa_client_reverse_transfer` | `p_sessao_id uuid, p_session_token text, p_transferencia_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-431` | `gsa_client_saude_abrir_atendimento` | `p_sessao_id uuid,p_session_token text,p_assunto text,p_mensagem text` | `jsonb` | **SIM** |
| `DB-RPC-432` | `gsa_client_saude_aceitar_proposta` | `p_sessao_id uuid,p_session_token text,p_proposta_id uuid,p_termos_versao text` | `jsonb` | **SIM** |
| `DB-RPC-433` | `gsa_client_saude_criar_cotacao` | `p_sessao_id uuid, p_session_token text, p_payload jsonb, p_idempotency_key uuid` | `jsonb` | **SIM** |
| `DB-RPC-434` | `gsa_client_saude_listar` | `p_sessao_id uuid, p_session_token text, p_recurso text, p_item_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-435` | `gsa_client_saude_registrar_documento` | `p_sessao_id uuid,p_session_token text,p_titulo text,p_tipo text,p_storage_path text` | `jsonb` | **SIM** |
| `DB-RPC-436` | `gsa_client_seguros_abrir_atendimento` | `p_sessao_id uuid,p_session_token text,p_assunto text,p_mensagem text` | `jsonb` | **SIM** |
| `DB-RPC-437` | `gsa_client_seguros_aceitar_proposta` | `p_sessao_id uuid,p_session_token text,p_proposta_id uuid,p_termos_versao text` | `jsonb` | **SIM** |
| `DB-RPC-438` | `gsa_client_seguros_criar_cotacao` | `p_sessao_id uuid,p_session_token text,p_payload jsonb,p_idempotency_key uuid` | `jsonb` | **SIM** |
| `DB-RPC-439` | `gsa_client_seguros_criar_ocorrencia` | `p_sessao_id uuid,p_session_token text,p_tipo text,p_apolice_id uuid,p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-440` | `gsa_client_seguros_listar` | `p_sessao_id uuid,p_session_token text,p_recurso text,p_item_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-441` | `gsa_client_seguros_registrar_documento` | `p_sessao_id uuid,p_session_token text,p_titulo text,p_tipo text,p_storage_path text` | `jsonb` | **SIM** |
| `DB-RPC-442` | `gsa_client_service_catalog` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-443` | `gsa_client_session_actor` | `p_sessao_id uuid, p_session_token text` | `TABLE` | **SIM** |
| `DB-RPC-444` | `gsa_client_store_payment_quote` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-445` | `gsa_client_store_refunds` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-446` | `gsa_client_submit_credit_withdrawal_documents` | `p_sessao_id uuid,p_session_token text,p_saque_id uuid,p_documento_foto jsonb,p_comprovante_endereco jsonb` | `jsonb` | **SIM** |
| `DB-RPC-447` | `gsa_client_submit_exchange_tracking` | `p_sessao_id uuid, p_session_token text, p_solicitacao_id uuid, p_codigo_rastreio text` | `jsonb` | **SIM** |
| `DB-RPC-448` | `gsa_client_subscribe_vip` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_nivel_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-449` | `gsa_client_sync_pix_invoice` | `p_sessao_id uuid, p_session_token text, p_orcamento_id uuid, p_checkout_link text, p_order_nsu text, p_itens jsonb DEFAULT '[]'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-450` | `gsa_client_transfer_affiliate_balance` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_destinatario_id uuid, p_valor numeric, p_observacao text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-451` | `gsa_client_transfer_affiliate_balance_internal` | `p_sessao_id uuid,p_session_token text,p_request_id uuid,p_destinatario_id uuid,p_valor numeric,p_observacao text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-452` | `gsa_client_update_affiliate_profile` | `p_sessao_id uuid, p_session_token text, p_nome_divulgacao text, p_pix_tipo text, p_pix_chave text` | `jsonb` | **SIM** |
| `DB-RPC-453` | `gsa_close_collaborator_sessions` | `p_colaborador_id uuid` | `void` | **SIM** |
| `DB-RPC-454` | `gsa_collaborator_can_access_demand` | `p_demanda_id uuid` | `boolean` | **SIM** |
| `DB-RPC-455` | `gsa_collaborator_dashboard_snapshot` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-456` | `gsa_collaborator_demand_history` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_demanda_id uuid DEFAULT NULL, p_limit integer DEFAULT 500` | `jsonb` | **SIM** |
| `DB-RPC-457` | `gsa_collaborator_has_module` | `p_module text` | `boolean` | **SIM** |
| `DB-RPC-458` | `gsa_collaborator_list_demands` | `p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_limit integer DEFAULT 500` | `jsonb` | **SIM** |
| `DB-RPC-459` | `gsa_complete_partner_appeal` | `p_challenge_id uuid, p_code_hash text, p_contestacao text, p_idempotency_key uuid` | `jsonb` | **SIM** |
| `DB-RPC-460` | `gsa_confirmar_contribuicao_vaquinha` | `p_contribuicao_id UUID, p_transacao_id TEXT DEFAULT NULL` | `JSONB` | **SIM** |
| `DB-RPC-461` | `gsa_consume_auth_rate_limit` | `p_bucket_key text, p_limit integer, p_window_seconds integer, p_block_seconds integer` | `jsonb` | **SIM** |
| `DB-RPC-462` | `gsa_converter_pontos_carteira` | `p_cliente_id uuid, p_pontos integer DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-463` | `gsa_create_session_internal` | `p_ator_tipo text, p_ator_id uuid, p_ator_nome text, p_metadata jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-464` | `gsa_credit_dispute_order_id` | `p_cliente_id uuid, p_descricao text` | `uuid` | **SIM** |
| `DB-RPC-465` | `gsa_credit_dispute_purchase_code` | `p_descricao text` | `text` | **SIM** |
| `DB-RPC-466` | `gsa_credit_withdrawal_fee` | `p_valor numeric` | `jsonb` | **SIM** |
| `DB-RPC-467` | `gsa_criar_vaquinha` | `p_dados JSONB` | `JSONB` | **SIM** |
| `DB-RPC-468` | `gsa_current_actor_id` | `` | `uuid` | **SIM** |
| `DB-RPC-469` | `gsa_current_actor_type` | `` | `text` | **SIM** |
| `DB-RPC-470` | `gsa_current_advertiser_id` | `` | `uuid` | **SIM** |
| `DB-RPC-471` | `gsa_emit_provider_operational_event` | `` | `trigger` | **SIM** |
| `DB-RPC-472` | `gsa_end_session` | `p_sessao_id uuid, p_session_token text` | `boolean` | **SIM** |
| `DB-RPC-473` | `gsa_enforce_admin_log_identity` | `` | `trigger` | **SIM** |
| `DB-RPC-474` | `gsa_enrich_public_partner_application` | `` | `trigger` | NÃO |
| `DB-RPC-475` | `gsa_expire_stale_admin_sessions` | `` | `integer` | **SIM** |
| `DB-RPC-476` | `gsa_finalize_external_invoice_payment` | `p_fatura_id uuid, p_order_nsu text, p_transaction_nsu text, p_paid_amount numeric, p_capture_method text, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-477` | `gsa_finalize_paid_invoice_internal` | `p_fatura_id uuid, p_valor_base_pontos numeric DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-478` | `gsa_finish_partner_appeal_notification` | `p_notification_id uuid, p_success boolean, p_provider_message_id text DEFAULT NULL, p_error text DEFAULT NULL` | `void` | **SIM** |
| `DB-RPC-479` | `gsa_force_end_session` | `p_sessao_id uuid` | `boolean` | **SIM** |
| `DB-RPC-480` | `gsa_generate_code` | `p_prefix text` | `text` | **SIM** |
| `DB-RPC-481` | `gsa_generate_internal_collaborator_code` | `` | `text` | **SIM** |
| `DB-RPC-482` | `gsa_generate_unique_product_code` | `` | `text` | **SIM** |
| `DB-RPC-483` | `gsa_get_client_session_access_state` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-484` | `gsa_get_collaborator_session_access_state` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-485` | `gsa_guard_client_credit_limits` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-486` | `gsa_guard_client_credit_release_status` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-487` | `gsa_guard_client_notification_insert` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-488` | `gsa_guard_client_sensitive_profile_fields` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-489` | `gsa_guard_duplicate_active_client_ticket` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-490` | `gsa_guard_duplicate_client_credit_movement` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-491` | `gsa_guard_duplicate_client_credit_notification` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-492` | `gsa_guard_preapproved_credit_eligibility` | `` | `trigger` | **SIM** |
| `DB-RPC-493` | `gsa_guard_provider_direct_write` | `` | `trigger` | **SIM** |
| `DB-RPC-494` | `gsa_guard_provider_schedule` | `` | `trigger` | **SIM** |
| `DB-RPC-495` | `gsa_guard_store_credit_blocked_balance` | `` | `trigger` | NÃO |
| `DB-RPC-496` | `gsa_hash_collaborator_credential` | `` | `trigger` | **SIM** |
| `DB-RPC-497` | `gsa_hash_session_token` | `p_token text` | `text` | **SIM** |
| `DB-RPC-498` | `gsa_is_safe_provider_result_url` | `p_url text` | `boolean` | **SIM** |
| `DB-RPC-499` | `gsa_is_valid_cnpj` | `p_value text` | `boolean` | NÃO |
| `DB-RPC-500` | `gsa_is_valid_cpf` | `p_value text` | `boolean` | NÃO |
| `DB-RPC-501` | `gsa_jsonb_pick` | `p_data JSONB, p_keys TEXT[]` | `JSONB` | **SIM** |
| `DB-RPC-502` | `gsa_jwt_actor_id` | `` | `uuid` | NÃO |
| `DB-RPC-503` | `gsa_jwt_actor_type` | `` | `text` | NÃO |
| `DB-RPC-504` | `gsa_jwt_is_admin` | `` | `boolean` | NÃO |
| `DB-RPC-505` | `gsa_jwt_session_id` | `` | `uuid` | **SIM** |
| `DB-RPC-506` | `gsa_jwt_session_is_valid` | `` | `boolean` | **SIM** |
| `DB-RPC-507` | `gsa_log_action` | `p_sessao_id uuid, p_session_token text, p_ator_tipo text, p_ator_id text, p_ator_nome text, p_acao text, p_detalhes text DEFAULT NULL` | `uuid` | **SIM** |
| `DB-RPC-508` | `gsa_login_admin` | `p_code text` | `jsonb` | **SIM** |
| `DB-RPC-509` | `gsa_login_colaborador` | `p_code text` | `jsonb` | **SIM** |
| `DB-RPC-510` | `gsa_login_pin` | `p_documento text, p_pin text, p_tipo text` | `jsonb` | **SIM** |
| `DB-RPC-511` | `gsa_lookup_portal_account` | `p_documento text, p_tipo text` | `jsonb` | **SIM** |
| `DB-RPC-512` | `gsa_mark_historical_client_ineligible` | `` | `trigger` | **SIM** |
| `DB-RPC-513` | `gsa_mark_promotion_usage_for_invoice` | `p_fatura_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-514` | `gsa_normalize_partner_redemption_phone` | `p_value text` | `text` | **SIM** |
| `DB-RPC-515` | `gsa_normalize_points_movement_type` | `` | `trigger` | NÃO |
| `DB-RPC-516` | `gsa_normalize_provider_pix_key` | `p_tipo text, p_chave text` | `text` | **SIM** |
| `DB-RPC-517` | `gsa_normalize_service_order_status` | `` | `trigger` | NÃO |
| `DB-RPC-518` | `gsa_normalize_ticket_status` | `` | `trigger` | NÃO |
| `DB-RPC-519` | `gsa_normalize_url` | `p_url text` | `text` | NÃO |
| `DB-RPC-520` | `gsa_notify_admin_partner_appeal` | `` | `trigger` | **SIM** |
| `DB-RPC-521` | `gsa_notify_invoice_paid` | `` | `trigger` | **SIM** |
| `DB-RPC-522` | `gsa_notify_invoice_payment_started` | `` | `trigger` | **SIM** |
| `DB-RPC-523` | `gsa_obter_vaquinha` | `p_codigo_ou_id TEXT` | `JSONB` | **SIM** |
| `DB-RPC-524` | `gsa_partner_redemption_create_internal` | `p_parceiro_id uuid, p_parceiro_slug text, p_nome_completo text, p_telefone text, p_cliente_id uuid, p_email text, p_allow_duplicate boolean, p_justificativa text` | `jsonb` | **SIM** |
| `DB-RPC-525` | `gsa_partner_redemption_touch_trigger` | `` | `trigger` | **SIM** |
| `DB-RPC-526` | `gsa_ping_session` | `p_sessao_id uuid, p_session_token text` | `boolean` | **SIM** |
| `DB-RPC-527` | `gsa_private_document_read_allowed` | `p_name text` | `boolean` | **SIM** |
| `DB-RPC-528` | `gsa_process_due_store_credit_releases` | `` | `INTEGER` | **SIM** |
| `DB-RPC-529` | `gsa_process_due_subscription_cancellations` | `` | `INTEGER` | **SIM** |
| `DB-RPC-530` | `gsa_process_scheduled_subscription_cancellations` | `` | `jsonb` | **SIM** |
| `DB-RPC-531` | `gsa_provider_activate_promotion` | `p_promocao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-532` | `gsa_provider_cancel_withdrawal` | `p_saque_id uuid, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-533` | `gsa_provider_complete_schedule` | `p_agendamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-534` | `gsa_provider_context` | `p_require_active boolean DEFAULT false` | `jsonb` | **SIM** |
| `DB-RPC-535` | `gsa_provider_create_schedule` | `p_demanda_id uuid, p_data_inicio timestamptz, p_data_fim timestamptz, p_observacoes text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-536` | `gsa_provider_create_ticket` | `p_subject text, p_description text, p_deduplicate boolean DEFAULT false` | `jsonb` | **SIM** |
| `DB-RPC-537` | `gsa_provider_dashboard_snapshot` | `` | `jsonb` | **SIM** |
| `DB-RPC-538` | `gsa_provider_delete_schedule` | `p_agendamento_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-539` | `gsa_provider_financial_snapshot` | `` | `jsonb` | **SIM** |
| `DB-RPC-540` | `gsa_provider_insert_admin_notification` | `p_title text, p_message text, p_module text, p_action text, p_item_id uuid DEFAULT NULL, p_priority text DEFAULT 'normal', p_context jsonb DEFAULT '{}'::jsonb` | `uuid` | **SIM** |
| `DB-RPC-541` | `gsa_provider_mark_all_notifications_read` | `` | `jsonb` | **SIM** |
| `DB-RPC-542` | `gsa_provider_mark_notification_read` | `p_notificacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-543` | `gsa_provider_pendency_snapshot` | `` | `jsonb` | **SIM** |
| `DB-RPC-544` | `gsa_provider_redeem_prize` | `p_premio_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-545` | `gsa_provider_redeem_voucher` | `p_voucher_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-546` | `gsa_provider_request_demand_support` | `p_demand_id uuid, p_message text` | `jsonb` | **SIM** |
| `DB-RPC-547` | `gsa_provider_request_profile_change` | `p_field text, p_new_value text, p_reason text` | `jsonb` | **SIM** |
| `DB-RPC-548` | `gsa_provider_request_withdrawal` | `p_valor numeric, p_tipo_chave_pix text, p_chave_pix text` | `jsonb` | **SIM** |
| `DB-RPC-549` | `gsa_provider_send_ticket_message` | `p_ticket_id uuid, p_message text DEFAULT NULL, p_attachment_reference text DEFAULT NULL, p_attachment_type text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-550` | `gsa_provider_session_access_state` | `` | `jsonb` | **SIM** |
| `DB-RPC-551` | `gsa_provider_session_actor` | `p_sessao_id uuid, p_session_token text` | `TABLE` | **SIM** |
| `DB-RPC-552` | `gsa_provider_submit_document` | `p_documento_id uuid, p_urls text[]` | `jsonb` | **SIM** |
| `DB-RPC-553` | `gsa_provider_transition_demand` | `p_demanda_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-554` | `gsa_provider_update_profile` | `p_telefone text, p_cep text, p_numero text, p_area_servico text` | `jsonb` | **SIM** |
| `DB-RPC-555` | `gsa_provider_write_audit` | `p_action text, p_target_type text DEFAULT NULL, p_target_id uuid DEFAULT NULL, p_details jsonb DEFAULT '{}'::jsonb` | `uuid` | **SIM** |
| `DB-RPC-556` | `gsa_provision_auth_identity_internal` | `p_ator_tipo text, p_ator_id uuid, p_ator_nome text, p_sessao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-557` | `gsa_public_affiliate_programs` | `` | `jsonb` | **SIM** |
| `DB-RPC-558` | `gsa_public_confirm_career_resume` | `p_protocol text, p_document text, p_storage_path text` | `jsonb` | **SIM** |
| `DB-RPC-559` | `gsa_public_consultar_protocolo` | `p_codigo text` | `jsonb` | **SIM** |
| `DB-RPC-560` | `gsa_public_create_brand_budget_v1` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-561` | `gsa_public_create_enterprise_budget` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-562` | `gsa_public_create_enterprise_budget_v2` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-563` | `gsa_public_create_vaquinha_contribution` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-564` | `gsa_public_get_career_application` | `p_protocol text, p_document text` | `jsonb` | **SIM** |
| `DB-RPC-565` | `gsa_public_list_active_ads` | `p_placement_code text DEFAULT 'ADS_PUBLIC_SHOWCASE'` | `SETOF` | **SIM** |
| `DB-RPC-566` | `gsa_public_list_career_vacancies` | `` | `jsonb` | **SIM** |
| `DB-RPC-567` | `gsa_public_lookup_referral` | `p_token text` | `jsonb` | **SIM** |
| `DB-RPC-568` | `gsa_public_register_affiliate` | `p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-569` | `gsa_public_register_client` | `p_referral_token text, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-570` | `gsa_public_register_provider` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-571` | `gsa_public_register_supplier` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-572` | `gsa_public_registration_settings` | `` | `jsonb` | **SIM** |
| `DB-RPC-573` | `gsa_public_resgatar_beneficio_parceiro` | `p_parceiro_id uuid DEFAULT NULL, p_parceiro_slug text DEFAULT NULL, p_nome_completo text DEFAULT NULL, p_telefone text DEFAULT NULL, p_cliente_id uuid DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-574` | `gsa_public_resgatar_beneficio_parceiro_em_analise` | `p_parceiro_id uuid DEFAULT NULL, p_parceiro_slug text DEFAULT NULL, p_nome_completo text DEFAULT NULL, p_telefone text DEFAULT NULL, p_cliente_id uuid DEFAULT NULL, p_email text DEFAULT NULL, p_justificativa text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-575` | `gsa_public_service_catalog` | `p_audience text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-576` | `gsa_public_site_campaign_event` | `p_campaign_id uuid, p_event_type text, p_page text DEFAULT '/', p_device text DEFAULT 'desktop', p_audience text DEFAULT 'guests', p_viewer_hash text DEFAULT NULL, p_session_hash text DEFAULT NULL, p_actor_id text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-577` | `gsa_public_site_campaigns` | `p_page text DEFAULT '/', p_device text DEFAULT 'desktop', p_audience text DEFAULT 'guests', p_viewer_hash text DEFAULT NULL, p_session_hash text DEFAULT NULL, p_actor_id text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-578` | `gsa_public_submit_advertising_request` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-579` | `gsa_public_submit_career_application` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-580` | `gsa_public_track_affiliate_click` | `p_codigo text, p_visitante_token text, p_landing_path text, p_referrer_host text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-581` | `gsa_public_validate_advertising_protocol` | `p_protocol text` | `jsonb` | **SIM** |
| `DB-RPC-582` | `gsa_reactivate_client_after_pin` | `p_client_id uuid` | `void` | **SIM** |
| `DB-RPC-583` | `gsa_record_auth_attempt` | `p_escopo text, p_chave_hash text, p_sucesso boolean` | `void` | **SIM** |
| `DB-RPC-584` | `gsa_recuperar_senha_cliente` | `p_documento text, p_email text` | `jsonb` | **SIM** |
| `DB-RPC-585` | `gsa_refresh_travel_financial_summary` | `p_transacao_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-586` | `gsa_register_affiliate_account` | `p_payload jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-587` | `gsa_registrar_pendencia_whatsapp` | `p_cliente_id UUID, p_telefone TEXT, p_modulo TEXT, p_registro_id TEXT, p_tipo_esperado TEXT, p_mensagem_contexto TEXT DEFAULT NULL` | `JSONB` | **SIM** |
| `DB-RPC-588` | `gsa_release_due_store_credit_for_client` | `p_cliente_id UUID` | `INTEGER` | **SIM** |
| `DB-RPC-589` | `gsa_replace_product_variations` | `p_produto_id uuid, p_variacoes jsonb` | `jsonb` | **SIM** |
| `DB-RPC-590` | `gsa_request_ip` | `` | `text` | **SIM** |
| `DB-RPC-591` | `gsa_request_travel_cancellation` | `p_sessao_id UUID, p_session_token TEXT, p_transacao_id UUID, p_motivo TEXT` | `JSONB` | **SIM** |
| `DB-RPC-592` | `gsa_request_travel_cancellation_core` | `p_sessao_id uuid, p_session_token text, p_request_id uuid, p_transacao_id uuid, p_motivo text` | `jsonb` | **SIM** |
| `DB-RPC-593` | `gsa_require_admin_actor` | `p_sessao_id UUID, p_session_token TEXT` | `TABLE` | **SIM** |
| `DB-RPC-594` | `gsa_revoke_client_sessions_on_access_change` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-595` | `gsa_revoke_collaborator_session_on_modules` | `` | `trigger` | **SIM** |
| `DB-RPC-596` | `gsa_revoke_collaborator_session_on_status` | `` | `trigger` | **SIM** |
| `DB-RPC-597` | `gsa_revoke_provider_sessions_on_access_change` | `` | `trigger` | **SIM** |
| `DB-RPC-598` | `gsa_saude_registrar_comissao_ativacao` | `` | `trigger` | **SIM** |
| `DB-RPC-599` | `gsa_schedule_partner_appeal_sla_notifications` | `` | `integer` | **SIM** |
| `DB-RPC-600` | `gsa_seed_default_service_catalog` | `p_packages jsonb` | `integer` | **SIM** |
| `DB-RPC-601` | `gsa_seguros_registrar_comissao_ativacao` | `` | `trigger` | **SIM** |
| `DB-RPC-602` | `gsa_service_catalog_package_json` | `p_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-603` | `gsa_service_catalog_payload` | `p_publico text DEFAULT NULL, p_include_inactive boolean DEFAULT false` | `jsonb` | **SIM** |
| `DB-RPC-604` | `gsa_set_pin_and_login` | `p_documento text, p_telefone text, p_pin text, p_tipo text` | `jsonb` | **SIM** |
| `DB-RPC-605` | `gsa_set_travel_proposal_passenger_count` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-606` | `gsa_shopee_enqueue_from_paid_invoice` | `` | `trigger` | **SIM** |
| `DB-RPC-607` | `gsa_shopee_enqueue_paid_order` | `p_orcamento_id uuid` | `uuid` | **SIM** |
| `DB-RPC-608` | `gsa_shopee_worker_by_token` | `p_worker_token text` | `public` | **SIM** |
| `DB-RPC-609` | `gsa_shopee_worker_claim` | `p_worker_token text, p_lease_minutes integer DEFAULT 30` | `jsonb` | **SIM** |
| `DB-RPC-610` | `gsa_shopee_worker_heartbeat` | `p_worker_token text, p_job_id uuid DEFAULT NULL, p_lease_minutes integer DEFAULT 30` | `jsonb` | **SIM** |
| `DB-RPC-611` | `gsa_shopee_worker_update_job` | `p_worker_token text, p_job_id uuid, p_status text, p_patch jsonb DEFAULT '{}'::jsonb` | `jsonb` | **SIM** |
| `DB-RPC-612` | `gsa_site_campaign_assert_action` | `p_action text` | `void` | **SIM** |
| `DB-RPC-613` | `gsa_site_campaign_cleanup_events` | `p_keep_days integer DEFAULT 400` | `jsonb` | **SIM** |
| `DB-RPC-614` | `gsa_site_campaign_has_action` | `p_action text` | `boolean` | **SIM** |
| `DB-RPC-615` | `gsa_site_campaign_page_matches` | `p_targets text[], p_page text` | `boolean` | **SIM** |
| `DB-RPC-616` | `gsa_site_campaign_permission_touch` | `` | `trigger` | **SIM** |
| `DB-RPC-617` | `gsa_site_campaign_refresh_states` | `` | `void` | **SIM** |
| `DB-RPC-618` | `gsa_site_campaign_safe_url` | `p_url text` | `boolean` | NÃO |
| `DB-RPC-619` | `gsa_site_campaign_touch_updated_at` | `` | `trigger` | NÃO |
| `DB-RPC-620` | `gsa_snapshot_store_order` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-621` | `gsa_snapshot_subscription_order` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-622` | `gsa_solicitar_pin_whatsapp` | `p_telefone text` | `text` | **SIM** |
| `DB-RPC-623` | `gsa_start_session` | `p_ator_tipo text, p_ator_id uuid, p_ator_nome text, p_metadata jsonb DEFAULT '{}'::jsonb` | `TABLE` | **SIM** |
| `DB-RPC-624` | `gsa_supplier_dashboard_snapshot` | `` | `jsonb` | **SIM** |
| `DB-RPC-625` | `gsa_supplier_document_allowed` | `p_name text, p_write boolean DEFAULT false` | `boolean` | **SIM** |
| `DB-RPC-626` | `gsa_supplier_mark_notification_read` | `p_notification_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-627` | `gsa_supplier_mark_notifications_read` | `` | `jsonb` | **SIM** |
| `DB-RPC-628` | `gsa_supplier_mark_order_seen` | `p_order_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-629` | `gsa_supplier_request_product` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-630` | `gsa_supplier_session_access_state` | `` | `jsonb` | **SIM** |
| `DB-RPC-631` | `gsa_supplier_submit_delivery` | `p_request_id uuid, p_order_id uuid, p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-632` | `gsa_supplier_update_profile` | `p_payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-633` | `gsa_sync_admin_operation_request_columns` | `` | `trigger` | **SIM** |
| `DB-RPC-634` | `gsa_sync_colaborador_modules` | `p_colaborador_id uuid` | `void` | **SIM** |
| `DB-RPC-635` | `gsa_sync_colaborador_modules_trigger` | `` | `trigger` | **SIM** |
| `DB-RPC-636` | `gsa_sync_demand_comment_count` | `` | `trigger` | **SIM** |
| `DB-RPC-637` | `gsa_sync_travel_invoice_financials` | `` | `trigger` | **SIM** |
| `DB-RPC-638` | `gsa_touch_classified_commission_config` | `` | `trigger` | NÃO |
| `DB-RPC-639` | `gsa_touch_classified_row` | `` | `trigger` | NÃO |
| `DB-RPC-640` | `gsa_touch_parceiros_updated_at` | `` | `trigger` | **SIM** |
| `DB-RPC-641` | `gsa_touch_partner_redemption_public_status` | `p_resgate_id uuid` | `void` | **SIM** |
| `DB-RPC-642` | `gsa_touch_product_variation_updated_at` | `` | `trigger` | NÃO |
| `DB-RPC-643` | `gsa_touch_service_package_updated_at` | `` | `trigger` | **SIM** |
| `DB-RPC-644` | `gsa_travel_expected_passengers` | `p_snapshot JSONB` | `INTEGER` | NÃO |
| `DB-RPC-645` | `gsa_travel_invoice_is_open` | `p_status text` | `boolean` | **SIM** |
| `DB-RPC-646` | `gsa_travel_invoice_is_paid` | `p_status text` | `boolean` | NÃO |
| `DB-RPC-647` | `gsa_travel_safe_nonnegative_int` | `p_value TEXT` | `INTEGER` | **SIM** |
| `DB-RPC-648` | `gsa_travel_safe_uuid` | `p_value text` | `uuid` | NÃO |
| `DB-RPC-649` | `gsa_trg_produtos_discount_calc` | `` | `trigger` | NÃO |
| `DB-RPC-650` | `gsa_trigger_set_product_code` | `` | `trigger` | NÃO |
| `DB-RPC-651` | `gsa_tv_admin_context` | `p_sessao_id uuid, p_session_token text` | `jsonb` | **SIM** |
| `DB-RPC-652` | `gsa_tv_enqueue_media_probe` | `` | `trigger` | **SIM** |
| `DB-RPC-653` | `gsa_tv_execution_complete_rollup` | `` | `trigger` | NÃO |
| `DB-RPC-654` | `gsa_tv_guard_automation_compile` | `` | `trigger` | NÃO |
| `DB-RPC-655` | `gsa_tv_materialize_fixed_schedule` | `p_broadcast_date date, p_channel_id text DEFAULT 'ch-main'` | `jsonb` | **SIM** |
| `DB-RPC-656` | `gsa_tv_media_delete_guard` | `` | `trigger` | NÃO |
| `DB-RPC-657` | `gsa_tv_production_signature` | `p_version uuid` | `text` | NÃO |
| `DB-RPC-658` | `gsa_tv_refresh_fixed_schedule_horizon` | `p_start_date date DEFAULT (CURRENT_DATE+1), p_days integer DEFAULT 30, p_channel_id text DEFAULT 'ch-main'` | `jsonb` | **SIM** |
| `DB-RPC-659` | `gsa_tv_write_audit` | `p_context jsonb, p_channel_id text, p_action text, p_resource_type text, p_resource_id text, p_details jsonb DEFAULT '{}'::jsonb` | `void` | **SIM** |
| `DB-RPC-660` | `gsa_update_client_pin` | `p_sessao_id uuid, p_session_token text, p_new_pin text` | `jsonb` | **SIM** |
| `DB-RPC-661` | `gsa_validar_pin_whatsapp` | `p_telefone text,p_pin text` | `boolean` | **SIM** |
| `DB-RPC-662` | `gsa_validate_product_catalog_row` | `` | `trigger` | NÃO |
| `DB-RPC-663` | `gsa_validate_provider_operational_row` | `` | `trigger` | **SIM** |
| `DB-RPC-664` | `gsa_validate_service_invoice_link` | `` | `trigger` | NÃO |
| `DB-RPC-665` | `gsa_validate_session` | `p_sessao_id uuid, p_session_token text` | `TABLE` | **SIM** |
| `DB-RPC-666` | `gsa_validate_subscription_catalog_row` | `` | `trigger` | NÃO |
| `DB-RPC-667` | `gsa_verify_own_pin` | `p_sessao_id uuid, p_session_token text, p_pin text` | `boolean` | **SIM** |
| `DB-RPC-668` | `gsa_verify_provider_registration_challenge` | `p_challenge_id uuid, p_telefone text, p_code_hash text` | `jsonb` | **SIM** |
| `DB-RPC-669` | `gsa_webhook_solicitar_saque_cliente` | `p_cliente_id uuid, p_tipo_chave_pix text, p_chave_pix text, p_valor numeric DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-670` | `handle_realtime_notifications` | `` | `TRIGGER` | NÃO |
| `DB-RPC-671` | `increment_comentarios` | `demanda_id_param uuid` | `void` | **SIM** |
| `DB-RPC-672` | `liberar_credito_loja_assinado` | `p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-673` | `pagar_fatura_cliente` | `payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-674` | `prevent_saldo_tampering` | `` | `TRIGGER` | **SIM** |
| `DB-RPC-675` | `process_expired_quitacoes` | `` | `void` | **SIM** |
| `DB-RPC-676` | `prorrogar_assinatura_cliente` | `p_ordem_assinatura_id uuid, p_cliente_id uuid, p_meses integer` | `jsonb` | **SIM** |
| `DB-RPC-677` | `resgatar_voucher_carteira` | `p_voucher_id uuid, p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-678` | `rpc_admin_concluir_transacao_classificado` | `p_transacao_id UUID` | `JSONB` | NÃO |
| `DB-RPC-679` | `rpc_admin_moderar_mensagem_classificado` | `p_mensagem_id UUID, p_acao VARCHAR, -- 'approve' ou 'reject' p_motivo_rejeicao TEXT DEFAULT NULL` | `JSONB` | NÃO |
| `DB-RPC-680` | `rpc_criar_anuncio_classificado` | `p_cliente_id UUID, p_categoria VARCHAR, p_titulo VARCHAR, p_descricao TEXT, p_preco DECIMAL, p_cidade VARCHAR, p_estado VARCHAR, p_bairro VARCHAR, p_detalhes JSONB, p_comissao_aceita DECIMAL, p_midias JSONB -- Array de objetos com {url, tipo, ordem}` | `JSONB` | **SIM** |
| `DB-RPC-681` | `rpc_criar_proposta_classificado` | `p_anuncio_id uuid, p_comprador_id uuid, p_valor_proposta numeric, p_mensagem text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-682` | `rpc_enviar_mensagem_classificado` | `p_proposta_id uuid, p_remetente_id uuid, p_conteudo text` | `jsonb` | **SIM** |
| `DB-RPC-683` | `rpc_enviar_proposta_classificado` | `p_anuncio_id UUID, p_comprador_id UUID, p_valor_proposta DECIMAL, p_mensagem_inicial TEXT` | `JSONB` | NÃO |
| `DB-RPC-684` | `rpc_moderar_mensagem_classificado` | `p_mensagem_id uuid, p_proposta_id uuid, p_acao text` | `jsonb` | **SIM** |
| `DB-RPC-685` | `rpc_reenviar_anuncio_classificado` | `p_anuncio_id uuid, p_titulo text, p_descricao text, p_preco numeric, p_cidade text, p_estado text, p_bairro text, p_detalhes jsonb, p_midias jsonb` | `jsonb` | **SIM** |
| `DB-RPC-686` | `rpc_responder_proposta_classificado` | `p_proposta_id uuid, p_acao text, p_valor_contraproposta numeric DEFAULT NULL, p_motivo text DEFAULT NULL` | `jsonb` | **SIM** |
| `DB-RPC-687` | `secure_add_gamification_points` | `p_cliente_id UUID, p_pontos_gerados NUMERIC, p_descricao TEXT, p_tipo TEXT, p_fatura_id UUID DEFAULT NULL` | `JSONB` | NÃO |
| `DB-RPC-688` | `solicitar_saque_cliente` | `payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-689` | `solicitar_transferencia_cliente` | `payload jsonb` | `jsonb` | **SIM** |
| `DB-RPC-690` | `suprimir_bonus_boas_vindas_cliente` | `p_cliente_id uuid` | `jsonb` | **SIM** |
| `DB-RPC-691` | `sync_cliente_pontos_e_saldo` | `p_cliente_id UUID, p_pontos_delta INT DEFAULT 0, p_saldo_delta NUMERIC DEFAULT 0, p_descricao TEXT DEFAULT ''` | `JSONB` | **SIM** |
| `DB-RPC-692` | `trg_fn_update_produto_rating_summary` | `` | `TRIGGER` | NÃO |

---

## 11. INVENTÁRIO DE SUPABASE EDGE FUNCTIONS (`API-EDGE-*` — 17 FUNÇÕES)

| ID | Nome da Função | Entrypoint | Método | Propósito Funcional |
|---|---|---|---|---|
| `API-EDGE-001` | `cloudflare-api` | `supabase/functions/cloudflare-api/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-002` | `gsa-ads-admin` | `supabase/functions/gsa-ads-admin/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-003` | `gsa-ads-public` | `supabase/functions/gsa-ads-public/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-004` | `gsa-auth-session` | `supabase/functions/gsa-auth-session/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-005` | `gsa-careers-notifications` | `supabase/functions/gsa-careers-notifications/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-006` | `gsa-classified-media` | `supabase/functions/gsa-classified-media/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-007` | `gsa-free-tools` | `supabase/functions/gsa-free-tools/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-008` | `gsa-partner-application` | `supabase/functions/gsa-partner-application/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-009` | `gsa-payments` | `supabase/functions/gsa-payments/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-010` | `gsa-product-import` | `supabase/functions/gsa-product-import/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-011` | `gsa-public-budget` | `supabase/functions/gsa-public-budget/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-012` | `gsa-transactional-email` | `supabase/functions/gsa-transactional-email/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-013` | `gsa-trigger-webhook` | `supabase/functions/gsa-trigger-webhook/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-014` | `gsa-tv-proxy` | `supabase/functions/gsa-tv-proxy/index.ts` | `GET/POST` | Execução serverless Deno |
| `API-EDGE-015` | `gsa-whatsapp-inbound` | `supabase/functions/gsa-whatsapp-inbound/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-016` | `ssh-proxy` | `supabase/functions/ssh-proxy/index.ts` | `POST` | Execução serverless Deno |
| `API-EDGE-017` | `vps-api` | `supabase/functions/vps-api/index.ts` | `POST` | Execução serverless Deno |

---

## 12. INVENTÁRIO DE WEBHOOKS & ROTAS DO DAEMON VPS (`API-WH-*` — 15 ROTAS)

| ID | Rota / Caminho | Método | Manipulador | Propósito Operacional |
|---|---|---|---|---|
| `API-WH-001` | `/` | `GET` | `Health Check` | Liveness heartbeat, active sessions count and server info |
| `API-WH-002` | `/health` | `GET` | `Health Check` | Liveness check alias |
| `API-WH-003` | `/ping` | `GET` | `Health Check` | Fast latency ping probe |
| `API-WH-004` | `/feeds/viagens` | `GET` | `Travel Package Feed` | Returns JSON array of all national, international and promo travel packages |
| `API-WH-005` | `/feeds/viagens/nacionais` | `GET` | `National Travel Feed` | Returns curated national travel packages |
| `API-WH-006` | `/feeds/viagens/internacionais` | `GET` | `International Travel Feed` | Returns international travel packages |
| `API-WH-007` | `/feeds/viagens/promoc` | `GET` | `Promo Travel Feed` | Returns promotional and discounted packages |
| `API-WH-008` | `/feeds/viagens/*.csv` | `GET` | `CSV Travel Export` | Exports travel catalog as CSV with full pricing, days, nights, hotel tier |
| `API-WH-009` | `/api/dropship-search` | `GET` | `Dropship Product Search API` | Searches dropship catalog with query param ?q=, returns models with markup |
| `API-WH-010` | `/webhook` | `GET` | `Meta / WhatsApp Webhook Challenge Verification` | Verifies webhook challenge (hub.mode=subscribe & hub.verify_token) |
| `API-WH-011` | `/webhook` | `POST` | `Evolution API & Meta Webhook Message Receiver` | Receives incoming WhatsApp messages, dispatches through SessionMutex to Gemini/Chatbot |
| `API-WH-012` | `/webhook/supabase-update` | `POST` | `Supabase Realtime DB Webhook Handler` | Handles database change triggers dispatched from Supabase PostgreSQL |
| `API-WH-013` | `/webhook/gsa-produtos-scraping` | `POST` | `Product Scraping Webhook` | Receives scraped marketplace products from Shopee/external feeds |
| `API-WH-014` | `/webhook/gsa-viagens-scraping` | `POST` | `Travel Scraping Webhook` | Receives updated scraping feeds for airline flights and hotels |
| `API-WH-015` | `/webhook/scraping` | `POST` | `Generic Scraping Webhook` | Alias for scraping ingestion |

---

## 13. INTEGRAÇÕES EXTERNAS E ENDPOINTS REMOTOS (`API-END-*` — 10 INTEGRAÇÕES)

| ID | Serviço Integrado | URL / Endpoint Base | Método | Autenticação | Arquivo Fonte no Frontend |
|---|---|---|---|---|---|
| `API-END-001` | Evolution API WhatsApp Send Text | `http://147.15.43.141:8080/message/sendText/GSA_WhatsApp` | `POST` | `apikey header` | `src/utils/n8nWhatsApp.ts` |
| `API-END-002` | Evolution API WhatsApp Send Media | `http://147.15.43.141:8080/message/sendMedia/GSA_WhatsApp` | `POST` | `apikey header` | `src/utils/n8nWhatsApp.ts` |
| `API-END-003` | Evolution API Connection State Check | `http://147.15.43.141:8080/instance/connectionState/GSA_WhatsApp` | `GET` | `apikey header` | `src/lib/whatsappHealthService.ts` |
| `API-END-004` | n8n Webhook WhatsApp Fallback | `http://147.15.43.141:5678/webhook/send-whatsapp` | `POST` | `public webhook / header` | `src/utils/n8nWhatsApp.ts` |
| `API-END-005` | InfinitePay Checkout V2 Orders | `https://api.infinitepay.io/v2/transactions` | `POST` | `Bearer token` | `src/utils/infinitePay.ts` |
| `API-END-006` | Cloudflare R2 Public CDN | `https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev` | `GET` | `Public` | `src/lib/r2Storage.ts` |
| `API-END-007` | Cloudflare R2 Worker Auth Proxy | `https://gsa-hub-r2-worker.r2-handler.workers.dev` | `GET/POST/PUT/DELETE` | `x-gsa-session-id, x-gsa-session-token` | `src/lib/r2StorageWorkerClient.ts` |
| `API-END-008` | Google Gemini 3.5 Flash NLU | `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent` | `POST` | `GEMINI_API_KEY query param` | `server_webhook.cjs` |
| `API-END-009` | ViaCEP Postal Code Lookup | `https://viacep.com.br/ws/{cep}/json/` | `GET` | `Public` | `src/components/client/AddressStep.tsx` |
| `API-END-010` | BrasilAPI CNPJ Lookup | `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` | `GET` | `Public` | `src/utils/documentValidation.ts` |

---
