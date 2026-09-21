# Relatório Técnico de Investigação: Program Builder & Integração Fish Audio TTS

**Data da Investigação**: 2026-09-08 (00:05 BRT / 03:05 UTC)  
**Investigador**: Survey Explorer 2  
**Alvo**: VPS Oracle Cloud Linux (`147.15.43.141:22`), usuário `opc`  
**Escopo**: Arquitetura do Program Builder Python, Carregamento Seguro de Credenciais Fish Audio, Especificações da API Fish Audio TTS, Conformance de Áudio para ~5s 48kHz Estéreo e Ambiente de Execução.

---

## 1. Sumário Executivo

1. **Localização Canônica do Program Builder**:
   O Program Builder não reside em `/home/opc/gsa-ai/`, mas sim no diretório dedicado `/home/opc/gsa-program-builder/`. Ele opera como serviço de sistema (`gsa-program-builder.service`) rodando em `127.0.0.1:8770` via `/usr/bin/python3 /home/opc/gsa-program-builder/server.py`. O motor de renderização e timeline é o `/home/opc/gsa-program-builder/builder.py`.
2. **Carregamento Seguro da Chave Fish Audio**:
   A chave está cifrada em AES-256-GCM no cofre `/home/opc/gsa-ai/secrets/fish-production.enc.json`. A chave mestra de descriptografia (`GSA_TV_SECRET_KEY`, 32 bytes hex) é extraída em tempo de execução da memória do container `gsa-tv-control-plane` (`docker exec gsa-tv-control-plane printenv GSA_TV_SECRET_KEY`). Essa descriptografia foi testada e validada com sucesso em Python utilizando a biblioteca nativa `cryptography.hazmat.primitives.ciphers.aead.AESGCM`, sem expor ou gravar a chave em disco.
3. **Causa Raiz do Problema das Vozes Antigas**:
   Os MP3s legados em `/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/` foram gerados pelo script `scratch/generate-all-program-bumpers-vps.mjs` com base em um casting provisório (`provisional-assignment-2026-09-05.json`), o que atribuiu vozes inadequadas para a maioria dos programas (como o GSA Agro). O `builder.py` atualmente faz a seleção automática desses arquivos estáticos (`bumper_path(slug, kind)`).
4. **Especificações da API Fish Audio**:
   - Endpoint: `https://api.fish.audio/v1/tts`
   - Método: `POST`
   - Headers: `Authorization: Bearer <CHAVE>`, `Content-Type: application/json`, `model: s2.1-pro-free`
   - Voice ID institucional: `5c8a9b5d0b2549c7ada853529199ebe5` (Impacto Comercial)
   - Formatos testados: `mp3` (audio/mpeg, 44.1kHz mono, ~128kbps, status 200) e `wav` (audio/wav, pcm_s16le, 44.1kHz mono, status 200).
5. **Conformação de Áudio para 48kHz Estéreo ~5s com Fade In/Out**:
   Desenvolvemos e testamos via FFmpeg o filtro que transforma o áudio seco da API Fish (~3.2s mono 44.1kHz) em um master de exatamente 5.000000s, 48.000 Hz, 2 canais estéreo, com pré-roll de 250ms, fade-in de 0.25s, pad até 5s, fade-out de 0.5s e normalização EBU R128 (-16 LUFS / -1.5 dBTP).
6. **Ambiente Python e Ferramental**:
   Python 3.9.25 (aarch64) com `cryptography` (36.0.1) e `requests` (2.25.1) instalados. FFmpeg e FFprobe são executados via Docker com isolamento e controle de CPU (`IMAGE = 'gsa-tv/control-plane:1.7.9'`). Atenção: o wrapper `/usr/local/bin/ffprobe` no host aponta para a imagem obsoleta `1.7.2` e falha se chamado diretamente fora do Docker.

---

## 2. Inventário e Análise dos Scripts do Program Builder

### 2.1. Estrutura de Diretórios
```text
/home/opc/gsa-program-builder/
├── builder.lock                 # Lock de arquivo (fcntl.flock) para exclusão mútua
├── builder.py                   # Script principal de timeline, normalização e renderização
├── server.py                    # Servidor HTTP REST (ThreadingHTTPServer) porta 8770
├── cache/                       # Cache de segmentos normalizados e bumpers renderizados
├── jobs/                        # Histórico de jobs executados com logs e concat.txt
├── output/                      # Diretório intermediário de saída dos masters gerados
└── examples/                    # Exemplos de manifestos JSON (GSA Agro)
```

