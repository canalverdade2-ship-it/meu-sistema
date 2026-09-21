# GSA TV — Runbook operacional atual

**Versão:** 2.2  
**Atualizado:** 04/09/2026

A arquitetura vigente está descrita em `docs/arquitetura-atual-gsa-tv.md`. Google Drive/rclone e os serviços antigos 9200/9201/9203 não fazem parte do runtime atual.

## Saúde do canal

```bash
curl -fsS http://127.0.0.1:9202/health
curl -fsS http://127.0.0.1:9204/health
curl -fsS http://127.0.0.1:9204/metrics
curl -fsS http://127.0.0.1:8787/
docker ps --filter name=gsa-tv-
```

Um container `healthy` não prova transmissão. Para estado operacional, confirmar também `desired_state`, `playout_state`, `signal_state`, freshness do HLS e métricas do watchdog.

## Serviços

- Control Plane: `gsa-tv-control-plane`;
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

## Proteção de implantação durante transmissão

O encoder RTMP da versão 1.6.39 ainda é um processo filho do container do Control Plane. Recriar ou substituir esse container encerra o FFmpeg e pode fazer o YouTube finalizar o evento público, mesmo quando o processo volta a conectar poucos segundos depois.

Enquanto o encoder não for migrado para um serviço independente, toda promoção de imagem deve passar obrigatoriamente por:

```bash
sudo /opt/gsa-tv/bin/deploy-control-plane-safe.sh gsa-tv/control-plane:<versao>
```

A trava deve recusar a implantação quando o banco indicar `running|sending` ou quando encontrar um FFmpeg ativo. Não contornar essa recusa durante uma transmissão pública.

A versão de produção `1.6.39`, promovida em 04/09/2026, contém:

- atualização gráfica por FFmpeg/ZMQ sem `graphics_reload` recriar o encoder;
- advisory lock por canal no PostgreSQL;
- preservação de `media:<media_item_id>` durante restauração;
- modo de validação com `GSA_TV_DISABLE_RUNTIME_RESTORE=true`;
- correção da regressão de escopo associada a `next is not defined`.
- correção do comando inválido de `drawtext reinit` para corpos baseados em `textfile`; o conteúdo desses corpos continua sendo atualizado por `reload=1` sem reiniciar o RTMP.

Uma futura substituição da versão ativa não deve ocorrer com o canal no ar sem janela explicitamente autorizada. A solução definitiva é executar o encoder em serviço próprio, com ciclo de vida independente do Control Plane, e só então habilitar promoção blue-green do painel.
