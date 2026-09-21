# GSA TV — Estado dos serviços e pilha técnica

**Captura:** 17/08/2026 21:20 UTC  
**Ambiente:** VPS Oracle de produção + repositório local  
**Situação:** pilha técnica completa construída e desconectada — sem Drive, sem YouTube

---

## Resumo por fase

| Fase | Status | Observações |
|---|---|---|
| 0 — Inventário e backup | ✅ Concluída | Backup validado, restauração real dos dois bancos |
| 1 — Segurança e isolamento | ✅ Concluída (base) | Usuário, diretórios, rede Docker; portas preexistentes aguardam migração |
| 2 — Pilha técnica desconectada | ✅ Concluída | ffplayout 2.1.0, FFmpeg 7.1.5, benchmark, fallback, backup diário, rclone |
| 3 — Presets FFmpeg e mídia sintética | ✅ Concluída | 5 presets criados (validate, normalize, HLS, RTMPS, synthetic media) |
| 4 — Prova ARM64 ffplayout | ✅ Gate aprovado | 720p30 @ 4,92× real, fallback e healthcheck validados |
| 5 — Banco técnico e APIs internas | ✅ Concluída | 8 migrations SQL + migrate.sh + 4 serviços internos |
| 6 — Monitoramento e contingência | ✅ Concluída | Prometheus + Grafana + cAdvisor + Uptime Kuma configurados |
| 7 — GSA TV Manager | 🔲 Próxima fase | Aguarda pilha subir e APIs internas validadas |
| 8 — Google Drive | 🔲 Bloqueada | Aguarda conta Google e projeto no Cloud Console |
| 9 — Workflows n8n | ✅ Schemas criados | 7 workflows em JSON exportável; ativação na Fase 9 |
| 10 — Preview HLS interno | ✅ Configuração criada | Nginx config + auth_request criados; ativar após pilha subir |
| 11 — YouTube não listado | 🔲 Bloqueada | Só após homologação de 72h |

---

## Artefatos criados nesta sessão

### Fase 3 — Presets FFmpeg
- [`scripts/preset-validate.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/scripts/preset-validate.sh) — ffprobe JSON + exit code 0/1
- [`scripts/preset-normalize.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/scripts/preset-normalize.sh) — H.264 CBR 4 Mbps + EBU R128 two-pass
- [`scripts/preset-hls.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/scripts/preset-hls.sh) — HLS segmentos 6 s
- [`scripts/preset-rtmps.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/scripts/preset-rtmps.sh) — RTMPS YouTube (recusa sem chave)
- [`scripts/generate-synthetic-media.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/scripts/generate-synthetic-media.sh) — Barras SMPTE + relógio + tom

### Fase 5 — Banco técnico
| Migration | Tabela | Destaques |
|---|---|---|
| 001 | `gsa_tv.channels` | Canal principal seed, trigger updated_at |
| 002 | `gsa_tv.media_items` | 9 estados, metadados técnicos + direitos, 4 índices |
| 003 | `gsa_tv.schedule_slots` | EXCLUDE GIST anti-sobreposição por canal |
| 004 | `gsa_tv.playlists` | Rollback atômico, snapshot anterior |
| 005 | `gsa_tv.execution_log` | dropped_frames, avg_bitrate, avg_fps |
| 006 | `gsa_tv.incidents` | Sem DELETE/UPDATE via design |
| 007 | `gsa_tv.jobs` | Fila por prioridade, retry automático |
| 008 | `gsa_tv.audit_log` | Imutável via RULES PostgreSQL |

### Fase 5 — Serviços internos
| Serviço | Runtime | Porta | Função |
|---|---|---|---|
| `gsa-tv-media-worker` | Node.js 20 | 9200 | ffprobe → ffmpeg → atualiza DB |
| `gsa-tv-cache-manager` | Python 3.12 | 9201 | rclone + cálculo de cobertura |
| `gsa-tv-playout-api` | Node.js 20 | 9202 | Proxy seguro sobre ffplayout |
| `gsa-tv-playlist-compiler` | Python 3.12 | 9203 | Compila + publica atomicamente |

### Fase 6 — Monitoramento
- Prometheus v2.53.2 — 7 scrape jobs + 30 dias de retenção
- Alertas: 10 regras (processo parado, cache, disco 70/80/90%, CPU, memória, dropped frames, playlist compiler)
- Grafana 11.1.5 — dashboard base com 6 painéis provisionado automaticamente
- Uptime Kuma 1.23.13 — 7 monitors configurados

### Infra adicional
- [`compose.yml`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/compose.yml) — pilha completa com 9 serviços, volumes nomeados, limites de CPU/RAM
- [`nginx/gsa-tv-preview.conf`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/nginx/gsa-tv-preview.conf) — preview HLS protegido por auth_request GSA Hub
- [`rclone/rclone.conf.template`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/rclone/rclone.conf.template) — template sem credenciais reais
- [`scripts/setup-directories.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/scripts/setup-directories.sh) — cria toda a árvore `/opt/gsa-tv` na VPS
- 7 workflows n8n em JSON exportável (Fases 9 — ativação pendente)

---

## O que está DESCONECTADO (por design)

| Item | Estado intencional |
|---|---|
| Google Drive / rclone | Template criado; OAuth não configurado |
| YouTube RTMPS | Script criado; chave não cadastrada; preset recusa sem chave |
| Supabase (banco GSA TV) | Migrations prontas; não aplicadas ainda |
| n8n workflows | JSONs criados; não importados ainda |
| Nginx HLS preview | Config criada; não ativado ainda |
| JWT_SECRET (Playout API) | Placeholder; integrar com GSA Hub na Fase 7 |

---

## Próximo gate — Fase 7: GSA TV Manager

### Pré-requisitos para iniciar a Fase 7
1. Executar `setup-directories.sh` na VPS para criar a árvore de diretórios
2. Aplicar migrations em ordem: `bash db/migrate.sh` (requer credenciais do PostgreSQL do GSA Hub)
3. Fazer `docker compose up --build` na VPS para subir todos os 9 serviços
4. Verificar que todos os healthchecks ficam `healthy` em até 60 s
5. Confirmar Prometheus scraping: `curl localhost:9090/targets`
6. Confirmar Grafana acessível: `curl localhost:3001/api/health`

### O que a Fase 7 criará
- Módulo `GSA TV` no painel administrativo Remix
- 9 telas: Central ao Vivo, Status, Biblioteca, Grade, Publicação, Cache, Jobs, Incidentes, Configurações
- Integração com Playout API (JWT GSA Hub)
- Player HLS interno na Central ao Vivo
- Editor de grade totalmente configurável
- Sem acesso a shell, Docker ou filesystem pelo browser

---

> [!NOTE]
> O banco técnico (`gsa_tv.*`) deve ser aplicado no PostgreSQL **já existente** do GSA Hub — não cria um novo banco separado. O schema `gsa_tv` é isolado e não interfere com os schemas existentes.

> [!IMPORTANT]
> Antes de aplicar as migrations em produção, execute com `--dry-run` para verificar o que será aplicado: `bash db/migrate.sh --dry-run`
