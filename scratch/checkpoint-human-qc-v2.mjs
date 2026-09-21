import { runSshScript } from './ssh2-run.mjs';
const entry=`

## 2026-09-06 — Revisão humana do FINAL-CANDIDATE da chamada V2

- A contact sheet canônica do candidato de 85 s foi baixada da VPS e revisada visualmente quadro a quadro.
- O candidato permanece tecnicamente aprovado no QC preliminar, mas **não foi promovido a FINAL** por pendências editoriais.
- Pontos positivos: identidade azul-marinho/dourado coerente, planos mais fortes que a peça revogada, divisão clara por núcleos, mosaico final completo, 25 logos oficiais únicos e ausência de GSA Entrevista.
- Pendências: apenas os dois âncoras do GSA News aparecem com destaque; demais apresentadores oficiais ainda não estão representados; vários logos continuam como pequenos cartões de canto; alguns programas dependem de imagens temáticas genéricas; falta revisão contínua do ritmo, transições e relação áudio/vídeo.
- Relatório humano: /home/opc/gsa-ai/work/chamada-grade-v2/qc/HUMAN_QC_FINAL_CANDIDATE.md.
- Próxima passagem obrigatória: inserir flashes de apresentadores/cenários aprovados, integrar logos ao motion design, reforçar reconhecimento específico por atração e repetir revisão contínua + QC.
- Nada foi promovido, publicado ou colocado no ar; encoder, RTMP, grade, playlist, mosca e selo AO VIVO permanecem intocados.
`;
const data=Buffer.from(entry).toString('base64');const r=await runSshScript(`printf '%s' '${data}'|base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 16 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,60000);process.stdout.write(r.stdout);
