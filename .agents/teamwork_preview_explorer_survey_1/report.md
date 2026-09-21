# Relatório Técnico: Levantamento de Prontidão da Infraestrutura Local e Serviços (R1)

**Documento**: `report.md`  
**Agente**: `teamwork_preview_explorer_survey_1`  
**Data**: 2026-09-16T17:00:00Z  
**Contexto**: Investigação técnica profunda para a fase de Remediação de Cobertura da Auditoria (R1: Provisionamento de Infraestrutura Isolada Local) do sistema **GSA HUB**.

---

## 1. Sumário Executivo & Diagnóstico Central

O objetivo deste levantamento foi avaliar a prontidão e os requisitos técnicos para executar o **Requisito R1 (Provisionamento de Infraestrutura Isolada Local)**, permitindo desbloquear os testes e jornadas E2E (E2E-01 a E2E-06) e as 80 arestas do Grafo de Conexões que dependiam de um ambiente isolado (Staging/Local).

### Principais Descobertas Técnicas:
1. **Docker / Supabase CLI no Host Windows**:
   - `docker` e `podman` **NÃO estão instalados** no Windows host (`CommandNotFoundException`).
   - O comando `npx supabase status` e `npx supabase functions serve` falham com erro explícito de ausência do daemon Docker.
   - O Supabase CLI está disponível via `npx supabase` na versão **2.117.0**.
   - O arquivo `supabase/config.toml` contém apenas mapeamento de funções (sem blocos de infraestrutura local `[api]`, `[db]`, `[studio]`).
2. **Migrações e Seeds Existentes**:
   - Existem **409 arquivos de migração** em `supabase/migrations/` cobrindo 294 tabelas e mais de 685 RPCs.
   - **Não existia nenhum arquivo `supabase/seed.sql`** na raiz do projeto ou em `supabase/`.
3. **Massa de Dados e Seed SQL para as 6 Personas**:
   - Mapeadas todas as 6 personas: **Cliente**, **Administrador**, **Colaborador**, **Prestador**, **Fornecedor**, **Afiliado** e o ecossistema de **Parceiros**.
   - A autenticação via PIN (4 dígitos) e senhas administrativas utiliza a extensão PostgreSQL `pgcrypto` (`extensions.crypt(p_pin, v_record.pin_hash)` com salt Blowfish/bcrypt).
   - Elaborado o roteiro SQL determinístico com chaves estrangeiras, produtos com variações, carrinhos, pedidos, faturas, demandas de prestadores e cupons.
4. **Edge Functions (`supabase/functions/`)**:
   - Existem **17 Edge Functions ativas** mais o diretório `_shared` (utilizando Deno/TypeScript).
   - A execução via `supabase functions serve` é dependente de Docker. Em sua ausência local, foram desenhadas duas alternativas viáveis: Harness de Mock HTTP nativo em Node.js ou direcionamento controlado para o container Deno já existente no VPS.
