# Project: Auditoria Completa de QA, Segurança e Arquitetura — Grupo GSA

## Architecture
- **Frontend Architecture**: React 18, Vite, TypeScript, Tailwind CSS, Lucide icons, Supabase client SDK (`@supabase/supabase-js`).
  - Painéis de Papéis:
    - Prestador: `src/components/prestador/` & `src/pages/ProviderAccessPage.tsx`
    - Parceiro & Fornecedor: `src/components/admin/super-domains/pessoas/` & `src/components/admin/FornecedoresModule.tsx`, `PartnersAdminModule.tsx`
    - Colaborador & Admin: `src/components/admin/` & `src/components/admin/super-domains/`
    - Afiliado: `src/components/afiliado/` & `src/components/client/ClientAffiliatePanel.tsx`
    - Anunciante: `src/pages/AdvertiserPortal.tsx` & `src/components/admin/AdvertisingAdminModule.tsx`
    - Cliente / Loja: `src/components/client/`
- **Backend Architecture**: PostgreSQL (Supabase) via 397 migrations versionadas em `supabase/migrations/`.
  - Controle de Acesso: Row Level Security (RLS) baseado em claims JWT (`gsa_jwt_actor_type()` e `gsa_jwt_actor_id()`).
  - Camada de Segurança Financeira: Procedimentos armazenados (PL/pgSQL RPCs) com travas de concorrência (`FOR UPDATE`), proteção de integridade via triggers (`prevent_saldo_tampering()`) e encapsulamento `SECURITY DEFINER`.
- **Integration Layer**:
  - Edge Functions: 16 funções em `supabase/functions/` (incluindo `gsa-transactional-email`, `vps-api`, `cloudflare-api`, `ssh-proxy`, `gsa-payments`).
  - Webhooks VPS: `server_webhook_vps_live.cjs` e `server_webhook.cjs` com filas `SessionMutex`, processamento atômico e UTF-8 estrito.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Revogação e Exclusão da RPC `sync_cliente_pontos_e_saldo` | Revogar grants de `anon`/`public` e remover RPC vulnerável que permite injeção de saldo/pontos contornando trigger | M1 | Survey DB |
