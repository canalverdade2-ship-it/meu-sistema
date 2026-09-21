# Task Assignment for Explorer 3 (GSA Agro, Masters Package, and Changelog)

## Mission
Investigate the state of GSA Agro assets, masters-v1 inventory, masters-final structure, manifest format, and changelog rules on the VPS.

## Authoritative User Request
Read: `c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md` under header `## 2026-09-08T02:46:22Z`.

## Investigation Targets on VPS (147.15.43.141, opc):
1. Inspect `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/`: list all 50 MP4 files, their naming convention, sizes, and probe properties.
2. Check the 2 already approved regenerations: GSA Esportes (encerramento) and GSA Hora da Palavra (abertura). Where are their files located on VPS?
3. Inspect `/home/opc/gsa-ai/work/gsa-agro-builder-teste-publicado.mp4` and identify why it must be discarded/refone with Fish Audio. Find the original and regenerated GSA Agro opening and closing pieces.
4. Check the requirements and target directory for `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/`. Does it already exist or have partial content?
5. Verify requirements for `manifest.json` (fields: `program`, `piece_type`, `source`, `sha256`, `approved_at`) and minimum count (at least 40 MP4s). Note that GSA Entrevista is explicitly EXCLUDED.
6. Inspect `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`. What is its current format, latest entries, and required update structure?

## Access
- Use `node scratch/ssh2-run.mjs` or execute remote bash commands via SSH to query the VPS.

## Output
Write your comprehensive report to:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\survey_explorer_17_3\report.md`
And write your `handoff.md`.
