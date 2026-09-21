# Relatório Técnico de Investigação — GSA Agro, Masters Package e Changelog

**Data/Hora**: 2026-09-08T03:00:00Z (08/09/2026 00:00 BRT)  
**Investigador**: Survey Explorer 3  
**Alvo**: VPS Oracle Linux `147.15.43.141`, usuário `opc`, diretório `/home/opc/gsa-ai`  
**Escopo**: Inventário de `masters-v1`, regenerações aprovadas, ativos do GSA Agro, especificação de `masters-final/` e `manifest.json`, e diretrizes de atualização do `GSA_TV_MEMORY_CHANGELOG.md`.

---

## 1. Inventário Detalhado de `masters-v1/`

### 1.1 Localização e Visão Geral
- **Diretório**: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/`
- **Total de arquivos MP4**: 50 arquivos (exatamente 25 pares de `opening` e `closing`).
- **Convenção de Nomenclatura**: `<slug>-<kind>.mp4` (onde `<slug>` é o identificador do programa e `<kind>` é `opening` ou `closing`).
- **Arquivos de Manifesto e Checksums Existentes**:
  - `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/master-manifest.json` (50 registros mapeando slug, kind, source_index, source candidate, logo PNG e master path).
  - `/home/opc/gsa-ai/work/identity-flow-20260907/SHA256SUMS-MASTERS-V1.txt` (checksums SHA-256 de todas as 50 peças).

### 1.2 Parâmetros Técnicos (`ffprobe`)
Todas as 50 peças de `masters-v1` foram inspecionadas via `ffprobe` e apresentam conformidade técnica idêntica:
- **Codec de Vídeo**: H.264 (High profile, yuv420p)
- **Resolução**: 1920x1080 (Full HD 16:9)
- **Taxa de Quadros (FPS)**: 30 fps exatos (`r_frame_rate="30/1"`)
- **Duração**: 10.000 segundos exatos
- **Codec de Áudio**: AAC (LC)
- **Amostragem de Áudio**: 48.000 Hz
- **Canais de Áudio**: 2 canais (estéreo)
- **Taxa de Bits (Bitrate)**: Entre 2.325.579 bps (~2,3 Mbps) e 7.289.938 bps (~7,3 Mbps)
- **Tamanhos em Disco**: Entre 2.906.974 bytes (~2,9 MB) e 9.112.423 bytes (~9,1 MB)

### 1.3 Tabela Completa dos 50 Arquivos em `masters-v1/`

| Programa (Slug) | Tipo (`kind`) | Arquivo | Tamanho (Bytes) | SHA-256 Hash | Status Editorial |
|---|---|---|---|---|---|
| `gsa-agro` | closing | `gsa-agro-closing.mp4` | 5.669.028 | `adebd8ca62b3adfc709577d38fc32eef1d8ceab327e0c53a5dd9930cca08fc2e` | Aprovado (Original) |
| `gsa-agro` | opening | `gsa-agro-opening.mp4` | 7.496.990 | `548b00abba7b76ae546a1c8b5f87f76beac96bfa25356422f520eed510433215` | Defeito (`TV AGRO/TV.Safe`) |
| `gsa-bem-viver` | closing | `gsa-bem-viver-closing.mp4` | 3.768.078 | `d0bc0191a67f0d983414f178b2393fe1b43a814772f95bc981accd1674461883` | Defeito (Texto `BEM` duplicado) |
| `gsa-bem-viver` | opening | `gsa-bem-viver-opening.mp4` | 3.945.982 | `555880420e12593805fc530971141b21c011903246578ec98686c7f27b7682d8` | Aprovado (Original) |
| `gsa-business` | closing | `gsa-business-closing.mp4` | 4.075.567 | `9010b37c501845b2151350c3c995192fc4210db402fb5cb8f675f19b67505bc7` | Aprovado (Original) |
| `gsa-business` | opening | `gsa-business-opening.mp4` | 5.194.216 | `8d40c8960b0785112e8e7d6318d7a02f79f92fe8a3e51188099ffa40dc91ec9b` | Defeito (`TV SAFE watermark`) |
| `gsa-cidadania` | closing | `gsa-cidadania-closing.mp4` | 4.869.793 | `b6fbe5d631164faf43e07726809f1e63f34323a2621b4e09ad821763b83a6a66` | Aprovado (Original) |
| `gsa-cidadania` | opening | `gsa-cidadania-opening.mp4` | 4.791.860 | `fae42bce358afe987d0e08d640e2e3110d388b88b3b02fa4a9f9170d1785c5d1` | Aprovado (Original) |
| `gsa-cinema` | closing | `gsa-cinema-closing.mp4` | 3.291.813 | `b245281ba5e26488a9f4b750749e88771969835e041c7763b39c46a7b4625310` | Aprovado (Original) |
| `gsa-cinema` | opening | `gsa-cinema-opening.mp4` | 4.046.185 | `756f143cfa10413010c64e9185eb02b65dbff8dcb4812ea248ebcf5f75725260` | Aprovado (Original) |
| `gsa-desenhos` | closing | `gsa-desenhos-closing.mp4` | 3.058.584 | `521580bf817759653f1b0ed69e00390ae23ad06baf172c051cb95150bb1e27e4` | Aprovado (Original) |
| `gsa-desenhos` | opening | `gsa-desenhos-opening.mp4` | 3.327.341 | `a50f338d0ebd796133bbf80fa63070a5ae192a2f4a66ca0ef7628679c3eb3cfd` | Aprovado (Original) |
| `gsa-destinos` | closing | `gsa-destinos-closing.mp4` | 4.940.411 | `6bc49a5d34eb564f07e8154eb2063061b67c0cbad128a5d284532fbfa15be9dc` | Aprovado (Original) |
| `gsa-destinos` | opening | `gsa-destinos-opening.mp4` | 4.505.450 | `56346f3134205c3a86a06c62b06f6f222857e2b7f75c337c24bff7a90bc4ec7d` | Aprovado (Original) |
| `gsa-em-fe` | closing | `gsa-em-fe-closing.mp4` | 3.444.284 | `2b7ab2850981a04492aede8e65819f157e983fac5fba8741cc9dcf66d647cb7e` | Defeito (Marcas d'água estranhas) |
| `gsa-em-fe` | opening | `gsa-em-fe-opening.mp4` | 3.891.325 | `df90928083a588a2afaaf7c74f666dee56333f471a20fe134f4f1f45c7c67c18` | Aprovado (Original) |
| `gsa-esportes` | closing | `gsa-esportes-closing.mp4` | 5.422.578 | `018ad3b465ad9a67c7885bd596f8e6fbaf537df0294877f1044f834bcb140ded` | Defeito (Texto `PROGNAM`) |
| `gsa-esportes` | opening | `gsa-esportes-opening.mp4` | 6.134.313 | `9a91d43aefd3b04f7a2b113b6ddb13016a77051d7c2329b6bd844cc925e9b66f` | Aprovado (Original) |
| `gsa-historias-da-biblia` | closing | `gsa-historias-da-biblia-closing.mp4` | 4.284.838 | `e2119569cf723b015a702a8d6020531f748324c746650ac085554d417bd99702` | Aprovado (Original) |
| `gsa-historias-da-biblia` | opening | `gsa-historias-da-biblia-opening.mp4` | 6.253.724 | `08f6a13899f1af8a8171a73ef17729ecc0063a7e57b7c9a1ce75a5c5fa395b6f` | Aprovado (Original) |
| `gsa-hora-da-palavra` | closing | `gsa-hora-da-palavra-closing.mp4` | 2.906.974 | `01642f3810ce1789bae0fe5c1e30d41a9749d0fae298f5992e3c99c9d9df3b31` | Aprovado (Original) |
| `gsa-hora-da-palavra` | opening | `gsa-hora-da-palavra-opening.mp4` | 3.628.849 | `f010ceeb0ae2dd53665c6cb2f5e1c9248eb2c399435b84ab60384be84ee1a33f` | Defeito (`TV SAFE watermark`) |
| `gsa-manha-news` | closing | `gsa-manha-news-closing.mp4` | 4.971.459 | `2f4a25351b435682f87ee851940e8d4f10d3d97a59344729292eaae555d037dc` | Aprovado (Original) |
| `gsa-manha-news` | opening | `gsa-manha-news-opening.mp4` | 5.038.259 | `0041965a25f6caccde833070668d81fcf16433bb673fa16301759fb375b5c92e` | Aprovado (Original) |
| `gsa-meio-dia-news` | closing | `gsa-meio-dia-news-closing.mp4` | 5.575.904 | `ca77d01441a02fd2b0794a7d7969361e7c4316fea1f8f3584fe74dfb91551e81` | Aprovado (Original) |
| `gsa-meio-dia-news` | opening | `gsa-meio-dia-news-opening.mp4` | 7.055.979 | `054dbcf0a5e2d2771e1d87598d8be8c47d89bbb92925702ba0f8e32701682bdd` | Aprovado (Original) |
| `gsa-mercado` | closing | `gsa-mercado-closing.mp4` | 5.181.919 | `12e52ee77a7b47c6f163eade0ee0cfb87590751481fd1375fb916eefb59b099e` | Aprovado (Original) |
| `gsa-mercado` | opening | `gsa-mercado-opening.mp4` | 6.778.229 | `d8b577115346b264f573f479e2b928ae9b2cc7e0d2cbb8fb8c7528fe8a65754c` | Aprovado (Original) |
| `gsa-misterios` | closing | `gsa-misterios-closing.mp4` | 3.175.286 | `b399021b13afc8afd026371b1f8e9785d14902ee122f525110fd4f443bfa313a` | Aprovado (Original) |
| `gsa-misterios` | opening | `gsa-misterios-opening.mp4` | 5.743.578 | `011c37920eded5f6c8d465b3c4df20979e5ceedc9afe53ae0eb9b74cb9efa70f` | Aprovado (Original) |
| `gsa-motor` | closing | `gsa-motor-closing.mp4` | 6.229.798 | `e256dc023279ad3d0315fe9d8c9f59ee4f3ea3ca4d84c4f6c07f57f92a7b83ed` | Aprovado (Original) |
| `gsa-motor` | opening | `gsa-motor-opening.mp4` | 5.499.133 | `ab6d6f940b7a616d59b4e5b6fb7e7510548dbb7a9fce65a9db9756ef8caf3889` | Defeito (Texto `PROGRAM`) |
| `gsa-mundo` | closing | `gsa-mundo-closing.mp4` | 4.537.550 | `b2ca3f291dd036f63ec65bf5f3b51cfd8a2c7d5c765f648e49b79f17237e251c` | Aprovado (Original) |
| `gsa-mundo` | opening | `gsa-mundo-opening.mp4` | 4.508.939 | `e859aa5c8593ce5888cd9435cdb94bb4d602287235d3e20cd1ac901fdbdc6c13` | Aprovado (Original) |
| `gsa-music` | closing | `gsa-music-closing.mp4` | 3.904.209 | `9e9e16db4cec359da1f3e42ee38df81cb1ba6ed56a2f235a7cc5512bd3d73a70` | Aprovado (Original) |
| `gsa-music` | opening | `gsa-music-opening.mp4` | 5.166.364 | `4d687ab615adcc41ae202e7e7074ecbb846de9b4afa16173837f300682344213` | Aprovado (Original) |
| `gsa-news-noite` | closing | `gsa-news-noite-closing.mp4` | 4.822.044 | `c85b279f3a2736285c97bb21ac4b7b7706d2bddb20a02fb8b1fcbaad8107af9e` | Aprovado (Original) |
| `gsa-news-noite` | opening | `gsa-news-noite-opening.mp4` | 5.490.099 | `3d8b475d7064ab0009ad6c0cd4dfe00f736134bfb4f42af86d27018cadcd4e32` | Defeito (`NEWS PROGRAM`) |
| `gsa-planeta-terra` | closing | `gsa-planeta-terra-closing.mp4` | 9.112.423 | `d7d43c11f742cb72b5330b8c8fb11d94ea27dbe99ace2536b6b4d0a29af7b204` | Aprovado (Original) |
| `gsa-planeta-terra` | opening | `gsa-planeta-terra-opening.mp4` | 8.976.923 | `3113957442dd77376a4d9fb83c32a22fcbfbf4bcc3ebb86fff50d436f3ee8141` | Aprovado (Original) |
| `gsa-sabor` | closing | `gsa-sabor-closing.mp4` | 3.987.048 | `601b2f90923bde4662d17c47f2dcf43e8369330a011e33a5c9749e10c19a7409` | Aprovado (Original) |
| `gsa-sabor` | opening | `gsa-sabor-opening.mp4` | 4.463.612 | `e930d77af35f7a209b6dd0683406761ece9c7d0216045d6fd16d2202a5062932` | Defeito (Texto `SABOE`) |
| `gsa-sessao-pipoca` | closing | `gsa-sessao-pipoca-closing.mp4` | 3.892.763 | `e8f73e220cdbb32c085403cc756dc6df8dd479d74a0d1f78e7fa94e4b7bf1cb6` | Aprovado (Original) |
| `gsa-sessao-pipoca` | opening | `gsa-sessao-pipoca-opening.mp4` | 6.467.259 | `e4d587dc38d9ef1837c3dca64b9cab5cc34479b2f2ddba7865fb2dc47140022e` | Aprovado (Original) |
| `gsa-ta-na-rede` | closing | `gsa-ta-na-rede-closing.mp4` | 3.814.026 | `aa81a49139e8d39bad0a8169776bf60eadc6da0263386b48c071bf87295ffaf9` | Aprovado (Original) |
| `gsa-ta-na-rede` | opening | `gsa-ta-na-rede-opening.mp4` | 4.599.304 | `4801d90fe7e1e698bcbcfd950ee774824489f9f3b40c475beff002a69648ddf6` | Aprovado (Original) |
| `gsa-tech` | closing | `gsa-tech-closing.mp4` | 4.839.510 | `e041be35a8751ac99f7ec99c33bdfa5f23a2d861e5d1d780a5f20fd9ada18265` | Aprovado (Original) |
| `gsa-tech` | opening | `gsa-tech-opening.mp4` | 4.990.563 | `e2e575d45fee5c42550bb2d22095e941f09bb3d20db2defbc95ceb5b4b98849d` | Aprovado (Original) |
| `gsa-tempo` | closing | `gsa-tempo-closing.mp4` | 5.641.876 | `cb3dbae182c85aee8e8e39c64e2b5e96d2eb8319ffadddc7e96439bc2687577b` | Aprovado (Original) |
| `gsa-tempo` | opening | `gsa-tempo-opening.mp4` | 4.561.266 | `7cc3da9e9071089efb5143024abbe9d3c7fe19ce37adaf2d9f3a24f9bfaf842a` | Aprovado (Original) |

### 1.4 Diagnóstico Editorial de `masters-v1`
Embora 100% dos arquivos estejam tecnicamente íntegros (resolução, duração, codec de áudio/vídeo), o lote `masters-v1` como um todo foi reprovado pelo responsável no changelog anterior (23:38 BRT) pelos seguintes motivos:
1. O script `build-gsa-masters.mjs` inseriu blur localizado (`gblur=sigma=18`), escurecimento e sobreposição de um segundo logo PNG oficial por cima de vídeos do Flow que já continham elementos visuais/logo.
2. A política mandatória estabelecida é: **PROIBIDO aplicar blur global/local, desaceleração artificial ou sobrepor um segundo logo sobre vídeo do Flow que já contenha logo**.
3. As **peças originais sem defeito (41 peças)** devem ser mantidas limpas e intactas.
4. As **peças com defeito comprovado (9 peças)** são substituídas unicamente pelas regenerações correspondentes aprovadas visualmente no Google Flow.

---

## 2. Regenerações Aprovadas (GSA Esportes e GSA Hora da Palavra)

### 2.1 Peça 1: GSA Esportes — Encerramento
- **Caminho na VPS**: `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/esportes-closing-repl.mp4`
- **Tamanho**: 4.012.353 bytes (~4,01 MB)
- **SHA-256**: `db5a9055baf2c8cb18c6bb9b7f1e2bbbea6772f73e7d94556728c7cce31b2a22`
- **ID no Google Flow**: `6d4683fe-78b3-4e62-b7b1-6be20f570fbe`
- **Aria/Título no Flow**: `"GSA Esportes closing broadcast i…"`
- **Contact Sheet de QC**: `/home/opc/gsa-ai/work/identity-flow-20260907/qc-replacements/esportes-closing-repl.jpg`
- **Propriedades Técnicas Brutas do Flow**: H.264, 1280x720, 24 fps, AAC 48 kHz estéreo, duração 8.000s.
- **Status em `regen-defective-state.json`**: `"qc": "approved_visual_sample"`
- **Motivo da Substituição**: O original (candidato 11) continha texto sintético deformado (`PROGNAM`). A regeneração possui o logo limpo e foi aprovada visualmente.

### 2.2 Peça 2: GSA Hora da Palavra — Abertura
- **Caminho na VPS**: `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/hora-opening-repl-2.mp4`
- **Tamanho**: 1.688.162 bytes (~1,69 MB)
- **SHA-256**: `3eed26e249fe74ca3101d78663d8a47c74334f344c4cd8c25ac3fe39263980dc`
- **ID no Google Flow**: `6129ad61-df66-476a-b91d-9770bc515fb7`
- **Aria/Título no Flow**: `"GSA Hora da Palavra opening"`
- **Contact Sheet de QC**: `/home/opc/gsa-ai/work/identity-flow-20260907/qc-replacements/hora-opening-repl-2.jpg`
- **Propriedades Técnicas Brutas do Flow**: H.264, 1280x720, 24 fps, AAC 48 kHz estéreo, duração 8.000s.
- **Status em `regen-defective-state.json`**: `"qc": "approved_visual_sample"`
- **Motivo da Substituição**: O original (candidato 18) continha marca d'água espúria (`TV SAFE watermark`).
- *Nota Histórica*: O arquivo intermediário `hora-opening-repl-1.mp4` (Flow ID `68815c97-739e-4404-8eaf-e58ff22d8817`) foi **reprovado** por inventar o texto `PROGUUAC / PROGRECOM`. O arquivo `hora-opening-repl-2.mp4` é a peça correta e aprovada.

---

## 3. Ativos do GSA Agro e Análise do Teste Publicado

### 3.1 Teste Publicado: `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-builder-teste-publicado.mp4`
*(Nota de localização: o prompt menciona `/home/opc/gsa-ai/work/gsa-agro-builder-teste-publicado.mp4`, mas o arquivo físico real reside em `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-builder-teste-publicado.mp4`).*

- **Propriedades Técnicas**:
  - Tamanho: 259.095 bytes (~259 KB)
  - Resolução: 1280x720 (720p)
  - Taxa de Quadros: 30 fps
  - Duração: 8.256 segundos
  - Áudio: AAC 48 kHz estéreo
- **Razões Obrigatórias para Descarte e Refazimento**:
  1. **Uso de MP3 Legado**: O teste foi montado utilizando o áudio estático antigo `/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/gsa-agro--apresentando.mp3`.
  2. **Voz Incorreta**: Não utilizou a voz institucional mandatória da Fish Audio (`5c8a9b5d0b2549c7ada853529199ebe5` sob o modelo `s2.1-pro-free`), que é a voz padrão das chamadas da GSA TV.
  3. **Resolução Não Conforme**: O vídeo foi exportado em 1280x720 (720p), violando a norma de playout de 1920x1080 (1080p).
  4. **Duração e Conteúdo Incompletos**: Com apenas 8,256 segundos, não constitui um master completo de programa (abertura + continuidade + blocos/intervalos + encerramento).
  5. **Peça de Abertura Defeituosa**: Utilizou a abertura do Flow antiga com artefatos visuais.

### 3.2 Peças de Abertura e Encerramento do GSA Agro
1. **Abertura Original**:
   - Arquivo: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/gsa-agro-opening.mp4`
   - Candidato Flow: Candidato #34
   - Diagnóstico: **Defeituosa** (presença de marcas espúrias `TV AGRO` e `TV.Safe`).
   - Status da Regeneração: Submetida com sucesso no Google Flow (`2026-09-07T17:52:15.814Z ACCEPTED gsa-agro:opening`), aguardando exportação/QC no container `gsa-ai-browser`.
