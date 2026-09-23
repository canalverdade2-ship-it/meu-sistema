# GSA TV Autopilot V2 — checkpoint de retomada

Data das evidências: 22/09/2026, horário de São Paulo (23/09 em UTC).

## Código

- Branch local: `codex/gsa-tv-local`.
- Branch do PR #386: `feat/gsa-tv-autopilot-v2`.
- Head validado: `e0efba1e3766059918790f49ef3c76082030d95d`.
- PR: https://github.com/canalverdade2-ship-it/meu-sistema/pull/386

Correções desta retomada:

1. O probe SQLite agora roda mesmo quando todos os diretórios já existem. A origem é aberta em modo somente leitura e o backup de teste fica em memória.
2. A verificação final aceita o estado pré-instalação `CONTROL_PLANE_MISSING` apenas com todas as evidências de preparação válidas. Erros de SSH e runtime parcial continuam bloqueados.
3. O workflow oferece `deploy-dry-run` na branch de rollout. Ele envia um pacote de código verificado e simula o instalador, sem selecionar as etapas de aplicação/cutover.
4. O deploy inicial reconhece um Control Plane ausente quando banco, backup e off-air estão prontos. Aplicação e cutover continuam exclusivos da `main`.
5. O dry-run não altera a permissão do arquivo de ambiente.

## Evidência real da VPS

Preparação concluída:
https://github.com/canalverdade2-ship-it/meu-sistema/actions/runs/35804016101

- `FIRST_MIGRATION_PREP_READY=true`.
- `MIGRATION_STATE=ready`: as cinco migrations possuem histórico e contrato.
- Migration 31000 reparada na execução anterior 35803804578; essa execução anterior terminou com falha no tratamento do retorno final, corrigido em seguida.
- `AUTOPILOT_DB_CONTRACT_READY=true`.
- Canal fisicamente fora do ar, estado `stopped / stopped / off_air`.
- Backup: `/opt/gsa-tv/backups/full/20260923T005528Z`.
- `LATEST_BACKUP_STATE=restored_test` e `LATEST_BACKUP_MANIFEST_OK=true`.
- `MISSING_PATHS=none`.
- 107 mídias continuam sem recuperação determinística; não confundir diretórios presentes com acervo completo.

Dry-run concluído:
https://github.com/canalverdade2-ship-it/meu-sistema/actions/runs/35804115575

- `apply=false`.
- `already_external_migrated=false`.
- `runtime_off_air=true`.
- `backup_state=restored_test`.
- `backup_manifest_ok=true`.
- `WOULD_GENERATE=ENCODER_ENGINE_TOKEN`.
- `DRY_RUN_OK=true`.
- O pacote de fonte foi enviado para a VPS; nenhum serviço foi instalado/recriado e nenhum cutover foi realizado nessa simulação.

## Validação

- Quatro testes locais do probe SQLite passaram, incluindo origem intacta, corrupção, banco ausente e container ausente.
- Oito testes locais do gate passaram, incluindo matrizes de evidências faltantes, SSH com erro, runtime parcial e seleção das etapas de dry-run.
- Sintaxe Bash e `git diff --check` passaram.
- CI GSA TV Autopilot V2 passou no head validado: run 35804086835.
- Os testes Python que dependem de `fcntl` não executam no Windows nativo; sua validação completa foi feita no CI Linux, sem substituir locks por mocks para declarar produção validada.

## Pendências antes da instalação e operação

- O workflow exige `main` para `deploy` e `cutover`; o PR permanece draft.
- O PR inclui alterações fora da TV (Home/rodapé, ajustes de CI e dependências).
- Três checks gerais falham: Advertising Platform, Advertising Security Hardening e Production Integrity. Evidências mostram funções de publicidade ausentes e colisões históricas de migrations (issues #390 e #388).
- Decisão solicitada ao responsável: resolver esses bloqueios primeiro ou autorizar integração do PR no estado atual para o deploy guardado da TV. Nenhuma integração foi feita neste checkpoint.
- Rotação de segredos anteriormente expostos continua sem evidência confirmada nesta retomada; seguir `docs/gsa-tv-secret-rotation.md` antes de declarar prontidão de produção.
- Resolver o impacto das 107 mídias ausentes na grade.
- Reconciliar GSA Cinema com 60 minutos e a grade posterior (issue #389), sem truncar outros programas.
- Após instalação: comprovar saúde do Control Plane e Encoder Engine, readiness D+1, políticas editoriais, cutover, teste de continuidade e soak real. Nenhum desses resultados é inferido do dry-run.