| 2 | Endurecimento do Trigger `prevent_saldo_tampering()` | Garantir que o trigger impeça mutações de saldo/pontos também para roles `anon` e `public` | M1 | Survey DB |
| 3 | Eliminação de 8 Políticas RLS Wildcard `USING (true)` | Remover políticas abertas residuais em `faturas`, `ordens_servico`, `saques`, `transferencias`, `contratos`, `orcamento_timeline`, `sistema_logs`, `whatsapp_pendencias_ativas` | M1 | Survey DB |
| 4 | Políticas RLS para Prestador (`transacoes`, `saques`, `vouchers`) | Criar políticas de `SELECT` para prestador autenticado em suas próprias transações, saques e vouchers | M1 | Survey DB |
| 5 | Políticas RLS para Promoções de Loja (`promocoes_quantidade`) | Habilitar RLS e criar política de leitura de promoções ativas para clientes da loja | M1 | Survey DB |
| 6 | Hardening de `search_path` em Funções `SECURITY DEFINER` | Adicionar `SET search_path = public, pg_temp` em `gsa_generate_unique_product_code()` e restringir RPCs de saque via webhook a `service_role` | M1 | Survey DB |
| 7 | Desbloqueio de Login do Portal de Anunciantes | Ajustar `routeSecurity.ts:33` para permitir acesso de novos anunciantes à tela de login/portal | M2 | Survey FE |
| 8 | Correção de Query SQL no Extrato do Prestador | Ajustar `PrestadorFinanceiro.tsx:198` para buscar coluna `nome_razao` em vez de `nome_completo` na tabela `prestadores` | M2 | Survey FE |
| 9 | Registro da Rota de Perfil do Prestador | Adicionar `profile: '/prestador/perfil'` em `src/routes/routeCatalog.ts` | M2 | Survey FE |
| 10 | Estágio de Sucesso no Credenciamento de Prestador | Renderizar estágio `'success'` após conclusão do PIN em `ProviderAccessPage.tsx` | M2 | Survey FE |
| 11 | Tratamento de Erros e Logs em Funções Assíncronas | Substituir catches vazios por logs explícitos em `features/partners/service.ts:313` e `PrestadorDemandas.tsx:140` | M2 | Survey FE |
| 12 | Otimização de Assinatura WebSocket Realtime | Aplicar debounce na busca de `PrestadoresFinanceiro.tsx` para evitar recriação de canal a cada tecla | M2 | Survey FE |
| 13 | Correção de Tabela e Autenticação em `gsa-transactional-email` | Trocar tabela inexistente `clientes_pf` por `clientes` e adicionar cabeçalho de autenticação webhook | M3 | Survey Integ |
| 14 | Alinhamento de Assinatura RPC em `ProviderAccessPage.tsx` | Passar `p_verification_token` na chamada a `gsa_public_register_provider` conforme migração `20260830123000` | M3 | Survey Integ |
| 15 | Fechamento de Segurança em `vps-api` | Remover `isAuthorized = true`, ler chaves da API e IPs via `Deno.env.get()` e sanitizar requisições | M3 | Survey Integ |
| 16 | RBAC em `cloudflare-api` e `ssh-proxy` | Validar role de `admin` ou `colaborador` antes de executar operações de DNS/WAF/SSH | M3 | Survey Integ |
| 17 | Alinhamento de Contratos de Teste em `AfiliadoDashboard` e `CareersLandingPage` | Expor `activateClientProfileFromAffiliate` e listar vagas via `gsa_public_list_career_vacancies` | M3 | Survey Integ |
| 18 | Ajuste de Falsos-Positivos no Linter de Produção | Ajustar regex em `scripts/audit-production-real.mjs` para desconsiderar comentários informativos | M3 | Survey Integ |
| 19 | Verificação Programática Completa de Compilação e Testes | Executar `tsc --noEmit`, `npm run build`, `npm run lint`, scripts de verificação de contratos e simulação de concorrência | M4 | Protocol |
| 20 | Revisão Independente e Desafio Adversarial | 2 Reviewers, 2 Challengers e 1 Forensic Auditor para validação com veto binário | M5 | Protocol |
| 21 | Relatório Final Consolidado e Sign-off | Laudo conclusivo atestando ecossistema GSA 100% à prova de balas | M6 | Deliverable |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Security & RLS Remediation | Migração SQL `20260911030000_comprehensive_database_security_remediation.sql` (Features 1-6) | Survey | PLANNED |
| M2 | Frontend Panels & UI Remediation | Patches nos painéis Anunciante, Prestador, Parceiro, rotas e formulários (Features 7-12) | Survey | PLANNED |
| M3 | Edge Functions & Interface Contracts | Patches em Edge Functions e alinhamento de contratos de teste (Features 13-18) | Survey | PLANNED |
| M4 | Programmatic Build & Test Validation | `tsc --noEmit`, `npm run build`, `npm run lint`, `check-*-contracts.ts` (Feature 19) | M1, M2, M3 | PLANNED |
| M5 | Review, Challenge & Forensic Audit | 2 Reviewers, 2 Challengers, 1 Forensic Auditor (Feature 20) | M4 | PLANNED |
| M6 | Consolidated Final Report & Sign-off | Síntese global e entrega ao parent sentinel (Feature 21) | M5 | PLANNED |

## Interface Contracts
### Client & Provider ↔ PostgreSQL RLS
- Tabelas operacionais do prestador (`prestador_transacoes`, `prestador_saques`, `prestador_vouchers`) devem possuir políticas de `SELECT` ativas restringindo a `prestador_id = public.gsa_jwt_actor_id()`.
- Tabela `promocoes_quantidade` deve permitir leitura pública para `status = 'ativo'`.
- Nenhuma tabela sensível (`faturas`, `ordens_servico`, `saques`, `transferencias`, `contratos`, etc.) pode possuir política aberta com `USING (true)`.

### Provider Registration RPC Contract
- `public.gsa_public_register_provider(p_payload jsonb, p_verification_token text)`: A chamada front-end DEVE enviar obrigatoriamente os 2 parâmetros `p_payload` e `p_verification_token`.

### Transactional Email Edge Function Contract
- Endpoint `gsa-transactional-email` deve consultar a tabela `public.clientes` (e nunca a inexistente `clientes_pf`) e rejeitar requisições sem Bearer token de autenticação.

## Code Layout
- SQL Migrations: `supabase/migrations/`
- Edge Functions: `supabase/functions/`
- Frontend Components: `src/components/`
- Frontend Pages: `src/pages/`
- Routes & Navigation: `src/routes/`
- Verification Scripts: `scripts/`
- Metadata: `.agents/`