2. **Encerramento Original**:
   - Arquivo: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/gsa-agro-closing.mp4`
   - Candidato Flow: Candidato #32
   - Diagnóstico: **Íntegras e Aprovadas**. Não apresentou defeitos visuais no censo inicial nem foi marcado para regeneração.

### 3.3 Program Builder (`/home/opc/gsa-program-builder/builder.py`)
- O script em `/home/opc/gsa-program-builder/builder.py` linhas 17 e 135-140 aponta diretamente para o diretório local de bumpers:
  ```python
  BUMPERS = Path('/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered')
  def bumper_path(slug, kind):
      suffix = 'apresentando' if kind == 'presenting' else 'de-volta'
      p = BUMPERS / f'{slug}--{suffix}.mp3'
      ...
  ```
- Para atender ao R2/R3, `builder.py` deve substituir o carregamento desse arquivo por uma chamada à API TTS do Fish Audio ou integrar a geração dinâmica reutilizando as credenciais seguras já descriptografadas pelo `ai_worker` (`/opt/gsa-tv/ai-worker/ai_worker.mjs`), que lê a chave segura de `/home/opc/gsa-ai/secrets/fish-production.enc.json`.

---

## 4. Requisitos para `masters-final/` e `manifest.json`

### 4.1 Diretório Alvo
- **Caminho**: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/`
- **Estado Atual**: **Não existe ainda**. Deverá ser criado na etapa de montagem do pacote aprovado.

