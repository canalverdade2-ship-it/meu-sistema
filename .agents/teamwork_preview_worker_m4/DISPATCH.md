## 2026-09-08T03:50:44Z

# Task Assignment for Worker M4 — Final Masters Package & Changelog

## Mission
Montar o pacote final aprovado de vinhetas da GSA TV em `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/` (mínimo 40 MP4s, meta de 50 MP4s), gerar o manifesto estruturado `manifest.json` com SHA-256 e registrar o inventário final no `GSA_TV_MEMORY_CHANGELOG.md`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Quality Rules
- PROIBIDO aplicar blur global, desaceleração artificial, ou sobrepor um segundo logo sobre vídeo do Flow que já contenha logo.
- Peças originais sem defeito (41 peças de `masters-v1/`) devem ser mantidas intactas.
- Peças regeneradas aprovadas (9 peças: 2 anteriores + 7 recém-auditadas) substituem as 9 peças defeituosas.
- As peças regeneradas do Flow (720p 24fps) devem ser escalonadas para 1080p 30fps AAC 48kHz estéreo de forma limpa (`-vf "scale=1920:1080:flags=lanczos,fps=30" -c:a aac -b:a 384k -ar 48000 -ac 2 -movflags +faststart`) SEM qualquer aplicação de blur nem sobreposição de logo secundário.
- GSA Entrevista está TERMINANTEMENTE EXCLUÍDO do escopo — não introduzir!
- Toda ação realizada DEVE ser registrada no `GSA_TV_MEMORY_CHANGELOG.md` com backup obrigatório prévio `.bak`.

## Acceptance Criteria
1. Diretório `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/` criado com todos os MP4s aprovados (pelo menos 40 MP4s, preferencialmente todos os 50 MP4s dos 25 programas).
2. Convenção de nomenclatura padronizada: `gsa-<slug>-opening.mp4` e `gsa-<slug>-closing.mp4`.
3. Todos os arquivos em `masters-final/` devem passar por validação técnica via ffprobe (`gsa-tv/control-plane:1.8.7`): 1920x1080, 30fps, AAC 48kHz estéreo, container MP4.
4. Gerar `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json` contendo um array JSON onde cada item possui exatamente:
   - `program`: Nome oficial do programa (ex: "GSA Agro", "GSA Sabor", etc.)
   - `piece_type`: "opening" ou "closing"
   - `source`: "original" (para as 41 peças limpas) ou "regenerated" (para as 9 peças substituídas)
   - `sha256`: Hash SHA-256 hexadecimal em minúsculas
   - `approved_at`: Timestamp ISO 8601 UTC
5. Criar backup `.bak` de `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md` e registrar a conclusão com a tabela completa do inventário final e hashes.

## Output
Write your comprehensive completion report to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_worker_m4\handoff.md`
Send a message when finished.