### 2.2. Arquitetura do `builder.py`
- **Isolamento e Controle de Carga**:
  - `load_guard(max_factor=0.80)`: Mede o load1 da VPS contra os 4 núcleos de CPU (`load1 <= limit`).
  - `docker_prefix(cpus='1.0')`: Executa comandos dentro do container Docker `gsa-tv/control-plane:1.7.9` com `nice -n 15`, `ionice -c 3`, restrição de CPU (`--cpus 1.0`, `--cpu-shares 128`), usuário `1000:1000` (`opc:opc`), montando `/opt`, `/home`, `/tmp`.
  - Concorrência: `fcntl.flock(lockf, fcntl.LOCK_EX | fcntl.LOCK_NB)` garante que apenas um render execute por vez.
- **Perfil Técnico Canônico**:
  ```python
  PROFILE = {
      'width': 1280,
      'height': 720,
      'fps': 30,
      'audio_rate': 48000,
      'audio_channels': 2
  }
  ```
- **Codificação FFmpeg**:
  `-c:v libx264 -preset superfast -crf 23 -g 60 -keyint_min 60 -sc_threshold 0 -pix_fmt yuv420p -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart`
- **Geração do Bumper Visual Atual (`render_audio_bumper`)**:
  Recebe um arquivo de áudio (`audio`), mede sua duração (`dur = max(1.0, duration(audio))`), e cria um card de vídeo 720p30 (fundo escuro `#101826`, barra superior `#1D2A44`, texto "GSA TV", nome do programa central e subtítulo em DejaVuSans) com fade-in e fade-out, com duração idêntica à do áudio.
- **Publicação e Registro**:
  - `publish_master`: Move o arquivo gerado atomicamente para `/opt/gsa-tv/cache/media/1/program-masters/{nome_publicado}`.
  - `control_plane_post('/program-builder/register')`: Registra o master gerado na biblioteca de mídia via Control Plane (porta 9202).
  - `control_plane_post('/program-builder/schedule')`: Agenda o programa na grade da emissora se solicitado no manifesto.

### 2.3. Ponto de Injeção dos Bumpers Antigos
No arquivo `builder.py`:
```python
BUMPERS = Path('/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered')

def bumper_path(slug, kind):
    suffix = 'apresentando' if kind == 'presenting' else 'de-volta'
    p = BUMPERS / f'{slug}--{suffix}.mp3'
    if not p.is_file():
        raise ValueError(f'bumper nao encontrado: {p.name}')
    return p
```
Em `resolve_item`:
```python
    if kind == 'presenting':
        return {'tipo': 'bumper', 'papel': 'apresentando', 'arquivo': str(bumper_path(slug, 'presenting')),
                'label': 'ESTAMOS APRESENTANDO'}
    if kind in {'return', 'de-volta', 'voltamos'}:
        return {'tipo': 'bumper', 'papel': 'de-volta', 'arquivo': str(bumper_path(slug, 'return')),
                'label': 'DE VOLTA À PROGRAMAÇÃO'}
```
Essa é a dependência exata que deve ser substituída pela síntese dinâmica via Fish Audio TTS.

---

## 3. Carregamento Seguro das Credenciais Fish Audio

### 3.1. Análise do Mecanismo em `ai_worker.mjs`
Em `/opt/gsa-tv/ai-worker/ai_worker.mjs` (linhas 12 a 23):
- O segredo da API é armazenado cifrado em `/home/opc/gsa-ai/secrets/fish-production.enc.json`.
- A chave de criptografia (`GSA_TV_SECRET_KEY`) é uma chave AES de 256 bits (32 bytes em formato hexadecimal) injetada como variável de ambiente no container Docker `gsa-tv-control-plane`.
- O algoritmo é `AES-256-GCM` com autenticação via `aad` e tag de 16 bytes no final do ciphertext.
- Em nenhum momento a chave da API é escrita em texto plano em logs, arquivos de configuração estáticos ou repositório Git.

