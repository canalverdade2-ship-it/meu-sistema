import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — Regra oficial de continuidade visual dos apresentadores do GSA News

- Determinação expressa do responsável: o GSA News manterá os avatares dos apresentadores criados pelo próprio Google Vids.
- Os dois avatares, combinados às vozes nativas Holt e Nyla, formam a identidade permanente da bancada do telejornal.
- Rosto, voz, função editorial, figurino-base e linguagem visual devem permanecer consistentes entre edições.
- Pautas, B-roll, imagens de reportagem, mapas e cenários editoriais continuam obrigatoriamente novos; os avatares fixos são exceção legítima por serem ativos permanentes de identidade.
- O projeto GSA News 04/09/2026 foi ampliado de uma para seis cenas no Google Vids para receber abertura, quatro blocos e encerramento.
- Nenhuma publicação ou troca de mídia no ar ocorreu nesta etapa.
`;
const n64=Buffer.from(note).toString('base64');const r=await runSshScript(String.raw`printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 14 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
