import { runSshScript } from './ssh2-run.mjs';
const entry=`

## 2026-09-06 22:25Z — Substituição dos painéis estáticos por cenas reais do Google Vids iniciada
- O QC técnico do checkpoint com apresentadores passou, mas o arquivo não foi aceito como final porque ainda continha fotografias compostas; permanece válida a exigência de chamada 100% em vídeo.
- Foi validado no Google Vids o fluxo Animar uma imagem usando os painéis oficiais apenas como referência de identidade, gerando clipes de 10 segundos com movimento de câmera, luz, parallax e expressões discretas.
- O primeiro clipe animado, núcleo Presente e Futuro, foi concluído e inserido no projeto Vids da V2.
- O segundo clipe animado, núcleo Vida e Mundo, foi concluído e inserido no mesmo projeto.
- O terceiro clipe animado, núcleo Fé e Inspiração, foi concluído e inserido no mesmo projeto, preservando Elisa Monteiro como apresentadora visual de Hora da Palavra e Salomão Oliveira em Histórias da Bíblia.
- Projeto: https://docs.google.com/videos/d/1NoUuv9KmksylGMfxKdbcXCvXHYZ9k89XvcwAhwKErjo/edit.
- Permanecem para esta passagem: entretenimento A, entretenimento B, jornalismo/Tempo, exportação, extração dos clipes, recomposição do master 85 s, variantes 60/30/15 e novo QC completo.
- A retomada automática de 10 minutos foi atualizada para rejeitar explicitamente qualquer master com painéis fotográficos e continuar até os masters 100% em vídeo ficarem prontos para aprovação.
- Nada foi colocado no ar; encoder, RTMP, playout, grade, playlist, mosca e selo AO VIVO permanecem intocados.
`.replaceAll('\u001f','`');
const b=Buffer.from(entry).toString('base64');const r=await runSshScript(`printf '%s' '${b}'|base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 18 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`);process.stdout.write(r.stdout);
