# GSA TV — Runbook operacional atual

**Versão:** 3.0  
**Atualizado:** 22/09/2026

A arquitetura vigente está descrita em `docs/arquitetura-atual-gsa-tv.md`. Google Drive/rclone e os serviços antigos 9200/9201/9203 não fazem parte do runtime atual.

## Saúde do canal

```bash
curl -fsS http://127.0.0.1:9202/health
curl -fsS http://127.0.0.1:9210/health
curl -fsS http://127.0.0.1:9204/health
curl -fsS http://127.0.0.1:9204/metrics
curl -fsS http://127.0.0.1:8787/
docker ps --filter name=gsa-tv-
```

Um container `healthy` não prova transmissão. Para estado operacional, confirmar também `desired_state`, `playout_state`, `signal_state`, freshness do HLS e métricas do watchdog.

## Serviços

- Control Plane: `gsa-tv-control-plane`;
- Encoder Engine: `gsa-tv-encoder-engine`;
- ffplayout: `gsa-tv-ffplayout`;
- Watchdog: `gsa-tv-watchdog`;
- bridge n8n: `gsa-tv-n8n-bridge.service`;
- backup: `gsa-tv-backup.timer`.
## Operação pelo GSA Hub

Use as abas Sala de Controle/Estado para `Iniciar`, `Pausar`, `Retomar` e `Encerrar`. Use `Ao Vivo` para TAKE/RETURN. Não manipule a Stream Key pelo terminal nem por workflow.

Pausar mantém o ingest ativo com continuidade institucional. Encerrar é uma ação diferente: termina o relay externo.

## Contingência

O fallback oficial fica no armazenamento local e é protegido contra exclusão enquanto estiver configurado. Em perda de programação, o canal deve continuar com filler/fallback; o Watchdog registra a condição e abre incidente quando a anomalia é real.

## n8n

Os workflows atuais usam somente a ponte Docker privada. O n8n não recebe `DATABASE_URL`, `service_role` ou Stream Key. A ponte não aceita start/stop/pause/resume/TAKE/RETURN.

## Backup e restauração

```bash
systemctl status gsa-tv-backup.timer
systemctl list-timers --all | grep gsa-tv-backup
```

Considere uma execução válida somente quando o registro em `gsa_tv_backup_runs` demonstrar backup completo, checksums e `restored_test`.

## Deploy do Autopilot V2 e proteção do sinal

Antes do primeiro deploy:

```bash
sudo ./infrastructure/gsa-tv/scripts/autopilot-runtime-preflight.sh
```

O preflight é somente leitura e classifica o runtime. Os estados principais são:

- `EXTERNAL_READY` — Control Plane já usa Encoder Engine independente;
- `LEGACY_COUPLED` — relay ainda pertence ao Control Plane;
- `CONTROL_PLANE_MISSING` — runtime divergente/incompleto;
- `PARTIAL_EXTERNAL` — migração parcial que exige correção antes de continuar.

A primeira migração de `LEGACY_COUPLED` para o Encoder Engine independente exige canal off-air. O instalador recusa `running|sending` e nunca envia STOP automaticamente.

Aplicar primeiro as migrations pelo fluxo canônico do Supabase:

- `20260922131000_gsa_tv_autopilot_compile_gate.sql`;
- `20260922132000_gsa_tv_autopilot_duration_swap.sql`.

Depois executar dry-run e apply:

```bash
sudo ./infrastructure/gsa-tv/scripts/deploy-autopilot-v2.sh
sudo ./infrastructure/gsa-tv/scripts/deploy-autopilot-v2.sh --apply
```

O instalador:

1. valida estado do canal e contrato do banco;
2. gera `ENCODER_ENGINE_TOKEN` somente se necessário, sem imprimi-lo;
3. cria backup local para rollback;
4. builda imagens versionadas;
5. inicia/valida `gsa-tv-encoder-engine`;
6. substitui o Control Plane;
7. confirma os marcadores do contrato externo;
8. instala scripts e timers do Autopilot;
9. executa readiness read-only como smoke test;
10. habilita timers somente depois das healthchecks.

No runtime externo, reiniciar/substituir o Control Plane não deve parar ffplayout nem o Encoder Engine. O `SIGTERM` do painel preserva a cadeia de sinal; ao retornar, ele reconcilia o estado desejado com o engine.

### Rollback

Cada apply cria diretório protegido em:

`/opt/gsa-tv/backups/autopilot-v2/<timestamp>/`

Falha durante a implantação aciona rollback local dos compose e timers. Não apagar esse backup até concluir os testes de estabilidade.

## Autopilot

```bash
systemctl status gsa-tv-autopilot-readiness.timer
systemctl status gsa-tv-autopilot-content-factory.timer
cat /opt/gsa-tv/runtime/autopilot/readiness-horizon.json
cat /opt/gsa-tv/runtime/autopilot/content-factory.json
cat /opt/gsa-tv/runtime/autopilot/duration-engine.json
```

O readiness roda a cada 15 minutos. O dispatcher de produção roda em ciclos de baixa prioridade e trabalha primeiro D+1, depois D+2/D+3. O Duration Engine atua somente em programas originais futuros; live, reprise e conteúdo de acervo ficam fora da substituição automática.


## Homologação Autopilot

Após o deploy, executar os testes temporais em ordem crescente:

```bash
sudo bash infrastructure/gsa-tv/tests/run-live-test-suite.sh 1   # 30 min
sudo bash infrastructure/gsa-tv/tests/run-live-test-suite.sh 2   # 2 h
sudo bash infrastructure/gsa-tv/tests/run-live-test-suite.sh 3   # 6 h
sudo bash infrastructure/gsa-tv/tests/run-live-test-suite.sh 4   # 12 h
sudo bash infrastructure/gsa-tv/tests/run-live-test-suite.sh 5   # 24 h
sudo bash infrastructure/gsa-tv/tests/run-live-test-suite.sh 6   # 72 h
sudo bash infrastructure/gsa-tv/tests/run-live-test-suite.sh 7   # 7 dias
```

Cada amostra valida Control Plane, Encoder Engine, Watchdog/HLS, ausência de black/silence/freeze, freshness do Readiness Horizon e timers do Autopilot ativos. Um período só resulta em PASS depois do tempo real integral.

### Chaos test — restart do Control Plane

Somente depois do preflight retornar `EXTERNAL_READY` e com o canal `running|sending`:

```bash
sudo bash infrastructure/gsa-tv/tests/test-control-plane-restart-continuity.sh --confirm-live-chaos
```

Esse teste reinicia exclusivamente o container `gsa-tv-control-plane` e exige que:

- o Encoder Engine continue com `outer_running=true`;
- o PID do transporte RTMP permaneça o mesmo;
- o PID do produtor permaneça o mesmo;
- o Control Plane recupere health;
- o Watchdog continue reportando HLS válido.

O teste não reinicia o Encoder Engine nem o ffplayout. Falha nesse teste bloqueia a classificação de continuidade do runtime externo.
