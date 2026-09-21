# Relatório de Diagnóstico e Auditoria de Liveness da VPS — Grade 15/09 (GSA TV)

**Data da Auditoria:** 2026-09-15T03:33:00Z (00:33:00 Horário de Brasília)  
**Agente Investigador:** `teamwork_preview_explorer_survey_1` (Read-only Investigation)  
**Host Alvo:** Oracle Cloud Linux VPS (`147.15.43.141:22`, usuário `opc`, hostname `gsa-server-pro`)  
**Kernel:** Linux `6.12.0-204.92.4.3.1.el9uek.aarch64` (ARM Neoverse-N1, 4 vCPUs)  
**Status Geral:** **OPERACIONAL / EM PRODUÇÃO ATIVA**

---

## 1. Sumário Executivo

A auditoria de infraestrutura e processos da VPS confirmou com 100% de evidências operacionais que:
1. **Conectividade SSH:** Totalmente íntegra, autenticada via chave privada RSA/Ed25519 (`C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key`), sem timeouts ou perdas de pacotes.
2. **Liveness do `night-production.py`:** O script está **ATIVO e em plena execução** sob o PID principal **3870456**, iniciado às 03:29:29 GMT (00:29:29 BRT). O processo pai é o PID 1 (`systemd`), sob a unit `gsa-tv-night-factory.service`.
3. **Produção da Grade 15/09:** O pipeline já executou a materialização da grade para o dia `2026-09-15` (versão `896c3e00-05a1-48ad-8d1e-bb12cc6a45ef`, contendo 27 blocos de programação). 
   - A síntese de áudio TTS via API Fish Audio (Daniel Campos) para o programa `GSA Agro` concluiu com sucesso (12/12 parágrafos, conformação EBU R128 estéreo 48kHz em 97.0s).
   - O renderizador editorial (`video_assembler.py`) concluiu a geração do miolo (`core_assembled.mp4` com 25.8 MB) e está normalizando as vinhetas oficiais através de container Docker com ffmpeg.
4. **Recursos de Sistema:** A VPS possui folga de memória e processamento:
   - **RAM:** 22 GiB totais (5.4 GiB usados, 17 GiB disponíveis, 16 GiB buffers/cache).
   - **Disco:** 183 GB totais em `/dev/mapper/ocivolume-root`, com 39 GB livres (79% de ocupação).
   - **CPU:** 4 núcleos ARM Neoverse-N1; load average ~3.5 a 4.5. O processo de render é estritamente isolado via `--cpuset-cpus 2,3` e `--cpus 1.5`, preservando os núcleos 0 e 1 para transmissão ao vivo, banco de dados e control-plane.
5. **Ambiente de Execução:** O pipeline roda como serviço nativo **systemd** (`gsa-tv-night-factory.service`), disparado por timer (`gsa-tv-night-factory.timer`). Utilitários como `tmux` e `screen` não estão instalados na VPS.

---

## 2. Inventário de Processos e Liveness de Produção

### 2.1 Processo Principal: `night-production.py`
- **Comando:** `/usr/bin/python3 /opt/gsa-tv/bin/night-production.py`
- **PID:** `3870456`
- **Usuário:** `root`
- **Início:** `Tue Sep 15 03:29:29 GMT 2026` (`00:29:29 BRT`)
- **Consumo de Memória:** ~30 MB RSS / 241 MB VSZ
- **Consumo de CPU:** ~0.1% a 0.3% (orquestrador aguardando subprocessos)
- **Trava de Idempotência:** Mantém lock exclusivo via `fcntl.flock` no arquivo `/tmp/gsa-tv-night-factory.lock`.
- **CGroup:** `/system.slice/gsa-tv-night-factory.service`

### 2.2 Árvore de Processos em Tempo Real (Subprocessos e Render)
```
systemd (PID 1)
 └─ gsa-tv-night-factory.service
     └─ python3 /opt/gsa-tv/bin/night-production.py (PID 3870456)
         └─ python3 /home/opc/gsa-program-builder/video_assembler.py (PID 3874195)
             └─ docker run --rm --net host --cpuset-cpus 2,3 --cpus 1.5 ... ffmpeg (PID 3879329)
                 └─ ffmpeg -i /opt/gsa-tv/cache/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4 ... (PID 3879371)
```

