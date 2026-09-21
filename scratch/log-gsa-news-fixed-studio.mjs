import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — Regra oficial de cenário permanente do GSA News

- Determinação do responsável: o GSA News deve manter um cenário-base único e reconhecível entre edições.
- Elementos fixos: mesma bancada, composição do estúdio, paleta azul-marinho e dourada, mapa/painéis ao fundo, posições dos apresentadores e padrão de iluminação.
- Podem variar somente o conteúdo das telas de apoio, mapas, gráficos e elementos editoriais vinculados ao assunto de cada bloco.
- A identidade permanente do telejornal passa a ser composta por três pilares: avatares fixos, vozes nativas Holt/Nyla e cenário-base oficial.
- A mídia jornalística e os B-rolls continuam novos e exclusivos em cada edição.
- Nenhuma alteração foi realizada no sinal ao vivo neste registro.
`;
const n64=Buffer.from(note).toString('base64');const r=await runSshScript(String.raw`printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 12 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