### 4.2 Contagem Mínima e Elegibilidade dos Arquivos
- **Regra de Escopo**: O pacote final deve conter **pelo menos 40 MP4s** (excluindo peças que ainda estejam em regeneração pendente).
- **Matemática do Pacote**:
  - Total de programas: 25 programas x 2 peças (abertura + encerramento) = 50 peças.
  - Peças originais sem defeito (intactas): **41 peças**.
  - Peças com regeneração já aprovada (Esportes encerramento + Hora da Palavra abertura): **2 peças**.
  - Total imediatamente aprovado e elegível: **43 MP4s** (satisfaz a exigência de >= 40 MP4s).
  - Peças com regeneração pendente no Flow (7 peças): GSA Sabor (abertura), GSA Bem Viver (encerramento), GSA Em Fé (encerramento), GSA Agro (abertura), GSA Motor (abertura), GSA News Noite (abertura), GSA Business (abertura). Quando auditadas e aprovadas, o lote final atingirá 50 MP4s.
- **Exclusão Explícita**: `GSA Entrevista` está **terminantemente excluído** do escopo e não deve constar em nenhuma hipótese.

### 4.3 Especificação Técnica de Conformidade dos Arquivos
Cada MP4 em `masters-final/` deve respeitar:
- **Container**: MP4 (`+faststart`)
- **Codec de Vídeo**: H.264 (yuv420p)
- **Resolução**: 1920x1080 (1080p)
- **Taxa de Quadros**: 30 fps
- **Codec de Áudio**: AAC 48.000 Hz estéreo
- **Duração**: Entre 8s e 12s
- **Qualidade Visual**: Sem aplicação de blur, sem desaceleração artificial e sem dupla inserção de logo.
*(Nota importante de conformação: os brutos do Flow como `esportes-closing-repl.mp4` possuem 1280x720 24fps e 8.0s de duração. Ao serem promovidos a `masters-final`, devem sofrer escalonamento limpo para 1920x1080 e 30fps sem qualquer filtro destrutivo de blur ou sobreposição).*

