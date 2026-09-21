# Project: Finalização do Pacote de Identidade Visual da GSA TV

## Architecture
- **Browser Automation & Flow Playout Track**: Container Docker `gsa-ai-browser` (CDP 127.0.0.1:9228) conecta ao Google Flow/Vids (`ac1da714-fe03-4812-b62d-fb92d575e554`). Exportação de vídeo das 7 regenerações, download para `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/`, QC com ffprobe e contact sheets (1s, 5s, 9s) em `qc-regen/`.
- **Audio Continuity & TTS Track**: Integração segura do Program Builder (`/home/opc/gsa-program-builder/builder.py`) com Fish Audio API (`https://api.fish.audio/v1/tts`, modelo `s2.1-pro-free`, voz `5c8a9b5d0b2549c7ada853529199ebe5`). Descriptografia segura AES-256-GCM via vault `/home/opc/gsa-ai/secrets/fish-production.enc.json` em memória. Conformação do áudio via FFmpeg para 48kHz estéreo, exatamente 5.000s com fade-in/out e loudness EBU R128.
- **Program Master Builder Track**: Descarte do teste antigo de 720p (`/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-builder-teste-publicado.mp4`). Montagem do master do GSA Agro completo (1080p, 30fps, AAC 48kHz estéreo) com abertura Flow aprovada, locução Fish e encerramento Flow.
- **Final Packaging & Audit Track**: Consolidação em `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/` (mínimo 40 MP4s, até 50 MP4s), `manifest.json` padronizado (`program`, `piece_type`, `source`, `sha256`, `approved_at`), e registro histórico em `GSA_TV_MEMORY_CHANGELOG.md` com backup obrigatório.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Download & Sessão Flow | Reautenticar sessão Google no container `gsa-ai-browser` e baixar os 7 MP4s das regenerações | M1 | ORIGINAL_REQUEST §R1 |
| 2 | QC Técnico & Visual das Regenerações | Executar ffprobe (1080p/720p, 30fps/24fps, AAC 48kHz) e gerar contact sheets (1s, 5s, 9s) em `qc-regen/` | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Aprovação e Reprovação Editorial | Atualizar `regen-defective-state.json` aprovando peças limpas e rejeitando peças com artefatos/logos falsos | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Decriptação Segura Fish Audio | Implementar descriptografia AES-256-GCM em Python 3.9 para ler vault sem expor chaves | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Síntese de Voz Institucional Fish | Chamar API Fish TTS com modelo `s2.1-pro-free` e voz `5c8a9b5d0b2549c7ada853529199ebe5` para chamadas de continuidade | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Conformação FFmpeg de Áudio | Conformar áudio gerado para 48kHz estéreo, duração ~5s com fade in/out | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Refatoração do `builder.py` | Modificar Program Builder para substituir seleção de MP3s antigos por geração dinâmica Fish | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Descarte do Teste Antigo Agro | Descartar `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-builder-teste-publicado.mp4` | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Geração de Novo Master GSA Agro | Gerar novo master completo do GSA Agro com abertura Flow aprovada, locução Fish e encerramento Flow | M3 | ORIGINAL_REQUEST §R3 |
| 10 | QC Técnico e Visual GSA Agro | Validar master via ffprobe (1080p, 30fps, AAC 48kHz estéreo) e contact sheet visual | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Consolidação `masters-final/` | Criar diretório `masters-final/` e copiar peças aprovadas (mínimo 40 MP4s, sem blur nem duplo logo) | M4 | ORIGINAL_REQUEST §R4 |
| 12 | Geração do `manifest.json` | Criar manifesto JSON com `program`, `piece_type`, `source`, `sha256`, `approved_at` | M4 | ORIGINAL_REQUEST §R4 |
| 13 | Registro em Changelog | Criar backup `.bak` e registrar entrada detalhada em `GSA_TV_MEMORY_CHANGELOG.md` | M4 | ORIGINAL_REQUEST §R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Download e QC das 7 Regenerações Flow | Download das 7 peças do Flow, QC técnico ffprobe, contact sheets em `qc-regen/`, atualização do state | none | DONE |
| 2 | M2: Integração Fish Audio no Program Builder | Descriptografia segura, síntese TTS institucional, filtro FFmpeg 48kHz 5s, refatoração de `builder.py` | none | DONE |
| 3 | M3: Revalidação e Master do GSA Agro | Descarte do teste antigo, montagem do master com abertura Flow + Fish + encerramento, QC técnico e visual | M1, M2 | DONE |
| 4 | M4: Pacote Final `masters-final/` e Changelog | Montagem do pacote final (>=40 MP4s), `manifest.json` com SHA-256 e registro canônico no changelog | M1, M3 | DONE |

## Interface Contracts
### Flow CDP ↔ Replacements & QC
- Entrada: Container `gsa-ai-browser` porta 9228, projeto `ac1da714-fe03-4812-b62d-fb92d575e554`.
- Saída de Mídia: Arquivos MP4 salvos em `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/`.
- Saída de QC: Contact sheets em `/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen/<slug>-<kind>-qc.jpg` (tempos 1s, 5s, 9s).
- Estado: JSON em `/home/opc/gsa-ai/work/identity-flow-20260907/regen-defective-state.json`.

### Program Builder ↔ Fish Audio TTS
- Endpoint: `https://api.fish.audio/v1/tts`
- Headers: `Authorization: Bearer <FISH_API_KEY>`, `Content-Type: application/json`, `model: s2.1-pro-free`
- Voz Institucional: `5c8a9b5d0b2549c7ada853529199ebe5`
- Formato Conforme: 48.000 Hz, 2 canais (estéreo), duração 5.000s, com fade in 0.25s e fade out 0.5s.
- Interface Python no `builder.py`: `get_continuity_bumper(slug: str, kind: str) -> Path`

### Playout Standard ↔ `masters-final/`
- Container: MP4 (com `-movflags +faststart`)
- Vídeo: H.264 (yuv420p), 1920x1080, 30 fps
- Áudio: AAC, 48 kHz, 2 canais (estéreo)
- Duração: 8.0s a 12.0s
- Regra de Arte: Sem blur global/local, sem desaceleração artificial, sem sobreposição de segundo logo.

### Manifest Schema (`masters-final/manifest.json`)
```json
[
  {
    "program": "GSA Agro",
    "piece_type": "opening",
    "source": "regenerated",
    "sha256": "...",
    "approved_at": "2026-09-08T..."
  }
]
```

## Code Layout
- VPS Work Directory: `/home/opc/gsa-ai/`
- Flow Work Directory: `/home/opc/gsa-ai/work/identity-flow-20260907/`
- QC Regenerations: `/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen/`
- Replacements: `/home/opc/gsa-ai/work/identity-flow-20260907/replacements/`
- Masters Final: `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/`
- Program Builder: `/home/opc/gsa-program-builder/builder.py`, `/home/opc/gsa-program-builder/server.py`
- Secret Vault: `/home/opc/gsa-ai/secrets/fish-production.enc.json`
- Changelog: `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`
