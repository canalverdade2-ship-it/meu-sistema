# GSA TV — Runbook de Configuração do Google Drive (Fase 8)

> **DOCUMENTO HIST?RICO / SUPERADO.** Google Drive/rclone n?o fazem parte da arquitetura operacional atual. A VPS ? o armazenamento definitivo. Consulte `docs/arquitetura-atual-gsa-tv.md` e `infrastructure/gsa-tv/README.md`.


**Objetivo:** Configurar o Google Drive como repositório definitivo da biblioteca de mídia com credenciais de mínimo privilégio, isolamento criptográfico na VPS e downloads resilientes no cache local.

---

## 1. Estrutura da Pasta Raiz no Google Drive

Crie a pasta raiz **`GSA TV`** na conta Google oficial da GSA com a seguinte árvore de subpastas:

```
GSA TV/
├── 00_INBOX/                     # Uploads brutos de produtores / editores
├── 01_PROCESSADOS/               # Mídias aprovadas pelo Media Worker
├── 02_GRADE/                     # Mídias ativas programadas na grade
│   ├── CONTEUDO/
│   ├── COMERCIAIS/
│   ├── VINHETAS/
│   └── SLATES/
├── 03_ARQUIVADOS/                # Mídias antigas fora da grade
├── 04_PRODUCAO_IA/               # Mídias e áudios gerados por pipelines IA
└── 05_CONTINGENCIA/              # Cópias de segurança e vídeos de emergência
```

---

## 2. Configuração no Google Cloud Console

1. Acesse o **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Crie um novo projeto: **`GSA-TV-Production`**.
3. Em **APIs & Services > Library**, pesquise por **`Google Drive API`** e clique em **Enable**.
4. Em **OAuth consent screen**:
   - Tipo de Usuário: **Internal** (se Workspace) ou **External** (com conta do canal adicionada em Test Users).
   - Nome do App: `GSA TV Playout Engine`.
   - Email de suporte: admin do canal GSA.
5. Em **Credentials > Create Credentials > OAuth client ID**:
   - Tipo de Aplicativo: **Desktop app**.
   - Nome: `GSA TV rclone sync`.
   - Baixe o arquivo JSON ou anote:
     - `Client ID`: `xxxxxxxxxx.apps.googleusercontent.com`
     - `Client Secret`: `GOCSPX-xxxxxxxxxxxxxx`

---

## 3. Configuração Segura na VPS

### A. Separação de Credenciais por Mínimo Privilégio
- **VPS / rclone (`gdrive-gsa-tv`):** Acesso **Read-Only** (`drive.readonly`) restrito à pasta raiz da GSA TV.
- **n8n (`gdrive-gsa-tv-inbox`):** Acesso restrito para organizar e mover arquivos de `00_INBOX` para `01_PROCESSADOS`.

### B. Instalação e Permissões dos Segredos
```bash
# Na VPS Oracle:
sudo install -d -o gsa-tv -g gsa-tv -m 0700 /opt/gsa-tv/secrets
sudo install -d -o gsa-tv -g gsa-tv -m 0700 /opt/gsa-tv/config/rclone

# Criar o arquivo de configuração real (modo 600)
sudo touch /opt/gsa-tv/config/rclone/rclone.conf
sudo chown gsa-tv:gsa-tv /opt/gsa-tv/config/rclone/rclone.conf
sudo chmod 600 /opt/gsa-tv/config/rclone/rclone.conf
```

### C. Geração do Token OAuth (na máquina local ou via rclone auth)
```bash
# Na máquina com navegador:
rclone authorize "drive" "SEU_CLIENT_ID" "SEU_CLIENT_SECRET" --drive-scope="drive.readonly"
# Copie o JSON do token gerado {"access_token":"...","token_type":"Bearer","refresh_token":"...","expiry":"..."}
```

---

## 4. Parâmetros de Performance e Resiliência do rclone

O rclone opera com as seguintes proteções ativas:
- `--checksum`: Validação estrita de hash SHA-256 após download.
- `--retries 10`: Até 10 tentativas em caso de instabilidade de rede.
- `--retries-sleep 30s`: Backoff de 30 segundos entre falhas.
- `--low-level-retries 20`: Retentativas automáticas no nível de bloco HTTP.
- `--drive-chunk-size 64M`: Otimização de vazão para arquivos grandes de vídeo.
- `--tpslimit 10`: Limitação de transações para evitar limite 403/429 (User Rate Limit Exceeded).

---

## 5. Regra de Ouro da GSA TV

> [!CAUTION]
> **Nenhum arquivo é transmitido diretamente do Google Drive.**
> O Playout Engine (`ffplayout`) consome **única e exclusivamente** arquivos presentes no cache local (`/opt/gsa-tv/cache/media/`), previamente validados pelo FFprobe e com hash SHA-256 conferido no banco de dados.
