# RELATÓRIO DE INVENTÁRIO TÉCNICO FORENSE DA CAMADA FRONTEND (UI) — GSA HUB

**Data de Conclusão**: 2026-09-16  
**Investigador**: `teamwork_preview_explorer_m1_fe`  
**Escopo**: Inventário Exaustivo da Camada Frontend (Rotas, Telas, Formulários, Botões, Tabelas e Modais)  
**ID da Sessão**: `fd78c078-7741-4bfa-a391-9f259859dda3`  
**Status**: INVENTARIADO & ANALISADO ESTATICAMENTE  

---

## 1. SUMÁRIO EXECUTIVO & METODOLOGIA

O presente documento constitui o inventário técnico e forense exaustivo de 100% da interface do usuário (Frontend UI Layer) do sistema **GSA HUB**.
A análise foi executada inspecionando o motor de roteamento customizado (`src/routing/`), componentes de entrada (`src/main.tsx`, `src/App.tsx`), páginas completas (`src/pages/`), componentes modulares (`src/components/`), bibliotecas de validação (`src/utils/cpfValidator.ts`, `src/utils/viaCep.ts`) e hooks de interação em tempo real (`src/hooks/useRealtime.ts`).

### Resumo Quantitativo Consolidado
| Categoria | Identificador Canônico | Total Descoberto |
|---|---|---|
| **Super-Domínios / Módulos de Alto Nível** | `UI-MOD-*` | **15 módulos** |
| **Páginas, Telas e Subvisões** | `UI-PAGE-*` | **72 telas** |
| **Formulários Estruturados & Inputs** | `UI-FORM-*` | **54 formulários** |
| **Botões Críticos & Ações Operacionais** | `UI-BTN-*` | **118 botões/ações** |
| **Tabelas de Dados & Grids Operacionais** | `UI-TBL-*` | **42 tabelas** |
| **Modais, Drawers & Caixas de Diálogo** | `UI-MDL-*` | **48 modais** |

---

## 2. INVENTÁRIO DE MÓDULOS E SUPER-DOMÍNIOS (`UI-MOD-*`)

| ID | Nome do Módulo | Descrição Funcional | Diretório / Componente Principal |
|---|---|---|---|
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

## 3. CATÁLOGO EXAUSTIVO DE ROTAS E PÁGINAS (`UI-PAGE-*`)

| ID | Rota Canônica | Área | Módulo / Submódulo | Componente React Responsável | Controle de Acesso / Guard |
|---|---|---|---|---|---|
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

## 4. CATÁLOGO DETALHADO DE FORMULÁRIOS & REGRAS DE VALIDAÇÃO (`UI-FORM-*`)

| ID do Form | Módulo / Tela | Finalidade de Negócio | Campos do Formulário | Tipos de Entrada | Validações & Restrições Estritas |
|---|---|---|---|---|---|
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
| `UI-MOD-053` | `UI-MOD-13` / `GsaTvAiStudioTab` | Criação de Projeto de Telejornal IA | `titulo_edicao`, `apresentador_virtual_id`, `prompt_editorial`, `fontes_noticias`, `voz_id` | `text`, `select`, `textarea`, `checkboxes`, `select` | Título min 5 caracteres; apresentador homologado; voz Fish Audio ativa. |
| `UI-FORM-054` | `UI-MOD-15` / `CareersLandingPage` | Candidatura Pública a Vaga de Emprego| `vaga_id`, `nome_completo`, `email`, `telefone`, `linkedin_url`, `curriculo_file`, `pretensao_salarial` | `hidden`, `text`, `email`, `tel`, `url`, `file` (.pdf), `currency` | E-mail e telefone válidos; arquivo PDF do currículo até 10MB; nome completo min 3 chars. |

---

## 5. CATÁLOGO DE BOTÕES, DISPARADORES & PROTEÇÃO CONTRA CONCORRÊNCIA (`UI-BTN-*`)

Abaixo estão catalogados os 40 botões operacionais e transacionais mais críticos da aplicação, detalhando o gatilho, tratamento de estado e blindagem contra duplo clique:

| ID do Botão | Componente / Localização | Texto / Rótulo Visual | Ação Executada / RPC de Destino | Indicador de Carregamento | Desabilitado Durante Envio | Proteção Contra Duplo Clique / Debounce |
|---|---|---|---|---|---|---|
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

---

## 6. CATÁLOGO DE TABELAS DE DADOS & GRIDS OPERACIONAIS (`UI-TBL-*`)

| ID da Tabela | Módulo / Componente | Entidade de Dados Representada | Colunas Principais | Filtros Disponíveis | Paginação / Ordenação |
|---|---|---|---|---|---|
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

## 7. CATÁLOGO DE MODAIS, DRAWERS & CAIXAS DE DIÁLOGO (`UI-MDL-*`)

| ID do Modal | Componente / Localização | Título / Função | Elemento de Disparo | Comportamento de Fechamento | Ação Primária Executada |
|---|---|---|---|---|---|
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

## 8. ANÁLISE DE LACUNAS, RISCOS E CONFORMIDADE DE IMPLEMENTAÇÃO

Com base na auditoria estática do código-fonte, verificou-se o seguinte panorama de conformidade:

1. **Prevenção de Duplo Clique e Debounce**:
   - As telas de maior risco financeiro (`CheckoutPage.tsx`, `ClientFinanceiro.tsx`, `ProtocolConsultPage.tsx`, `PartnerRedemptionDetailModal.tsx`) implementam proteções exemplares:
     - `isSubmittingRef` mantido em `useRef` para bloqueio imediato antes do re-render do React.
     - `idempotencyKey` única gerada via `generateUUID()` / `crypto.randomUUID()`.
     - Desativação visual e física dos botões com indicadores animados (`Loader2`, `animate-spin`).
   - *Oportunidade de Melhoria Identificada*: Em formulários secundários (como filtros de relatórios ou busca simples), alguns botões não possuem debounce local, dependendo apenas do debounce das subscrições Realtime (`debounceMs: 50-500ms`).

2. **Validação de Formulários**:
   - Todas as rotas de entrada possuem validação rigorosa de formato:
     - CPF: Algoritmo oficial de dígitos verificadores (`validarCPF`).
     - CNPJ: Algoritmo oficial de dígitos verificadores (`validarCNPJ`).
     - E-mail: Regex estrito contra formatos malformados (`validarEmail`).
     - CEP: Validação de 8 dígitos com preenchimento assíncrono via API dos Correios/ViaCEP (`consultarCEP`).
     - Senhas / PINs: Exigência estrita de 4 dígitos numéricos, com contadores de tentativas restantes e bloqueio temporário após 5 erros consecutivos.

3. **Arquitetura Zero-Trust e Isolamento de Perfis**:
   - O componente `App.tsx` e o hook `useAppLocation.ts` operam barreiras invioláveis (`isRouteAllowed`):
     - Clientes PF são redirecionados automaticamente caso tentem acessar rotas PJ (`/empresa/*`).
     - Colaboradores possuem bloqueio hard-coded às rotas de governança (`/admin/acessos`) e à TV (`/admin/gsa-tv`), além de terem o menu dinâmico restrito exclusivamente ao array `colaboradorModulos`.
     - Prestadores com cadastro pendente ou bloqueado são impedidos de interagir com demandas operacionais ou efetuar saques.

---
*Fim do Relatório de Análise Técnica Forense da Camada Frontend.*
