# Context Briefing for teamwork_preview_orchestrator_24

## Original User Request
Refer to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` under header `## 2026-09-11T02:18:50Z`.

## Task Objective
Levantamento técnico profundo de ponta a ponta do sistema, resultando na criação de um único documento técnico centralizado (`DOCUMENTACAO_SISTEMA.md`) na raiz do projeto, detalhando e mapeando o banco de dados e as funcionalidades do frontend.

## Core Requirements & Deliverables

### R1. Mapeamento do Banco de Dados (Backend)
- Documentar esquema do banco de dados (tabelas principais, políticas RLS relevantes e RPCs vitais do sistema, como transações financeiras e autenticação).
- Basear-se em leitura profunda de scripts SQL, migrations (`supabase/migrations/`) e código do backend.

### R2. Mapeamento do Frontend (React)
- Analisar diretório `src/` e documentar a arquitetura visual.
- Mapear com precisão os módulos de:
  - Admin
  - Cliente
  - Fornecedor
  - Colaborador
  - Afiliado
  - Prestador
- Documentar as integrações de API e chamadas de RPC/Supabase.

### R3. Criação do Documento Central
- Consolidar todas as descobertas em um único arquivo: `DOCUMENTACAO_SISTEMA.md` na raiz do projeto (`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\DOCUMENTACAO_SISTEMA.md`).
- O documento deve explicar as regras de negócio exatas do sistema baseadas na leitura real do código-fonte.

## Acceptance Criteria
- [ ] O arquivo `DOCUMENTACAO_SISTEMA.md` deve existir na raiz do diretório do projeto.
- [ ] O documento deve conter seções explícitas para o Banco de Dados (listando tabelas/RPCs) e para o Frontend (listando módulos de usuários: Admin, Cliente, Fornecedor, Colaborador, Afiliado, Prestador).
- [ ] O documento deve ter mais de 100 linhas, comprovando um nível de profundidade analítica condizente com a leitura do código-fonte e não apenas uma sumarização superficial.

## Workspace & Directories
- Project Root: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`
- Working Directory: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_24`
