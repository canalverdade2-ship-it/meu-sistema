import { runSshScript } from './ssh2-run.mjs';

const note=`

## 2026-09-04 — Auditoria completa de nomes únicos dos programas

- Determinação expressa do responsável: cada programa deve possuir somente um nome oficial e uma única marca; complementos de edição, horário ou faixa não podem criar outro programa ou outro logo.
- A consulta completa ao banco ativo encontrou 37 registros publicados no canal principal, além de dois registros sem faixa de grade que são administrativos/legados: Continuidade GSA TV e GSA HUB — Uma estrutura para resolver.
- Foram identificados grupos que exigem consolidação de cadastro/identidade:
  - GSA Tá na Rede Web -> edição do GSA Tá na Rede.
  - GSA Em Fé Reflexão -> quadro/edição do GSA Em Fé.
  - GSA Destinos do Mundo -> edição temática do GSA Destinos.
  - GSA Documentário Especial -> edição do GSA Doc.
  - GSA Mistérios da Noite e GSA Mistérios Noturno -> edições/faixas do GSA Mistérios.
  - GSA News Especial -> edição do núcleo jornalístico, não identidade adicional.
  - GSA News Noturno duplica semanticamente GSA News Noite e deve ser tratado como faixa/edição, não novo logo.
- Continuação, Madrugada, Parte 1, Parte 2, Especial, Web e Reflexão devem ficar em segment_variant/metadata da grade quando representarem bloco, horário ou edição; nunca como nova identidade visual.
- GSA Manhã News, GSA Meio Dia News e GSA News Noite permanecem sob revisão de arquitetura de marca por já existirem historicamente como títulos próprios na arte fornecida; nenhuma consolidação destrutiva foi aplicada sem fechar essa distinção.
- A prancha de 32 logos foi rebaixada para REJEITADA/OBSOLETA e não pode ser promovida como oficial.
- A nova prancha só será produzida depois de consolidar a lista canônica sem nomes complementares.
- Nenhuma alteração foi feita no encoder, sinal ao vivo, grade ou banco nesta auditoria de leitura.
`;
const b64=Buffer.from(note,'utf8').toString('base64');
const sh=`printf '%s' '${b64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\npython3 - <<'PY'\nfrom pathlib import Path\np=Path('/home/opc/gsa-ai/assets/brand/gsa-program-logos-board-32-candidate-2026-09-04.png')\nif p.exists():\n    marker=p.with_suffix(p.suffix+'.REJECTED-NAME-DUPLICATES.txt')\n    marker.write_text('REJEITADA em 2026-09-04: contém identidades duplicadas baseadas em complementos de edição/faixa. Não oficializar.\\n',encoding='utf-8')\nPY\ntail -n 22 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const result=await runSshScript(sh,60000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
