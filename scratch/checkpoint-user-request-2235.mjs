import { runSshScript } from './ssh2-run.mjs';
const entry=`

## 2026-09-06 22:35Z — Atualização solicitada pelo responsável / produção 100% vídeo em andamento
- O responsável solicitou o registro imediato das atualizações até este instante.
- O candidato intermediário com fotografias animadas por composição permanece reprovado como master final, embora tenha passado no QC técnico; ele existe apenas como checkpoint e não pode ir ao ar.
- Google Vids: clipes animados de 10 segundos dos núcleos Presente e Futuro, Vida e Mundo e Fé e Inspiração foram concluídos e inseridos no projeto oficial da V2.
- A correção de identidade permanece consolidada: Elisa Monteiro é a apresentadora visual aprovada do GSA Hora da Palavra; apenas a voz é compartilhada com Salomão Oliveira. O GSA Histórias da Bíblia mantém Salomão Oliveira como apresentador visual.
- O núcleo Entretenimento A, com GSA Music, GSA Tá na Rede, GSA Esportes e GSA Cinema, foi enviado ao recurso Animar uma imagem do Google Vids às 22:35Z e encontra-se em processamento.
- Próximos itens da mesma passagem: concluir e inserir Entretenimento A; gerar Entretenimento B; gerar Jornalismo/Tempo; exportar o projeto; extrair os takes animados; recompor o master de 85 s; gerar versões de 60/30/15 s; repetir QC técnico e revisão visual contínua.
- O monitor automático concluir-chamada-gsa-tv-v2 permanece ativo a cada 10 minutos e foi atualizado para exigir masters 100% em vídeo antes de encerrar.
- Nada foi publicado ou colocado no ar. Encoder, RTMP, playout, grade, playlist, mosca e selo AO VIVO permanecem intocados.
`.replaceAll('\u001f','`');
const b=Buffer.from(entry).toString('base64');const r=await runSshScript(`printf '%s' '${b}'|base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 17 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`);process.stdout.write(r.stdout);
