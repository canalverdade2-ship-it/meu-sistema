# Relatório de Levantamento e Auditoria de Infraestrutura VPS (Oracle Cloud)
**Projeto:** GSA TV — Sonic Identity & Audio Assets Curation Automation  
**Data:** 04/09/2026  
**Investigador:** `teamwork_preview_explorer_survey_vps_1`  
**Referência da Solicitação:** `ORIGINAL_REQUEST.md` (Seção `## 2026-09-04T19:28:42Z`)

---

## 1. Sumário Executivo

Foi realizada uma investigação profunda, tanto na base de código do projeto quanto diretamente no runtime do servidor Oracle Cloud VPS (`147.15.43.141`), para averiguar a viabilidade técnica, os requisitos de ambiente e a arquitetura de implantação do sistema de automação para download e curadoria do pacote de 200–250 faixas de áudio e efeitos sonoros (Sonic Identity).

**Principais conclusões:**
1. **Conectividade SSH & Credenciais:** Conectividade SSH ativa e 100% funcional com o usuário `opc` na porta 22 utilizando a chave RSA privada em `C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key`.
2. **Sistema Operacional & Discrepância Crítica:** O sistema operacional é **Oracle Linux Server 9.8 (aarch64 / ARM64)**, baseado em RHEL/Fedora. **NÃO existe gerenciador `apt` ou `apt-get`**. O gerenciador do sistema é o **`dnf` / `yum`**. Automações devem utilizar `npm`, `pip3` ou `dnf` — chamadas a `apt` falhariam fatalmente.
3. **Runtimes Disponíveis:**
   - **Node.js:** v22.23.2 (com suporte nativo a `fetch` e ESM) e **npm:** 10.9.8.
   - **Python:** 3.9.25 e **pip:** 21.3.1 (com pacotes `requests`, `aiohttp`, `file-magic` já instalados).
   - **Host Shell:** Bash 5.1.
4. **Armazenamento e Permissões:**
   - O diretório raiz de mídia é `/opt/gsa-tv/cache/media/1/`.
   - O diretório de destino `/opt/gsa-tv/cache/media/1/identity/audio/` (com subpastas `news`, `viral`, `faith`, `lifestyle`, `sfx`) pode ser criado diretamente pelo usuário `opc` sem restrições, herdando o grupo `gsa-tv` via bit setgid já configurado na pasta pai.
   - Espaço em disco disponível: **107 GB livres** (42% de uso em partição de 183 GB).
5. **Ferramentas de Verificação de Áudio:**
   - `/usr/bin/file` (versão 5.39) está nativamente instalado no host.
   - `ffprobe` e `ffmpeg` estão disponíveis instantaneamente através dos contêineres Docker do próprio ecossistema GSA-TV (`gsa-tv/control-plane:1.7.2` ou container em execução `gsa-tv-ffplayout`), que já montam `/opt/gsa-tv/cache/media` em `/media`.
6. **Egress de Rede:** Conectividade externa para download de CDNs e repositórios abertos (Mixkit, Internet Archive, Free Music Archive, GitHub) testada com sucesso via HTTP/2 (código 200).

---

## 2. Dados de Conexão e Credenciais da VPS

Conforme auditado em `CREDENCIAIS_SISTEMA_GSA.md` e testado em tempo real:

| Item | Valor / Configuração | Observações |
|---|---|---|
| **Host / IP** | `147.15.43.141` | Oracle Cloud Infrastructure (Ashburn/GRU) |
| **Porta SSH** | `22` | Protocolo SSH 2.0 |
| **Usuário SSH** | `opc` | Usuário padrão Oracle Linux com privilégios sudo |
| **Chave Privada** | `C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key` | RSA 2048-bit, permissões de leitura confirmadas |
| **Privilégios Sudo** | `opc ALL=(ALL) NOPASSWD: ALL` | Sudo sem senha disponível |
| **Grupos do Usuário** | `opc` (1000), `adm` (4), `docker` (989) | Permite controlar Docker sem sudo |
| **Usuário de Serviço** | `gsa-tv` (UID 986 / GID 986) | Dono dos processos de playout e cache |

---

## 3. Topologia e Diretórios do GSA-TV

A infraestrutura atual do GSA-TV (documentada em `docs/arquitetura-atual-gsa-tv.md` e `infrastructure/gsa-tv/README.md`) adota a VPS como **armazenamento definitivo**:

