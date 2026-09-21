# Análise Técnica: Levantamento da Grade de 15/09, Banco de Dados e Pipeline Noturno na VPS

**Data do Levantamento**: 2026-09-15 00:36 BRT (03:36 GMT)  
**Agente Responsável**: `teamwork_preview_explorer_survey_3`  
**Host Alvo**: Oracle Cloud Linux VPS (`147.15.43.141:22`, usuário `opc`)  
**Diretório Base na VPS**: `/opt/gsa-tv/`  

---

## 1. Resumo Executivo

Neste levantamento técnico profundo, investigamos a pipeline de automação noturna da GSA TV para o dia **15/09/2026**. Identificamos:
1. **Pipeline de Produção Noturna Ativa**: O processo mestre `/usr/bin/python3 /opt/gsa-tv/bin/night-production.py` está atualmente em execução contínua (iniciado via `gsa-tv-night-factory.service`, PID principal 3870456).
2. **Definição da Grade**: A grade publicada para 15/09/2026 é a **Versão 2** (`896c3e00-05a1-48ad-8d1e-bb12cc6a45ef`), composta por exatamente **27 blocos/slots de programação** cobrindo das **06:00:00 às 23:59:00** (total de 86.340s; com off-air / produção das 00:00 às 05:59).
3. **Mecanismo de Banco de Dados**: Utiliza PostgreSQL 15 / Supabase (`postgres:15` e `gsa-tv-control-plane` com `DATABASE_URL`). As tabelas principais são `gsa_tv_channels`, `gsa_tv_schedule_versions`, `gsa_tv_program_blocks`, `gsa_tv_programs`, `gsa_tv_media_items`, `gsa_tv_jobs` e `gsa_tv_audit_log`. As RPCs centrais são `public.gsa_tv_materialize_fixed_schedule(date, 'ch-main')` e `public.gsa_tv_production_signature(version_id)`.
4. **Status Atual dos 27 Blocos**:
   - **Bloco 7 (09:30–10:00, GSA Histórias da Bíblia)**: Pré-vinculado com sucesso ao item de acervo aprovado `media-builder-hist-0909` (1.800s, 1080p, `rights_ok = true`).
   - **Bloco 1 (06:00–06:30, GSA Em Fé)**: Marcado como `missing_eligible_media` porque é do tipo acervo (`library`) e nenhum master aprovado de 1.800s com slug correspondente foi vinculado.
   - **Bloco 2 (06:30–07:15, GSA Agro)**: Síntese de áudio (TTS Fish Audio, 97s) e renderização de vídeo 1080p30 (137,055s) concluídas com sucesso. Registrado no banco como `media-master-gsa-agro-2026-09-15-818ad89d-a679-431d-8962-4e16fb769899` em estado `ready`. Porém, no estado do orchestrator noturno ficou como `incomplete_duration` porque a duração sintetizada (137s) é menor que o slot planejado (2.700s).
   - **Bloco 3 (07:15–07:30, GSA Tempo)**: Síntese de áudio concluída (123,5s via Fish Audio Clara Venturi). Renderização de vídeo em andamento no momento deste levantamento.
   - **Demais 23 Blocos**: Pendentes de processamento sequencial pela pipeline.
5. **Gargalos Críticos Identificados para o Prazo das 06:00 AM**:
   - **Discrepância de Duração (Underfilled)**: As sínteses diárias geram matérias de 1 a 3 minutos, enquanto os blocos da grade têm durações de 15 a 60 minutos (900s a 3.600s). A regra `media_issue()` em `night-production.py` exige que o arquivo tenha duração compatível (`actual >= budget - 2`), rejeitando vinculação de matérias curtas.
   - **Estado de Aprovação Inicial (`approval_state='pending'`)**: O script `night-production.py` registra novos masters com `approval_state='pending'` e `rights_ok=false`. Como `link_eligible()` exige `approval_state='approved'` e `rights_ok=true`, nenhum master gerado é vinculado sem etapa de aprovação.
   - **Blocos de Acervo (`library`)**: Blocos marcados como `library` não entram na síntese de IA e falham imediatamente se não houver mídia pré-aprovada na biblioteca com o slug exato.

---

## 2. Arquitetura da Pipeline Noturna

### 2.1 Componentes e Serviços
- **Timer & Serviço Systemd**:
  - `/etc/systemd/system/gsa-tv-night-factory.timer` ativa às 00:00 GMT (21:00 BRT ou configurado na madrugada).
  - `/etc/systemd/system/gsa-tv-night-factory.service` executa `/usr/bin/python3 /opt/gsa-tv/bin/night-production.py`.