### 4.4 Esquema do `manifest.json`
O manifesto deve ser gravado em `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json` com a seguinte estrutura de schema:
```json
[
  {
    "program": "GSA Agro",
    "piece_type": "closing",
    "source": "original",
    "sha256": "adebd8ca62b3adfc709577d38fc32eef1d8ceab327e0c53a5dd9930cca08fc2e",
    "approved_at": "2026-09-08T03:00:00Z"
  },
  {
    "program": "GSA Esportes",
    "piece_type": "closing",
    "source": "regenerated",
    "sha256": "db5a9055baf2c8cb18c6bb9b7f1e2bbbea6772f73e7d94556728c7cce31b2a22",
    "approved_at": "2026-09-08T03:00:00Z"
  }
]
```
Campos obrigatórios validados:
- `program`: Nome oficial do programa (string)
- `piece_type`: `"opening"` ou `"closing"` (string)
- `source`: `"original"` ou `"regenerated"` (string)
- `sha256`: Hash SHA-256 em hexadecimal minúsculo (string de 64 caracteres)
- `approved_at`: Timestamp ISO 8601 UTC de aprovação (string)

---

## 5. Estrutura e Regras de Atualização do `GSA_TV_MEMORY_CHANGELOG.md`

### 5.1 Estado Atual do Arquivo
- **Localização**: `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`
- **Extensão**: 2.453 linhas
- **Última Entrada**:
  - Título: `## 2026-09-07 23:38 -03 — Reconciliação canônica das identidades após reprovação das remasterizações`
  - Backup associado: `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md.bak-20260907-2338-identidades`

