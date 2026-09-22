# GSA TV — Infraestrutura atual

**Fonte de verdade operacional:** [Arquitetura atual](../../docs/arquitetura-atual-gsa-tv.md)  
**Atualizado:** 22/09/2026

> A arquitetura antiga baseada em Google Drive/rclone, cache-manager e serviços separados nas portas 9200/9201/9203 foi descontinuada. Arquivos históricos podem permanecer no repositório para rastreabilidade, mas não descrevem o runtime atual.

## Runtime

A implantação atual usa:

- `gsa-tv-ffplayout` — playout/HLS, `127.0.0.1:8787`;
- `gsa-tv-control-plane` — jobs, mídia, grade, orquestração e IA, `127.0.0.1:9202`;
- `gsa-tv-encoder-engine` — transporte FFmpeg/RTMP independente, `127.0.0.1:9210`;
- `gsa-tv-watchdog` — supervisão independente, `127.0.0.1:9204`;
- `gsa-tv-n8n-bridge` — ponte privada de automação;
- n8n GSA existente — reconciliação, monitoramento e relatórios;
- PostgreSQL/Supabase existente — estado e auditoria.

A VPS é o armazenamento definitivo. Não existe dependência operacional do Google Drive.

## Diretórios persistentes

```text
/opt/gsa-tv/cache/media/1/
/opt/gsa-tv/playlists/1/
/opt/gsa-tv/preview/1/live/
/opt/gsa-tv/fallback/
/opt/gsa-tv/backups/full/
/opt/gsa-tv/control-plane/
/opt/gsa-tv/watchdog/
/opt/gsa-tv/n8n-bridge/
```
## Segurança

- portas de operação permanecem no loopback da VPS;
- o preview HLS exige assinatura temporária;
- Stream Key e credenciais de IA ficam criptografadas e write-only;
- o n8n não recebe credencial de banco nem token de transmissão;
- a ponte n8n permite somente snapshot, jobs de baixo impacto, relatório e execução de projeto de IA aprovado;
- comandos `stream_start/stop`, pause/resume e TAKE/RETURN continuam sob controle do GSA Hub/operador;
- containers usam `no-new-privileges`, `cap_drop` e volumes restritos quando aplicável.

## Processamento de mídia

O Control Plane recebe upload ou importação direta, executa FFprobe e normaliza arquivos incompatíveis para o perfil broadcast. Mídia só é marcada `ready` após verificação técnica. O fallback oficial não pode ser excluído enquanto estiver configurado.

## Continuidade

A grade publicada é compilada para ffplayout e completada com filler institucional. O relay mantém o YouTube alimentado em modo programa, pausa/fallback ou fonte ao vivo. O watchdog registra As-Run e monitora HLS, tela preta, silêncio e congelamento.

## Backup

`gsa-tv-backup.timer` executa backup integral diário. O procedimento inclui dump completo, recorte GSA TV, ffplayout, mídia/configurações, checksums e teste de restauração isolado. Um backup só deve ser considerado válido quando o estado registrado for `restored_test`.
## Automação n8n

Os arquivos em `n8n/workflows/` representam a arquitetura atual e usam apenas a ponte privada. Eles não acessam diretamente PostgreSQL/Supabase e não usam Google Drive/rclone.

## Homologação

`tests/run-live-test-suite.sh` coleta amostras reais durante 30 min, 2h, 6h, 12h, 24h ou 72h. O teste falha se o tempo exigido não transcorrer ou se houver amostras inválidas. Nunca use relatórios históricos sintéticos como prova de soak test.

`tests/test-vps-storage-resilience.sh` valida a resiliência do armazenamento local definitivo.

## Autopilot V2

O Autopilot mantém uma janela rolante de prontidão, produz conteúdo faltante para D+1..D+3 e corrige duração insuficiente em programas originais futuros. O ffplayout e o Encoder Engine continuam responsáveis pela cadeia de exibição/transporte; o Autopilot não executa comandos de transmissão.

Deploy oficial:

```bash
sudo ./infrastructure/gsa-tv/scripts/autopilot-runtime-preflight.sh
# aplicar as migrations do Autopilot pelo fluxo canônico do Supabase
sudo ./infrastructure/gsa-tv/scripts/deploy-autopilot-v2.sh
sudo ./infrastructure/gsa-tv/scripts/deploy-autopilot-v2.sh --apply
```

O segundo comando é dry-run. A primeira migração do encoder acoplado exige canal off-air. O instalador se recusa a executar as migrations SQL fora do fluxo canônico do Supabase.

## Arquivos legados

`compose.yml`, migrations antigas sob `db/` e scripts em `scratch/` podem documentar fases anteriores e não devem ser usados como instaladores de produção. O instalador definitivo do Autopilot V2 é `scripts/deploy-autopilot-v2.sh`. Antes de reutilizar qualquer artefato legado, confirme sua aderência à arquitetura descrita aqui.