### 3.2. Implementação Canônica e Segura em Python
Implementação validada diretamente no interpretador Python 3.9 da VPS:
```python
import base64
import json
import os
import subprocess
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VAULT_PATH = Path('/home/opc/gsa-ai/secrets/fish-production.enc.json')

def load_fish_api_key() -> str:
    if not VAULT_PATH.is_file():
        raise FileNotFoundError(f'Cofre de credenciais ausente: {VAULT_PATH}')
    
    # 1. Recupera chave mestra do ambiente ou do container control-plane
    hex_key = os.environ.get('GSA_TV_SECRET_KEY')
    if not hex_key:
        proc = subprocess.run(
            ['docker', 'exec', 'gsa-tv-control-plane', 'printenv', 'GSA_TV_SECRET_KEY'],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True
        )
        hex_key = proc.stdout.strip()
    
    key_bytes = bytes.fromhex(hex_key)
    vault_data = json.loads(VAULT_PATH.read_text(encoding='utf-8'))
    
    # 2. Descriptografia AES-256-GCM via cryptography
    def b64url_decode(s: str) -> bytes:
        return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))
    
    nonce = b64url_decode(vault_data['nonce'])
    ciphertext = b64url_decode(vault_data['ciphertext'])  # já inclui auth tag de 16 bytes no final
    aad = vault_data['aad'].encode('utf-8')
    
    aesgcm = AESGCM(key_bytes)
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, aad)
    decrypted_json = json.loads(decrypted_bytes.decode('utf-8'))
    
    return decrypted_json['api_key']
```
**Resultado da validação na VPS**: Executado com sucesso. `api_key` extraída com comprimento de 51 caracteres, sem falhas de tag e sem necessidade de `sudo` (pois o usuário `opc` pertence ao grupo `docker`).

---

## 4. Especificações da API Fish Audio TTS

### 4.1. Parâmetros da Requisição
- **Endpoint**: `POST https://api.fish.audio/v1/tts`
- **Headers**:
  ```http
  Authorization: Bearer <FISH_API_KEY>
  Content-Type: application/json
  model: s2.1-pro-free
  ```
- **Voice ID Institucional de Continuidade**: `5c8a9b5d0b2549c7ada853529199ebe5` (Impacto Comercial / Vinhetas & Transições).
- **Corpo JSON**:
  ```json
  {
    "text": "Estamos apresentando: GSA Agro.",
    "reference_id": "5c8a9b5d0b2549c7ada853529199ebe5",
    "format": "mp3",
    "normalize": true,
    "latency": "normal",
    "prosody": {
      "speed": 1.0,
      "volume": 0,
      "normalize_loudness": true
    }
  }
  ```

### 4.2. Formatos de Áudio Retornados
Realizamos testes de síntese diretamente contra a API na VPS:
1. **Formato MP3 (`format: "mp3"`)**:
   - Status HTTP: `200 OK`
   - Content-Type: `audio/mpeg`
   - Codec: `mp3`
   - Sample Rate: `44100 Hz`
   - Canais: `1` (Mono)
   - Bitrate: ~128 kbps
   - Duração da fala ("Estamos apresentando GSA Agro"): `3.265 s` (52.243 bytes).
2. **Formato WAV (`format: "wav"`)**:
   - Status HTTP: `200 OK`
   - Content-Type: `audio/wav`
   - Codec: `pcm_s16le`
   - Sample Rate: `44100 Hz`
   - Canais: `1` (Mono)
   - Duração da fala ("Voltamos a apresentar GSA Agro"): `3.158 s` (278.572 bytes).

Ambos os formatos respondem com baixa latência e perfeita inteligibilidade. Recomenda-se o uso de `wav` ou `mp3` como intermediário bruto temporário antes da conformação final em FFmpeg.

---

## 5. Conformação de Áudio (~5s, 48kHz Estéreo, Fade In/Out)

Como a voz sintetizada tem duração natural entre 3.0s e 3.5s, mono a 44.1kHz, o áudio precisa ser conformed para o padrão broadcast da emissora: **exatamente ~5s, 48kHz, estéreo, com fade-in e fade-out**.

### 5.1. Filtro FFmpeg Padronizado (Voz Limpa)
```bash
ffmpeg -y -hide_banner -loglevel error \
  -i /caminho/fish_raw.mp3 \
  -filter_complex "[0:a]adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]" \
  -map "[a]" -ac 2 -ar 48000 -c:a pcm_s16le /caminho/bumper_conformed_5s.wav
```

