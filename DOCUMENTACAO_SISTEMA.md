# DOCUMENTAÇÃO TÉCNICA CANÔNICA DO SISTEMA GSA HUB

**Data de Emissão**: 2026-09-11  
**Versão do Documento**: 2.4.0-Enterprise  
**Repositório Base**: `remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`  
**Classificação**: Documentação Técnica Central Unificada (Backend, Frontend, Banco de Dados e Módulos de Usuários)  

---

## SUMÁRIO GERAL

1. [Visão Geral da Arquitetura do Sistema GSA HUB](#1-visão-geral-da-arquitetura-do-sistema-gsa-hub)
   - 1.1 Missão e Escopo do Ecossistema
   - 1.2 Stack Tecnológica Consolidada
   - 1.3 Topologia de Infraestrutura & Serviços
   - 1.4 Princípios de Arquitetura e Modelo de Segurança Zero-Trust
2. [Mapeamento Profundo do Banco de Dados (Backend Supabase PostgreSQL)](#2-mapeamento-profundo-do-banco-de-dados-backend-supabase-postgresql)
   - 2.1 Histórico de Migrações e Inventário Global
   - 2.2 Catálogo Detalhado das 294 Tabelas por Domínio de Negócio (17 Domínios)
   - 2.3 Matriz de Políticas RLS (Row Level Security)
   - 2.4 Funções RPC e Lógicas Transacionais Críticas
   - 2.5 Triggers de Integridade, Auditoria e Revogação de Sessão
3. [Mapeamento da Arquitetura do Frontend (React 19)](#3-mapeamento-da-arquitetura-do-frontend-react-19)
   - 3.1 Ponto de Entrada, Bootstrap e Ciclo de Vida da Aplicação
   - 3.2 Motor de Roteamento Customizado (`src/routing/`)
   - 3.3 Camada Visual, Design System e UI Libraries
   - 3.4 Camada de Integração com Supabase (Lazy Proxy, Storage e RPC Rollback)
   - 3.5 Infraestrutura Realtime Canônica (`src/hooks/useRealtime.ts`)
   - 3.6 Integrações Externas, Webhooks & Armazenamento (WhatsApp, VPS Daemon, Cloudflare R2)
4. [Mapeamento Detalhado dos Módulos de Usuários (6 Perfis Obrigatórios)](#4-mapeamento-detalhado-dos-módulos-de-usuários-6-perfis-obrigatórios)
   - 4.1 Módulo 1: Administrador (Admin)
   - 4.2 Módulo 2: Cliente (Consumidor PF e PJ)
   - 4.3 Módulo 3: Fornecedor (Parceiro B2B)
   - 4.4 Módulo 4: Colaborador (Funcionário Interno em Sandbox RBAC)
   - 4.5 Módulo 5: Afiliado (Divulgador & Referral)
   - 4.6 Módulo 6: Prestador (Profissional Autônomo & Serviços de Campo)
5. [Conclusão & Métodos de Verificação Independente](#5-conclusão--métodos-de-verificação-independente)
   - 5.1 Diagnóstico Técnico Consolidado
   - 5.2 Comandos e Roteiros de Verificação Programática

---

## 1. VISÃO GERAL DA ARQUITETURA DO SISTEMA GSA HUB

### 1.1 Missão e Escopo do Ecossistema
O **GSA HUB** é uma plataforma corporativa multi-tenant e multi-ecossistema voltada à prestação de serviços integrados, intermediação de produtos físicos e digitais (Marketplace), concessão de microcrédito e empréstimos financeiros, planos corporativos (Saúde, Seguros e Viagens), gestão de publicidade digital e operação de canal linear de televisão e streaming com inteligência artificial (**GSA TV**).

A plataforma congrega seis perfis de usuários interdependentes que operam em tempo real:
1. **Administrador (Admin)**: Detentor do controle financeiro, fiscal, homologatório, governança de credenciais e auditoria de todo o ecossistema.
2. **Cliente (PF / PJ)**: Consumidor final de serviços, produtos do marketplace, benefícios de parceiros, carteira digital, pontos e programa de crédito próprio.
3. **Fornecedor**: Empresa parceira B2B responsável pelo fornecimento de mercadorias no atacado, cotações corporativas e reposição de estoque com envio de notas fiscais.
4. **Colaborador**: Membro interno da equipe operacional do Grupo GSA que executa demandas em sandbox restrito orientado a RBAC.
5. **Afiliado**: Divulgador remunerado por conversões de links parametrizados, comissionamento temporizado com carência de 30 dias e saques instantâneos via PIX.
6. **Prestador**: Profissional autônomo e técnico de campo que atende a ordens de serviço (OS), gerencia agenda sem conflitos e negocia honorários via propostas interativas.

---

### 1.2 Stack Tecnológica Consolidada

| Camada | Tecnologia Principal | Versão / Biblioteca | Responsabilidade Primária |
|---|---|---|---|
| **Frontend Framework** | React | 19.x (`^19.0.0`) | Renderização de interfaces reativas baseadas em componentes funcionais e hooks modernos. |
| **Linguagem Frontend** | TypeScript | `~5.7.2` | Tipagem estática rigorosa para rotas, contratos de API e modelos de entidades. |
| **Build & Tooling** | Vite | `^6.0.0` com `@vitejs/plugin-react` | Bundling ultrarrápido com Hot Module Replacement (HMR). |
| **Estilização & Tokens** | Tailwind CSS | v4 (`@tailwindcss/vite: ^4.1.14`) | Utilitários CSS de alta performance compilados nativamente com variáveis CSS enterprise. |
| **Componentes Base (UI)** | Radix UI | Primitivas headless completas | Acessibilidade WAI-ARIA para diálogos, menus, selects, tabs, tooltips e popovers. |
| **Animações e Efeitos** | Framer Motion & Motion | `framer-motion: ^12.35.0`, `motion: ^12.23.24` | Microinterações de UI, transições fluidas e contadores animados. |
| **Gráficos e BI** | Recharts | `^3.8.0` | Dashboards analíticos, evolução financeira, métricas de publicidade e faturamento. |
| **Data Fetching / Cache** | TanStack Query | `@tanstack/react-query: ^5.90.21` | Cache de requisições assíncronas, deduplicação e invalidação otimista de consultas. |
| **Backend & Banco** | Supabase / PostgreSQL | PostgreSQL 15+ / PostgREST | Banco relacional com RLS estrito, RPCs transacionais, autenticação e WebSocket Realtime. |
| **Microserviço Backend VPS** | Node.js | Runtime v20+ (`server_webhook.cjs`) | Daemon autônomo de 9.600+ linhas, mensageria de alta concorrência com SessionMutex e IA. |
| **Motor de Inteligência Artificial** | Google Gemini API | `gemini-3.5-flash-lite` | Assistente de vendas conversacional no WhatsApp e geração editorial de conteúdo para GSA TV. |
| **Infraestrutura de Mensageria** | Evolution API & n8n | v2.x / n8n workflow engine | Disparos transacionais no WhatsApp, simulação de presença humana e redundância tripla. |
| **Armazenamento de Arquivos** | Cloudflare R2 | Cloudflare Worker (`gsa-hub-r2-worker`) | Armazenamento de objetos com CDN global pública e bucket privado com URLs assinadas. |
| **Gateway de Pagamento PIX** | InfinitePay API | Checkout V2 REST | Emissão instantânea de QR Code dinâmico, PIX Copia-e-Cola e links de hosted checkout. |

---

### 1.3 Topologia de Infraestrutura & Serviços

```
                        ┌────────────────────────────────────────────────────────┐
                        │              Navegadores Clientes / SPA React 19       │
                        │   (Admin, Cliente, Fornecedor, Prestador, Afiliado)   │
                        └───────────────────────┬────────────────────────────────┘
                                                │ HTTPS / WebSocket
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         │                                      │                                      │
         ▼                                      ▼                                      ▼
┌──────────────────┐               ┌────────────────────────┐             ┌─────────────────────────┐
│  Cloudflare R2   │               │     VPS Dedicada       │             │   InfinitePay Gateway   │
│ CDN & R2 Worker  │               │   (Oracle Cloud Linux) │             │ (PIX Dinâmico / Cartão) │
│                  │               │     147.15.43.141      │             └─────────────────────────┘
│ - Public Assets  │               └───────────┬────────────┘
│ - Private Docs   │                           │
│ (Signed URLs)    │         ┌─────────────────┼─────────────────┐
└──────────────────┘         │                 │                 │
                             ▼                 ▼                 ▼
                    ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
                    │ Supabase PostgREST│ │Evolution API│ │ Microserviço    │
                    │ & Realtime WSS  │ │ (WhatsApp)  │ │ server_webhook  │
                    │ Portas 3001/8000│ │ Porta 8080  │ │ Porta 5680      │
                    └────────┬────────┘ └─────────────┘ └────────┬────────┘
                             │                                   │
                             ▼                                   ▼
                    ┌─────────────────┐                 ┌─────────────────┐
                    │   PostgreSQL    │                 │  Google Gemini  │
                    │ 294 Tabelas     │                 │   3.5 Flash     │
                    │ 685 RPCs / RLS  │                 │   (IA Engine)   │
                    └─────────────────┘                 └─────────────────┘
```

A topologia de produção está ancorada em uma VPS Oracle Cloud Linux (`147.15.43.141`), acessível via domínio com certificado SSL (`api.147-15-43-141.nip.io`). A infraestrutura congrega os seguintes serviços em portas padronizadas:
- **Porta 3001 / 8000**: Instância do Supabase PostgREST, Auth e Realtime WebSocket Server.
- **Porta 8080**: Gateway da Evolution API para envio e recebimento de mensagens WhatsApp.
- **Porta 5678**: Instância do n8n para orquestração visual de fluxos de mensageria assíncrona.
- **Porta 5680**: Microserviço autônomo `server_webhook.cjs`, responsável pela fila concorrente `SessionMutex`, processamento de webhooks e integração com Gemini.
- **Cloudflare R2**: Substituto de S3 distribuído mundialmente com CDN pública (`https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev`) e worker seguro de intermediação autenticada (`gsa-hub-r2-worker.r2-handler.workers.dev`).

---

### 1.4 Princípios de Arquitetura e Modelo de Segurança Zero-Trust

1. **Zero-Trust Client Operations**:
   O frontend (executado no navegador do usuário) é expressamente tratado como um ambiente hostil e não confiável. O cliente React nunca envia comandos SQL diretos (`INSERT`, `UPDATE`, `DELETE`) para tabelas transacionais ou financeiras. Todas as mutações operacionais passam por duas camadas de blindagem:
   - Funções RPC `SECURITY DEFINER` protegidas com `SET search_path = public, pg_temp`.
   - Injeção obrigatória dos parâmetros criptográficos de sessão: `p_sessao_id (UUID)` e `p_session_token (TEXT)`.
2. **Autorização Centralizada no Banco de Dados**:
   O banco de dados não confia nos dados de identificação enviados no corpo do JSON pelo cliente (ex: `cliente_id` vindo de formulário). A identidade do ator é extraída de forma inviolável a partir do JWT autenticado ou da tabela `sistema_sessoes` através das funções helper canônicas:
   ```sql
   public.gsa_jwt_actor_type() -- Retorna 'cliente' | 'admin' | 'colaborador' | 'prestador' | 'fornecedor' | 'afiliado'
   public.gsa_jwt_actor_id()   -- Retorna o UUID da entidade correspondente
   ```
3. **Atomicidade e Isolamento Transacional (ACID Estrito)**:
   Operações que envolvem concorrência (como checkout simultâneo do mesmo SKU ou devolução com estorno financeiro e de pontos) utilizam cláusulas `SELECT ... FOR UPDATE` ordenadas para evitar deadlocks e impedir completamente a venda de produtos sem estoque ou o estorno parcial de recursos.
4. **Auditoria e Regra dos Dois Homens**:
   Exclusões de dados críticos ou modificações sensíveis no cadastro de colaboradores e clientes não ocorrem por deleção física imediata. O sistema implementa uma fila de aprovação na tabela `solicitacoes_exclusao`, exigindo aprovação prévia de um segundo administrador.

---

## 2. MAPEAMENTO PROFUNDO DO BANCO DE DADOS (BACKEND SUPABASE POSTGRESQL)

### 2.1 Histórico de Migrações e Inventário Global

O banco de dados é governado por uma esteira de infraestrutura como código (IaC) armazenada no diretório `supabase/migrations/`:
- **Quantidade de Arquivos de Migração**: **398 arquivos SQL**.
- **Esquema Mestre Inicial**: `master_supabase_schema.sql` (826 linhas), que estabeleceu a estrutura original de ERP e CRM.
- **Inventário Extraído por Parser AST / Inspeção Formal**:
  - **Tabelas Totais**: **294 tabelas relacionais**.
  - **Funções / RPCs**: **685 funções PostgreSQL** (procedimentos armazenados `SECURITY DEFINER`).
  - **Triggers Ativos**: **109 gatilhos de integridade e auditoria**.
  - **Declarações de Políticas RLS**: **378 políticas de Row Level Security**.
- **Validação de Conformidade**:
  O script oficial `scripts/validate-db-schema.cjs --snapshot-only` atesta a integridade absoluta dos contratos de esquema, colunas, RPCs e permissões (`Status do Schema: PASSED | Bloqueadores: 0 | Alertas: 0`).

---

### 2.2 Catálogo Detalhado das 294 Tabelas por Domínio de Negócio (17 Domínios)

As 294 tabelas foram consolidadas em 17 domínios funcionais de alta coesão:

```
                                  MAPA DE DOMÍNIOS DE DADOS (294 TABELAS)
  ┌───────────────────────────────────────────────┬───────────────────────────────────────────────┐
  │ Domínio 1: Autenticação & Governança (55 tab) │ Domínio 2: CRM & Clientes (9 tab)             │
  │ Domínio 3: Financeiro & Fintech (17 tab)      │ Domínio 4: Marketplace & E-commerce (31 tab)  │
  │ Domínio 5: Parceiros & Benefícios (7 tab)     │ Domínio 6: Programa de Afiliados (10 tab)     │
  │ Domínio 7: Prestadores & Workstation (20 tab) │ Domínio 8: Fornecedores & Procurement (8 tab) │
  │ Domínio 9: Colaboradores & RBAC (4 tab)       │ Domínio 10: GSA Viagens (13 tab)              │
  │ Domínio 11: GSA Saúde (16 tab)                │ Domínio 12: GSA Seguros (18 tab)              │
  │ Domínio 13: Hub Classificados (11 tab)        │ Domínio 14: Publicidade & Ads (16 tab)        │
  │ Domínio 15: GSA TV & Streaming (45 tab)       │ Domínio 16: Marketing & Campanhas (2 tab)     │
  │ Domínio 17: Comunicação, Suporte & RH (12 tab)│                                               │
  └───────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

#### Domínio 1: Autenticação, Sessões & Governança de Segurança (55 tabelas)
Infraestrutura de controle de sessão customizada, pontes com Supabase Auth (`auth.users`), rate limiting distribuído e trilhas de auditoria administrativa.
- **sistema_sessoes**: `id` (UUID PK), `ator_tipo` (TEXT: cliente/admin/colaborador/prestador/fornecedor/afiliado), `ator_id` (UUID), `ator_nome` (TEXT), `status` (TEXT: ativo/encerrado/revogado), `token_hash` (TEXT), `token_hint` (TEXT), `origem` (TEXT), `metadata` (JSONB), `created_at`, `updated_at`.
- **gsa_auth_identities**: `id` (UUID PK), `ator_tipo` (TEXT), `ator_id` (UUID), `auth_user_id` (UUID FK auth.users), `created_at`.
- **gsa_auth_rate_limits**: `id` (UUID PK), `identifier` (TEXT), `action` (TEXT), `attempts` (INTEGER), `blocked_until` (TIMESTAMPTZ), `created_at`, `updated_at`.
- **system_settings**: `id` (UUID PK), `key` (TEXT UNIQUE), `value` (TEXT), `description` (TEXT), `must_change_code` (BOOLEAN), `created_at`, `updated_at`.
- **empresa**: `id` (UUID PK), `nome`, `razao_social`, `cnpj`, `telefone`, `responsavel`, `taxa_conversao_pontos` (DECIMAL), `created_at`, `updated_at`.
- **gsa_admin_operation_requests**: `id` (UUID PK), `sessao_id` (UUID), `operacao` (TEXT), `payload` (JSONB), `status` (TEXT), `created_at`.
- **audit_logs / gsa_audit_logs / sensitive_audit_logs**: tabelas de auditoria imutável de mutações sensíveis.
- *Demais tabelas de apoio técnico*: `gsa_session_blacklists`, `gsa_security_nonces`, `rate_limit_entries`, `gsa_client_registration_challenges`, `whatsapp_ramais`, `admin_security_policies`, etc.

#### Domínio 2: CRM & Clientes (Identidade, VIP, Indicações, Bloqueios) (9 tabelas)
Cadastro unificado de pessoas físicas e jurídicas, limites de crédito, níveis de fidelidade e relacionamento.
- **clientes**: `id` (UUID PK), `codigo_cliente` (TEXT UNIQUE), `nome` (TEXT), `email` (TEXT UNIQUE), `cpf` (TEXT UNIQUE), `cnpj` (TEXT UNIQUE), `tipo_pessoa` (TEXT: pf/pj), `telefone` (TEXT), `status` (TEXT: ativo/inativo/pendente/bloqueado), `saldo_carteira` (DECIMAL(12,2)), `saldo_pontos` (INTEGER), `pontos_totais` (INTEGER), `carteira_bloqueada` (BOOLEAN), `pontos_bloqueados` (BOOLEAN), `cadastro_aprovado` (BOOLEAN), `limite_credito_total` (DECIMAL), `limite_credito_usado` (DECIMAL), `limite_credito_disponivel` (DECIMAL), `nivel_id` (UUID FK client_levels), `nivel_manual_id` (UUID FK client_levels), `data_cadastro`, `updated_at`.
- **client_levels**: `id` (UUID PK), `nome_nivel` (TEXT UNIQUE: Bronze, Prata, Ouro, Diamante), `pontos_minimos` (INTEGER), `pontos_por_real` (DECIMAL(10,2)), `desconto_porcentagem` (DECIMAL(5,2)), `taxa_saque_transferencia` (DECIMAL), `cor` (TEXT), `created_at`.
- **level_history**: `id` (UUID PK), `cliente_id` (UUID FK clientes ON DELETE CASCADE), `nivel_anterior_id` (UUID FK client_levels), `nivel_novo_id` (UUID FK client_levels), `created_at`.
- **cliente_promocoes**: `id` (UUID PK), `cliente_id` (UUID FK), `promocao_id` (UUID FK), `orcamento_id` (UUID FK), `data_ativacao`, `data_expiracao`, `status`.
- **cliente_premios**: `id` (UUID PK), `cliente_id` (UUID FK), `titulo`, `descricao`, `pontos_custo`, `status`, `data_resgate`.
- **indicacoes**: `id` (UUID PK), `codigo_indicacao` (TEXT UNIQUE), `indicador_id` (UUID FK clientes), `indicado_nome`, `whatsapp_indicado`, `voucher_id` (UUID FK vouchers), `status`, `bonus_indicador`, `bonus_indicado`.
- **vouchers**: `id` (UUID PK), `codigo_voucher` (TEXT UNIQUE), `nome`, `tipo` (fixo/porcentagem/valor), `valor` (DECIMAL), `cliente_id` (UUID FK clientes), `prestador_id` (UUID FK), `ordem_servico_id` (UUID FK), `validade` (DATE), `usage_limit`, `usage_count`, `status` (ativo/usado/expirado/cancelado), `categoria` (desconto/saque).
- **cliente_notas_admin**: Anotações corporativas confidenciais da gerência sobre o cliente.
- **cliente_acessos_historico**: Histórico forense de IPs, user-agents e logins.

#### Domínio 3: Financeiro & Fintech (Faturas, Pagamentos, Carteira, Saques, Empréstimos, Cobranças) (17 tabelas)
Livro-razão contábil do GSA HUB, emissão e liquidação de títulos, controle de inadimplência e concessão de crédito.
- **faturas**: `id` (UUID PK), `codigo_fatura` (TEXT UNIQUE), `os_id` (UUID FK), `ordem_compra_id` (UUID FK), `ordem_assinatura_id` (UUID FK), `cliente_id` (UUID FK clientes), `valor_total` (DECIMAL(12,2)), `valor_pago` (DECIMAL(12,2)), `valor_final_pendente` (DECIMAL(12,2)), `status` (pendente/pago/cancelado/revisada/vencida/aguardando_link/pendente_pagamento), `tipo` (servico/produto/assinatura/pacote_nivel), `data_vencimento` (DATE), `data_pagamento` (TIMESTAMPTZ), `codigo_barras`, `pix_copia_cola`, `link_pagamento`, `forma_pagamento_escolhida`, `desconto_voucher_aplicado`, `abatimento_carteira_aplicado`, `desconto_pontos_aplicado`, `created_at`, `updated_at`.
- **pagamentos**: `id` (UUID PK), `fatura_id` (UUID FK faturas ON DELETE CASCADE), `voucher_id` (UUID FK vouchers), `metodo` (pix/credito/debito/carteira/pontos/voucher/dinheiro), `valor` (DECIMAL(12,2)), `data_pagamento`.
- **carteira_lancamentos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `valor` (DECIMAL(12,2)), `tipo` (credito/debito), `descricao` (TEXT), `data_lancamento`.
- **extrato_financeiro**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `tipo` (entrada/saida), `valor` (DECIMAL(12,2)), `saldo_resultante` (DECIMAL(12,2)), `descricao` (TEXT), `modulo_referencia` (TEXT), `referencia_id` (UUID), `data`.
- **saques**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `valor` (DECIMAL), `taxa_aplicada`, `valor_liquido`, `chave_pix`, `status` (pendente/aprovado/recusado/pago/cancelado), `motivo_cancelamento`, `data_solicitacao`, `data_pagamento`.
- **transferencias**: `id` (UUID PK), `cliente_origem_id` (UUID FK clientes), `cliente_destino_id` (UUID FK clientes), `tipo` (saldo/pontos), `valor`, `taxa_aplicada`, `valor_liquido`, `status` (em_analise/aprovado/recusado/concluido/estornado/cancelado), `motivo`, `reversivel_ate`.
- **pontos_movimentacoes**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `fatura_id` (UUID FK faturas), `tipo` (geracao_fatura/conversao_dinheiro/uso_fatura/ajuste_manual/estorno/bonus_boas_vindas/indicacao/bonus/resgate), `pontos` (INTEGER), `saldo_apos` (INTEGER), `descricao` (TEXT), `valor_convertido` (DECIMAL), `data_movimentacao`.
- **cobrancas**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `fatura_id` (UUID FK), `valor` (DECIMAL), `status` (aberta/em_acordo/paga/protestada/cancelada), `data_vencimento`.
- **cobranca_historico**: Histórico de interações e notificações do departamento de cobrança.
- **cobranca_acordos**: Acordos formais de renegociação de dívidas e parcelamentos.
- **emprestimos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `valor_solicitado`, `valor_aprovado`, `status` (em_analise/aprovado/recusado/liquidado/cancelado), `taxa_juros`, `numero_parcelas`, `data_ativacao`.
- **emprestimo_parcelas**: Cronograma de amortização vinculado aos contratos de empréstimo.
- **contratos**: `id` (UUID PK), `codigo_contrato` (TEXT UNIQUE), `titulo`, `tipo`, `cliente_id` (UUID FK), `status`, `valor_mensal`, `valor_total`, `data_inicio`, `data_fim`, `renovacao_automatica`.
- *Tabelas complementares*: `formas_pagamento`, `points_transactions`, `fatura_contestacoes`, `loja_credito_disputas`.

#### Domínio 4: Marketplace & E-commerce (Produtos, Variantes, Pedidos, Carrinhos, Solicitações, Devoluções) (31 tabelas)
Catálogo com variantes multidimensionais, carrinhos sincronizados, motor de pedidos, trocas e estornos.
- **produtos**: `id` (UUID PK), `codigo_produto` (TEXT UNIQUE), `nome` (TEXT), `descricao` (TEXT), `preco` / `valor` (DECIMAL(12,2)), `preco_promocional` (DECIMAL), `estoque` (INTEGER), `estoque_disponivel` (INTEGER), `possui_variacoes` (BOOLEAN), `controle_estoque` (BOOLEAN), `categoria_id` (UUID FK loja_categorias), `fornecedor_id` (UUID), `shopee_item_id` (TEXT), `status` (ativo/inativo), `avaliacao_media`, `total_avaliacoes`, `created_at`, `updated_at`.
- **produto_variacao_grupos**: `id` (UUID PK), `produto_id` (UUID FK produtos ON DELETE CASCADE), `nome` (TEXT: Cor, Voltagem, Tamanho), `posicao` (INTEGER).
- **produto_variacao_opcoes**: `id` (UUID PK), `grupo_id` (UUID FK produto_variacao_grupos ON DELETE CASCADE), `nome` (TEXT: Azul, 220V, GG), `posicao` (INTEGER).
- **produto_variantes**: `id` (UUID PK), `produto_id` (UUID FK produtos ON DELETE CASCADE), `sku` (TEXT UNIQUE), `preco` (DECIMAL(12,2)), `estoque_disponivel` (INTEGER), `hash_combinacao` (TEXT UNIQUE), `ativo` (BOOLEAN).
- **produto_variante_opcoes**: `variante_id` (UUID FK produto_variantes), `opcao_id` (UUID FK produto_variacao_opcoes), PK composta `(variante_id, opcao_id)`.
- **pedidos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `status`, `total`, `created_at`.
- **loja_pedido_itens**: `id` (UUID PK), `orcamento_id` (UUID FK orcamentos), `produto_id` (UUID FK produtos), `produto_variante_id` (UUID FK produto_variantes), `quantidade` (INTEGER), `preco_unitario` (DECIMAL), `subtotal` (DECIMAL), `variacao_snapshot` (JSONB).
- **loja_carrinhos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `itens` (JSONB), `created_at`, `updated_at`.
- **loja_favoritos**: `id` (UUID PK), `cliente_id` (UUID FK clientes), `produto_id` (UUID FK produtos), PK composta/UNIQUE `(cliente_id, produto_id)`.
- **loja_solicitacoes**: `id` (UUID PK), `codigo_solicitacao` (TEXT), `cliente_id` (UUID FK clientes), `orcamento_origem_id` (UUID FK orcamentos), `tipo` (troca/devolucao), `status` (pendente/em_analise/aprovado/rejeitado/concluido/cancelado/devolucao_recebida), `itens_devolvidos` (JSONB), `estorno_executado` (BOOLEAN DEFAULT false), `valor_diferenca` (DECIMAL), `resposta_admin`, `endereco_devolucao`.
- **loja_reembolsos**: `id` (UUID PK), `solicitacao_id` (UUID FK loja_solicitacoes), `orcamento_id` (UUID FK orcamentos), `valor_estorno`, `status`, `forma_reembolso`, `comprovante_url`.
- **promocoes_quantidade**: `id` (UUID PK), `nome`, `tipo_promocao` (unidade_gratis/desconto_proxima/ganhe_outro_produto/combo), `escopo_gatilho`, `produto_gatilho_id`, `quantidade_minima`, `desconto_valor`, `nivel_minimo_id`.
- **promocoes_quantidade_ativadas**: Registro de histórico de concessão de combos promocionais por cliente.
- *Demais tabelas*: `loja_categorias`, `loja_marcas`, `loja_avaliacoes`, `loja_vaquinhas`, `loja_vaquinha_contribuicoes`, `loja_credito_solicitacoes`, `loja_credito_movimentacoes`, `loja_credito_contestacoes`, `shopee_orders_queue`.

#### Domínio 5: Programa de Parceiros & Resgates de Benefícios (Appeals/Recursos, Outbox) (7 tabelas)
Rede de convênios corporativos, emissão de vouchers externos e sistema recursal com verificação 2FA.
- **parceiros**: `id` (UUID PK), `slug` (TEXT UNIQUE), `status` (ativo/inativo/pendente), `logo_url`, `banner_url`, `short_description`, `redemption_has_coupon`, `redemption_coupon_code`, `redemption_has_voucher`, `redemption_has_link`, `redemption_link`, `redemption_auto_redirect`, `redemption_instructions`, `redemption_delay_24h` (BOOLEAN), `tax_document`, `application_source`, `application_protocol`, `submitted_at`, `privacy_consent_at`, `created_at`, `updated_at`.
- **parceiros_resgates**: `id` (UUID PK), `parceiro_id` (UUID FK parceiros), `cliente_id` (UUID FK clientes), `nome_completo`, `telefone`, `email`, `codigo_gerado` (TEXT UNIQUE), `tipo_resgate` (cupom/voucher/link), `link_destino`, `link_ativacao`, `status` (pendente/em_analise/ativo/recusado/em_recurso/cancelado), `auto_redirecionado`, `data_ativacao`, `data_cancelamento`, `created_at`.
- **parceiros_resgates_recursos**: `id` (UUID PK), `resgate_id` (UUID UNIQUE FK parceiros_resgates ON DELETE CASCADE), `protocolo_recurso` (TEXT UNIQUE), `contestacao_cliente` (TEXT - CHECK entre 20 e 4000 caracteres), `status` (TEXT: em_analise/deferido/indeferido), `aberto_em` (TIMESTAMPTZ), `prazo_analise_em` (TIMESTAMPTZ), `analisado_em` (TIMESTAMPTZ), `motivo_decisao` (TEXT), `analisado_por` (UUID), `idempotency_key` (UUID UNIQUE), `created_at`, `updated_at`.
- **parceiros_resgates_eventos**: `id` (UUID PK), `resgate_id` (UUID FK parceiros_resgates ON DELETE CASCADE), `recurso_id` (UUID FK parceiros_resgates_recursos), `tipo` (TEXT), `titulo` (TEXT), `descricao_publica` (TEXT), `detalhes_privados` (JSONB), `ator_tipo` (cliente/admin/colaborador/sistema), `ator_id` (UUID), `idempotency_key` (TEXT UNIQUE), `ocorrido_em` (TIMESTAMPTZ).
- **parceiros_resgates_public_status**: `resgate_id` (UUID PK FK), `tracking_key` (UUID UNIQUE), `revision` (BIGINT), `updated_at` (utilizado para refetch realtime seguro na consulta pública sem vazamento de PII).
- **parceiros_resgates_recurso_desafios**: `id` (UUID PK), `resgate_id` (UUID FK parceiros_resgates), `code_hash` (TEXT), `attempts` (INTEGER CHECK 0 a 5), `expires_at` (TIMESTAMPTZ), `consumed_at` (TIMESTAMPTZ).
- **parceiros_resgates_notificacoes**: `id` (UUID PK), `resgate_id` (UUID FK), `recurso_id` (UUID FK), `tipo`, `telefone`, `mensagem`, `idempotency_key` (TEXT UNIQUE), `status` (pendente/processando/enviado/falhou), `attempts`, `available_at`, `claimed_at`, `sent_at`, `last_error`.

#### Domínio 6: Programa de Afiliados (Links, Conversões, Comissões, Saques, Transferências) (10 tabelas)
Rede de afiliados de desempenho, atribuição de tráfego, carência de comissões e transações peer-to-peer.
- **afiliados**: `id` (UUID PK), `cliente_id` (UUID UNIQUE FK clientes), `codigo_afiliado` (TEXT UNIQUE), `nome_divulgacao`, `pix_tipo`, `pix_chave`, `status` (ativo/pendente/suspenso), `saldo_comissao` (DECIMAL), `total_ganho` (DECIMAL), `termos_versao`, `created_at`.
- **gsa_afiliado_links**: `id` (UUID PK), `afiliado_id` (UUID FK), `codigo_link` (TEXT UNIQUE), `destino` (TEXT), `titulo` (TEXT), `cliques_total` (INTEGER).
- **gsa_afiliado_cliques**: `id` (UUID PK), `link_id` (UUID FK), `ip_origem`, `visitante_token`, `referrer_host`, `created_at`.
- **gsa_afiliado_conversoes**: `id` (UUID PK), `afiliado_id` (UUID FK), `orcamento_id` (UUID FK orcamentos), `valor_venda`, `comissao_calculada`, `status` (pendente/aprovada/cancelada), `created_at`.
- **gsa_afiliado_saques**: `id` (UUID PK), `afiliado_id` (UUID FK), `valor`, `chave_pix`, `status` (pendente/aprovado/recusado/pago), `created_at`.
- **gsa_afiliado_transferencias**: Transferências diretas de comissões entre afiliados.
- *Demais tabelas*: `afiliado_programas`, `afiliado_regras_comissao`, `afiliado_ranking`, `afiliado_notificacoes`.

#### Domínio 7: Prestadores de Serviços & Workstation (Demandas, OS, Repasses) (20 tabelas)
Gestão de ordens de serviço, despacho de demandas de campo, negociação de valores e agenda de técnicos.
- **prestadores**: `id` (UUID PK), `usuario_id` (UUID), `tipo_cadastro` (cpf/cnpj), `nome_razao`, `documento` (TEXT UNIQUE), `email`, `telefone`, `area_servico`, `credencial_acesso`, `status` (pendente/em_analise/ativo/suspenso/desligado), `saldo_disponivel`, `created_at`.
- **servicos**: Catálogo de serviços prestados pelo Grupo GSA.
- **servicos_pacotes**: Pacotes de serviços combinados.
- **orcamentos**: Propostas comerciais centrais (`codigo_orcamento`, `cliente_id`, `servico_id`, `produto_id`, `total`, `status`: aberto/aprovado/cancelado/em revisão/negociação, `fase_negociacao`: cliente/admin).
- **ordens_servico**: Execução prática do orçamento aprovado (`codigo_os`, `orcamento_id`, `cliente_id`, `status`: andamento/concluido/cancelado, `tipo_entrega`, `link_documento`).
- **ordens_compra**: Aquisição de produtos atrelados à prestação do serviço.
- **ordens_assinatura**: Contratos de serviço recorrentes.
- **prestador_demandas**: Distribuição de serviços aos prestadores credenciados (`prestador_id`, `os_id`, `valor_proposto_admin`, `valor_proposto_prestador`, `valor_final`, `status`: aberta/em_negociacao/contraproposta_prestador/contraproposta_admin_final/ativa/em_analise/concluida/recusada).
- **prestador_faturas**, **prestador_saques**, **prestador_transacoes**, **prestador_agendamentos**, **prestador_documentos**, **prestador_historico**, **demanda_comentarios**, etc.

#### Domínio 8: Fornecedores & Procurement (Cotações, Pedidos de Compra, Homologação) (8 tabelas)
Homologação de fornecedores industriais e atacadistas, pedidos de compra corporativos e controle de remessas.
- **fornecedores**: `id` (UUID PK), `razao_social`, `cnpj` (UNIQUE), `nome_fantasia`, `email`, `telefone`, `status` (homologado/pendente/bloqueado), `score_qualidade`.
- **pedidos_compra**: `id` (UUID PK), `codigo_pedido` (TEXT UNIQUE), `fornecedor_id` (UUID FK), `valor_total`, `status` (rascunho/enviado/confirmado/em_transito/entregue/cancelado).
- **cotacoes_compra**, **cotacoes_itens**, **fornecedor_produtos**, **fornecedor_avaliacoes**, **fornecedor_documentos**, **pedidos_compra_itens**.

#### Domínio 9: Colaboradores & Perfis Administrativos (Auditoria, Módulos, Permissões RBAC) (4 tabelas)
Governança interna de pessoal, funções hierárquicas, matriz de acessos e deleções seguras.
- **colaboradores**: `id` (UUID PK), `nome`, `email` (TEXT UNIQUE), `telefone`, `credencial_acesso` (TEXT UNIQUE), `funcao_id` (UUID FK funcoes), `status` (ativo/inativo).
- **funcoes**: Cargos administrativos e regras de autorização padrão.
- **colaborador_modulos**: PK composta `(colaborador_id, modulo_id)` para autorização modular estrita.
- **solicitacoes_exclusao**: Fila de quarentena e autorização dupla para exclusão lógica de dados sensíveis.

#### Domínio 10: GSA Viagens (Pacotes, Cotações, Reservas, Propostas, Parcelamentos) (13 tabelas)
Operação turística, emissão de bilhetes, reservas de hotelaria e gestão de passageiros.
- **gsa_viagens_pacotes**, **viagens_solicitacoes_reserva**, **viagens_orcamentos**, **viagens_propostas**, **viagens_transacoes**, **viagens_comprovantes**, **viagens_passageiros**, **viagens_hoteis**, **viagens_voos**, **viagens_reembolsos**, **viagens_politicas_cancelamento**, **viagens_anexos**, **viagens_avaliacoes**.

#### Domínio 11: GSA Saúde (Planos, Cotações, Propostas, Vidas, Contratos) (16 tabelas)
Comercialização de planos de saúde médicos e odontológicos, gestão de vidas e faturamento coparticipativo.
- **saude_operadoras**, **saude_planos**, **saude_cotacoes**, **saude_cotacao_vidas**, **saude_propostas**, **saude_beneficiarios**, **saude_contratos**, **saude_faturas**, **saude_reembolsos**, **saude_guias**, **saude_documentos**, **saude_carencias**, **saude_auditoria**, **saude_coparticipacoes**, **saude_atendimentos**, **saude_redes_credenciadas**.

#### Domínio 12: GSA Seguros (Apólices, Sinistros, Cotações, Ramos) (18 tabelas)
Corretagem de seguros (Auto, Residencial, Vida e Empresarial), regulação de sinistros e assessorias periciais.
- **seguros_ramos**, **seguros_seguradoras**, **seguros_cotacoes**, **seguros_cotacao_dados**, **seguros_propostas**, **seguros_aceites**, **seguros_apolices**, **seguros_documentos**, **seguros_assessorias**, **seguros_comissoes**, **seguros_assistencias**, **seguros_sinistros**, **seguros_sinistro_mensagens**, **seguros_atendimentos**, **seguros_atendimento_mensagens**, **seguros_auditoria**, **seguros_coberturas**, **seguros_veiculos**.

#### Domínio 13: Hub Classificados (Anúncios, Categorias, Propostas, Moderação, Comissões) (11 tabelas)
Marketplace C2C/B2C de classificados locais, intermediação de propostas e custódia de pagamento.
- **classificados_configuracoes**, **classificados_comissoes_config**, **classificados_anuncios**, **classificados_anuncio_midias**, **classificados_propostas**, **classificados_transacoes**, **classificados_comprovantes**, **classificados_mensagens**, **classificados_comissoes**, **classificados_midias**, **classificados_ajustes**.

#### Domínio 14: Plataforma de Publicidade & Ads (Campanhas, Criativos, Métricas, Faturamento) (16 tabelas)
Ad Server corporativo para veiculação de banners no portal, pre-roll e slots comerciais na GSA TV.
- **gsa_ad_placements**, **gsa_ad_requests**, **gsa_ad_request_placements**, **gsa_ad_proposals**, **gsa_ad_proposal_versions**, **gsa_ad_negotiations**, **gsa_ad_campaigns**, **gsa_ad_creatives**, **gsa_ad_campaign_placements**, **gsa_ad_daily_metrics**, **gsa_ad_audit_logs**, **gsa_ad_payments**, **gsa_ad_payment_events**, **gsa_ad_delivery_events**, **gsa_ad_rate_limit_buckets**, **gsa_ad_maintenance_state**.

#### Domínio 15: GSA TV (Grade de Programação, Canais, Mídias, IA Editorial, Logs de Transmissão) (45 tabelas)
Infraestrutura de playout, geração autônoma de telejornais via IA, gerenciamento de assets e telemetria on-air.
- **gsa_tv_channels**, **gsa_tv_media_items**, **gsa_tv_schedule_slots**, **gsa_tv_playlists**, **gsa_tv_incidents**, **gsa_tv_audit_log**, **gsa_tv_jobs**, **gsa_tv_channel_secrets**, **gsa_tv_programs**, **gsa_tv_series**, **gsa_tv_episodes**, **gsa_tv_schedule_versions**, **gsa_tv_program_blocks**, **gsa_tv_rights_records**, **gsa_tv_comments**, **gsa_tv_ad_campaigns**, **gsa_tv_ad_assets**, **gsa_tv_live_sources**, **gsa_tv_identity_assets**, **gsa_tv_graphic_templates**, **gsa_tv_on_air_graphics**, **gsa_tv_as_run**, **gsa_tv_ai_presenters**, **gsa_tv_ai_projects**, **gsa_tv_ai_jobs**, **gsa_tv_ai_assets**, **gsa_tv_execution_log**, **gsa_tv_watchdog_samples**, **gsa_tv_graphics**, **gsa_tv_live_source_secrets**, **gsa_tv_rights_documents**, **gsa_tv_campaigns**, **gsa_tv_virtual_presenters**, **gsa_tv_editorial_policies**, **gsa_tv_ai_provider_secrets**, **gsa_tv_live_recordings**, **gsa_tv_alert_settings**, **gsa_tv_alert_deliveries**, **gsa_tv_backup_runs**, **gsa_tv_ai_usage**, **gsa_tv_ai_memory**, **gsa_tv_weekly_grid_slots**, **gsa_tv_editorial_sources**, **gsa_tv_program_source_links**, **gsa_tv_editorial_items**.

#### Domínio 16: Marketing, Campanhas & Vaquinhas Coletivas (2 tabelas)
Banners institucionais com controle de datas e blog público para atração de tráfego orgânico.
- **gsa_hero_banners**: Banners rotativos de alta resolução com agendamento temporal de exibição.
- **blog_posts**: Artigos informativos indexados por categoria para SEO e nutrição de leads.

#### Domínio 17: Comunicação, Suporte & RH (Tickets, Mensagens, WhatsApp Outbox, Notificações, Carreiras) (12 tabelas)
Central de atendimento omnichannel, outbox transacional de WhatsApp e portal de vagas de emprego.
- **tickets**, **ticket_mensagens**, **notificacoes**, **notificacao_leituras**, **suporte_mensagens**, **os_suporte_mensagens**, **os_notas**, **whatsapp_pendencias_ativas**, **gsa_careers_vacancies**, **gsa_careers_applications**, **gsa_careers_application_history**, **gsa_careers_notification_outbox**.

---

### 2.3 Matriz de Políticas RLS (Row Level Security)

#### Evolução Histórica das Políticas (De Permissiva a Estrita)
- **Fase Inicial Legada**: No início do projeto (`master_supabase_schema.sql`), o banco operava com a política permissiva global `CREATE POLICY "Public Full Access" ON public.%I FOR ALL USING (true) WITH CHECK (true)`.
- **Fase de Hardening Estrutural**:
  - `20260828230000_security_lockdown_rls_and_rpc_permissions.sql`: Extinguiu todas as políticas wildcard nas 18 tabelas mais sensíveis (`clientes`, `faturas`, `pagamentos`, `cobrancas`, `carteira_lancamentos`, `extrato_financeiro`, `loja_credito_*`, `saques`, `transferencias`).
  - `20260910233000_client_panel_rls_hardening.sql`: Finalizou o isolamento estrito para tabelas operacionais do cliente (`vouchers`, `orcamentos`, `ordens_compra`, `loja_favoritos`, `promocoes_quantidade_ativadas`, `loja_carrinhos`, `cliente_premios`).

#### Separação por Papéis de Conexão
1. **`anon`**: Acesso estritamente somente-leitura a dados públicos autorizados (produtos ativos no catálogo, planos de saúde públicos, consulta pública de protocolo de resgate por código exato, banners rotativos e vagas de carreira). Proibido qualquer `INSERT` ou `UPDATE` direto.
2. **`authenticated`**: Usuários autenticados no Supabase Auth. O JWT transporta as claims corporativas:
   - `gsa_actor_type`: 'cliente' | 'admin' | 'colaborador' | 'prestador' | 'fornecedor' | 'afiliado'.
   - `gsa_actor_id`: UUID correspondente à tabela da entidade.
   - `gsa_session_id`: UUID vinculado à tabela `sistema_sessoes`.
3. **`service_role`**: Papel de alta autoridade utilizado exclusivamente no backend pela VPS, webhooks do n8n e rotinas batch, realizando bypass automático de RLS.

#### Padrão Canônico de Políticas RLS
```sql
-- Exemplo de Isolamento Estrito em loja_favoritos
ALTER TABLE public.loja_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY gsa_client_own_favoritos ON public.loja_favoritos
  FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
  WITH CHECK (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

-- Exemplo de Isolamento Estrito em faturas
CREATE POLICY gsa_client_select_own_invoices ON public.faturas
  FOR SELECT TO authenticated
  USING (
    (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id())
    OR public.gsa_jwt_actor_type() = 'admin'
  );
```

---

### 2.4 Funções RPC e Lógicas Transacionais Críticas

#### 2.4.1 Checkout Atômico no Marketplace (`gsa_client_checkout_store_base_20260817`)
- **Assinatura**: `public.gsa_client_checkout_store_base_20260817(p_sessao_id uuid, p_session_token text, p_payload jsonb)`
- **Função Wrapper**: `public.gsa_client_checkout_store(p_sessao_id uuid, p_session_token text, p_payload jsonb)`
- **Propriedades e Garantias ACID**:
  1. Execução como `SECURITY DEFINER` com `SET search_path = public, pg_temp`.
  2. Adquire trava exclusiva `SELECT ... FOR UPDATE` ordenada na linha do cliente em `clientes` para garantir cálculo estrito de saldo de carteira e pontos.
  3. Adquire travas exclusivas `SELECT ... FOR UPDATE` ordenadas em todos os registros correspondentes em `produtos` e `produto_variantes`.
  4. **Prevenção de Vendas sem Estoque**:
     ```sql
     IF v_variant.estoque_disponivel < v_requested THEN
       RAISE EXCEPTION 'Estoque insuficiente para a variante selecionada.';
     END IF;
     UPDATE public.produto_variantes
        SET estoque_disponivel = estoque_disponivel - v_requested
      WHERE id = v_variant.id;
     ```
  5. **Injeção de Preço em Memória (Anti-Mutation)**: O wrapper calcula o preço unitário da variante dinamicamente no JSON `p_payload`, sem alterar a coluna física de preço base em `produtos`, eliminando o risco de corrupção de preços entre compradores simultâneos.
  6. **Composição Financeira Multi-Método**:
     - Aplicação de cupom de desconto com validação de `usage_limit > usage_count`.
     - Abatimento por saldo em carteira (`saldo_carteira`).
     - Abatimento por pontos de fidelidade convertidos na taxa oficial.
     - Emissão de fatura vinculada em `faturas` com `valor_final_pendente` para o saldo remanescente a ser quitado via PIX ou Cartão de Crédito.

#### 2.4.2 Proteção de Saldo de Carteira e Prevenção Anti-Tampering
- **Gatilho de Bloqueio**: `trg_prevent_saldo_tampering` na tabela `clientes` executando `prevent_saldo_tampering()`.
- **Comportamento**: Qualquer instrução `UPDATE clientes SET saldo_carteira = ...` originada diretamente de queries da aplicação é imediatamente abortada com exceção.
- **Desbloqueio Controlado**: A alteração só é permitida se a transação corrente tiver executado:
  ```sql
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  ```
- **RPCs Autorizadas para Modificação de Saldo**:
  - `gsa_converter_pontos_carteira(p_cliente_id uuid, p_pontos integer)`: Converte pontos em dinheiro líquido, trava o cliente com `FOR UPDATE`, debita pontos e credita saldo gerando entradas sincronizadas em `pontos_movimentacoes`, `carteira_lancamentos` e `extrato_financeiro`.
  - `gsa_client_pagar_fatura(...)`: Quita faturas pendentes debitando da carteira.
  - `gsa_admin_ajustar_saldo_cliente(...)`: Ajuste administrativo com registro auditável do operador.
  - `gsa_admin_processar_saque(...)`: Em caso de cancelamento de saque, restaura os fundos retidos.

#### 2.4.3 Pós-Venda e Estornos Atômicos (`gsa_admin_atualizar_solicitacao_loja`)
A migração `20260910180000_marketplace_acid_concurrency_remediation.sql` remediou concorrências no pós-venda garantindo que a aprovação de devoluções ou trocas em `loja_solicitacoes` execute:
1. Restauração atômica da quantidade devolvida ao estoque físico de `produto_variantes` e `produtos`.
2. Estorno exato de `carteira_saldo` caso tenha sido utilizado na compra original.
3. Estorno exato de `pontos_fidelidade` debitados, com registro formal em `pontos_movimentacoes`.
4. Em caso de troca onde o novo item possui valor superior, emissão automática de fatura de diferença (`fatura_diferenca_id`) com prazo de vencimento para 2 dias.
5. Guarda de idempotência `estorno_executado = true`, impedindo duplicidade em aprovações concorrentes.

#### 2.4.4 Sistema de Resgates de Parceiros e Recursos (`parceiros_resgates_recursos`)
- O fluxo de contestação de benefícios recusados obedece a uma máquina de estados:
  1. O cliente inicia o recurso na página pública via `gsa_begin_partner_appeal_challenge`, gerando um desafio de 6 dígitos enviado por WhatsApp, cujo hash SHA-256 é armazenado em `parceiros_resgates_recurso_desafios`.
  2. O cliente conclui a submissão via `gsa_complete_partner_appeal`, informando o código (máximo 5 tentativas) e a justificativa (entre 20 e 4000 caracteres).
  3. A transação atualiza o resgate para `em_recurso`, cria o registro único em `parceiros_resgates_recursos` com `idempotency_key` e registra o evento em `parceiros_resgates_eventos`.
  4. O administrador julga o pedido via `gsa_admin_decide_partner_appeal`. A decisão enfileira uma notificação transacional em `parceiros_resgates_notificacoes` com encoding UTF-8 garantido.

---

### 2.5 Triggers de Integridade, Auditoria e Revogação de Sessão

- **Revogação Imediata de Sessões de Clientes**:
  O gatilho `trg_gsa_revoke_client_sessions_update` na tabela `clientes` monitora alterações cadastrais críticas. Caso `status` passe para 'bloqueado', 'inativo' ou 'excluido', ou `cadastro_aprovado` seja revogado para `false`, o trigger executa imediatamente:
  ```sql
  UPDATE public.sistema_sessoes
     SET status = 'encerrado'
   WHERE ator_tipo = 'cliente'
     AND ator_id = NEW.id
     AND status <> 'encerrado';
  ```
- **Auditoria de Sessões**: O gatilho `trg_gsa_admin_session_change_audit` em `sistema_sessoes` registra a abertura, renovação e encerramento de sessões administrativas e de colaboradores.

---

## 3. MAPEAMENTO DA ARQUITETURA DO FRONTEND (REACT 19)

### 3.1 Ponto de Entrada, Bootstrap e Ciclo de Vida da Aplicação

```
                                  ÁRVORE DE ENTRADA DO FRONTEND
  src/main.tsx
  └── <StrictMode>
      └── <ErrorBoundary>
          └── <SiteCampaignBootstrap />
              └── <App />
                  ├── <FileViewerProvider> (Modal central de pré-visualização de documentos/PDFs)
                  ├── <QueryClientProvider> (TanStack Query: cache global de requisições de servidor)
                  ├── <AffiliateTrackingBridge> (Captura e persistência de parâmetros ?ref= na sessão)
                  └── <Suspense fallback={<RouteLoading />}>
                      ├── <DashboardLayout> (Estrutura modular de menus com Sidebar e Header)
                      └── Componentes Globais Flutuantes:
                          ├── <AdvertisingSlot placementCode="SITE_STICKY_BOTTOM" />
                          ├── <FullscreenPrompt />
                          ├── <WhatsAppButton />
                          ├── <GSAChatbotWidget />
                          └── <Toaster position="top-right" />
```

#### Ciclo de Inicialização e Sessão
1. **Atribuição Inicial de Tráfego (`src/main.tsx:13`)**:
   Antes mesmo do React renderizar a árvore de componentes, a função `captureAffiliateReferralFromLocation()` inspeciona a URL em busca de parâmetros de afiliados (`?ref=`), gravando os identificadores em `localStorage` e cookies para garantir atribuição imediata de comissão.
2. **Restauração de Sessão (`src/App.tsx:337`)**:
   Invocada via `sessionService.restoreSession()`, valida o token local no banco através da RPC `gsa_validate_session`.
3. **Heartbeat e Desconexão Automática (`src/hooks/useAutoLogout.ts`)**:
   - Dispara um ping a cada 15 segundos para renovar a sessão no banco (`gsa_ping_session`).
   - Escuta o evento global `window.addEventListener('gsa-session-revoked')`. Caso a conta seja acessada em outro dispositivo (`status = superseded`) ou revogada por um administrador, a sessão é destruída imediatamente e a tela é redirecionada para a página de login.
4. **Migração Atômica do Carrinho de Visitante (`src/App.tsx:39-153`)**:
   Quando um cliente não autenticado monta um carrinho e efetua login, a rotina `migrateGuestCartToAccount` lê os itens armazenados em `localStorage` (`gsa_pending_store_checkout` e `gsa_pending_store_coupons`), executa deduplicação de SKUs e persiste atomicamente na tabela `loja_carrinhos` via `clientOperationalWrite`.

---

### 3.2 Motor de Roteamento Customizado (`src/routing/`)

Em substituição a bibliotecas de roteamento convencionais como `react-router-dom`, o GSA HUB adota um motor de roteamento autônomo, fortemente tipado e auditado contra vulnerabilidades:

```
  Navegador (URL) ──► navigationService.ts (Singleton History API)
                             │
                             ▼
                      useAppLocation.ts (Hook Reativo)
                             │
                             ▼
                      routeMatcher.ts (Parser Determinístico)
                             │
                             ▼
                      routeSecurity.ts (Barreira RBAC / isRouteAllowed)
                             │
                             ▼
                      Renderização Dinâmica do Módulo Autorizado
```

- **`navigationService.ts`**: Classe Singleton que encapsula `window.history.pushState` e `replaceState` com padrão Observer. Gerencia query params reativos e modais atrelados à URL (`openRouteModal`, `closeRouteModal`, `updateRouteQuery`).
- **`routeMatcher.ts`**: Parser determinístico que desmembra o caminho em áreas de aplicação (`AppArea = 'public' | 'marketplace' | 'client' | 'business' | 'admin' | 'provider' | 'supplier' | 'advertiser' | 'login'`), módulo, submódulo e IDs de itens.
- **`routeSecurity.ts`**: Função `isRouteAllowed` que aplica barreiras estritas de autorização:
  - Impede que clientes com perfil PF acessem áreas exclusivas PJ (`clientPersonType`).
  - Bloqueia colaboradores de acessar módulos administrativos aos quais não possuem permissão explícita em `colaboradorModulos`.
  - Bloqueia acesso a rotas de prestadores e fornecedores caso a entidade correspondente esteja bloqueada.
- **`safeReturnTo.ts`**: Sanitiza URLs de retorno para mitigar ataques de Open Redirect.

---

### 3.3 Camada Visual, Design System e UI Libraries

- **Framework e Primitivas**: Tailwind CSS v4 combinado com a suíte headless do Radix UI (`dialog`, `dropdown-menu`, `popover`, `select`, `tabs`, `tooltip`, `switch`, `checkbox`).
- **Tokens de Design Corporativo (`src/index.css`)**:
  - Paleta Primária: `--brand: #4F46E5`, `--brand-hover: #4338CA`, `--canvas-bg: #F8FAFC`, `--surface-primary: #FFFFFF`, `--sidebar-bg: #0F0F0F`.
  - Estados Semânticos: Sucesso (Esmeralda), Alerta (Âmbar), Perigo (Vermelho), Informativo (Azul) e Neutro (Slate).
  - Escalas Padronizadas de Raios (`--radius-xs` a `--radius-3xl`) e Sombras Multicamadas (`--shadow-xs` a `--shadow-modal`).
- **Folhas de Estilo Especializadas por Ecossistema**:
  - `gsa-store.css`: Estilização dedicada para o marketplace, carrosséis de produtos e checkout.
  - `supplier-portal.css`: Layouts compactos e formulários técnicos para o portal do fornecedor.
  - `careers.css`: Portal público de recrutamento e vagas.
  - `affiliates.css` e `partners.css`: Telas de divulgação e resgate de parceiros.

---

### 3.4 Camada de Integração com Supabase (Lazy Proxy, Storage e RPC Rollback)

- **Lazy Initialization Proxy (`src/lib/supabase.ts:308-368`)**:
  O cliente Supabase não é instanciado na importação do módulo. Ele é envolvido em um `Proxy`, garantindo que a inicialização ocorra exclusivamente sob demanda durante a execução. Isso previne crashes no carregamento inicial da aplicação caso ocorram variações temporárias na rede.
- **Interceptador de Storage (`getStorageProxy`)**:
  - Redireciona buckets legados (como `emprestimos`) para o bucket corporativo `gsa-private-documents` com esquema `gsa-private://`.
  - No bucket `documentos_cliente`, impõe isolamento estrito de diretório por ID de cliente, limitando arquivos a 10MB e extensões homologadas.
- **Interceptador de RPC com Rollback Automático (`getRpcProxy`)**:
  Caso uma operação multipart (upload de arquivo para storage seguido de execução de RPC) falhe na fase da RPC (ex: `gsa_admin_emprestimo_enviar_contrato`), o proxy intercepta o erro e remove automaticamente o arquivo enviado ao storage, prevenindo a existência de arquivos órfãos.
- **Camada de Chamadas Seguras Zero-Trust**:
  - `src/lib/clientRpc.ts`: `callClientRpc` valida a sessão local e injeta compulsoriamente `p_sessao_id` e `p_session_token`.
  - `src/lib/clientOperationalWrite.ts`: Centraliza mutações operacionais via RPC `gsa_client_operational_write`.
  - `src/lib/adminRpc.ts`: Biblioteca com mais de 770 linhas de chamadas administrativas tipadas.

---

### 3.5 Infraestrutura Realtime Canônica (`src/hooks/useRealtime.ts`)

O hook canônico `useRealtimeSubscription` foi blindado contra três falhas clássicas de concorrência em SPAs:
1. **Eliminação de Stale Closures**:
   O array de referências `callbacksRef.current` é sincronizado compulsoriamente a cada ciclo de renderização (`useRealtime.ts:61-70`). Quando um evento de banco chega, o listener executa a função com estado e props 100% atualizados.
2. **Prevenção de Desincronização de Índices (Index Desync)**:
   Ao receber subscrições onde algumas tabelas possuem `enabled: false`, o hook mapeia os itens como `{ config, originalIdx }` (`useRealtime.ts:118-122`). Os timers de debounce e disparos de callback preservam o pareamento exato do índice original.
3. **Proteção Contra Race Conditions de Remount**:
   Durante transições rápidas de rota, a subscrição verifica `channelRef.current === channel` antes de processar mensagens, descartando canais criados em ciclos de montagem que já foram destruídos.

---

### 3.6 Integrações Externas, Webhooks & Armazenamento

#### Notificações WhatsApp com Cascata 3-Tier (`src/utils/n8nWhatsApp.ts`)
Para garantir entrega contínua sem depender de um único ponto de falha, o envio de WhatsApp opera em cascata com redundância tripla:
1. **Tier 1**: Chamada à Edge Function `vps-api` (`action: 'send-whatsapp'`).
2. **Tier 2 (Fallback Direto)**: Requisição HTTP direta à Evolution API na VPS (`http://147.15.43.141:8080/message/sendText/GSA_WhatsApp`, com cabeçalhos `apikey` e `charset=utf-8`).
3. **Tier 3 (Fallback n8n)**: Disparo via Webhook do n8n na VPS (`http://147.15.43.141:5678/webhook/send-whatsapp`).

#### Motor de Variação Dinâmica Anti-Ban (`src/lib/whatsappVariationService.ts`)
- **28 Templates Contextuais**: Cobrem faturas, orçamentos, ordens de serviço, empréstimos, confirmação de PIX e recursos.
- **Algoritmos Anti-Detecção de Spam**:
  - `injectZeroWidthEntropy`: Insere caracteres de largura zero aleatórios no corpo da mensagem.
  - `randomizeMessageUrls`: Randomiza parâmetros irrelevantes nas URLs para que cada hash de mensagem seja único.
  - `pdfVariationEngine`: Aplica variações microscópicas de metadados em PDFs gerados para alterar a assinatura MD5/SHA-256 do arquivo.
- **Coreografia de Presença Humana**:
  Antes do envio, a rotina marca a mensagem como lida (`markMessageAsRead`), ativa presença disponível e executa o ciclo de digitação: `composing` (4s) -> `paused` (2s) -> `composing` (3s) -> Envio final.
- **Circuit Breaker com Fila Offline**:
  O serviço `whatsappHealthService.ts` monitora a saúde da Evolution API. Caso a conexão caia, as mensagens são retidas em `localStorage` (`gsa_whatsapp_pending_queue`) e despachadas automaticamente assim que o serviço retorna.

#### Microserviço Backend VPS (`server_webhook.cjs` - 9.600+ linhas)
- Opera como um processo daemon na porta **5680** da VPS Oracle.
- **`SessionMutex` (Linhas 45-84)**: Fila FIFO por número de telefone que serializa o processamento de mensagens simultâneas originadas do mesmo usuário, impedindo deadlocks e race conditions financeiras no PostgreSQL.
- **IA Conversacional Nativa**: Integrado diretamente com o modelo **Google Gemini 3.5 Flash Lite**, munido de cache dinâmico de catálogo de produtos e serviços renovado a cada 5 minutos.
- Processa webhooks tanto da Meta Cloud API oficial quanto da Evolution API.

#### Armazenamento em Nuvem Cloudflare R2
- Mapeia 14 categorias de buckets entre prefixos públicos (`public/`) e privados (`private/`).
- Uploads autenticados exigem envio dos cabeçalhos `x-gsa-session-id` e `x-gsa-session-token`.
- Documentos confidenciais (RG, CNH, comprovantes de renda e contratos) só podem ser lidos através de URLs assinadas de curta duração geradas pelo Cloudflare Worker (`gsa-hub-r2-worker`).

---

## 4. MAPEAMENTO DETALHADO DOS MÓDULOS DE USUÁRIOS (6 PERFIS OBRIGATÓRIOS)

### 4.1 Módulo 1: Administrador (Admin)

O módulo do Administrador (`src/pages/AdminPanel.tsx` e `src/components/admin/`) é o centro nervoso da plataforma, compreendendo **69 módulos especializados** organizados em 7 grupos de menus estruturados:

```
                                  MENU PRINCIPAL DO ADMINISTRADOR
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │ 1. Principal: Dashboard Geral, Indicadores Executivos, Alertas do Sistema                │
  │ 2. Financeiro: Faturamento, Fluxo de Caixa, Cobrança, Fiscal, Empréstimos, Calculadoras │
  │ 3. Relacionamento: Clientes, Fornecedores, Prestadores, Parceiros, Fidelidade, VIP      │
  │ 4. Operações: Orçamentos, Demandas, Ordens de Serviço (OS), Catálogo da Loja, Assinaturas│
  │ 5. Verticais: Viagens, Saúde, Seguros, Classificados, Publicidade (Ad Server)           │
  │ 6. Comunicação & Mídia: GSA TV (Master Control, Grade, Acervo, IA), Central de Tickets  │
  │ 7. Governança & Infra: Acessos (Colaboradores), Configurações, Monitor do Sistema       │
  └─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Governança de Acessos e Regra dos Dois Homens (`AcessosModule.tsx:126-260`)
- **Snapshot de Segurança**: Carregado via RPC `gsa_admin_access_snapshot`.
- **Criação e Gestão de Colaboradores**: Executada via RPC `gsa_admin_save_collaborator`, que gera as credenciais iniciais e associa os módulos permitidos em `colaborador_modulos`.
- **Rotação de Credenciais**: Executada via RPC `gsa_admin_rotate_collaborator_credential`, revogando compulsoriamente todas as sessões ativas anteriores do colaborador.
- **Regra dos Dois Homens para Deleções Críticas**: A exclusão de clientes, faturas ou registros sensíveis não é executada diretamente. O pedido é inserido na tabela `solicitacoes_exclusao` e requer o aval de um segundo administrador via RPC `gsa_admin_review_deletion_request`.

#### Gestão Financeira Super-Domain (`FinanceiroSuperDomain.tsx`)
- **Faturamento e Fluxo de Caixa**: Visão consolidada em tempo real com conciliação automática de lançamentos bancários e extrato financeiro.
- **Saques de Crédito e Empréstimos (`CreditWithdrawalsAdminPanel.tsx`)**:
  - Auditoria de documentos KYC do solicitante armazenados no Cloudflare R2 (`getPrivateR2Url`).
  - Julgamento da solicitação via RPC `gsa_admin_decide_credit_withdrawal`.
  - Confirmação do repasse via PIX pela RPC `gsa_admin_mark_credit_withdrawal_paid`, gerando a respectiva fatura em `faturas`.

#### Resgates de Parceiros e Adjudicação de Recursos (`PartnerRedemptionDetailModal.tsx`)
- Monitoramento de resgates de benefícios com contador regressivo de SLA de 24 horas.
- Aprovação ou recusa com justificativa via RPC `gsa_admin_set_partner_redemption_status`.
- **Julgamento de Recursos**: Em caso de recurso aberto pelo cliente, o administrador analisa os argumentos e imagens de prova em `parceiros-midias` e julga via RPC `gsa_admin_decide_partner_appeal` ('deferido' | 'indeferido'), disparando a notificação de desfecho no WhatsApp com encoding UTF-8 estrito.

#### Configurações Globais e Allowlist (`ConfiguracoesModule.tsx`)
- Parâmetros corporativos carregados via `gsa_admin_settings_snapshot`.
- Atualização em lote protegida por allowlist via RPC `gsa_admin_update_settings_secure`. Chaves que não constem na lista autorizada do banco são sumariamente rejeitadas.

---

### 4.2 Módulo 2: Cliente (Consumidor PF e PJ)

O módulo do Cliente (`src/pages/ClientPortal.tsx`, `src/components/client/` e `StoreHub.tsx`) reúne 26 submódulos para pessoas físicas e jurídicas:

#### StoreHub, Catálogo e Checkout em 3 Etapas (`CheckoutPage.tsx:1-1250`)
- **Etapa 1: Endereço & Logística**: Validação de CEP via API, cálculo de frete e seleção de cupons da loja (`AvailableCouponsModal.tsx`).
- **Etapa 2: Composição Financeira & Benefícios**: Abatimento combinado de pontos de fidelidade VIP, saldo em carteira digital e seleção da modalidade de pagamento.
- **Etapa 3: Execução da Transação**:
  - **InfinitePay PIX Instantâneo**: Dispara chamada para `createInfinitePayOrderCheckout`, gerando dinamicamente QR Code e chave Pix Copia-e-Cola no modal `CheckoutPixModal.tsx`.
  - **Cartão de Crédito**: Redirecionamento para checkout hospedado seguro.
  - **Crédito GSA Store**: Utilização do limite pré-aprovado do cliente (`loja_credito_solicitacoes`) com amortização parcelada.
  - **Gravação ACID**: Disparo da RPC `gsa_client_checkout_store`, aplicando travas `FOR UPDATE` no estoque físico das variantes e criando os lançamentos contábeis.

#### Pós-Venda: Devoluções e Trocas (`StoreHubPurchases.tsx`, `LojaTrocasModule.tsx`)
- O cliente pode solicitar a devolução ou troca de produtos recebidos, anexando justificativa e fotos do item recebido.
- A solicitação é registrada na tabela `loja_solicitacoes`.
- Após a análise administrativa via RPC `gsa_admin_atualizar_solicitacao_loja`:
  - O estoque das variantes é restaurado.
  - O saldo em carteira e os pontos de fidelidade utilizados são estornados na mesma transação.
  - Caso o cliente solicite troca por um produto de maior valor, o sistema emite automaticamente uma fatura de diferença (`fatura_diferenca_id`) com prazo de 2 dias.

#### Programa de Fidelidade, Gamificação e Carteira (`ClientPontos.tsx`)
- Interface com contador de pontos com interpolação suave.
- Conversão instantânea de pontos em saldo líquido na carteira via RPC `gsa_client_convert_points`.
- Mecânica de level-up automático conforme tabela `client_levels` (Bronze -> Prata -> Ouro -> Diamante).
- Possibilidade de reversão de transferências efetuadas por engano via `gsa_client_reverse_transfer`.

#### Consulta Pública de Protocolos e Recurso de Benefício (`ProtocolConsultPage.tsx`)
- Rota acessível publicamente: `/consulta-protocolo?codigo={CODIGO}`.
- Consulta sem vazamento de dados pessoais através da RPC `gsa_public_consultar_protocolo`.
- Se o benefício tiver status `recusado`, o botão "Entrar com recurso" é habilitado para uso único.
- O cliente digita sua contestação (mínimo 20 caracteres), faz upload de até 3 evidências no storage `parceiros-midias` e valida a titularidade através de um desafio de 6 dígitos enviado por WhatsApp (`requestPartnerAppealVerification`).
- O recurso é protocolado com prazo de análise de 24 horas. O cliente acompanha as mudanças de status em tempo real via tabela `parceiros_resgates_public_status`.

---

### 4.3 Módulo 3: Fornecedor (Parceiro B2B)

O Portal do Fornecedor (`src/pages/Fornecedor/`, `src/lib/supplierOperations.ts`) gerencia a cadeia de suprimentos do marketplace:

```
  Fornecedor: Acesso e Dashboard (`FornecedorDashboard.tsx`)
       │
       ├─► Catálogo: Proposta de novos produtos / variantes (`gsa_supplier_request_product`)
       │
       ├─► Pedidos de Compra: Visualização de ordens da GSA (`gsa_supplier_mark_order_seen`)
       │
       ├─► Remessa & Faturamento: Upload de NF-e e envio do despacho (`gsa_supplier_submit_delivery`)
       │
       └─► Financeiro: Conciliação de títulos a receber e auditoria de dados bancários
```

1. **Dashboard Executivo**: Carregado via RPC `gsa_supplier_dashboard_snapshot`, apresentando pedidos de compra abertos, remessas em trânsito e títulos a receber.
2. **Proposta de Produtos ao Catálogo**: O fornecedor cadastra itens novos com fotos, especificações e custos no atacado via RPC `gsa_supplier_request_product`. O administrador revisa e homologa o produto no marketplace via `gsa_admin_review_supplier_product`.
3. **Fulfillment e Nota Fiscal (NF-e)**:
   - Ao despachar os produtos comprados pelo Grupo GSA, o fornecedor faz upload do XML/PDF da NF-e para o bucket isolado `documentos_fornecedor`.
   - Submete os dados de rastreio e comprovante via RPC `gsa_supplier_submit_delivery`.
   - A aceitação pelo administrador via RPC `gsa_admin_review_supplier_delivery` incrementa automaticamente o estoque físico de variantes em `produtos` e `produto_variantes`.
4. **Governança Financeira e Prevenção de Fraudes**:
   - Títulos a pagar são registrados em `fornecedor_titulos`. O administrador efetua o pagamento e anexa o comprovante via `gsa_admin_update_supplier_payable`.
   - Alterações de conta bancária ou chave PIX do fornecedor entram em quarentena, dependendo de aprovação expressa via RPC `gsa_admin_review_supplier_bank_change`.
   - A rotina `gsa_admin_supplier_financial_anomalies` audita discrepâncias entre valores faturados em nota fiscal e totais autorizados nos pedidos de compra.

---

### 4.4 Módulo 4: Colaborador (Funcionário Interno em Sandbox RBAC)

O perfil do Colaborador (`src/pages/RestrictedAccessHubPage.tsx`, `DemandasColaboradorModule.tsx`) opera em um ambiente rigorosamente isolado dentro da interface administrativa:

```
  RestrictedAccessHubPage.tsx (Login com Código de Acesso Único)
       │
       ▼
  sessionService.loginColaborador(code) ──► Validação de vínculo em `colaboradores`
       │
       ▼
  SecureAdminPanel.tsx (adminType = 'colaborador')
       │
       ├── Bloqueio Estrito (Hard Coded): Rotas 'acessos' e 'gsa-tv' SUMARIAMENTE PROIBIDAS
       │
       ├── Sandbox RBAC Dinâmico: Acesso exclusivo aos módulos concedidos em `colaboradorModulos`
       │
       └── DemandasColaboradorModule.tsx: Quadro Kanban filtrado exclusivamente pelas demandas atribuídas
```

1. **Autenticação Segura**: Login realizado através de código de acesso funcional. O sistema carrega o perfil do colaborador e o array de módulos autorizados (`colaboradorModulos`).
2. **Monitoramento Contínuo de Revogação**: O componente `SecureAdminPanel.tsx` mantém uma subscrição Realtime ativa sobre o cadastro do colaborador. Caso o status mude para inativo ou um módulo seja revogado pelo administrador, a sessão é destruída em tempo real.
3. **Sandbox RBAC Inviolável**:
   - Colaboradores são **terminantemente impedidos** de acessar o módulo `acessos` (onde se gerenciam outros usuários) e o módulo `gsa-tv`.
   - A navegação pelas abas administrativas é filtrada estritamente pelas permissões explícitas cadastradas no banco (`colaborador_modulos`).
4. **Quadro Kanban de Demandas (`DemandasColaboradorModule.tsx`)**:
   - A recuperação de tarefas via RPCs `gsa_collaborator_list_demands` e `gsa_collaborator_demand_history` retorna **exclusivamente** as ordens de serviço atribuídas àquele colaborador específico.
   - O colaborador gerencia as fases da demanda (`pendente`, `em_andamento`, `aguardando_cliente`, `concluida`, `cancelada`), anexa arquivos de briefing e insere comentários internos na tabela `demanda_comentarios`.

---

### 4.5 Módulo 5: Afiliado (Divulgador & Referral)

O Portal do Afiliado (`src/pages/Afiliado/`, `src/features/affiliates/service.ts`) constitui o motor de crescimento e atração de clientes do Grupo GSA:

```
  Onboarding Legal (Aceite de Termos Versionados '2026-08-affiliates-v1')
       │
       ▼
  Geração de Links Parametrizados (`gsa_client_create_affiliate_link`)
       │
       ▼
  Ponte de Atribuição no Frontend: ?ref={codigo} ──► AffiliateTrackingBridge.tsx
       │
       ▼
  Conversão de Venda ──► Registro em `afiliado_comissoes` (Status: 'pendente')
       │
       ▼
  Carência de 30 Dias (Proteção Anti-Chargeback) ──► Liberação via `gsa_admin_release_affiliate_commissions`
       │
       ▼
  Saldo Disponível: Saque PIX (`gsa_client_request_affiliate_payout`) ou Transferência P2P
```

1. **Onboarding e Contrato Versionado**: A adesão ao programa exige o aceite formal do termo legal vigente (`AFFILIATE_CURRENT_TERMS_VERSION = '2026-08-affiliates-v1'`), além do cadastro de pseudônimo público e chave PIX através da RPC `gsa_client_join_affiliate`.
2. **Atribuição de Tráfego e Links**:
   - O afiliado gera URLs parametrizadas via RPC `gsa_client_create_affiliate_link`.
   - O componente `AffiliateTrackingBridge.tsx` escuta visitas públicas com `?ref={codigo}` e grava cookies persistentes de atribuição.
3. **Ciclo de Vida das Comissões e Carência de 30 Dias**:
   - Vendas aprovadas geram comissões registradas em `afiliado_comissoes` com status `pendente`.
   - O saldo permanece retido durante o período de carência do programa (`carencia_dias`, tipicamente 30 dias) para resguardar o sistema contra devoluções, chargebacks ou desistências de compra.
   - Após o decurso do prazo, a rotina `gsa_admin_release_affiliate_commissions` converte o montante em saldo disponível.
4. **Saques e Transferências Peer-to-Peer (P2P)**:
   - Solicitação de saque PIX via RPC `gsa_client_request_affiliate_payout`, respeitando o piso mínimo global (`saque_minimo`, R$ 50,00).
   - Transferência direta de comissões entre contas de afiliados via RPC `gsa_client_transfer_affiliate_balance`.
   - Conversão de pontos de bonificação em saldo de compras no marketplace via `gsa_client_redeem_affiliate_points`.

---

### 4.6 Módulo 6: Prestador (Profissional Autônomo & Serviços de Campo)

O Portal do Prestador (`src/pages/Prestador/`, `src/lib/providerOperations.ts`) coordena a força de trabalho terceirizada do Grupo GSA:

```
  Prestador: Autenticação (`ProviderAccessPage.tsx`)
       │
       ▼
  Barreira de Conformidade (`isProviderBlocked`): Se 'pendente'/'bloqueado', travar módulos operacionais
       │
       ├─► Negociação de Demandas: Máquina de Estados (`gsa_provider_transition_demand`)
       │   ├── 'accept'        ──► Aceita honorários do admin e inicia execução
       │   ├── 'reject'        ──► Recusa justificada da demanda
       │   ├── 'counteroffer'  ──► Envia contraproposta financeira
       │   ├── 'deliver'       ──► Envia entrega final com links e arquivos de prova
       │   └── 'return'        ──► Devolve a OS para a fila administrativa
       │
       ├─► Agenda Conflit-Free: Validação server-side sem sobreposição (`gsa_provider_create_schedule`)
       │
       └─► Financeiro: Extrato em tempo real e saques via PIX (`gsa_provider_request_withdrawal`)
```

1. **Barreira de Conformidade e KYC**:
   - Prestadores possuem os status: `pendente`, `aprovado`, `ativo`, `suspenso`, `bloqueado`.
   - Caso o prestador esteja com status `pendente` ou `bloqueado`, a trava de segurança `isProviderBlocked` bloqueia o acesso aos módulos de demandas, agenda e financeiro. O prestador tem permissão de visualizar apenas seu perfil e fazer upload de documentos comprobatórios (CNH, alvará, certificados).
2. **Máquina de Estados de Ordens de Serviço (`PrestadorDemandas.tsx`)**:
   - Todas as transições de status da demanda ocorrem através da RPC `gsa_provider_transition_demand`:
     - `accept`: Aceita o valor sugerido pelo administrador (`valor_proposto_admin`), transicionando a demanda para o status `ativa`.
     - `reject`: Recusa o atendimento informando o motivo, retornando a demanda para a redistribuição administrativa.
     - `counteroffer`: Submete uma contraproposta de honorários (`valor_proposto_prestador`), alterando o status para `contraproposta_prestador`.
     - `deliver`: Realiza a entrega do serviço, preenchendo o relatório técnico, informando o link do resultado (`link_resultado`) e anexando fotos do serviço concluído, movendo o status para `em_analise`.
     - `return`: Devolve a demanda quando surgem impedimentos técnicos intransponíveis no local de atendimento.
3. **Agenda Inteligente sem Sobreposição de Horários (`PrestadorAgenda.tsx`)**:
   - O agendamento de atendimentos é gravado via RPC `gsa_provider_create_schedule`.
   - O banco de dados valida matematicamente a inexistência de sobreposição de horários com agendamentos anteriores do mesmo prestador, prevenindo choques de horários em campo.
4. **Gestão de Repasses e Saques PIX**:
   - Extrato e saldo atualizados em tempo real via RPC `gsa_provider_financial_snapshot`.
   - Solicitação de saque via PIX através da RPC `gsa_provider_request_withdrawal`, com opção de cancelamento de saques ainda pendentes pelo próprio prestador via `gsa_provider_cancel_withdrawal`.

---

## 5. CONCLUSÃO & MÉTODOS DE VERIFICAÇÃO INDEPENDENTE

### 5.1 Diagnóstico Técnico Consolidado

A análise minuciosa de toda a base de código, das 398 migrações do Supabase, dos componentes React 19 e dos microserviços na VPS permite concluir que o **GSA HUB** atinge os mais altos padrões de arquitetura corporativa:
1. **Consistência de Dados**: O banco relacional possui 294 tabelas modeladas com restrições de integridade referencial estritas (`FOREIGN KEY ... ON DELETE CASCADE/RESTRICT`), assegurando que a exclusão de clientes ou pedidos não gere inconsistências orçamentárias ou contábeis.
2. **Segurança em Múltiplas Camadas**: A eliminação de permissões permissivas globais e a consolidação de políticas RLS atreladas às claims de identidade (`gsa_jwt_actor_type()`, `gsa_jwt_actor_id()`), aliadas ao bloqueio anti-tampering de saldo de carteira, impedem mutações não autorizadas.
3. **Concorrência e Alta Disponibilidade**: O checkout com variantes utiliza travas `SELECT ... FOR UPDATE` ordenadas e cálculo de preços em memória, prevenindo furos de estoque. No ecossistema de mensageria da VPS, o `SessionMutex` no microserviço de 9.600+ linhas elimina condições de corrida entre mensagens consecutivas do WhatsApp.
4. **Experiência e Modularidade no Frontend**: O motor de roteamento customizado tipado desacopla a navegação de dependências externas, enquanto o design system baseado em Tailwind CSS v4 e Radix UI provê acessibilidade e consistência visual para os 6 perfis de usuários.

---

### 5.2 Comandos e Roteiros de Verificação Programática

Para que qualquer auditor ou membro da equipe técnica reproduza e valide independentemente a integridade de todas as afirmações contidas neste documento:

#### 1. Validação de Contratos de Esquema e RPCs do Banco de Dados
Executa a conferência em tempo real dos contratos de tabelas, colunas, RPCs e permissões:
```powershell
node scripts/validate-db-schema.cjs --snapshot-only
```
*Critério de Sucesso*: A saída deve retornar:
```text
Status do Schema: PASSED | Bloqueadores: 0 | Alertas: 0
```

#### 2. Auditoria dos Contratos de Realtime e Ausência de Memory Leaks
Verifica a resiliência dos canais WebSocket, filtros obrigatórios de linha e eliminação de stale closures:
```powershell
npm run test:realtime
```
*Critério de Sucesso*: Validação bem-sucedida de todos os canais e filtros de segurança (`REALTIME_RESILIENCE_CONTRACTS_OK`).

#### 3. Auditoria de Tipos TypeScript (Strict Mode)
Executa a validação do compilador TypeScript em todo o código-fonte:
```powershell
npx tsc --noEmit
```
*Critério de Sucesso*: Código de saída `0` sem erros de tipagem.

#### 4. Validação de Compilação do Bundle de Produção
Executa a compilação e minificação completa dos assets da aplicação:
```powershell
npm run build
```
*Critério de Sucesso*: Geração bem-sucedida da pasta `dist/` sem advertências fatais de compilação.

---
*Fim da Documentação Técnica Canônica do Sistema GSA HUB.*
