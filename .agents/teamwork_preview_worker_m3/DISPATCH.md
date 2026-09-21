# Task Assignment for Worker M3 — GSA Agro Full Master Revalidation & QC

## 2026-09-08T03:41:00Z

### Mission
Revalidação completa do GSA Agro: descartar os testes anteriores com MP3 antigo, gerar o novo master completo do GSA Agro (abertura Flow regenerada e aprovada + locução Fish Audio de continuidade + encerramento Flow aprovado), executar QC técnico ffprobe e gerar contact sheets visuais.

### Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Quality Rules
- PROIBIDO aplicar blur global, desaceleração artificial, ou sobrepor um segundo logo sobre vídeo do Flow que já contenha logo.
- Substituição só ocorre com defeito COMPROVADO e peça substituta visualmente aprovada.
- Peças originais sem defeito mantidas intactas.
- GSA Entrevista está EXCLUÍDO do escopo.
- Toda ação realizada DEVE ser registrada no `GSA_TV_MEMORY_CHANGELOG.md`.

### Execution Steps
1. Descartar/remover o teste antigo com MP3 legado `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-builder-teste-publicado.mp4` (e `/home/opc/gsa-ai/work/gsa-agro-builder-teste-publicado.mp4`).
2. Obter a abertura Flow aprovada (`/home/opc/gsa-ai/work/identity-flow-20260907/replacements/agro-opening-repl.mp4`).
3. Gerar a locução institucional Fish Audio de continuidade via Program Builder (`builder.py`) com voz `5c8a9b5d0b2549c7ada853529199ebe5` e modelo `s2.1-pro-free` (48kHz estéreo ~5s com fade in/out).
4. Obter o encerramento Flow aprovado (`/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/gsa-agro-closing.mp4`).
5. Gerar o novo master completo do GSA Agro conformado em 1080p 30fps H.264, áudio AAC 48kHz estéreo, MP4 `+faststart`, sem blur e sem duplo logo, publicando em `/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-master.mp4` (e link/cópia em `/home/opc/gsa-ai/work/identity-flow-20260907/gsa-agro-builder-master.mp4`).
6. Executar QC técnico ffprobe via `docker run --rm --user 0:0 -v /home:/home -v /opt:/opt gsa-tv/control-plane:1.8.7 ffprobe ...` confirmando 1920x1080, 30fps, AAC 48kHz estéreo.
7. Gerar contact sheets visuais nos tempos chave (1s, 5s, 9s...) e salvar em `/home/opc/gsa-ai/work/identity-flow-20260907/qc-agro/` (ou `qc-regen/`).
8. Validar visualmente a ausência total de logos duplos, blur e textos sintéticos.
9. Criar backup `.bak` e registrar a ação no `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`.