**Decomposição do Filtro**:
1. `adelay=250|250`: Adiciona 250ms de silêncio antes do início da fala, evitando que a locução comece colada no corte.
2. `afade=t=in:st=0:d=0.25`: Suaviza o início em 250ms.
3. `apad=whole_dur=5.0`: Completa o áudio com silêncio até atingir a duração exata de 5.0 segundos.
4. `atrim=0:5.0`: Assegura corte rígido no segundo 5.0 caso alguma frase mais longa ultrapasse.
5. `afade=t=out:st=4.5:d=0.5`: Fade-out de 500ms (do segundo 4.5 ao 5.0), garantindo término limpo sem pops.
6. `loudnorm=I=-16:TP=-1.5:LRA=7`: Normalização de sonoridade broadcast padrão EBU R128 (-16 LUFS integrado, -1.5 dB True Peak).
7. `aresample=48000`: Resampling limpo para 48 kHz.
8. `-ac 2`: Duplica o canal mono para estéreo balanceado (Left/Right).

**Verificação Técnica (`ffprobe`)**:
- Codec: `pcm_s16le` (ou `aac` / `mp3`)
- Sample Rate: `48000 Hz`
- Canais: `2` (Stereo)
- Duração: `5.000000 s` (precisão absoluta)

### 5.2. Filtro Alternativo com Acorde Harmônico Sutil (Identidade Sonora)
Se for desejado o colchão harmônico idêntico ao pacote de 05/09/2026:
```bash
ffmpeg -y -hide_banner -loglevel error \
  -i /caminho/fish_raw.mp3 \
  -f lavfi -i "sine=frequency=110:duration=5,volume=0.045" \
  -f lavfi -i "sine=frequency=165:duration=5,volume=0.025" \
  -f lavfi -i "sine=frequency=247:duration=5,volume=0.018" \
  -filter_complex "[1:a][2:a][3:a]amix=inputs=3:normalize=0,afade=t=in:st=0:d=0.25,afade=t=out:st=4.2:d=0.8[bed];[0:a]adelay=250|250,volume=1.18[vox];[bed][vox]amix=inputs=2:duration=longest:normalize=0,atrim=0:5.0,afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]" \
  -map "[a]" -ac 2 -ar 48000 -b:a 192k /caminho/bumper_conformed_5s.mp3
```

---

## 6. Proposta de Integração no `builder.py`

### 6.1. Modificações Necessárias em `builder.py`

1. **Importações**:
   Adicionar:
   ```python
   from cryptography.hazmat.primitives.ciphers.aead import AESGCM
   import requests
   ```
2. **Constantes da API Fish Audio**:
   ```python
   FISH_API_URL = 'https://api.fish.audio/v1/tts'
   FISH_MODEL = 's2.1-pro-free'
   FISH_VOICE_CONTINUITY = '5c8a9b5d0b2549c7ada853529199ebe5'
   FISH_VAULT_PATH = Path('/home/opc/gsa-ai/secrets/fish-production.enc.json')
   ```
3. **Função de Carregamento Seguro de Chave**:
   Inserir `load_fish_api_key()` conforme seção 3.2.
4. **Função `get_continuity_bumper(program_name, slug, kind, job_dir)`**:
   Gera o áudio sob demanda caso não esteja em cache:
   ```python
   def get_continuity_bumper(program_name: str, slug: str, kind: str, job_dir: Path) -> Path:
       """
       kind: 'presenting' ('apresentando') ou 'return' ('de-volta')
       """
       is_presenting = kind == 'presenting'
       label_text = 'ESTAMOS APRESENTANDO' if is_presenting else 'DE VOLTA À PROGRAMAÇÃO'
       spoken_phrase = f"Estamos apresentando: {program_name}." if is_presenting else f"Estamos de volta com: {program_name}."
       
       # Chave única de cache baseada no programa, texto e voz
       cache_token = hashlib.sha256(f"{slug}|{kind}|{spoken_phrase}|{FISH_VOICE_CONTINUITY}|v1".encode()).hexdigest()[:16]
       conformed_wav = CACHE / f"bumper_{slug}_{kind}_{cache_token}_48k5s.wav"
       
       if conformed_wav.exists() and conformed_wav.stat().st_size > 1024:
           return conformed_wav
       
       # 1. Chamar Fish Audio TTS
       api_key = load_fish_api_key()
       headers = {
           'Authorization': f'Bearer {api_key}',
           'Content-Type': 'application/json',
           'model': FISH_MODEL,
       }
       payload = {
           'text': spoken_phrase,
           'reference_id': FISH_VOICE_CONTINUITY,
           'format': 'mp3',
           'normalize': True,
           'latency': 'normal',
           'prosody': {'speed': 1.0, 'volume': 0, 'normalize_loudness': True}
       }
       resp = requests.post(FISH_API_URL, headers=headers, json=payload, timeout=30)
       if resp.status_code != 200:
           raise RuntimeError(f"Fish Audio TTS falhou ({resp.status_code}): {resp.text[:300]}")
       
       raw_mp3 = job_dir / f"raw_tts_{kind}.mp3"
       raw_mp3.write_bytes(resp.content)
       
       # 2. Conformar com FFmpeg via docker (run_tool) para 48kHz stereo ~5s
       filter_graph = (
           "[0:a]adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,"
           "afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]"
       )
       args = ['-y', '-i', str(raw_mp3), '-filter_complex', filter_graph,
               '-map', '[a]', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', str(conformed_wav)]
       p = run_tool('ffmpeg', args)
       if p.returncode != 0:
           conformed_wav.unlink(missing_ok=True)
           raise RuntimeError(f"Falha ao conformar áudio de continuidade: {p.stderr[-1500:]}")
       
       return conformed_wav
   ```
