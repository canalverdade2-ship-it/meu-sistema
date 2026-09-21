# Plano de Execução: Remediação de Cobertura da Auditoria

## Identidade e Papel
- Orquestrador: `teamwork_preview_orchestrator_34`
- Diretório de Trabalho: `.agents/teamwork_preview_orchestrator_34/`
- Modo: DISPATCH-ONLY (todas as ações técnicas, testes e códigos executadas via subagentes especializados).

## Fases do Plano

### Fase 1: Survey Técnico & Diagnóstico de Infraestrutura
- **Objetivo**: Mapear o estado atual do Supabase local (Docker, CLI), scripts de migração/seed existentes, suíte E2E existente (`tests/` ou `e2e/`), servidor webhook, e os 9 relatórios na raiz.
- **Subagente**: `teamwork_preview_explorer` (`.agents/teamwork_preview_explorer_survey/`)
- **Entregável**: Relatório de inventário técnico e prontidão para provisionamento local.

### Fase 2: Provisionamento da Infraestrutura Isolada e Seed Determinístico (R1)
- **Objetivo**:
  - Iniciar Supabase localmente (`supabase start` / `supabase db reset --local`).
  - Desenvolver/aplicar script de seed SQL determinístico abrangendo as 6 personas (cliente, admin/colaborador, prestador, fornecedor, afiliado, parceiro) e entidades correlatas (produtos, pedidos, OS, agendamentos, fidelidade, cupons).
  - Inicializar Edge Functions localmente (`supabase functions serve`) e Webhook local (`node server_webhook.cjs` ou mock local).
  - Configurar sandboxes/mocks de APIs externas.
- **Subagentes**: `teamwork_preview_worker` (`.agents/teamwork_preview_worker_infra/`) e `teamwork_preview_reviewer` (`.agents/teamwork_preview_reviewer_infra/`).

### Fase 3: Execução Dinâmica Completa — 6 Jornadas E2E e 80 Arestas (R2)
- **Objetivo**:
  - Executar as 6 Jornadas E2E completas (E2E-01 a E2E-06) contra o ambiente local (sem dados de produção).
  - Testar dinamicamente todas as 80 arestas do `GRAFO_CONEXOES`, gerando evidências individuais para cada aresta.
  - Validar persistência real no banco local, propagação entre módulos (A -> B) e regras de RLS (testes positivos e negativos).
- **Subagentes**: `teamwork_preview_worker` (`.agents/teamwork_preview_worker_e2e_edges/`), `teamwork_preview_challenger` (`.agents/teamwork_preview_challenger_dynamic/`).

### Fase 4: Auditoria de Taxonomia, Classificação de Bugs e Reconciliação dos 9 Relatórios (R3 & R4)
- **Objetivo**:
  - Validar a aplicação uniforme da taxonomia estrita de 7 estados em todas as tabelas e relatórios.
  - Reclassificar BUG-001 a BUG-006 como `BUG DA SUÍTE DE TESTE`.
  - Produzir e reconciliar matematicamente os 9 artefatos na raiz do projeto:
    1. `MATRIZ_TESTES_CONEXOES.md`
    2. `RELATORIO_E2E.md`
    3. `RELATORIO_TESTES_API.md`
    4. `RELATORIO_BANCO.md`
    5. `RELATORIO_REGRESSAO.md`
    6. `SEGUNDA_VARREDURA.md`
    7. `PENDENCIAS_E_BLOQUEIOS.md`
    8. `METRICAS_FINAIS.md`
    9. `RELATORIO_FINAL_AUDITORIA.md`
- **Subagentes**: `teamwork_preview_worker` (`.agents/teamwork_preview_worker_reports/`), `teamwork_preview_reviewer` (`.agents/teamwork_preview_reviewer_reports/`).

### Fase 5: Auditoria Forense e Portão de Validação Final
- **Objetivo**:
  - Executar auditoria independente de integridade (`teamwork_preview_auditor`).
  - Veto binário inegociável contra trapaças, mocks vazios ou hardcoded results.
  - Verificação de reconciliação de números entre o inventário de 1.377 itens, as 80 arestas e os 9 relatórios.
- **Subagente**: `teamwork_preview_auditor` (`.agents/teamwork_preview_auditor_final/`).

### Fase 6: Declaração de Vitória e Notificação ao Sentinel Parent
- **Objetivo**:
  - Enviar mensagem estruturada via `send_message` ao parent (`5f52fae9-6730-48a7-a45a-f2dfba2678af`) atestando o cumprimento de R1, R2, R3 e R4 com links e resumo executivo.
