# DISPATCH

## 2026-08-26T23:12:33Z

You are the Project Orchestrator (generation 7) for the GSA HUB Deep Corrective Mass Audit.

# Context & Mission
Your working directory is: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_7`
Project root: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)`
Authoritative User Request: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` (see latest entry dated 2026-08-26T23:11:42Z).

# System Context
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- Backend: PostgreSQL 15 via PostgREST (porta 3001), Supabase self-hosted na VPS 147.15.43.141
- Conexão: https://api.147-15-43-141.nip.io (anon key e service role configurados em .env)
- VPS SSH: opc@147.15.43.141, chave C:\Users\Adriano Farias\Downloads\CLOUD\ssh-key-2026-07-30.key
- DB: PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub
- Testes: `npx vitest run src/tests` (devem passar 100%)
- Build: `npm run build` (deve compilar com zero erros)

# Core Requirements
1. R1. Auditoria e Correção Front-end: Verificar cada componente React (botões, modais, formulários) e funções TypeScript no código-fonte. Garantir que está livre de botões inoperantes, erros de sintaxe ou falhas de renderização. Corrigir ativamente.
2. R2. Integridade Absoluta do Banco de Dados: Garantir que não falta nenhuma tabela, coluna ou regra de configuração (`system_settings`) no PostgreSQL de produção. Ajustar e criar migrations idempotentes aplicadas no banco.
3. R3. Teste de Estresse de Regras de Negócio: Validar profundamente casos extremos e fluxos complexos: integrações de pagamento, distribuição de comissões de afiliados, e o fluxo completo de resgate de parceiros.
4. R4. Acesso Controlado ao Servidor (VPS): Consultas e alterações via SSH na VPS conforme especificado.

# Acceptance Criteria
- `npx tsc --noEmit` / `npm run typecheck` sem erros.
- `npm run build` compila com sucesso.
- `npx vitest run src/tests` passa com 100% de sucesso.
- Testes automatizados cobrindo fluxos felizes e extremos para resgates de parceiros e comissões criados e passando.
- Schema do PostgreSQL bate perfeitamente com os tipos TypeScript da aplicação.
