import { runSshScript } from './ssh2-run.mjs';
const entry=String.raw`

## 2026-09-06 22:16Z — QC pesado da passagem de elenco e rejeição como master por regra “100% vídeo”
- Foi criada uma passagem editorial intermediária da chamada V2 com as 22 identidades visuais aprovadas, seus nomes artísticos e logos oficiais, preservando também a dupla fixa do GSA News já presente nos takes do Vids.
- A vinculação canônica foi revisada: **GSA Hora da Palavra mantém Elisa Monteiro como identidade visual aprovada; somente a voz é compartilhada com Salomão Oliveira**, conforme decisão posterior do responsável.
- Candidato intermediário: /home/opc/gsa-ai/work/chamada-grade-v2/output/GSA-TV-Chamada-Grade-V2-PRESENTER-CANDIDATE.mp4.
- Especificação: H.264 + AAC, 1920x1080, 30 fps, 85,000 s, AAC 48 kHz estéreo, 76.558.199 bytes; SHA-256 7a20dfef845a7cbd055de521220951406e6bd3644917cb17e6ce87e3dd84808a.
- QC técnico passou: decode integral, nenhum silêncio >=2 s, nenhum black frame >=0,30 s, nenhum freeze >=1,5 s e 0 clicks/pops digitais isolados sincronizados.
- Áudio: -16,8 LUFS integrado, LRA 8,4 LU e true peak -4,8 dBFS.
- A revisão humana confirmou identidade visual consistente, 25 logos preservados no mosaico final, GSA Entrevista ausente e associação correta entre os demais rostos, nomes e programas.
- Apesar do QC técnico, este arquivo **NÃO foi promovido a master final**, porque as identidades entram como fotografias compostas sobre vídeo. Isso viola a regra expressa do responsável de que a chamada deve ser **100% em vídeo**.
- Próxima etapa obrigatória: substituir os painéis fotográficos por cenas em movimento produzidas no Google Vids com os apresentadores oficiais, mantendo logos/textos como motion design e repetindo o QC completo.
- O arquivo fica apenas como checkpoint técnico/editorial e não pode ser colocado no ar.
- Nenhuma alteração foi feita no encoder, RTMP, playout, grade, playlist, mosca, selo AO VIVO ou sinal.
`;
const safe=Buffer.from(entry.replaceAll('\u001f','`')).toString('base64');
const r=await runSshScript(`printf '%s' '${safe}' | base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 26 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`);
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
