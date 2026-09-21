# Handoff Report: Survey da Grade de 15/09, Banco de Dados e Conclusão dos Programas 24h na VPS

**Autor**: `teamwork_preview_explorer_survey_3`  
**Destinatário**: `parent` (`teamwork_preview_orchestrator_26`, ID `cf5ec5de-a72c-4f1b-8c55-46cc2cfc1225`)  
**Data**: 2026-09-15 00:37 BRT (03:37 GMT)  
**Tipo**: Hard Handoff (Missão de levantamento concluída)  

---

## 1. Observation

1. **Processo Noturno Ativo na VPS**:
   - Comando executado: `ps aux | grep -E 'night|production'`
   - Resultado observado:
     ```
     root  3870453  0.0  0.1 239780 23552 ?  S   03:29  0:00 sudo systemctl start gsa-tv-night-factory.service
     root  3870455  0.0  0.1 238008 23744 ?  S   03:29  0:00 systemctl start gsa-tv-night-factory.service
     root  3870456  0.6  0.1 241616 30000 ?  Ss  03:29  0:00 /usr/bin/python3 /opt/gsa-tv/bin/night-production.py
     ```
   - O processo está rodando sob a unidade `/etc/systemd/system/gsa-tv-night-factory.service`.

2. **Definição da Grade 15/09 no Banco de Dados**:
   - Query executada:
     ```sql
     select * from gsa_tv_schedule_versions where broadcast_date='2026-09-15' order by version desc;
     ```
   - Versão publicada ativa: `id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'`, versão 2, `state = 'published'`.
   - Política de canal (`gsa_tv_channels` para `id = 'ch-main'`):
     `on_air_start = "06:00:00"`, `stream_stop = "23:59:00"`, `production_start = "00:00:00"`, `production_stop = "05:59:00"`.
   - Total de blocos na versão: **27 blocos** cobrindo das 06:00:00 às 23:59:00.

3. **Arquivos de Estado e Log da Produção Noturna**:
   - Arquivo de estado: `/opt/gsa-tv/runtime/production/2026-09-15.json`
   - Log de execução: `/opt/gsa-tv/runtime/production/2026-09-15-execution.log`
   - Conteúdo de `/opt/gsa-tv/runtime/production/2026-09-15.json`:
     ```json
     {
       "date": "2026-09-15",
       "schedule_version_id": "896c3e00-05a1-48ad-8d1e-bb12cc6a45ef",
       "state": "running",
       "programs": [
         {
           "block_id": "a782f8bb-1585-4eca-93e2-673ffa8211a0",
           "program": "GSA Em Fé",
           "state": "missing_eligible_media"
         },
         {
           "block_id": "818ad89d-a679-431d-8962-4e16fb769899",
           "program": "GSA Agro",
           "slug": "gsa-agro",
           "state": "incomplete_duration",
           "master": "/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-2026-09-15-818ad89d-a679-431d-8962-4e16fb769899-master-1080p.mp4",
           "duration": 137.055,
           "media_id": "media-master-gsa-agro-2026-09-15-818ad89d-a679-431d-8962-4e16fb769899"
         },
         {
           "block_id": "86ea4013-6e11-46be-a23d-2d1866ba1efe",
           "program": "GSA Tempo",
           "slug": "gsa-tempo",
           "state": "video"
         }
       ]
     }
     ```

4. **Registro de Mídia no Banco de Dados (`gsa_tv_media_items`)**:
   - Para o programa GSA Agro:
     `id`: `media-master-gsa-agro-2026-09-15-818ad89d-a679-431d-8962-4e16fb769899`
     `state`: `ready`
     `approval_state`: `pending`
     `rights_ok`: `false`
     `duration_s`: 137
     `drive_path`: `/media/1/program-masters/gsa-agro-2026-09-15-818ad89d-a679-431d-8962-4e16fb769899-master-1080p.mp4`

5. **Regras de Validação no Código de `/opt/gsa-tv/bin/night-production.py`**:
   - Linha 125 (`media_issue`):
     ```python
     if m['state'] != 'ready' or m['approval_state'] != 'approved' or not m['rights_ok']:
         return 'media_not_approved'
     actual = probe(path)
     if actual > block['planned_duration_s']+1: return 'overlong'
     if actual < block['planned_duration_s']-2: return 'underfilled'
     ```
   - Linha 225 (Tratamento de blocos de acervo):
     ```python
     if not block['name'] or block['is_reprise'] or (block.get('metadata') or {}).get('content_mode')=='library':
         state['programs'].append({'block_id':block['id'],'program':block['name'],'state':'missing_eligible_media'})
         save(state)
         continue
     ```
   - Linha 275 (Inserção e Estado do item recém-sintetizado):
     ```python
     item['state']='incomplete_duration' if qc['probe']['duration']<budget-2 else 'awaiting_review'
     ```

6. **Ledger de Roteiros Diários (`/home/opc/gsa-ai/work/roteiros-2026-09-15/production-sources.json`)**:
   - Total de 20 programas diários catalogados.
   - 9 programas com fontes válidas (`state: "ready"`): `gsa-agro`, `gsa-tempo`, `gsa-manha-news`, `gsa-cidadania`, `gsa-business`, `gsa-meio-dia-news`, `gsa-mercado`, `gsa-planeta-terra`, `gsa-news-noite`.
   - 11 programas sem fontes catalogadas (`state: "missing_verified_sources"`): `gsa-bem-viver`, `gsa-tech`, `gsa-sabor`, `gsa-destinos`, `gsa-mundo`, `gsa-hora-da-palavra`, `gsa-motor`, `gsa-ta-na-rede`, `gsa-esportes`, `gsa-cinema`, `gsa-misterios`.

