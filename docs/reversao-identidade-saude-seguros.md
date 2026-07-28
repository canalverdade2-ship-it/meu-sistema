# Reversão — Identidade GSA Saúde e GSA Seguros

## Objetivo deste arquivo

Este documento permite desfazer somente a frente de diferenciação visual das páginas iniciais de **GSA Saúde** e **GSA Seguros**, sem atingir outros módulos do sistema.

## Ponto-base protegido

- Repositório: `canalverdade2-ship-it/meu-sistema`
- Branch de trabalho: `agent/identidade-saude-seguros`
- Branch de origem: `main`
- Commit-base: `3a7b1693db6f17ccd3405af0e471443c28d6bba9`
- Pull request draft: `#353`

## Escopo desta implantação

Arquivos adicionados:

- `src/components/client/marketplace/protection/HealthMarketplaceLandingPage.tsx`
- `src/components/client/marketplace/protection/InsuranceMarketplaceLandingPage.tsx`
- `scripts/check-protection-identity-contracts.ts`
- `.github/workflows/protection-identity-quality.yml`

Arquivo de integração alterado:

- `src/components/client/marketplace/MarketplaceGSAStore.tsx`

Arquivo de auditoria e reversão:

- `docs/reversao-identidade-saude-seguros.md`

O componente operacional compartilhado abaixo foi preservado e não foi reescrito nesta etapa:

- `src/components/client/marketplace/protection/ProtectionMarketplace.tsx`

Assim, os fluxos de cotação, propostas, documentos, suporte, apólices, assistências, sinistros e planos continuam utilizando a lógica existente.

## Reversão segura enquanto a frente estiver somente nesta branch

Execute os reverts em ordem cronológica inversa:

```bash
git switch agent/identidade-saude-seguros
git revert 5e9cfccf19ad2f18a53ec5467fdaf8eba287c730
git revert b35a4fb587f3e4e1c076532e4a1d7df05ed04efd
git revert 2e1b47f74e3452678a2026da8f661530075ed2a4
git revert e7b23622688a03d8b8d092bd44003225868f6fe7
git revert 29c104e9441ddc51e007c62a876c7751dc940a1f
```

Esses comandos:

1. removem o workflow dedicado e somente de leitura;
2. removem o contrato automatizado desta frente;
3. restauram o roteamento anterior de Saúde e Seguros;
4. removem a nova página de Seguros;
5. removem a nova página de Saúde.

Este documento pode permanecer como registro de auditoria. Para retirar também o arquivo de reversão, exclua-o em um commit separado depois de confirmar que a reversão foi concluída.

## Reversão depois de eventual merge

O método preferencial será reverter o commit de merge ou o squash da pull request correspondente:

```bash
git switch main
git pull --ff-only
git switch -c agent/reversao-identidade-saude-seguros
git revert <SHA_DO_MERGE_OU_SQUASH_DA_PR>
```

Depois, validar e abrir uma nova pull request de reversão. Não executar `reset --hard` na `main`.

## Reversão de emergência da branch isolada

Somente se a branch ainda não tiver sido compartilhada com outras frentes e nenhum trabalho adicional precisar ser preservado:

```bash
git switch agent/identidade-saude-seguros
git reset --hard 3a7b1693db6f17ccd3405af0e471443c28d6bba9
```

Esse procedimento nunca deve ser usado diretamente na `main`.

## Verificação após reversão

Confirmar as rotas:

- `/marketplace/menu/saude`
- `/marketplace/menu/seguros`
- `/marketplace/menu/saude/cotacao`
- `/marketplace/menu/seguros/cotacao`
- áreas autenticadas de cotações, propostas, documentos, planos, apólices, assistências e sinistros.

A reversão deve afetar apenas a apresentação inicial dos dois domínios e a validação dedicada desta frente.