- **Script Controlador**: `/opt/gsa-tv/bin/night-controller.py`
  - `night-controller.py stop`: Coloca o playout em `stream_standby` durante a madrugada e dispara `gsa-tv-night-factory.service`.
  - `night-controller.py start`: Às 06:00 BRT, executa `production.compile_ready(date)` e faz a transição para `stream_start` (modo `'program'`).
- **Script de Produção Diária**: `/opt/gsa-tv/bin/daily-scripts.py`
  - Inspeciona fontes de notícias e gera `/home/opc/gsa-ai/work/roteiros-2026-09-15/ROTEIROS-NOVOS.md` e `production-sources.json`.
- **Motor de Síntese Vocal**: `/home/opc/gsa-ai/bin/gsa-tts-engine.mjs`
  - Usa a API Fish Audio (chave armazenada no Vault de credenciais).
  - Possui catálogo de 22 vozes oficiais mapeadas por apresentador e slug do programa.
  - Gera áudio EBU R128 em 48kHz estéreo em `/opt/gsa-tv/cache/media/1/audio/programs/{slug}/{slug}-locucao-master.wav`.
- **Montador Audiovisual**: `/home/opc/gsa-program-builder/video_assembler.py`
  - Executa FFmpeg dentro do container Docker isolado `gsa-tv/control-plane:1.8.7`.
  - Seleciona átomos de B-roll usando `gsa_broll_manager`.
  - Gera trilha harmônica corporativa com ducking (-18dB).
  - Aplica lower-thirds / GCs institucionais com fonte `DejaVuSans-Bold.ttf`.
  - Vincula vinheta oficial de abertura e encerramento (1080p30, H.264 / AAC 48kHz).
  - Exporta master e gera arquivo de controle de qualidade `{output}.qc.json`.
- **Fallback Autônomo via IA**: `/media/1/production/autonomous/tools/autonomous-script.cjs`
  - Acionado quando o programa não possui fontes no ledger diário (`name not in available`).
  - Utiliza Google Gemini (`gsa_tv_ai_provider_secrets`) para geração do texto e locução via `gemini-3.1-flash-tts-preview`, renderizando via `render-generic-program.py`.

---

## 3. Arquitetura de Banco de Dados e Mapeamento de Tabelas

A persistência do sistema é gerenciada no PostgreSQL via Supabase no container `gsa-tv-control-plane`.

### Tabelas Principais:
1. **`gsa_tv_channels`**:
   - Registro principal `id = 'ch-main'`.
   - Coluna `config->'broadcast_schedule_policy'`:
     - `on_air_start`: `"06:00:00"`
     - `stream_stop`: `"23:59:00"`
     - `production_start`: `"00:00:00"`
     - `production_stop`: `"05:59:00"`
     - `sign_off_start`: `"23:50:00"`
2. **`gsa_tv_schedule_versions`**:
   - `id`: UUID da versão (`896c3e00-05a1-48ad-8d1e-bb12cc6a45ef` para 15/09/2026).
   - `broadcast_date`: `'2026-09-15'`.
   - `version`: `2`.
   - `state`: `'published'`.
3. **`gsa_tv_program_blocks`**:
   - Contém os slots de transmissão associados a `schedule_version_id`.
   - Total de 27 blocos para a data.
   - Campos: `id`, `schedule_version_id`, `program_id`, `planned_start_offset_s`, `planned_duration_s`, `media_item_id`, `is_reprise`, `metadata`, `block_type`, `position`.
4. **`gsa_tv_programs`**:
   - Catálogo mestre de programas (`id`, `name`, `channel_id`).
5. **`gsa_tv_media_items`**:
   - Catálogo de mídias aptas para exibição:
     - `id`: Identificador único (ex: `media-master-gsa-agro-2026-09-15-...`).
     - `channel_id`: `'ch-main'`.
     - `title`: Nome do programa e data.
     - `duration_s`: Duração em segundos.
     - `drive_path`: Caminho no sistema de arquivos do container (ex: `/media/1/program-masters/...`).
     - `state`: `'ready'`.
     - `approval_state`: `'approved'` | `'pending'` | `'rejected'`.
     - `rights_ok`: booleano (`true` para liberado).
     - `metadata`: JSONB com `program_slug`, `broadcast_date`, `production_qc`, `target_duration_s`.
6. **`gsa_tv_jobs`**:
   - Fila de jobs assíncronos: `compile_playlist`, `stream_start`, `stream_standby`.
7. **`gsa_tv_audit_log`**:
   - Logs de auditoria estruturados com actor `night-production` ou `night-controller`.

