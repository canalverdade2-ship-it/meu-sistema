import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`cat >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md <<'EOF'

## 2026-09-04 — GSA News diário: produção iniciada, ainda não liberada para o ar
- Pré-voo aprovado para Google Vids, navegador de produção, diretórios de download e containers de playout.
- Sessões autenticadas manualmente pelo responsável do canal no Google Vids e Google Flow.
- Projeto criado no Google Vids: GSA News - 04-09-2026.
- Primeiro prompt do Vids foi rejeitado pelo filtro de segurança; não houve tentativa de contornar a proteção.
- Prompt neutro reformulado foi aceito; clipe animado de estúdio com 10 segundos foi gerado e inserido no projeto.
- Projeto novo no Google Flow criado; prompt neutro de mapa meteorológico animado foi aceito e retornou duas gerações de 8 segundos.
- Pauta em elaboração a partir de fontes oficiais do dia: Agência Brasil/EBC, Câmara dos Deputados e Banco Central, com checagem de data e atribuição.
- Bloqueio de conformidade: a documentação exige Fish Audio para toda locução, mas não existe credencial Fish Audio no cofre, nos containers ou nos arquivos da VPS.
- Nenhum master foi aprovado, registrado como ready ou colocado no ar. O programa corrente e as sobreposições permanentes não foram alterados.
- Próximo passo obrigatório: cadastrar a chave da Fish Audio no cofre e gerar as vozes oficiais de Holt e Nyla; depois concluir montagem Vids, trilha, QC Full HD, cadastro e media_take.
EOF`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);
