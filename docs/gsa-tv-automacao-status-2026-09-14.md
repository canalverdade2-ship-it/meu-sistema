# GSA TV — automação: implantação e resultado real

Atualizado em 14/09/2026. Horário operacional: America/Sao_Paulo.

## Situação atual

A infraestrutura foi corrigida, mas a grade diária **não está pronta**. A transmissão está em continuidade (`standby`), confirmada pelo Control Plane e por heartbeat recente. Isso não confirma a imagem pública no YouTube.

O lote real terminou às 03h29 com estado `incomplete`, sem publicar os rascunhos:

- 8 vídeos produzidos e tecnicamente validados, somando cerca de 15 minutos. São curtos demais para seus blocos, de 15 a 60 minutos.
- 12 programas sem pautas verificadas e reutilizáveis na seleção desta edição.
- 1 bloco recebeu vínculo exato com vídeo existente e aprovado: GSA Histórias da Bíblia.
- 26 blocos continuam sem mídia final elegível.
- A grade oficial termina às 23:59:00, conforme a política já cadastrada. A conferência passou a respeitar esse contrato, sem alterar o relógio editorial. O compilador completa o minuto até 00h00 com continuidade.

## Correções instaladas na VPS

1. `ffprobe` voltou a medir duração real, sem montagem inválida da raiz.
2. TTS rejeita duração inválida, propaga falhas e identifica edição e roteiro. Não substitui silenciosamente a data solicitada por roteiros antigos.
3. O montador confere resolução, codecs, áudio, quadros por segundo, duração e decodificação completa antes de promover o arquivo final.
4. A fábrica tem um único proprietário no systemd. A entrada antiga encaminha ao serviço, sem aprovação em massa, seleção por nomes parciais ou substituição por cartelas.
5. Há checkpoints, cópias antes de sobrescrever, hashes para retomada, vínculo por programa/edição e preservação das escolhas do operador. Acervo exige associação exata, aprovação existente e duração compatível.
6. Produção começa às 00h00. Conferências às 05h00, 05h30 e 05h50. Encerramento às 05h59, com limpeza somente dos containers identificados como pertencentes à fábrica.
7. A compilação enfileirada exige conferência recente ligada à assinatura da grade. Mudanças de mídia, duração ou aprovação invalidam essa assinatura.
8. `GSA TV 02 - Schedule Compile` foi desativada no n8n: a compilação horária duplicava a responsabilidade da fábrica e da abertura diária.
9. `GSA TV 07 - Approved AI Production` permanece ativa, mas inicia projetos somente entre 00h00 e 04h50, com trava de horário também no código. Isso limita novos disparos; não comprova cancelamento de chamadas externas já em execução.
10. O controlador passou a consultar o Control Plane instalado, com ffplayout direto. A dependência do encoder inexistente na porta 9210 foi removida. Não houve reinstalação de watchdog nem reinício da transmissão.
11. O preparo do encerramento passou para 23h50, alinhado à grade, em vez de 00h50.
12. O início das 06h00 exige compilação concluída e confirmação do modo de transmissão. Grade incompleta preserva o sinal vigente e retorna falha explícita.

## Acervo: problema confirmado

A rotina antiga fabricava vídeos estáticos com nomes de filmes quando o arquivo faltava e os cadastrava como aprovados. Uma amostra de `gulliver-travels-animated-1080p.mp4`, aos 60 segundos, confirmou a cartela. A rotina foi substituída; os arquivos existentes não foram apagados nem tratados como filmes válidos pelo novo fluxo. O cadastro dessa cartela foi marcado como rejeitado, com motivo e backup da linha original.

Nas quatro pastas consultadas no Drive foram encontrados:

| Faixa | Conteúdo disponível | Duração na VPS | Bloco |
|---|---|---:|---:|
| GSA Desenhos | Popeye / Ali Babá | 1.508,134 s | 1.800 s |
| GSA Cinema | His Girl Friday | 5.553,821 s | 1.800 s |
| GSA Sessão Pipoca | Romance e Mistério | 4.646,380 s | 7.200 s |
| GSA Music | Apenas abertura e encerramento encontrados | — | 1.800 s |

Esses três arquivos de conteúdo já estão na VPS. Não foram cortados, repetidos ou promovidos arbitrariamente para simular uma grade completa. O inventário recursivo global do Drive não foi concluído; a verificação acima é das quatro pastas consultadas individualmente.

## Painel

O projeto local recebeu um resumo de prontidão em GSA TV → Operações, com data e pendências por programa, usando o histórico administrativo existente. Nenhum endpoint público ou novo acesso foi criado. A alteração foi compilada no projeto; não houve publicação separada do site.

## Validação

- 8 testes do produtor e 3 do controlador passaram na VPS.
- Tentativa real de compilar grade incompleta foi recusada, sem inserir job.
- Teste real de encerramento: container da fábrica removido; container de outro renderizador preservado.
- Entrada de áudio por pipe continuou funcionando no wrapper do FFmpeg.
- Piloto de 43,022 segundos passou por decodificação completa: 1920×1080, H.264, 30 fps, AAC, 48 kHz, estéreo.
- O lote de 8 vídeos passou na validação técnica, mas falhou na completude editorial/duração.
- Build Vite do painel concluído. Não se declara typecheck concluído: a saída preservada não contém confirmação do término.
- Timers de conferência, corte e abertura dispararam nesta data. A abertura foi bloqueada pela grade incompleta. O novo controlador foi validado por testes e consulta de leitura; não houve ensaio real de mudança para `program` com a grade incompleta.

## O que ainda impede operação completa

1. Produzir conteúdo suficiente para os blocos, com fontes, imagens e liberações adequadas. Rascunhos de 1–3 minutos não preenchem programas de 15–60 minutos.
2. Completar e organizar o acervo de entretenimento e música, com seleção compatível com cada faixa.
3. Concluir aprovação editorial e de direitos dos novos masters; o relógio cadastrado já exige essa aprovação. O código não a inventa.
4. Homologar um dia completo: produção, compilação, retorno às 06h00, reprodução pública e encerramento.

## Backups e reversão

Backups da VPS, com acesso restrito:

- `/opt/gsa-tv/backups/automation-repair-20260914-0455`: estado anterior à etapa 1, com hashes e instruções.
- `/opt/gsa-tv/backups/automation-repair-phase2-20260914`: produtor, montador, TTS e fábrica originais da etapa 2.
- `/opt/gsa-tv/backups/owner-staging-20260914`: versões intermediárias, entradas legadas, migração de bloqueio e exportação dos dois fluxos alterados no n8n.
- `/opt/gsa-tv/backups/automation-owner-20260914-053455`, `automation-owner-20260914-054727` e `automation-owner-20260914-110931`: arquivos anteriores a cada instalação, nos caminhos espelhados.
- `/opt/gsa-tv/backups/production-editions/2026-09-14`: arquivos preservados antes de sobrescrita.
- `/opt/gsa-tv/backups/production-links/2026-09-14`: blocos antes do vínculo automático.

Backups locais: `backups/gsa-tv-automation-20260914-continuation`.

Para reverter, escolher o checkpoint, parar apenas a fábrica, restaurar os arquivos espelhados e recarregar o systemd. A restauração integral anterior à etapa 2 exige também remover os novos timers/drop-ins, restaurar os dois fluxos do n8n pela API e remover o trigger `gsa_tv_automation_compile_gate` e suas duas funções. Os vínculos podem ser revertidos pelos JSONs de cada ID. **Restaurar a fábrica antiga também restaura seus defeitos conhecidos.**