### RPCs e Stored Procedures:
- `public.gsa_tv_materialize_fixed_schedule(date, channel_id)`: Materializa automaticamente os blocos da grade semanal fixa para uma data específica caso ainda não existam.
- `public.gsa_tv_production_signature(schedule_version_id)`: Gera um hash de integridade dos blocos e mídias vinculadas para garantir que a grade não foi modificada durante a checagem.

---

## 4. Levantamento Completo da Grade de 15/09/2026 (27 Slots)

Abaixo está o inventário exato dos 27 blocos que compõem as 24 horas da grade de 15/09/2026:

| # | Horário Início | Horário Término | Duração (s) | Block ID | Programa | Modo de Conteúdo | Mídia Vinculada no Banco | Status no Ledger / Pipeline |
|---|---|---|---|---|---|---|---|---|
| 1 | 06:00:00 | 06:30:00 | 1800 | `a782f8bb-1585-4eca-93e2-673ffa8211a0` | GSA Em Fé | library | null | `missing_eligible_media` (sem master de 1800s no acervo) |
| 2 | 06:30:00 | 07:15:00 | 2700 | `818ad89d-a679-431d-8962-4e16fb769899` | GSA Agro | mixed | null | Sintetizado e renderizado (137s). `incomplete_duration` |
| 3 | 07:15:00 | 07:30:00 | 900 | `86ea4013-6e11-46be-a23d-2d1866ba1efe` | GSA Tempo | api | null | Em renderização de vídeo (áudio: 123.5s) |
| 4 | 07:30:00 | 08:00:00 | 1800 | `f7d13b46-f585-4fbd-8dec-7f9ba2fcafdb` | GSA Manhã News | mixed | null | No ledger (1 fonte pronta). Aguardando processamento |
| 5 | 08:00:00 | 09:00:00 | 3600 | `532ddef0-d5c1-40f3-bcdc-4423d0c2073b` | GSA Bem Viver | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 6 | 09:00:00 | 09:30:00 | 1800 | `905688bd-435c-4be6-961d-6a5fcabb8eac` | GSA Tech | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 7 | 09:30:00 | 10:00:00 | 1800 | `5ab59d97-076d-44f1-a40c-310665cc9ab0` | GSA Histórias da Bíblia | library | `media-builder-hist-0909` | **CONCLUÍDO & VINCULADO** (1800s, Aprovado) |
| 8 | 10:00:00 | 10:30:00 | 1800 | `c4c7db99-2f7a-4500-adb2-60b8bd977a23` | GSA Cidadania | mixed | null | No ledger (9 fontes prontas). Aguardando processamento |
| 9 | 10:30:00 | 11:00:00 | 1800 | `cd0cbcf2-a461-4dd6-94f5-8b06b99cd1c5` | GSA Business | mixed | null | No ledger (10 fontes prontas). Aguardando processamento |
| 10 | 11:00:00 | 12:00:00 | 3600 | `7cb750de-ffda-485a-bdb1-3a2c9774e898` | GSA Sabor | ai_original | null | `missing_verified_sources` (irá para geração autônoma) |
| 11 | 12:00:00 | 12:30:00 | 1800 | `d5f1fc24-445c-499f-82bb-0014124f6547` | GSA Meio Dia News | mixed | null | No ledger (9 fontes prontas). Aguardando processamento |
| 12 | 12:30:00 | 13:00:00 | 1800 | `c247dd32-21b8-4ede-92bd-a62ae9c96898` | GSA Mercado | api | null | No ledger (10 fontes prontas). Aguardando processamento |
| 13 | 13:00:00 | 13:30:00 | 1800 | `823999aa-010f-4d8e-aaba-07db6bf53b91` | GSA Desenhos | library | null | Acervo existente não vinculado (`program_slug` despareado) |
| 14 | 13:30:00 | 14:30:00 | 3600 | `12516662-54a9-4a4e-a213-9ab38e8496b0` | GSA Planeta Terra | mixed | null | No ledger (10 fontes prontas). Aguardando processamento |
| 15 | 14:30:00 | 15:30:00 | 3600 | `254039dd-eef8-4c9e-bdca-8b2e56b20453` | GSA Destinos | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 16 | 15:30:00 | 16:30:00 | 3600 | `5638ea2d-5327-49d0-9036-fc0466e7d9ef` | GSA Mundo | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 17 | 16:30:00 | 17:00:00 | 1800 | `67d5fd01-cb53-4baa-b82a-ca3e91017932` | GSA Hora da Palavra | ai_original | null | `missing_verified_sources` (irá para geração autônoma) |
| 18 | 17:00:00 | 17:30:00 | 1800 | `5979df92-e5f3-436b-83a6-8a5cf0656b8b` | GSA Motor | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 19 | 17:30:00 | 18:00:00 | 1800 | `0f2f9292-a83b-462b-aab7-b09cbff27b8a` | GSA Tá na Rede | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 20 | 18:00:00 | 19:00:00 | 3600 | `6c377715-f532-4691-a846-75d8bc685679` | GSA Esportes | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 21 | 19:00:00 | 19:30:00 | 1800 | `09149d77-f6b8-46a1-a438-44899ffe1138` | GSA News Noite | mixed | null | No ledger (5 fontes prontas). Aguardando processamento |
| 22 | 19:30:00 | 20:00:00 | 1800 | `64a32b69-696e-4e84-a316-c493fc4bceac` | GSA Cinema | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 23 | 20:00:00 | 22:00:00 | 7200 | `c25b969e-5c85-471a-b3d7-df1f14e86eb7` | GSA Sessão Pipoca | library | null | Acervo existente de 7200s não vinculado |
| 24 | 22:00:00 | 23:00:00 | 3600 | `493559c1-2408-43fc-84a4-974066b2e081` | GSA Mistérios | mixed | null | `missing_verified_sources` (irá para geração autônoma) |
| 25 | 23:00:00 | 23:30:00 | 1800 | `9419f6a4-cbcc-486f-8cac-76503231a6cc` | GSA Music | library | null | Acervo pendente |
| 26 | 23:30:00 | 23:50:00 | 1200 | `2a8851c9-af05-4e8b-b337-53e5c615bb5d` | GSA Em Fé | library | null | Acervo pendente |
| 27 | 23:50:00 | 23:59:00 | 540 | `91368035-2657-430a-b148-d0a466e5327a` | Continuidade GSA TV | library | null | Acervo pendente |

