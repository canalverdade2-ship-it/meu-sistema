# Backup — Área Logada PJ (modelo atual)

## Identificação

- Projeto: GSA HUB
- Repositório: `canalverdade2-ship-it/meu-sistema`
- Data do backup: 26/07/2026
- Branch protegida de referência: `backup/area-pj-modelo-atual-2026-07-26`
- Branch de origem: `main`
- Nova frente de desenvolvimento: `feature/portal-empresarial-pj`

## Finalidade

Esta branch preserva o estado completo do sistema antes da reformulação da área logada destinada a clientes Pessoa Jurídica.

Ela existe para permitir reversão segura caso o novo Portal Empresarial apresente falhas, incompatibilidades, regressões ou precise ser suspenso.

## Escopo preservado

O backup mantém o estado existente antes da nova implementação, incluindo, conforme presentes no projeto:

- área logada atual de clientes Pessoa Física;
- área logada atual de clientes Pessoa Jurídica;
- autenticação e redirecionamentos existentes;
- layouts, componentes, rotas e menus atuais;
- integrações com backend e banco de dados;
- permissões, políticas e regras existentes;
- fluxos de documentos, solicitações, financeiro, notificações e demais módulos já conectados;
- configurações e dependências vigentes no momento da criação desta branch.

## Regra obrigatória de preservação

Esta branch não deve receber o desenvolvimento do novo Portal Empresarial.

Ela deve permanecer como referência histórica e técnica do modelo anterior. Qualquer correção futura nela deve ser excepcional, documentada e feita somente quando necessária para viabilizar uma reversão.

## Desenvolvimento do novo modelo

Todo o trabalho da nova área logada empresarial deve ocorrer exclusivamente na branch:

`feature/portal-empresarial-pj`

A implementação deve respeitar o isolamento entre frentes do projeto GSA HUB:

- não trabalhar diretamente na `main`;
- não alterar páginas fora do escopo PJ sem necessidade comprovada;
- não misturar mudanças de outras frentes;
- identificar explicitamente alterações em arquivos compartilhados;
- manter commits restritos ao escopo da área empresarial;
- validar frontend, backend, banco, RLS, permissões, rotas, estados e fluxos de ponta a ponta.

## Procedimento de reversão

### Reversão completa do novo modelo

Caso seja necessário abandonar integralmente a nova implementação, restaurar a referência desta branch protegida e abrir uma alteração controlada para a `main`.

Fluxo recomendado:

1. interromper alterações na branch do novo Portal Empresarial;
2. comparar `feature/portal-empresarial-pj` com `backup/area-pj-modelo-atual-2026-07-26`;
3. identificar migrations ou alterações de banco que exijam rollback específico;
4. criar uma branch de reversão a partir da `main`;
5. restaurar os arquivos da branch de backup;
6. aplicar migrations reversíveis ou scripts compensatórios, quando necessário;
7. testar autenticação, PF, PJ, administrativo, permissões e integrações;
8. somente depois abrir o pull request de reversão.

### Reversão parcial

Para restaurar apenas arquivos específicos, copiar a versão correspondente desta branch para uma branch de correção, sem alterar diretamente a branch de backup.

## Atenção ao banco de dados

A restauração dos arquivos não desfaz automaticamente:

- migrations já aplicadas;
- alterações de estrutura no banco;
- novos registros;
- policies RLS;
- funções, triggers e índices;
- mudanças no Storage;
- integrações externas.

Toda alteração estrutural do novo Portal Empresarial deve possuir estratégia de rollback ou script compensatório antes de ser aplicada em ambiente real.

## Critério para remoção deste backup

Esta branch somente poderá ser removida quando:

- o novo Portal Empresarial estiver aprovado;
- todos os fluxos estiverem testados de ponta a ponta;
- as permissões e o isolamento entre empresas estiverem validados;
- a estabilidade em ambiente real estiver confirmada;
- existir outro marco/versionamento seguro para restauração.

Até lá, este backup deve permanecer intacto.