### 5.2 Regras Canônicas de Atualização do Changelog
Toda alteração futura no changelog deve seguir rigorosamente o padrão consolidado da equipe de infraestrutura:
1. **Backup Obrigatório Pré-Edição**:
   Antes de abrir o arquivo para escrita, criar um backup no formato:
   `cp /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md.bak-YYYYMMDD-HHMM-<slug>`
2. **Cabeçalho Padronizado**:
   `## YYYY-MM-DD HH:MM -03 — <Título Claro da Ação/Milestone>`
3. **Seções Típicas**:
   - *Contexto e Autorização*: Motivo da intervenção e diretriz editorial.
   - *Ações Executadas*: Lista detalhada de comandos, scripts rodados e arquivos alterados.
   - *Inventário e Hashes*: Caminhos absolutos, contagem de arquivos e tabela/lista com hashes SHA-256.
   - *Verificação e QC*: Comprovação técnica com logs do `ffprobe` e validação visual de contact sheets.
   - *Próximos Passos*: Estado consolidado para as próximas etapas.

---

## 6. Observação Crítica de Infraestrutura da VPS
- **Wrapper `/usr/local/bin/ffprobe`**:
  O arquivo `/usr/local/bin/ffprobe` no host chama internamente a imagem `gsa-tv/control-plane:1.7.2`, que não existe mais localmente (as imagens ativas na VPS são `1.8.7` e `1.7.9`). Isso causa erro `docker: pull access denied` se o comando `ffprobe` for invocado diretamente pelo shell host.
- **Solução Padronizada**:
  Qualquer comando de inspeção de mídia na VPS deve utilizar:
  `docker run --rm --user 0:0 -v /home:/home -v /opt:/opt gsa-tv/control-plane:1.8.7 ffprobe <args>`
  Esta observação deve constar no briefing do implementador para evitar quebras em scripts de validação automatizados.