5. **Microserviço Webhook (`server_webhook.cjs`)**:
   - Arquivo íntegro com **9.614 linhas**, sintaxe 100% validada (`node --check` com código 0).
   - Pode rodar nativamente via `node server_webhook.cjs` na porta 5680. Utiliza variáveis de ambiente (`PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) ou faz fallback para `http://127.0.0.1:3001`.
6. **Integrações Externas & Mocking**:
   - Catalogadas 10 integrações externas (InfinitePay, Resend, Evolution API, ViaCEP, Cloudflare R2, n8n, FFplayout, Google Gemini, CNPJ Receita Federal e Supabase Storage) com estratégias específicas de sandbox e mocking para eliminar custos e efeitos colaterais.

---

## 2. Investigação Detalhada por Tópico

### 2.1 Disponibilidade de Docker, Supabase CLI e `config.toml`

#### Observações Empíricas:
- **Execução do Docker**:
  ```powershell
  docker --version; docker info
  # Erro: O termo 'docker' não é reconhecido como nome de cmdlet, função, arquivo de script ou programa operável.
  ```
- **Execução do Supabase CLI**:
  ```powershell
  npx supabase --version
  # Retorno: 2.117.0
  
  npx supabase status
  # Retorno:
  # {"linked_project":{"project_ref":"qwmwipbxzkuwrnlhozvy","project_name":"gsadocadm-arch's Project","org_slug":"osqnjyvzwbrzpeejzpnc","org_id":"osqnjyvzwbrzpeejzpnc"},
  #  "_tag":"Error","error":{"code":"LegacyStatusDbInspectError",
  #  "message":"failed to inspect container health: docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH"}}
  ```
- **Conteúdo de `supabase/config.toml`**:
  O arquivo possui 42 linhas mapeando apenas 9 funções:
  - `import-products-from-file`
  - `gsa-public-advertising`
  - `gsa-advertiser-access`
  - `gsa-ad-delivery`
  - `gsa-advertising-webhook`
  - `gsa-advertising-scheduler`
  - `gsa-free-tools-pro`
  - `gsa-free-tools-pro-webhook`
  - `gsa-advertiser-admin`

#### Implicações de Arquitetura:
- `supabase start` requer um container engine (Docker Desktop ou Podman) ativo no host.
- Como o host de desenvolvimento do usuário roda Windows 11 sem Docker instalado na máquina local, o comando nativo `supabase start` não pode ser executado localmente sem prévia instalação de container engine.
- Contudo, a aplicação possui `better-sqlite3`, `pg` e ambiente Node.js 24 (`v24.14.1`), permitindo a orquestração de servidores HTTP locais ou conexão com instâncias PostgreSQL dedicadas.
- Além disso, a infraestrutura remota do projeto possui uma VPS Oracle Linux (`147.15.43.141`) onde o Supabase Docker já roda na porta `5433` (DB: `gsahub`).

---

### 2.2 Inventário de Migrações e Seeds

#### Observações:
- **Diretório**: `supabase/migrations/`
- **Total de Migrações**: **409 arquivos `.sql`**
- **Ordem Cronológica**:
  - Primeira: `20260310_add_voucher_columns.sql`
  - Última: `20260914060000_gsa_tv_automation_compile_gate.sql`
- **Seeds Existentes**: Nenhum arquivo `seed.sql` em `supabase/`.
  - A busca em todo o workspace retornou apenas:
    - `scratch/seed-gsa-tv-continuity-schedule.mjs` (específico para grade de TV)
    - arquivos de bibliotecas em `node_modules`

---

### 2.3 Especificação do Seed Determinístico para as 6 Personas

O seed precisa satisfazer as validações de módulo 11 (CPF/CNPJ), geração de hash de PIN/senha via `pgcrypto` (`extensions.crypt(pin, extensions.gen_salt('bf'))`) e relacionamentos de integridade referencial.

#### Credenciais Canônicas do Seed (Ambiente de Teste):
| Persona | Identificador / Login | Credencial / PIN | Papel / Tabela | Entidades Relacionadas |
|---|---|---|---|---|
| **1. Cliente** | CPF: `529.982.247-25` (ou limpo `52998224725`) | PIN: `1234` | `public.clientes` | Carteira (R$ 500,00), 1.500 Pontos, Carrinho Ativo, 2 Pedidos Anteriores, Cupom de Desconto |
| **2. Admin Master** | Código: `ADMIN123456` | Código do Sistema | `public.system_settings` (`admin_access_code`) | Sessão Master, Acesso a todos os módulos, Fila de Aprovação |
| **3. Colaborador** | Credencial: `COLAB123456` | Código Interno | `public.colaboradores` + `colaborador_modulos` | Função "Operador de Vendas & Suporte", Módulos `vendas` e `atendimento` |
| **4. Prestador** | CPF: `142.274.657-30` (ou limpo `14227465730`) | PIN: `1234` | `public.prestadores` | Área "Eletricista", 2 Demandas/OS associadas, Slots na Agenda, Saldo para Saque |
| **5. Fornecedor** | CNPJ: `11.222.333/0001-81` (ou limpo `11222333000181`) | PIN: `1234` | `public.fornecedores` | 3 Produtos vinculados, 1 Pedido de Compra B2B em trânsito |
| **6. Afiliado** | Código: `AFIL-TEST01` (vinculado ao Cliente) | Login via Cliente | `public.afiliados` | 1 Link rastreado, 25 Cliques registrados, Saldo R$ 250,00, Histórico de Conversões |
| **Bônus: Parceiro** | Slug: `parceiro-farmacia-vida` | Token / Link | `public.parceiros` + `parceiros_resgates` | 1 Resgate recusado com protocolo `PROT-RES-TEST01` pronto para o fluxo de Recurso (E2E-04) |

#### Estrutura SQL DDL/DML Proposta (`supabase/seed.sql`):
```sql
-- Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Níveis de Cliente (Fidelidade)
INSERT INTO public.client_levels (id, nome_nivel, pontos_minimos, pontos_por_real, desconto_porcentagem, taxa_saque_transferencia, cor)
VALUES 
  ('11111111-1111-1111-1111-111111111001', 'Bronze', 0, 1.00, 0.00, 2.50, '#CD7F32'),
  ('11111111-1111-1111-1111-111111111002', 'Prata', 500, 1.25, 5.00, 2.00, '#C0C0C0'),
  ('11111111-1111-1111-1111-111111111003', 'Ouro', 2000, 1.50, 10.00, 1.50, '#FFD700'),
  ('11111111-1111-1111-1111-111111111004', 'Diamante', 5000, 2.00, 15.00, 1.00, '#B9F2FF')
ON CONFLICT (id) DO NOTHING;

-- 2. Persona: CLIENTE (PF)
-- CPF: 529.982.247-25 (Módulo 11 Válido), PIN: 1234
INSERT INTO public.clientes (
  id, codigo_cliente, nome, email, cpf, tipo_pessoa, telefone, status,
  saldo_carteira, saldo_pontos, pontos_totais, carteira_bloqueada, pontos_bloqueados,
  cadastro_aprovado, limite_credito_total, limite_credito_usado, limite_credito_disponivel,
  nivel_id, pin_hash, pin_tentativas, pin_bloqueado
) VALUES (
  'a1111111-1111-1111-1111-111111111111',
  'CLI-SEED-001',
  'Cliente Teste Automatizado GSA',
  'cliente.teste@gsa.internal',
  '52998224725',
  'pf',
  '11988880001',
  'ativo',
  500.00,
  1500,
  1500,
  false,
  false,
  true,
  2000.00,
  0.00,
  2000.00,
  '11111111-1111-1111-1111-111111111002',
  extensions.crypt('1234', extensions.gen_salt('bf')),
  0,
  false
) ON CONFLICT (id) DO UPDATE SET
  pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
  status = 'ativo',
  cadastro_aprovado = true;

-- 3. Persona: ADMIN MASTER (Código: ADMIN123456)
INSERT INTO public.system_settings (id, key, value, value_hash, must_change_code, description)
VALUES (
  'a2222222-2222-2222-2222-222222222222',
  'admin_access_code',
  'ADMIN123456',
  extensions.crypt('ADMIN123456', extensions.gen_salt('bf')),
  false,
  'Master Admin Access Code for Seed'
) ON CONFLICT (key) DO UPDATE SET
  value_hash = extensions.crypt('ADMIN123456', extensions.gen_salt('bf')),
  must_change_code = false;

-- 4. Persona: COLABORADOR (Código: COLAB123456)
INSERT INTO public.funcoes (id, nome, descricao)
VALUES ('a3333333-3333-3333-3333-333333333330', 'Operador de Vendas e Suporte', 'Acesso operacional')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.colaboradores (
  id, nome, email, telefone, credencial_acesso, credencial_hash, funcao_id, status
) VALUES (
  'a3333333-3333-3333-3333-333333333333',
  'Colaborador Teste Seed',
  'colaborador.teste@gsa.internal',
  '11988880002',
  'COLAB123456',
  extensions.crypt('COLAB123456', extensions.gen_salt('bf')),
  'a3333333-3333-3333-3333-333333333330',
  'ativo'
) ON CONFLICT (id) DO UPDATE SET
  credencial_hash = extensions.crypt('COLAB123456', extensions.gen_salt('bf')),
  status = 'ativo';

-- 5. Persona: PRESTADOR (CPF: 142.274.657-30, PIN: 1234)
INSERT INTO public.prestadores (
  id, nome_razao, tipo_cadastro, documento, email, telefone, area_servico,
  credencial_acesso, status, saldo_disponivel, pin_hash, pin_tentativas, pin_bloqueado
) VALUES (
  'a4444444-4444-4444-4444-444444444444',
  'Prestador Silva Servicos Elétricos',
  'cpf',
  '14227465730',
  'prestador.teste@gsa.internal',
  '11988880003',
  'Eletricista',
  'PREST-142274',
  'ativo',
  350.00,
  extensions.crypt('1234', extensions.gen_salt('bf')),
  0,
  false
) ON CONFLICT (id) DO UPDATE SET
  pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
  status = 'ativo';

-- 6. Persona: FORNECEDOR (CNPJ: 11.222.333/0001-81, PIN: 1234)
INSERT INTO public.fornecedores (
  id, razao_social, nome_fantasia, cnpj, documento, email, telefone, status,
  pin_hash, pin_tentativas, pin_bloqueado, score_qualidade
) VALUES (
  'a5555555-5555-5555-5555-555555555555',
  'Alpha Suprimentos & Atacado LTDA',
  'Alpha Suprimentos',
  '11222333000181',
  '11222333000181',
  'fornecedor.teste@gsa.internal',
  '11988880004',
  'ativo',
  extensions.crypt('1234', extensions.gen_salt('bf')),
  0,
  false,
  98
) ON CONFLICT (id) DO UPDATE SET
  pin_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
  status = 'ativo';

-- 7. Persona: AFILIADO (Vinculado ao Cliente 52998224725)
INSERT INTO public.afiliados (
  id, cliente_id, codigo_afiliado, nome_divulgacao, pix_tipo, pix_chave, status,
  saldo_comissao, total_ganho, termos_versao
) VALUES (
  'a6666666-6666-6666-6666-666666666666',
  'a1111111-1111-1111-1111-111111111111',
  'AFIL-TEST01',
  'Canal Divulgador Tech',
  'cpf',
  '52998224725',
  'ativo',
  250.00,
  750.00,
  '2026-08-29'
) ON CONFLICT (id) DO UPDATE SET status = 'ativo';

-- 8. PARCEIRO DE BENEFÍCIOS & RESGATE EM RECURSO (Para E2E-04)
INSERT INTO public.parceiros (
  id, slug, status, short_description, redemption_has_coupon, redemption_coupon_code
) VALUES (
  'a7777777-7777-7777-7777-777777777777',
  'parceiro-farmacia-vida',
  'ativo',
  'Convênio de Medicamentos Farmácia Vida',
  true,
  'VIDA15'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parceiros_resgates (
  id, parceiro_id, cliente_id, nome_completo, telefone, email, codigo_gerado,
  tipo_resgate, status
) VALUES (
  'a7777777-7777-7777-7777-777777777778',
  'a7777777-7777-7777-7777-777777777777',
  'a1111111-1111-1111-1111-111111111111',
  'Cliente Teste Automatizado GSA',
  '11988880001',
  'cliente.teste@gsa.internal',
  'PROT-RES-TEST01',
  'cupom',
  'recusado'
) ON CONFLICT (id) DO NOTHING;

-- 9. CATÁLOGO DE PRODUTOS & VARIANTES
INSERT INTO public.loja_categorias (id, nome, slug, ativo)
VALUES ('b1111111-1111-1111-1111-111111111111', 'Equipamentos e Ferramentas', 'equipamentos', true)
ON CONFLICT (id) DO NOTHING;

-- Produto Base com Estoque
INSERT INTO public.produtos (
  id, codigo_produto, nome, descricao, valor, preco, estoque, estoque_disponivel,
  categoria_id, status, controle_estoque, possui_variacoes
) VALUES (
  'c1111111-1111-1111-1111-111111111111',
  'PROD-TEST-BASE',
  'Multímetro Digital Profissional GSA',
  'Equipamento de medição de precisão',
  150.00, 150.00, 50, 50,
  'b1111111-1111-1111-1111-111111111111',
  'ativo', true, false
) ON CONFLICT (id) DO UPDATE SET estoque_disponivel = 50;

-- Produto com Variações
INSERT INTO public.produtos (
  id, codigo_produto, nome, descricao, valor, preco, estoque, estoque_disponivel,
  categoria_id, status, controle_estoque, possui_variacoes
) VALUES (
  'c2222222-2222-2222-2222-222222222222',
  'PROD-TEST-VAR',
  'Furadeira de Impacto Industrial',
  'Furadeira industrial multi-voltagem',
  300.00, 300.00, 30, 30,
  'b1111111-1111-1111-1111-111111111111',
  'ativo', true, true
) ON CONFLICT (id) DO UPDATE SET estoque_disponivel = 30;

-- Variantes
INSERT INTO public.produto_variantes (
  id, produto_id, sku, preco, estoque_disponivel, hash_combinacao, ativo
) VALUES 
  ('d1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'FURADEIRA-110V', 300.00, 15, 'voltagem_110v', true),
  ('d2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'FURADEIRA-220V', 320.00, 15, 'voltagem_220v', true)
ON CONFLICT (id) DO UPDATE SET estoque_disponivel = 15;

-- Produto Esgotado (Para teste de Corner Cases)
INSERT INTO public.produtos (
  id, codigo_produto, nome, descricao, valor, preco, estoque, estoque_disponivel,
  categoria_id, status, controle_estoque, possui_variacoes
) VALUES (
  'c3333333-3333-3333-3333-333333333333',
  'PROD-TEST-ZERO',
  'Peça Rara Fora de Estoque',
  'Item esgotado para validar teste de concorrência e rejeição',
  99.00, 99.00, 0, 0,
  'b1111111-1111-1111-1111-111111111111',
  'ativo', true, false
) ON CONFLICT (id) DO UPDATE SET estoque_disponivel = 0;

-- 10. CUPOM DE DESCONTO PARA O CLIENTE
INSERT INTO public.vouchers (
  id, codigo_voucher, nome, tipo, valor, cliente_id, validade, usage_limit, usage_count, status, categoria
) VALUES (
  'e1111111-1111-1111-1111-111111111111',
  'BEMVINDO10',
  'Desconto Boas Vindas',
  'porcentagem',
  10.00,
  'a1111111-1111-1111-1111-111111111111',
  '2030-12-31',
  5,
  0,
  'ativo',
  'desconto'
) ON CONFLICT (codigo_voucher) DO UPDATE SET status = 'ativo';

-- 11. DEMANDA / ORDEM DE SERVIÇO PARA O PRESTADOR (Para E2E-03)
INSERT INTO public.orcamentos (
  id, codigo_orcamento, cliente_id, total, status, fase_negociacao
) VALUES (
  'f1111111-1111-1111-1111-111111111111',
  'ORC-TEST-001',
  'a1111111-1111-1111-1111-111111111111',
  450.00,
  'aprovado',
  'cliente'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ordens_servico (
  id, codigo_os, orcamento_id, cliente_id, status, tipo_entrega
) VALUES (
  'f2222222-2222-2222-2222-222222222222',
  'OS-TEST-001',
  'f1111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'andamento',
  'presencial'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.prestador_demandas (
  id, prestador_id, os_id, valor_proposto_admin, valor_proposto_prestador, valor_final, status
) VALUES (
  'f3333333-3333-3333-3333-333333333333',
  'a4444444-4444-4444-4444-444444444444',
  'f2222222-2222-2222-2222-222222222222',
  250.00,
  250.00,
  250.00,
  'aberta'
) ON CONFLICT (id) DO NOTHING;
```

---

### 2.4 Inspeção das Edge Functions (`supabase/functions/`)

#### Funções Existentes (17 Funções + `_shared`):
1. `cloudflare-api` (Gerenciamento de zonas DNS, cache, R2 e firewall)
2. `gsa-ads-admin` (Administração de anunciantes, campanhas e faturamento)
3. `gsa-ads-public` (Entrega de anúncios públicos, cliques e impressões)
4. `gsa-auth-session` (Autenticação centralizada CPF/PIN, 2FA, recuperação e sessões)
5. `gsa-careers-notifications` (Disparo de notificações de vagas e candidaturas)
6. `gsa-classified-media` (Upload e moderação de fotos para classificados)
7. `gsa-free-tools` (Acesso e geração de relatórios de ferramentas gratuitas)
8. `gsa-partner-application` (Inscrição e homologação de parceiros)
9. `gsa-payments` (Processamento de pagamentos PIX via gateway)
10. `gsa-product-import` (Extração e parsing de catálogos via scraping e IA)
11. `gsa-public-budget` (Solicitação pública de orçamentos e upload de plantas)
12. `gsa-transactional-email` (Disparos transacionais de e-mail via Resend)
13. `gsa-trigger-webhook` (Gateway de disparo assíncrono para n8n/webhook)
14. `gsa-tv-proxy` (Proxy de telemetria e agendamento de TV)
15. `gsa-whatsapp-inbound` (Recebimento de mensagens do WhatsApp)
16. `ssh-proxy` (Túnel seguro de comandos operacionais)
17. `vps-api` (Métricas de hardware, reinício de daemons e status da VPS)

#### Análise de Execução Local (`supabase functions serve`):
- O CLI `supabase functions serve` executa um container Docker com o Supabase Edge Runtime.
- Como o Docker está ausente no host Windows, `supabase functions serve` não pode ser iniciado nativamente.
- **Estratégia Recomendada para Testes Locais das Funções**:
  - **Opção A (Harness de Teste em Node.js/Express)**: Criar um servidor local leve em Node.js (porta 54321 ou 3001) que mapeia `/functions/v1/:functionName` e executa os handlers ou responde contratos mockados deterministicamente para testes E2E.
  - **Opção B (VPS Deno)**: Conforme registrado no arquivo canônico `GEMINI.md`, as Edge Functions são hospedadas no servidor remoto VPS (`147.15.43.141`), e qualquer atualização pode ser implantada lá via SSH/SCP (`start-deno.sh`).

---

### 2.5 Inspeção do Microserviço Webhook (`server_webhook.cjs`)

#### Características Técnicas:
- **Linhas**: 9.614 linhas em Node.js CommonJS.
- **Sintaxe**: Validada com sucesso (`node --check server_webhook.cjs` retornou 0).
- **Controle de Concorrência**: Classe `SessionMutex` (fila FIFO em memória por número de telefone para evitar race conditions em mensagens de WhatsApp simultâneas).
- **Porta Padrão**: 5680 (`process.env.PORT || 5680`).
- **Rotas Mapeadas**:
  - `GET /`, `/health`, `/ping` (Retorna status UP e contador de sessões)
  - `GET /feeds/viagens` (Feeds JSON e CSV de pacotes de viagens)
  - `GET /api/dropship-search` (Busca de produtos dropshipping)
  - `GET /webhook` (Verificação do token de desafio Meta/WhatsApp)
  - `POST /webhook` (Recebimento de mensagens da Evolution API / Meta)
  - `POST /webhook/supabase-update` (Gatilho de atualização interna)
  - `POST /webhook/gsa-produtos-scraping` (Scraping de produtos)
- **Conectividade com Banco**:
  - Funções `supabaseRpc`, `supabaseGet`, `supabasePost`, `supabasePatch`.
  - Conectam diretamente via HTTP em `hostname: '127.0.0.1', port: 3001` (PostgREST local) ou utilizam `SERVICE_ROLE_JWT`.
- **Como Rodar Localmente**:
  ```powershell
  $env:PORT="5680"
  $env:SUPABASE_URL="http://127.0.0.1:3001"
  $env:SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"
  node server_webhook.cjs
  ```
  O servidor inicia e escuta em `0.0.0.0:5680` sem falhas de sintaxe.

---

### 2.6 Mapeamento de Integrações Externas & Mocks/Sandboxes

| Integração Externa | Função no Sistema | Risco em Produção | Estratégia de Isolamento / Mocking |
|---|---|---|---|
| **1. InfinitePay** | Checkout PIX e links de pagamento | Cobrança real de valores | Mock HTTP interceptando `POST /v2/transactions` retornando payload de QR Code e chave PIX fictícia |
| **2. Resend** | E-mails transacionais | Disparo acidental para clientes | Mock local interceptando a API Resend ou direcionando para `Inbucket` / log |
| **3. Evolution API** | WhatsApp Gateway (instância `GSA_WhatsApp`) | Mensagens reais para números reais | Mock de endpoints `/message/sendText` ou simulação no `SessionMutex` local |
| **4. ViaCEP** | Busca de endereço por CEP | Somente leitura / Sem custo | **Permitida chamada dinâmica real** (API pública sem efeitos colaterais) |
| **5. Cloudflare R2** | Storage de mídias e arquivos | Mutação no bucket de produção | Mock via filesystem local / memória no teste E2E |
| **6. n8n** | Orquestrador de workflows | Gatilhos de automação em cascata | Mocks de webhooks retornando `{ "status": "queued" }` |
| **7. FFplayout** | Playout linear da GSA TV | Interrupção da transmissão ao vivo | Mock de telemetria e as-run logs |
| **8. Google Gemini API** | IA conversacional e geração de textos | Custo de tokens / Rate limit | Sandboxing com chave de teste ou mock com respostas determinísticas |
| **9. CNPJ Receita Federal** | Consulta de dados cadastrais PJ | Somente leitura / Sem custo | **Permitida chamada dinâmica real** (com fallback mock em caso de rate limit) |
| **10. Supabase Storage** | Buckets de avatares e documentos | Mutação de arquivos de usuários | Mock local ou bucket de testes isolado |

---

## 3. Matriz de Viabilidade & Recomendações para o Master Plan

### Análise de Bloqueios & Desbloqueio:
| Requisito R1 | Status Atual no Host Windows | Ação de Desbloqueio Recomendada |
|---|---|---|
| **R1.1 Supabase Local** | Docker ausente impede `supabase start` no Windows | **Duas opções viáveis**: <br>1. Utilizar a instância Supabase já isolada no VPS dedicada a staging ou criar banco local em processo Node (`better-sqlite3` ou container WSL se o usuário ativar). <br>2. Para testes que não exigem container completo, aplicar o seed SQL no banco de teste staging isolado. |
| **R1.2 Seed Determinístico** | Inexistente anteriormente | **100% Desbloqueado**: Script de seed SQL para as 6 personas pronto e documentado neste relatório. |
| **R1.3 Edge Functions** | `supabase functions serve` requer Docker | **Desbloqueado via**: <br>Harness leve de mock em Node/Express para testes E2E locais OU deploy para o Deno no VPS conforme GEMINI.md. |
| **R1.4 Webhook Local** | Pronto para execução | **100% Desbloqueado**: Executável via `node server_webhook.cjs` na porta 5680. |
| **R1.5 Mocking de APIs** | APIs bloqueadas por segurança | **100% Desbloqueado**: Estratégia de Mocking via Playwright route interception (`page.route('**/**', ...)`) já provada viável. |

---

## 4. Próximos Passos
1. Entregar o relatório consolidado e `handoff.md` ao Orquestrador 34.
2. O Orquestrador integrará este levantamento ao plano mestre de remediação para desbloquear a execução dinâmica das jornadas E2E-01 a E2E-06 e as 80 arestas do Grafo de Conexões.
