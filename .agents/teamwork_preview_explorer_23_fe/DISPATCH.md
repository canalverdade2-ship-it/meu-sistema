# Task Assignment — Explorer 23 Front-end Panels

**Mission**: Auditoria minuciosa do Front-end nos Painéis do Prestador, Parceiro, Fornecedor, Colaborador, Afiliado e Anunciante no ecossistema Grupo GSA.
**Working Directory**: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_fe
**Reference Documents**:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (sob o cabeçalho `## 2026-09-11T02:00:24Z`)
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
- Código fonte em `src/components/`, `src/pages/`, `src/hooks/`

**Scope & Specific Tasks**:
1. Vasculhar e mapear os componentes e páginas de cada um dos painéis:
   - Prestador
   - Parceiro
   - Fornecedor
   - Colaborador
   - Afiliado
   - Anunciante
2. Detectar código morto: componentes órfãos, imports não utilizados, funções declaradas mas nunca chamadas, rotas quebradas.
3. Detectar funções assíncronas que possam estar falhando silenciosamente: blocos `try/catch` vazios ou sem feedback visual ao usuário, promises sem tratamento de erro (`.catch()`), chamadas de mutação ou busca ao Supabase que ignoram `{ error }`.
4. Avaliar consistência de formulários, estados globais e sincronia entre a interface e os dados persistidos.
5. Inspecionar possíveis problemas de ciclo de vida do React: missing dependencies em `useEffect`, stale closures, subscription leaks.
6. Mapear todas as deficiências encontradas com arquivos, números de linha e propor plano de correção.
7. Escrever relatório detalhado em `.agents/teamwork_preview_explorer_23_fe/handoff.md`.

## 2026-09-11T02:02:37Z
<USER_REQUEST>
You are teamwork_preview_explorer_23_fe. Your working directory is:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_fe
You MUST read:
1. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header `## 2026-09-11T02:00:24Z`.
2. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_fe\DISPATCH.md
3. c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md

Mission:
Perform an exhaustive Front-end audit of all role panels in the Grupo GSA ecosystem:
- Inspect all React components and pages for Prestador, Parceiro, Fornecedor, Colaborador, Afiliado, and Anunciante (in `src/components/`, `src/pages/`, etc.).
- Scan for dead code, orphan components, unused exports/imports, broken routes.
- Scan for unhandled async operations and silent failures: empty `.catch(() => {})`, empty `try { ... } catch (e) {}`, Supabase mutation/query calls where `{ error }` is swallowed without visual error handling/toasts.
- Check form validations, global state sync, and ensure UI and database synchronization is 100%.
- Document all findings with file paths, line numbers, and actionable remediation steps.
- Write your complete handoff report to:
c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_fe\handoff.md
Once finished, send a completion message to the orchestrator.
</USER_REQUEST>

## 2026-09-11T02:16:54Z
**Context**: Status check da Auditoria Front-end (Fase 0 - Survey)
**Content**: Olá explorer_23_fe, o DBA Security Auditor acabou de concluir seu relatório e o Integration Auditor está finalizando a compilação. Como está o andamento da sua varredura nos painéis (Prestador, Parceiro, Fornecedor, Colaborador, Afiliado, Anunciante), código morto e falhas silenciosas?
**Action**: Envie uma atualização de status ou finalize seu handoff.md.
