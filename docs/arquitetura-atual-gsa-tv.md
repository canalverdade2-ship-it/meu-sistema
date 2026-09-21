# GSA TV — Arquitetura atual

**Documento de referência operacional**  
**Atualizado em:** 01/09/2026

Este documento substitui, para fins de operação e auditoria, as decisões antigas que usavam Google Drive/rclone e serviços separados nas portas 9200/9201/9203.

## Princípios definitivos

- um canal GSA TV, uma grade e um sinal contínuo;
- a VPS é a biblioteca e o armazenamento operacional definitivo;
- PostgreSQL/Supabase guarda metadados, grade, direitos, auditoria e filas;
- o navegador nunca executa shell, FFmpeg ou Docker;
- ffplayout executa a grade e gera HLS interno;
- o Control Plane processa mídia, compila grade, controla relay e integra IA;
- o Watchdog é independente do Control Plane e mede HLS/áudio/vídeo;
- n8n reconcilia e automatiza, mas nunca é ponto único de falha;
- segredos não retornam ao navegador e não ficam em workflows versionados.

## Fluxo de transmissão

```text
GSA Hub → PostgreSQL → Control Plane → ffplayout → HLS interno
                                              ↓
                                    relay FFmpeg → YouTube
```
## Serviços atuais

| Serviço | Escuta | Função |
|---|---:|---|
| ffplayout | `127.0.0.1:8787` | playout e HLS |
| Control Plane | `127.0.0.1:9202` | mídia, grade, relay, IA e jobs |
| Watchdog | `127.0.0.1:9204` | supervisão e As-Run |
| n8n bridge | rede Docker privada | API mínima para automações |
| n8n | ambiente GSA existente | reconciliação e relatórios |

O Control Plane usa uma chave interna para rotas de automação. O n8n não recebe `service_role`, `DATABASE_URL`, Stream Key do YouTube nem acesso ao Docker.

## Armazenamento

```text
/opt/gsa-tv/cache/media/1/       # mídia definitiva e versões normalizadas
/opt/gsa-tv/playlists/1/         # playlists do ffplayout
/opt/gsa-tv/preview/1/live/      # HLS interno
/opt/gsa-tv/fallback/            # contingência
/opt/gsa-tv/backups/full/        # backups integrais e manifestos
```

Uploads/importações são inspecionados por FFprobe. Arquivos incompatíveis são normalizados antes de receber estado `ready`.
## n8n atual

Os oito workflows versionados trabalham apenas pela ponte privada:

1. Media Readiness Reconcile
2. Schedule Compile
3. VPS Storage Readiness
4. Playout Monitor
5. YouTube Transport Monitor
6. Rights Watch
7. Approved AI Production
8. Daily Operational Report

O workflow 07 executa somente projetos já aprovados e explicitamente configurados para autonomia. Comandos de transmissão, TAKE/RETURN e credenciais continuam fora do escopo do n8n.

## Homologação

Os scripts de homologação temporal medem tempo real. Um teste de 72 horas só pode resultar em PASS depois de 259.200 segundos efetivamente monitorados. Relatórios antigos que marcavam períodos como aprovados sem executar esse tempo não são evidência válida.

A homologação pública do YouTube é distinta da prova de transporte RTMP: transporte pode ser confirmado pelo relay, mas o estado público deve ser confirmado pelo YouTube Studio/API.
