import { runSshScript } from './ssh2-run.mjs';
const entry=`

## 2026-09-06 — Atualização imediata da chamada oficial da grade

- O arquivo \`/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\` foi relido antes da continuidade e as decisões canônicas mais recentes foram adotadas.
- Projeto preservado: \`GSA TV — Chamada Oficial da Grade de Programação\`, no Google Vids.
- A montagem-base continua com 6 cenas e aproximadamente 2min08s de vídeos em movimento licenciados do banco integrado do Vids/Getty Images.
- Foram aplicadas e verificadas transições do tipo \`Dissolver\`, com duração de 1,5 segundo, entre todas as cinco divisões das seis cenas.
- O roteiro de locução foi reorganizado em seis blocos sincronizados com os núcleos visuais: abertura; três edições GSA News; informação/economia/tecnologia; campo/mundo/saúde/gastronomia; fé; entretenimento/família/encerramento.
- A locução utilizará exclusivamente o locutor oficial aprovado da GSA TV, Fish Audio “Impacto Comercial”, voice_id \`5c8a9b5d0b2549c7ada853529199ebe5\`, modelo \`s2.1-pro-free\`.
- A geração dos seis arquivos de locução e sua inserção no Vids ainda estão em andamento e não devem ser tratadas como concluídas até verificação técnica e visual.
- Permanecem obrigatórias: todos os programas oficiais, vídeos em movimento, grafismos/logos animados, apresentadores e identidades aprovadas, trilha licenciada, sincronização, reprodução integral e QC antes da conclusão.
- Nenhum encoder, RTMP, grade em produção, playlist ou sinal ao vivo foi alterado nesta etapa.
`;
const payload=Buffer.from(entry,'utf8').toString('base64');
const r=await runSshScript(`printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 16 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,120000);
process.stdout.write(r.stdout);
