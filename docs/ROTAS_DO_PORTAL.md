# Manifesto de Rotas - Portal GSA

Este documento mapeia e explica a nova arquitetura centralizada de roteamento implementada no Portal GSA. Toda a navegação do sistema é agora sincronizada em tempo real com a URL do navegador.

## Arquitetura de Roteamento (`src/routing/`)

A base do roteamento foi construída usando TypeScript e APIs nativas do HTML5 History (`pushState`, `replaceState` e evento `popstate`), dispensando bibliotecas pesadas e garantindo compatibilidade retroativa.

Os seguintes arquivos compõem o ecossistema:

1. [types.ts](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20%284%29/src/routing/types.ts): Definições de tipos e interfaces das áreas do sistema (`public`, `marketplace`, `client`, `admin`, `prestador`).
2. [routeCatalog.ts](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20%284%29/src/routing/routeCatalog.ts): Catálogo canônico gerador de links dinâmicos e tipados.
3. [routeMatcher.ts](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20%284%29/src/routing/routeMatcher.ts): Parser reverso de URL que traduz strings em estruturas de estado.
4. [navigationService.ts](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20%284%29/src/routing/navigationService.ts): Envoltório centralizado para mudanças de URL que notifica listeners reativos.
5. [useAppLocation.ts](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20%284%29/src/routing/useAppLocation.ts): Hook React reativo utilizado pelos componentes para monitorar a URL.
6. [legacyRouteResolver.ts](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20%284%29/src/routing/legacyRouteResolver.ts): Camada de compatibilidade retroativa para URLs antigas com query strings (`?module=x&tab=y`).
7. [routeSecurity.ts](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20%284%29/src/routing/routeSecurity.ts): Proteção de áreas por nível de acesso (Cliente, Admin, Prestador).

---

## Catálogo Completo de Rotas

### 1. Rotas Públicas (Sem Autenticação)
- `/login`: Tela de autenticação unificada.
- `/registro`: Cadastro de novos usuários.
- `/recuperar-senha`: Fluxo de redefinição de credenciais.

### 2. Rotas do Marketplace (`/marketplace`)
- `/marketplace`: Landing Page da loja GSA Store.
- `/marketplace/menu`: Menu principal com os 3 módulos (Loja, Viagens, Classificados).
- `/marketplace/menu/loja/produtos`: Aba de listagem de produtos.
- `/marketplace/menu/loja/assinaturas`: Aba de listagem de assinaturas.
- `/marketplace/menu/loja/produtos/:produtoId`: Detalhes de um produto físico específico (abre em modal).
- `/marketplace/menu/loja/assinaturas/:assinaturaId`: Detalhes de uma assinatura de serviço (abre em modal).
- `/marketplace/menu/viagens`: Landing page estilosa do módulo "Pacotes de Viagem".
- `/marketplace/menu/classificados`: Hub do módulo "Classificados".

#### Parâmetros de Consulta (Queries da Loja)
- `?busca=termo`: Filtro de texto para pesquisa.
- `?categoria=id`: Filtro de categoria selecionada.
- `?precoMin=valor`: Filtro de preço mínimo.
- `?precoMax=valor`: Filtro de preço máximo.
- `?ordenacao=opcao`: Critério de ordenação (`price-asc`, `price-desc`, `alpha-asc`, etc.).
- `?modal=carrinho`: Abre a gaveta de itens no carrinho.
- `?modal=checkout`: Abre o fluxo de checkout e pagamento.
- `?modal=filtros`: Abre o modal de filtros avançados.

### 3. Rotas do Portal do Cliente (`/cliente/`)
- `/cliente/dashboard`: Tela inicial com visão geral.
- `/cliente/perfil`: Edição de perfil do cliente.
- `/cliente/servicos-e-assinaturas`: Gestão de serviços, orçamentos e assinaturas.
- `/cliente/financeiro`: Extratos, saques, faturas e crédito loja.
- `/cliente/fidelidade`: Vouchers, pontos, cashback e área VIP.
- `/cliente/suporte`: Chat de tickets com suporte da GSA.

### 4. Rotas do Painel Administrativo (`/admin/`)
- `/admin/dashboard`: Monitor de métricas gerais e lucros.
- `/admin/clientes`: Gestão e auditoria de clientes cadastrados.
- `/admin/produtos`: Cadastro e precificação do catálogo da loja.
- `/admin/orcamentos`: Gestão operacional de orçamentos e ordens de serviço.
- `/admin/financeiro`: Acompanhamento de faturas, depósitos e caixas.
- `/admin/atendimento`: Resolução de tickets de suporte abertos por clientes/prestadores.
- `/admin/relatorios`: Painéis de Business Intelligence e exportações.
- `/admin/configuracoes`: Parâmetros e limites do sistema.
- `/admin/acessos`: Gestão de permissões de colaboradores e RLS.
- `/admin/sistema`: Telemetria de integridade e logs do sistema.

### 5. Rotas do Portal do Prestador (`/prestador/`)
- `/prestador/dashboard`: Indicadores de ganhos e resumo diário.
- `/prestador/demandas`: Listagem de ordens de serviço e chamados disponíveis.
- `/prestador/agenda`: Escala e compromissos agendados.
- `/prestador/financeiro`: Extrato de repasses e histórico de saques realizados.
- `/prestador/documentos`: Envio de CNH, RG e comprovante de residência.
- `/prestador/beneficios`: Vouchers e vantagens de fidelidade.
- `/prestador/suporte`: Atendimento direto com a equipe operacional.
