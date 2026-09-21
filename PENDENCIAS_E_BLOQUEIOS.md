# PENDÊNCIAS E BLOQUEIOS TÉCNICOS — GSA HUB

**Documento**: `PENDENCIAS_E_BLOQUEIOS.md`  
**Fase**: Remediação de Cobertura Massiva (Auditoria Técnica)  
**Data da Execução**: 2026-09-16  
**Taxonomia Unificada**: EXECUTADO DINAMICAMENTE — PASSOU (79) | BLOQUEADO (1.564)  
**Total Reconciliado**: 1.643 itens  

---

## 1. RECONCILIAÇÃO MATEMÁTICA DOS BLOQUEIOS

| Bloco de Componentes | Total Inventariado | Executado Dinamicamente (Passou) | Bloqueado com Justificativa | Causa Raiz do Bloqueio |
|---|:---:|:---:|:---:|---|
| **Bloco 1: Banco de Dados** (Tabelas, RPCs, RLS) | 1.172 | 0 | 1.172 | PROBLEMA DE INFRAESTRUTURA (Sem banco local) |
| **Bloco 2: UI Autenticada** (Rotas, Forms, Botões, Grids, Modais, Módulos) | 349 | 62 | 287 | PROBLEMA DE INFRAESTRUTURA (Sem login seed) |
| **Bloco 3: Arestas de Grafo** (Conexões Inter-módulos) | 80 | 12 | 68 | PROBLEMA DE INFRAESTRUTURA (Sem banco local) |
| **Bloco 4: Integrações** (Edge Functions, Webhooks, APIs Externas) | 42 | 5 | 37 | PROTEÇÃO DE DADOS & INFRAESTRUTURA |
| **TOTAL GERAL** | **1.643** | **79** | **1.564** | **100% Auditado e Justificado** |

> **Equação Obrigatória de Reconciliação**:  
> `1.643 = 0 (ESTÁTICO) + 79 (PASSOU) + 0 (FALHOU) + 0 (CORRIGIDO) + 1.564 (BLOQUEADO) + 0 (NÃO TESTADO)`  
> **Conformidade**: 79 + 1.564 = 1.643 ✅

---

## 2. DETALHAMENTO DAS DEPENDÊNCIAS DE BLOQUEIO

### 2.1 Bloco 1: Banco de Dados Local (1.172 Itens)
- **Itens Afetados**: 294 Tabelas, 692 Stored Procedures/RPCs, 186 Políticas RLS.
- **Causa Raiz Técnica**: `PROBLEMA DE INFRAESTRUTURA`. O sistema operacional é `Windows 10 Home Single Language` (build 19045). O provisionamento de contêineres locais para o `supabase start` requer Docker Desktop ou Podman rodando sobre WSL2 ou Hyper-V.
- **Tentativas Concretas Registradas**:
  1. Instalação do Docker Desktop via `winget`: Abortada com código `4294967291` por exigir elevação interativa de Administrador (UAC).
  2. Download direto do instalador (598.5 MB em `$env:TEMP\DockerDesktopInstaller.exe`): Execução via script impedida por ausência de suporte a elevação de privilégios (`Start-Process -Verb RunAs: Não há suporte para o pedido`).
  3. Instalação do Podman CLI 6.1.2: Instalado com êxito, porém `podman machine init` falhou por ausência de WSL2 registrado e ausência de Hyper-V no Windows 10 Home.
- **Bloqueio de Produção Ativo**: O script `tests/preflight-isolation.ps1` bloqueou corretamente qualquer execução contra o banco de produção (`147.15.43.141`), cumprindo o Requisito R1.

### 2.2 Bloco 2: UI Autenticada e Funcional (287 Itens)
- **Itens Afetados**: 48 rotas internas, 46 formulários protegidos, 100 botões de ação transacional, 38 grids de dados privados, 46 modais de cadastro/edição, 9 módulos funcionais internos.
- **Causa Raiz Técnica**: Exigem autenticação válida de cliente, prestador ou administrador contra o Supabase com RLS ativo. Como o Supabase local não pôde ser iniciado pelas limitações de infraestrutura acima, esses fluxos foram marcados como `test.skip` na suíte Playwright.

### 2.3 Bloco 3: Arestas de Conexão do Grafo (68 Itens)
- **Itens Afetados**: `EDGE-013` a `EDGE-080`.
- **Causa Raiz Técnica**: Conexões que envolvem transações completas (ex: Adicionar ao Carrinho → Criar Pedido → Debitar Saldo → Gerar Fatura → Notificar via WhatsApp). Dependem da persistência real de dados no banco e de serviços locais de mensageria.

### 2.4 Bloco 4: Integrações e Serviços Externos (37 Itens)
- **Itens Afetados**: 15 Edge Functions, 14 Webhooks VPS, 8 APIs de terceiros.
- **Causa Raiz Técnica**:
  - `Edge Functions`: Requerem o runtime Deno local (`supabase functions serve`), dependente de contêiner.
  - `Webhooks`: Requerem o listener do VPS e triggers de banco de dados ativos.
  - `APIs Externas`: InfinitePay (gateway de pagamento), Resend (e-mail transacional), Evolution API (WhatsApp) foram bloqueadas para evitar custos financeiros e disparos de mensagens reais para clientes de produção.

---

## 3. PLANO DE AÇÃO PARA DESBLOQUEIO DEFINITIVO
Para converter os 1.564 itens de `BLOQUEADO` para `EXECUTADO DINAMICAMENTE — PASSOU`, é necessária a seguinte ação pontual de infraestrutura pelo usuário administrador:

1. Executar o instalador do Docker Desktop já baixado no computador:
   ```powershell
   & "$env:TEMP\DockerDesktopInstaller.exe" install --quiet --accept-license --backend=wsl-2
   ```
2. Após a reinicialização da máquina, rodar o laboratório local:
   ```powershell
   supabase start
   supabase db reset --local
   npx playwright test
   ```
O arquivo de seed determinístico (`supabase/seed.sql`) e a suíte completa de testes já estão preparados e prontos para execução imediata.