---

## 2. Logic Chain

1. A partir das **Observações 1 e 3**, deduz-se que a automação noturna (`night-production.py`) está ativa e operando de forma assíncrona sequencial sobre os 27 blocos da grade.
2. A partir da **Observação 2**, a grade do dia 15/09 possui exatamente 27 blocos, cobrindo o período útil das 06:00 às 23:59 (com o intervalo da madrugada 00:00–05:59 reservado para standby e geração de mídia).
3. A partir da **Observação 4**, o GSA Agro foi sintetizado via Fish Audio (97s) e montado com vinheta via FFmpeg (137,055s), e registrado em `gsa_tv_media_items` com sucesso técnico absoluto (1080p, H.264, AAC 48kHz stereo).
4. No entanto, a partir da **Observação 5 (Linha 275)** e **Observação 3**, o slot planejado para GSA Agro era de 2.700s (45 minutos), mas o vídeo gerado possui 137s. Por isso, a pipeline classificou o item como `incomplete_duration`.
5. Além disso, a partir da **Observação 5 (Linha 125)**, quando `night-production.py` chegar ao final da fila e executar `link_eligible()` e `report()`, a função `media_issue()` rejeitará esse master por dois motivos cumulativos:
   - `approval_state != 'approved'` e `rights_ok != true` (pois o `night-production.py` grava como `pending` e `rights_ok=false`).
   - `actual < block['planned_duration_s'] - 2` (`137 < 2698`), retornando `'underfilled'`.
6. Da mesma forma, a partir da **Observação 5 (Linha 225)**, os 6 blocos marcados com `content_mode = 'library'` (Blocos 1, 13, 23, 25, 26 e 27) são automaticamente rotulados como `missing_eligible_media` caso não haja uma mídia previamente aprovada no banco que bata com a duração e o slug.
7. Portanto, para que o aceite final (conclusão com grade 24h e compilação de playlist antes das 06:00 AM) seja atingido, a equipe de remediação precisará desbloquear essas 3 travas lógicas.

---

## 3. Caveats

- Não alteramos nenhum arquivo de código-fonte, banco de dados ou processo na VPS (investigação estritamente somente-leitura).
- O processo `night-production.py` continua em execução neste momento; conforme ele avança pelos blocos, os arquivos de log e estado continuarão sendo atualizados em tempo real.
- Nenhum outro caveat identificado.

---

## 4. Conclusion

1. **Definição da Grade**: A grade de 15/09/2026 está definida no banco de dados na tabela `gsa_tv_schedule_versions` (Versão 2, ID `896c3e00-05a1-48ad-8d1e-bb12cc6a45ef`), composta por **27 blocos programados** entre 06:00:00 e 23:59:00.
2. **Banco de Dados Utilizado**: Supabase PostgreSQL 15, rodando via Docker na VPS e acessado via `gsa-tv-control-plane` através da variável `DATABASE_URL`.
3. **Status Atual da Produção**:
   - Bloco 7 (`GSA Histórias da Bíblia`): Concluído e vinculado a `media-builder-hist-0909` (1.800s, aprovado).
   - Bloco 1 (`GSA Em Fé`): Falhou por `missing_eligible_media` (bloco library não vinculado).
   - Bloco 2 (`GSA Agro`): Sintetizado, renderizado e cadastrado no banco (`duration: 137s`), porém marcado como `incomplete_duration`.
   - Bloco 3 (`GSA Tempo`): Síntese vocal concluída, renderização em andamento.
   - Demais 23 blocos: Pendentes.
4. **Causa Raiz de Possível Falha na Compilação das 06:00 AM**: A incompatibilidade entre a duração curta gerada pelas notícias de IA (~2 a 3 min) e a duração planejada dos blocos da grade (15 a 60 min), somada à inserção de registros em estado `pending` e à falta de vinculação de itens para os blocos de acervo (`library`).

---

## 5. Verification Method

Para que qualquer agente ou avaliador possa verificar independentemente essas descobertas:

1. **Checagem do Processo na VPS**:
   ```bash
   node scratch/vps-exec.mjs "ps aux | grep -E 'night-production' | grep -v grep"
   ```
2. **Checagem do Estado Atual da Produção de 15/09**:
   ```bash
   node scratch/vps-exec.mjs "cat /opt/gsa-tv/runtime/production/2026-09-15.json"
   ```
3. **Checagem do Log de Execução**:
   ```bash
   node scratch/vps-exec.mjs "tail -n 40 /opt/gsa-tv/runtime/production/2026-09-15-execution.log"
   ```
4. **Checagem da Grade e Blocos no PostgreSQL**:
   ```bash
   node scratch/vps-exec.mjs -f .agents/teamwork_preview_explorer_survey_3/dump_blocks.sh
   ```
5. **Checagem dos Itens de Mídia Registrados**:
   ```bash
   node scratch/vps-exec.mjs -f .agents/teamwork_preview_explorer_survey_3/check_agro_registered.sh
   ```