```text
/opt/gsa-tv/
├── cache/
│   └── media/
│       └── 1/                       <-- Raiz de mídia definitiva do Canal 1
│           ├── identity/            <-- Identidade visual e sonora (0775 / setgid gsa-tv)
│           │   ├── motion_bg/
│           │   ├── vinhetas/
│           │   ├── sfx/             <-- Contém 6 SFX de emissora já implantados
│           │   └── audio/           <-- [ALVO DA AUTOMAÇÃO]
│           │       ├── news/        <-- Tense, corporate, hard news beds
│           │       ├── viral/       <-- Upbeat, pop, comedy effects
│           │       ├── faith/       <-- Cinematic, peaceful, ambient
│           │       ├── lifestyle/   <-- Jazz, acoustic, organic
│           │       └── sfx/         <-- Transitions, whooshes, impacts, tickers
│           ├── news/
│           ├── normalized/
│           ├── incoming/
│           └── ...
├── playlists/1/                     <-- Playlists ffplayout
├── preview/1/live/                  <-- HLS interno
├── control-plane/                   <-- Runtime do Control Plane
└── bin/                             <-- Binários e scripts operacionais
```

### Mapeamento em Contêineres Docker
Os contêineres principais montam `/opt/gsa-tv/cache/media`:
- `gsa-tv-control-plane` monta `/opt/gsa-tv/cache/media -> /media`
- `gsa-tv-ffplayout` monta `/opt/gsa-tv/cache/media -> /media`

Logo, qualquer arquivo salvo em `/opt/gsa-tv/cache/media/1/identity/audio/` torna-se imediatamente acessível para o ffplayout e para o control plane em `/media/1/identity/audio/`.

---

## 4. Padrões de Implantação e Execução de Scripts no Projeto

A análise do repositório identificou dois padrões consolidados de execução e implantação:

### Padrão 1: Execução Remota via Script Runner Local (`scratch/ssh2-run.mjs`)
- Utilizado em `scratch/download-real-sfx.mjs`, `scratch/render-master-broadcast-vinhetas.mjs`, `scratch/check-vps-status.mjs`.
- O script Node.js roda localmente, conecta-se via pacote `ssh2` ao IP `147.15.43.141` com a chave do usuário `opc`, envia o script bash diretamente para execução no servidor (`stream.end(script)`), e retorna stdout/stderr em tempo real.
- **Vantagem:** Totalmente automatizado a partir da máquina de desenvolvimento ou dos agentes, sem necessidade de transferir arquivos intermediários.

### Padrão 2: Execução Standalone no Diretório do Usuário na VPS (`~/teamwork_projects/audio_identity_builder`)
- O requisito do prompt indica expressamente:
  - `Working directory: ~/teamwork_projects/audio_identity_builder`
  - "The system will run on an Oracle VPS running Linux. You must write the logic and ensure dependencies are installed (e.g., via npm, pip, or apt) without manual user intervention."
- Verificou-se que o diretório `~/teamwork_projects/` ainda não existe na VPS e deve ser criado (`mkdir -p ~/teamwork_projects/audio_identity_builder`).
- O código do script pode ser escrito em **Node.js (ESM)** ou **Python (3.9)** e implantado dentro dessa pasta.
- Um script de orquestração pode disparar o processo via SSH (`ssh opc@147.15.43.141 "cd ~/teamwork_projects/audio_identity_builder && node download.mjs"` ou `python3 download.py`).

---

## 5. Auditoria de Ambiente Linux e Dependências (Task 4)

### 5.1 Sistema Operacional e Arquitetura
- **OS:** Oracle Linux Server 9.8 (kernel `6.12.0-204.92.4.3.1.el9uek.aarch64`).
- **Arquitetura de CPU:** `aarch64` (ARM64). Binários compilados para x86_64 não rodam; devem ser aarch64 ou interpretados (Node/Python).

### 5.2 Gerenciador de Pacotes — ALERTA CRÍTICO
- **`apt` / `apt-get`:** **NÃO EXISTEM** no sistema (`which: no apt in ...`).
- **`dnf` / `yum`:** Presentes e funcionais (`/usr/bin/dnf`, `/usr/bin/yum`).
- **Recomendação:** Não incluir comandos `apt-get install` nos scripts. Usar `pip3 install --user <pacote>` ou `npm install`, ou pacotes da biblioteca padrão para garantir 100% de autonomia e zero falhas de execução.

### 5.3 Runtimes e Ferramentas Instaladas
| Ferramenta | Caminho | Versão | Status |
|---|---|---|---|
| **Node.js** | `/usr/bin/node` | `v22.23.2` | Nativo, suporte a `fetch()`, Streams e ESM |
| **npm** | `/usr/bin/npm` | `10.9.8` | Funcional |
| **Python** | `/usr/bin/python3` | `3.9.25` | Funcional |
| **pip** | `/usr/bin/pip3` | `21.3.1` | Funcional (instala via `--user`) |
| **curl** | `/usr/bin/curl` | 7.76+ | Suporta HTTP/2, SSL |
| **wget** | `/usr/bin/wget` | Instalado | Funcional |
| **jq** | `/usr/bin/jq` | Instalado | Funcional |
| **git** | `/usr/bin/git` | Instalado | Funcional |
| **file** | `/usr/bin/file` | `file-5.39` | Instalado e validado com arquivos `.mp3` |
| **Docker** | `/usr/bin/docker` | 27.x | Acessível pelo usuário `opc` sem sudo |