---

## 5. Achados Críticos e Recomendações para a Orquestração

### 5.1 O Problema da Validação de Duração (`incomplete_duration` / `underfilled`)
- A função `media_issue(m, block, date)` em `night-production.py` contém:
  ```python
  actual = probe(path)
  if actual > block['planned_duration_s'] + 1: return 'overlong'
  if actual < block['planned_duration_s'] - 2: return 'underfilled'
  ```
- Para o GSA Agro (slot de 2.700s = 45 min), o áudio gerado pelo Fish Audio tem 97 segundos e o vídeo gerado tem 137 segundos. O script classifica o item como `incomplete_duration`.
- Na checagem final `report(date)`, esse item é reprovado com o erro `'underfilled'`.
- **Impacto**: Se não for aceito preenchimento com filler/bumper ou se a tolerância de duração não for ajustada ou se não houver looping/expansão de B-Roll até o budget, a compilação final da playlist rejeitará a grade.

### 5.2 O Problema do Status de Aprovação Inicial
- `night-production.py` insere os itens recém-produzidos com `approval_state='pending'` e `rights_ok=false`.
- A query de vinculação (`link_eligible`) filtra estritamente por:
  ```sql
  approval_state = 'approved' AND rights_ok = true
  ```
- **Impacto**: Nenhum master novo gerado durante a noite é vinculado pelo `link_eligible` a menos que um processo ou operador aprove o registro e marque `rights_ok = true`.

### 5.3 O Problema dos Blocos de Acervo (`library`)
- Blocos 1, 13, 23, 25, 26 e 27 são marcados como `content_mode = 'library'`.
- O código em `night-production.py` (linha 225) ignora esses blocos da síntese e adiciona diretamente `state: 'missing_eligible_media'` se eles não tiverem `media_item_id`.
- Porém, existem arquivos de acervo aptos no banco (ex: `media-ent-desenhos-betty-boop` com 1800s, `media-ent-pipoca-sexta` com 7200s, etc.), mas seus metadados (`program_slug` ou `broadcast_date`) não estão correspondendo aos critérios exatos do `link_eligible()`.

---

## 6. Conclusão da Investigação

A pipeline noturna está operacional e executando normalmente na VPS. As ferramentas de IA (Fish Audio para locução e ffmpeg/docker para vídeo) estão funcionando perfeitamente sem erros de API. No entanto, para cumprir o critério de aceitação de 100% de conclusão e compilação da grade de 24h até as 05:59 AM, a equipe de remediação precisará atuar nos 3 gargalos estruturais identificados: compatibilização da regra de duração (`underfilled`), auto-aprovação de masters recém-validados pelo QC, e vinculação correta dos 6 blocos de acervo (`library`).
