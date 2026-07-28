# Reversão — Personalidade completa das páginas críticas

## Objetivo

Este arquivo registra como desfazer somente a implantação de identidade e organização das páginas críticas do GSA HUB, sem usar `reset --hard` na `main` e sem atingir banco, RLS, Edge Functions, dependências ou módulos fora do escopo.

## Identificação da frente

- Repositório: `canalverdade2-ship-it/meu-sistema`
- Branch: `agent/personalidade-completa-sistema`
- Pull request: `#354`
- Base da PR no momento da abertura: `a3599177ac2d196244b79a574cdd46362087e4be`
- Método previsto de integração: squash merge

## Arquivos funcionais alterados

- `src/components/client/ClientDashboard.tsx`
- `src/pages/Prestador/PrestadorDashboard.tsx`
- `src/pages/Fornecedor/FornecedorDashboard.tsx`
- `src/components/public/FreeToolsPage.tsx`
- `src/components/client/StoreHub.tsx`
- `src/components/client/marketplace/travel/TravelHubMenu.tsx`
- `src/components/admin/Dashboard.tsx`
- `src/pages/AdvertiserPortal.tsx`
- `src/components/client/marketplace/ClassifiedsHubPage.tsx`

## Arquivos de validação adicionados

- `scripts/check-page-personality-contracts.mjs`
- `.github/workflows/page-personality-quality.yml`

## O que não foi alterado

- migrations e estrutura do banco;
- políticas RLS;
- autenticação e autorização;
- Edge Functions;
- `package.json` e lockfile;
- serviços de dados e RPCs;
- fluxos de pagamento;
- componentes operacionais internos de cada módulo.

## Reversão depois do merge

Após o squash merge, use o SHA gerado pela PR #354:

```bash
git switch main
git pull --ff-only
git switch -c agent/reversao-personalidade-completa-sistema
git revert <SHA_DO_SQUASH_DA_PR_354>
git push -u origin agent/reversao-personalidade-completa-sistema
```

Abra uma pull request da branch de reversão para `main`, execute os testes e faça o merge somente após a validação.

## Reversão antes do merge

Enquanto a implantação estiver apenas na branch:

```bash
git switch agent/personalidade-completa-sistema
git fetch origin
git reset --hard origin/main
```

Esse comando só pode ser usado na branch isolada. Nunca execute diretamente na `main`.

## Verificação após reversão

Validar as entradas:

- `/cliente/dashboard`
- `/prestador/dashboard`
- `/fornecedor/dashboard`
- `/servicos-gratuitos`
- `/marketplace/loja`
- `/marketplace/menu/pacotes-viagem`
- dashboard administrativo
- `/anuncios/painel`
- `/marketplace/menu/classificados`

Os fluxos internos devem continuar acessíveis com a arquitetura anterior.