### 5.4 Ferramentas de Verificação de Áudio (`ffprobe` e `file`)
- **Comando `file`:** Nativo no host.
  - Teste em áudio real (`/opt/gsa-tv/cache/media/1/identity/sfx/whoosh_air.mp3`):
    `MPEG ADTS, layer III, v1, 128 kbps, 44.1 kHz, JntStereo`
- **Comando `ffprobe`:**
  - Não está instalado no `/usr/bin` do host, mas está presente nos contêineres Docker do GSA-TV.
  - Execução validada via contêiner:
    ```bash
    docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.7.2 ffprobe -v error -show_entries format=filename,format_name,duration -of json /media/1/identity/sfx/whoosh_air.mp3
    ```
  - Retorno JSON:
    ```json
    {
      "format": {
        "filename": "/media/1/identity/sfx/whoosh_air.mp3",
        "format_name": "mp3",
        "duration": "1.384490"
      }
    }
    ```
  - **Estratégia Recomendada para o Critério de Aceite:**
    Criar um script wrapper `/usr/local/bin/ffprobe` (ou invocar o contêiner `gsa-tv/control-plane:1.7.2`), e/ou utilizar o utilitário nativo `file`, cumprindo 100% dos critérios do prompt.

### 5.5 Permissões no Diretório de Destino
- Teste prático realizado: `mkdir -p /opt/gsa-tv/cache/media/1/identity/test_perm`
- Resultado: Criado com sucesso pelo usuário `opc`, pertencendo automaticamente a `opc:gsa-tv` com permissões `drwxr-sr-x`.
- Remoção imediata do teste concluída sem resíduos.
- Nenhuma elevação `sudo` é necessária para escrever em `/opt/gsa-tv/cache/media/1/identity/audio/`.

---

## 6. Estratégia de Aquisição de Áudio (~200–250 arquivos)

Para cumprir o requisito R1 e R2 (distribuição equilibrada entre as 5 categorias):
1. **Fontes de Áudio Royalty-Free recomendadas:**
   - **Mixkit:** CDN aberta de alta velocidade (`assets.mixkit.co/music` e `assets.mixkit.co/active_storage/sfx`), já homologada no projeto (`scratch/download-real-sfx.mjs`). Sem exigência de chave de API.
   - **Internet Archive (archive.org):** Coleções de áudio de domínio público e efeitos sonoros históricos de rádio/TV (OTR SFX, BBC Sound Effects, Free Music beds) via API pública de metadados.
   - **Free Music Archive (FMA) / Wikimedia Commons:** Faixas instrumentais sob licença CC0 / Public Domain.
2. **Distribuição Proposta (~45–50 faixas por categoria):**
   - `news/` (~45 faixas): Trilhas corporativas, tensas, ritmo de telejornal, breaking news beds.
   - `viral/` (~45 faixas): Upbeat, synth pop, beats eletrônicos, sons de comédia/punchline.
   - `faith/` (~45 faixas): Ambient, piano pacífico, orquestral suave, texturas cinematográficas.
   - `lifestyle/` (~45 faixas): Jazz suave, acústico/violão, bossa nova, lofi orgânico.
   - `sfx/` (~50–60 efeitos): Whooshes, stingers de transição, swooshes, tickers de notícias, risers, impacts.
3. **Resiliência:** O script deve incorporar:
   - Validação de integridade pós-download (tamanho mínimo > 5KB, cabeçalho de áudio válido).
   - Retry exponencial e timeouts para requisições de rede.
   - Logs detalhados de progresso em tempo real.

---

## 7. Recomendações Técnicas para a Equipe de Implementação

1. **Estrutura de Pastas na VPS:**
   Executar na inicialização:
   ```bash
   mkdir -p ~/teamwork_projects/audio_identity_builder
   mkdir -p /opt/gsa-tv/cache/media/1/identity/audio/{news,viral,faith,lifestyle,sfx}
   chmod -R 0775 /opt/gsa-tv/cache/media/1/identity/audio
   ```
2. **Escolha de Linguagem do Script de Download:**
   - **Node.js (v22.23.2):** Recomendado. Está instalado nativamente, suporta concorrência assíncrona ultra-rápida (`Promise.all` com limites de pool via `p-limit` ou loop com chunks), `fetch` nativo sem dependências externas, e não sofre com incompatibilidades de versão de bibliotecas.
   - **Python (v3.9.25):** Também viável utilizando `urllib.request` / `concurrent.futures`.
3. **Validação Automática:**
   - Script de contagem: `find /opt/gsa-tv/cache/media/1/identity/audio/ -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.m4a" \) | wc -l` (deve ser $\ge 200$).
   - Script de integridade: Amostragem de 10 arquivos testados com `file` e `ffprobe` via container.