### 2.3 Processos Correlacionados na VPS
| Subsistema | Processos Detectados | Status / Observação |
|---|---|---|
| **FFmpeg** | `PID 3879371` (dentro do container docker `gsa-tv/control-plane:1.8.7`) | Ativo, renderizando H.264 1080p30 a ~144% CPU (limitado a 1.5 cpus nos cores 2 e 3). |
| **Chromium** | PIDs `1549550`, `1549582`, `1549591`, `1549848` no container `gsa-ai-browser` | Ativo com porta CDP `9228` exposta para automação de browser/Google. |
| **Node.js** | `gsa-tts-engine.mjs` (sob demanda), `n8n` (PID 744496), `n8n-bridge` (PID 676066), `desktop-commander` (PID 3856923), `ai_worker.mjs` (PID 2178746), `server_webhook.cjs` (PID 1643156), `gsa-upload-service` (PID 2227639) | Todos ativos e saudáveis. |
| **Celery** | Nenhum processo | Arquitetura não utiliza Celery; orquestração baseada em NodeJS, scripts Python e Systemd. |
| **Docker Fleet** | `gsa-tv-control-plane`, `gsa-tv-ffplayout`, `gsa-ai-browser`, `n8n`, `gsa-auth-session`, `realtime`, `evolution-api`, `evo-redis`, `evo-postgres`, `storage`, `mytunnel` | Todos os containers em estado `Up` e saudáveis. |

---

## 3. Auditoria de Recursos do Sistema

```
=== DATE & UPTIME ===
Tue Sep 15 03:29:27 AM UTC 2026 (00:29:27 BRT)
Uptime: 39 dias, 8:40 | Load Average: 3.51, 4.48, 4.73

=== MEMÓRIA (free -m) ===
               total        used        free      shared  buff/cache   available
Mem:           22945        5480        1484         396       16811       17464
Swap:           5119        2289        2830

=== DISCO (df -h) ===
Filesystem                  Size  Used Avail Use% Mounted on
/dev/mapper/ocivolume-root  183G  145G   39G  79% /
/dev/sda2                   2.0G  730M  1.3G  37% /boot
/dev/mapper/ocivolume-oled   15G  403M   15G   3% /var/oled
```

### Avaliação de Capacidade:
- **CPU (4 vCPUs ARM Neoverse-N1):** A carga de 3.5 a 4.5 é normal e esperada durante a renderização de vídeo. O isolamento de cgroups via `gsa-load-guard.sh` e docker `--cpuset-cpus 2,3` garante que a CPU não sofra starvation na transmissão ao vivo (`gsa-tv-ffplayout`).
- **RAM (22 GiB):** 17 GiB disponíveis. Sem qualquer risco de Out-Of-Memory (OOM).
- **Disco (39 GiB livres em `/`):** Espaço suficiente para a geração dos vídeos diários (~15-20 GB esperados para a grade completa de 24h). Entretanto, recomenda-se que o monitoramento acompanhe a retenção diária (`gsa-tv-retention.timer` agendado para 06:00 UTC).

---

## 4. Estado da Grade e Pipeline de Produção (15/09)

### 4.1 Identificação dos Artefatos
- **Versão da Grade Ativa:** `896c3e00-05a1-48ad-8d1e-bb12cc6a45ef` (`gsa_tv_schedule_versions`, `broadcast_date = '2026-09-15'`, state = `published`).
- **Arquivo de Estado:** `/opt/gsa-tv/runtime/production/2026-09-15.json`
- **Arquivo de Log de Execução:** `/opt/gsa-tv/runtime/production/2026-09-15-execution.log`
- **Ledger de Fontes:** `/home/opc/gsa-ai/work/roteiros-2026-09-15/production-sources.json`
- **Roteiros:** `/home/opc/gsa-ai/work/roteiros-2026-09-15/ROTEIROS-NOVOS.md`

### 4.2 Mapeamento dos 27 Blocos da Grade
Uma consulta direta ao banco de dados revelou a seguinte composição para 15/09:

| Horário | Programa | Duração | Estado Inicial de Mídia | Observação do Pipeline |
|---|---|---|---|---|
| 06:00 | GSA Em Fé | 1800s | NONE | Marcado `content_mode: "library"`. Marcado pelo script como `missing_eligible_media` porque não há item de acervo aprovado linkado. |
| 06:30 | GSA Agro | 2700s | NONE | **Em processamento ativo** (`state: "video"`). Áudio concluído, vídeo quase finalizado. |
| 07:15 | GSA Tempo | 900s | NONE | Fontes verificadas prontas no ledger (`state: ready`, 10 fontes). |
| 07:30 | GSA Manhã News | 1800s | NONE | Fontes verificadas prontas no ledger (`state: ready`, 1 fonte). |
| 08:00 | GSA Bem Viver | 3600s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 09:00 | GSA Tech | 1800s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 09:30 | GSA Histórias da Bíblia | 1800s | **media-builder-hist-0909** | **Já vinculado e pronto no banco!** |
| 10:00 | GSA Cidadania | 1800s | NONE | Fontes verificadas prontas no ledger (`state: ready`, 9 fontes). |
| 10:30 | GSA Business | 1800s | NONE | Fontes verificadas prontas no ledger (`state: ready`, 10 fontes). |
| 11:00 | GSA Sabor | 3600s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 12:00 | GSA Meio Dia News | 1800s | NONE | Fontes verificadas prontas no ledger (`state: ready`, 9 fontes). |
| 12:30 | GSA Mercado | 1800s | NONE | Fontes verificadas prontas no ledger (`state: ready`, 10 fontes). |
| 13:00 | GSA Desenhos | 1800s | NONE | Programação infantil/acervo. |
| 13:30 | GSA Planeta Terra | 3600s | NONE | Fontes verificadas prontas no ledger (`state: ready`, 10 fontes). |
| 14:30 | GSA Destinos | 3600s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 15:30 | GSA Mundo | 3600s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 16:30 | GSA Hora da Palavra | 1800s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 17:00 | GSA Motor | 1800s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 17:30 | GSA Tá na Rede | 1800s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 18:00 | GSA Esportes | 3600s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 19:00 | GSA News Noite | 1800s | NONE | Fontes verificadas prontas no ledger (`state: ready`, 5 fontes). |
| 19:30 | GSA Cinema | 1800s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 20:00 | GSA Sessão Pipoca | 7200s | NONE | Longa-metragem/acervo. |
| 22:00 | GSA Mistérios | 3600s | NONE | `missing_verified_sources` no ledger; acionará pipeline autônomo. |
| 23:00 | GSA Music | 1800s | NONE | Acervo musical/louvor. |
| 23:30 | GSA Em Fé | 1200s | NONE | Conteúdo institucional/religioso. |
| 23:50 | Continuidade GSA TV | 540s | NONE | Vinhetas institucionais e alinhamento de grade. |

---

## 5. Achados Críticos e Pontos de Atenção para o Time de Remediação

### 5.1 Bloqueio de Concorrência Inicial às 03:00 GMT (00:00 BRT)
- **Fato observado no journalctl:** Às 03:00:00 GMT e 03:00:01 GMT, o timer do systemd tentou iniciar o `gsa-tv-night-factory.service`, mas falhou com:
  `BlockingIOError: [Errno 11] Resource temporarily unavailable` no arquivo `/tmp/gsa-tv-night-factory.lock`.
- **Resolução Automática:** Às 03:29:29 GMT, a lock foi liberada e o serviço iniciou normalmente.
- **Ação Recomendada:** Monitorar se há processos residuais que seguram a lock em `/tmp/gsa-tv-night-factory.lock` caso o serviço seja reiniciado manualmente.

### 5.2 Programas do Modo Biblioteca (`content_mode: "library"`)
- **Fato observado:** O bloco `06:00 - GSA Em Fé` possui `metadata.content_mode = "library"`.
- O script `night-production.py` possui a seguinte checagem estrita:
  ```python
  if not block['name'] or block['is_reprise'] or (block.get('metadata') or {}).get('content_mode')=='library':
      state['programs'].append({'block_id':block['id'],'program':block['name'],'state':'missing_eligible_media'})
      save(state)
      continue
  ```
- **Consequência:** Como o programa é marcado como biblioteca, ele não gera áudio/vídeo novo do dia; ele busca no acervo itens aprovados com `program_slug = 'gsa-em-fe'` e `rights_ok = true`. Caso não encontre nenhum arquivo válido no disco com duração exata, ele fica em `missing_eligible_media`.
- **Ação:** O subagente de remediação deve garantir que exista uma mídia elegível no acervo ou vincular a edição anterior/aprovada na tabela `gsa_tv_media_items` para os blocos marcados como reprise/library (`GSA Em Fé`, `GSA Desenhos`, `Sessão Pipoca`, `GSA Music`, `Continuidade GSA TV`).

### 5.3 Programas sem Fontes Jornalísticas (`missing_verified_sources`)
- Dos 20 programas definidos para produção, 9 possuem fontes jornalísticas frescas no ledger. Os outros 11 acionam o fallback autônomo via `autonomous-script.cjs`.
- **Ação:** O subagente de monitoramento (M2) deve acompanhar a execução do `autonomous-script.cjs` para esses blocos e intervir caso algum estoure timeout ou falhe na geração de roteiro.

---

## 6. Conclusão da Investigação (Milestone 1)

O ambiente da VPS está estável, saudável e com todos os serviços e recursos necessários operando perfeitamente. O processo `night-production.py` (PID 3870456) está em execução contínua e ativa gerando a grade de 15/09. Todos os dados, PIDs, unidades systemd e caminhos de log foram mapeados com exatidão para continuidade imediata pelo time de monitoramento e remediação.
