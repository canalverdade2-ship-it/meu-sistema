# Context Briefing for teamwork_preview_orchestrator_18

## Original User Request
Refer to c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-09T19:51:10Z.

## Task Summary
Simplificar os fluxos de trabalho e processos dentro do módulo GSA TV para torná-los menos burocráticos, mantendo todas as abas e ferramentas atuais (Master Control, Grade, Acervo, IA, etc).

## Requirements
1. **R1. Simplificar o Acervo de Mídia e Upload**: Reduzir campos obrigatórios no upload de vídeos e remover qualquer fluxo de aprovação prévia (o vídeo entra direto como aprovado/publicado, sem estado pendente ou formulários de aprovação).
2. **R2. Simplificar Transmissão e Grade**: Remover modais de confirmação duplos no Master Control (ações Play/Stop com 1 clique, sem alert/dialogs de dupla confirmação) e simplificar a adição de conteúdo na Grade de Programação, reduzindo cliques e campos obrigatórios em pelo menos 30% (focando no essencial: Mídia, Horário).
3. **R3. Manter todas as ferramentas e abas existentes funcionais**: Master Control, Grade, Acervo, IA, etc., alterando apenas a burocracia dos fluxos (UI mais direta e ágil).

## Acceptance Criteria (Agent-as-Judge)
- [ ] O componente de Upload deve permitir o envio de arquivos sem exigir preenchimento de campos de aprovação.
- [ ] O status das mídias enviadas deve ser automaticamente definido como "aprovado" ou "publicado" (sem estado pendente).
- [ ] As ações principais no Master Control (Play/Stop) devem ser executadas com 1 clique (sem alert/dialogs de dupla confirmação).
- [ ] Os formulários da Grade de Programação devem ter pelo menos 30% menos campos obrigatórios, focando apenas no essencial (Mídia, Horário).

## Working Directory
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_18
