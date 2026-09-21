## 2026-09-11T02:02:37Z

# Task Assignment — Explorer 23 DBA & Security

**Mission**: Auditoria completa de Segurança e Banco de Dados (Supabase PostgreSQL) no ecossistema Grupo GSA.
**Working Directory**: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_explorer_23_db
**Reference Documents**:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (sob o cabeçalho `## 2026-09-11T02:00:24Z`)
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\PROJECT.md
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations\

**Scope & Specific Tasks**:
1. Auditar todas as migrations do Supabase em `supabase/migrations/`.
2. Verificar todas as tabelas relevantes aos painéis de Prestador, Parceiro, Fornecedor, Colaborador, Afiliado, Anunciante, Clientes, Marketplace e Financeiro.
3. Checar status de RLS em todas as tabelas (verificar se `ENABLE ROW LEVEL SECURITY` está presente e se há brechas como `USING (true)` sem restrição de tenant/ator ou papéis `anon`/`authenticated` expostos indevidamente).
4. Auditar todas as funções RPC, especialmente aquelas com `SECURITY DEFINER`. Verificar se possuem `SET search_path = ''` ou `public`, validações de autorização (`auth.uid()`, tipo de ator via JWT), e integridade transacional.
5. Inspecionar triggers (ex: triggers de atualização de saldo, auditoria, timestamps) e integridade referencial.
6. Mapear vulnerabilidades encontradas e propor remediação concreta.
7. Escrever relatório detalhado em `.agents/teamwork_preview_explorer_23_db/handoff.md`.
