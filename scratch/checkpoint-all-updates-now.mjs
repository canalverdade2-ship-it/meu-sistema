import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const localImage='C:/Users/Adriano Farias/.codex/generated_images/01a01128-ed98-7c82-b207-1afeb589b650/exec-a6d028e7-9952-47d0-b34f-fef079e96490.png';
const image64=fs.readFileSync(localImage).toString('base64');
const remote=String.raw`set -euo pipefail
mkdir -p /home/opc/gsa-ai/assets/brand
printf '%s' '${image64}' | base64 -d > /home/opc/gsa-ai/assets/brand/gsa-program-logos-board-prefix-draft-2026-09-04.png
chmod 644 /home/opc/gsa-ai/assets/brand/gsa-program-logos-board-prefix-draft-2026-09-04.png
SHA=$(sha256sum /home/opc/gsa-ai/assets/brand/gsa-program-logos-board-prefix-draft-2026-09-04.png | awk '{print $1}')
NOW=$(TZ=America/Sao_Paulo date '+%Y-%m-%d %H:%M:%S %Z')
cat >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md <<EOF

## 2026-09-04 — CHECKPOINT INTEGRAL ATÉ $NOW

### Segurança e autenticação Google
- A conta operacional do Google Vids/Flow foi armazenada em cofre criptografado AES-256-GCM.
- A senha não foi registrada neste arquivo nem em documentação aberta.
- Cofre: /home/opc/gsa-ai/secrets/google-production.enc.json, permissão 0600.
- Recuperador de sessão: /home/opc/gsa-ai/bin/google-session-login.js.
- Uma senha em texto aberto encontrada em script legado foi removida.
- O responsável do canal concluiu manualmente o login; Google Vids e Google Flow ficaram autenticados.

### Produção GSA News — edição 04/09/2026
- Pré-voo aprovado: navegador de produção, Google Vids, downloads, Control Plane e playout disponíveis.
- Projeto Google Vids criado e nomeado GSA News - 04-09-2026.
- Primeiro prompt de clipe foi rejeitado pelo filtro do produto; a proteção não foi contornada.
- Prompt foi reescrito de forma neutra e compatível; um clipe animado de estúdio de 10 segundos foi gerado e inserido no projeto Vids.
- Projeto Google Flow criado; prompt neutro de mapa meteorológico animado foi aceito e retornou duas gerações de 8 segundos.
- Pauta em elaboração com fatos do dia e fontes oficiais: Agência Brasil/EBC, Câmara dos Deputados e Banco Central.
- Bloqueio atual: a documentação exige Fish Audio para todas as locuções, mas não existe credencial Fish Audio configurada no cofre, containers ou arquivos da VPS.
- Estado de publicação: nenhum master do GSA News de 04/09/2026 foi aprovado, cadastrado como ready ou colocado no ar.
- Proteção do sinal: programa corrente, mosca e selo AO VIVO não foram alterados.

### Regra permanente de realismo audiovisual
- Proibido entregar programa baseado apenas em voz seca sobre imagem parada.
- Cada produção deve utilizar, conforme sua identidade: trilha licenciada, cama musical, stings, transições, ambiência, imagens/vídeos em movimento e desenho sonoro coerente.
- A trilha deve preservar a inteligibilidade da locução.
- Proibido reutilizar imagem de reportagem ou de outro programa sem relação direta.
- GSA Em Fé não deve reutilizar ativos do GSA News e vice-versa.
- Foi registrado que a edição corrente de GSA Em Fé ficou sem impacto sonoro/espiritual e reutilizou indevidamente imagem de reportagem do GSA News; requer reconstrução futura específica.

### Aberturas e encerramentos da grade
- Cada programa deve possuir abertura e encerramento oficiais próprios, em Full HD, com identidade, trilha e desenho sonoro específicos.
- Não reutilizar vinheta genérica entre programas diferentes.
- Deve ser feito inventário da grade para classificar masters existentes, ausentes ou reprovados antes da produção em lote.

### Auditoria da prancha consolidada de logotipos
- A imagem original possui 26 logotipos de programas.
- A regra canônica foi confirmada: todo nome de programa deve iniciar com GSA.
- Foram detectados 11 logotipos sem o prefixo: Despertar da Fé; Oração da Manhã; Bênção da Tarde; Misericórdia; Noite & Família; Desenhos; Sessão Pipoca; Filmes & Documentários; Cine Madrugada; Bem Viver; Tá na Rede.
- Foi gerado um rascunho corrigindo os 11 prefixos, preservando a organização visual.
- Rascunho salvo em: /home/opc/gsa-ai/assets/brand/gsa-program-logos-board-prefix-draft-2026-09-04.png
- SHA-256 do rascunho: $SHA
- O rascunho NÃO é final nem aprovado, pois ainda precisa refletir a grade vigente e as mudanças de programas.

### Levantamento da grade vigente no Painel Master
- A tabela histórica de programas publicados contém aliases e variações; ela não deve ser usada sozinha para atualizar a prancha.
- A fonte canônica identificada é public.gsa_tv_weekly_grid_slots com enabled=true, relacionada a public.gsa_tv_programs.
- A grade semanal atualmente referencia 35 nomes únicos de programa.
- GSA Entrevista não aparece na grade semanal vigente e também não aparece visualmente na imagem anexada nesta conversa; permanece classificado como removido/não vigente até a comparação final.
- Diferenças já confirmadas entre a prancha e a grade: GSA Boletim Financeiro não é o nome canônico atual (a grade usa GSA Mercado); GSA Desenhos aparece como GSA Desenhos Clássicos; GSA Motores aparece como GSA Motor.
- A grade vigente inclui programas ausentes da prancha, entre eles GSA Cidadania, GSA Em Fé Reflexão, GSA Histórias da Bíblia, GSA Motivação, GSA Noite de Louvor, GSA Planeta Terra, GSA Tempo e variações editoriais/documentais a serem consolidadas antes do layout final.
- A comparação definitiva remover/adicionar/renomear ainda está em andamento; nenhuma prancha final substituiu a oficial.

### Regra de rastreabilidade
- Toda nova alteração técnica, editorial, download, geração, montagem, teste, publicação, troca de mídia ou mudança de identidade deve continuar sendo registrada automaticamente neste changelog, sem exposição de segredos.
EOF
tail -n 85 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