5. **Atualização do `resolve_item`**:
   Em vez de buscar caminhos de arquivos estáticos no disco, as entradas `'presenting'` e `'return'` são marcadas para serem geradas pelo `get_continuity_bumper`:
   ```python
   def resolve_item(item, program, slug, job_dir=None):
       kind = str(item.get('tipo') or 'video').strip().lower()
       if kind in {'video', 'abertura', 'encerramento', 'intervalo', 'bloco'}:
           src = safe_media_path(item.get('arquivo'))
           return {'tipo': 'video', 'papel': item.get('papel') or kind, 'arquivo': str(src),
                   'trim': item.get('duracao_max')}
       if kind == 'presenting':
           audio_file = get_continuity_bumper(program, slug, 'presenting', job_dir or CACHE)
           return {'tipo': 'bumper', 'papel': 'apresentando', 'arquivo': str(audio_file),
                   'label': 'ESTAMOS APRESENTANDO'}
       if kind in {'return', 'de-volta', 'voltamos'}:
           audio_file = get_continuity_bumper(program, slug, 'return', job_dir or CACHE)
           return {'tipo': 'bumper', 'papel': 'de-volta', 'arquivo': str(audio_file),
                   'label': 'DE VOLTA À PROGRAMAÇÃO'}
   ```
6. **Impacto no `render_audio_bumper`**:
   O `render_audio_bumper` recebe o áudio conformed de 5.0 segundos e gera automaticamente o vídeo bumper de 5.0 segundos com o visual escuro institucional da emissora, sincronizado e sem sobras.

---

## 7. Verificações de Ambiente e Ressalvas Críticas (Caveats)

1. **Wrapper `/usr/local/bin/ffprobe` no Host**:
   - Verificamos que `/usr/local/bin/ffprobe` contém um script bash que chama `docker run ... gsa-tv/control-plane:1.7.2`. Como a imagem `1.7.2` foi purgada da VPS (substituída por `1.7.9`), qualquer comando rodando `ffprobe` diretamente no shell do host falha com `pull access denied`.
   - O `builder.py` contorna isso perfeitamente usando a constante `IMAGE = 'gsa-tv/control-plane:1.7.9'` internamente em `run_tool()`. Recomenda-se atualizar o wrapper do host para apontar para `1.7.9`.
2. **Dependência do Container Control Plane em Execução**:
   - Para extrair `GSA_TV_SECRET_KEY`, o container `gsa-tv-control-plane` deve estar ativo. Ele está rodando continuamente desde o boot (`Up 10 hours`).
3. **Isolamento de Credenciais**:
   - A biblioteca `cryptography` descriptografa tudo em memória volátil (`RAM`). Nenhuma chave da API Fish Audio fica exposta em texto plano ou histórico de linha de comando.
4. **Alvo de QC do GSA Agro**:
   - Os testes anteriores em `/home/opc/gsa-program-builder/output/gsa-agro-builder-teste.mp4` e `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-builder-teste-publicado.mp4` continham o bumper MP3 legado. Após a alteração do `builder.py`, esses artefatos devem ser substituídos pelo novo master gerado com locução Fish oficial e vinhetas do Flow aprovadas.
