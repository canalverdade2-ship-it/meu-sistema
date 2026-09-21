import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — CHECKPOINT INTEGRAL ATÉ ESTE EXATO SEGUNDO

### Continuidade, encoder e RTMP

- Detectado retransmissor FFmpeg órfão pertencente ao container antigo do Control Plane e ocupando a porta UDP 12345.
- Existia apenas uma conexão efetiva com o YouTube: a conexão do órfão; o retransmissor oficial do Encoder Engine falhava antes de conectar por “Address already in use”.
- O órfão foi validado por PID, comando e cgroup e encerrado de forma controlada.
- O Encoder Engine assumiu automaticamente o transporte e realizou novo handshake RTMP.
- Validação repetida: produtor ativo, retransmissor ativo, using_fallback=false, last_error=null, uma conexão RTMP ESTABLISHED e Send-Q entre 0 e 16 bytes nas amostras.
- Estado do banco após recuperação: online | running | media:media-gsa-em-fe-15h-10min | sending | sem last_error.
- Reinício controlado apenas do Control Plane preservou exatamente os mesmos PIDs internos do Encoder Engine (producer=20 e outer=575), provando a separação entre controle e transporte.
- A execução do script verify-external-encoder-architecture.mjs foi registrada como falha operacional desta sessão porque o arquivo, apesar do nome de verificação, executava force-recreate do Encoder Engine. Nova regra: inspecionar scripts de verificação e confirmar leitura pura antes da execução.
- Mosca, selo AO VIVO, posições e conteúdo exibido não foram alterados.

### Grade, marcas e painel consolidado

- Fonte canônica mantida: public.gsa_tv_weekly_grid_slots com enabled=true, ligada a public.gsa_tv_programs.
- A grade foi consolidada em 32 identidades de programa; aliases e faixas horárias não viram marcas separadas.
- GSA Entrevista permanece removido e não pode reaparecer.
- Todos os nomes de programa devem começar por GSA.
- Painel candidato com as 32 identidades foi gerado e armazenado em /home/opc/gsa-ai/assets/brand/gsa-program-logos-board-32-candidate-2026-09-04.png.
- Especificação do arquivo candidato: PNG, 1637x961, RGB; SHA-256 52224b6dd231e8495645ee33db9eaca21db26aec437584296a986eb0822765e4.
- O painel de 32 logos continua classificado como CANDIDATO, não substituiu automaticamente nenhum ativo oficial e ainda requer aprovação visual final.

### Identidade dos programas

- Correção expressa do responsável: nenhum programa possui abertura ou encerramento oficial; inclusive os arquivos do GSA News são somente testes.
- Nova exigência acrescentada: cada programa também precisa de vinheta “Estamos apresentando” e “Voltamos a apresentar” para intervalos comerciais.
- Total canônico atualizado: 32 programas x 4 peças = 128 masters oficiais pendentes.
- Situação atual: 0 aberturas oficiais, 0 “Estamos apresentando”, 0 “Voltamos a apresentar” e 0 encerramentos oficiais.
- Inventário atualizado em /home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md.

### Biblioteca sonora

- Confirmação expressa do responsável: os 230 arquivos da biblioteca sonora estão liberados para uso pela GSA TV.
- Inventário físico auditado: news=45, viral=45, faith=45, lifestyle=45, sfx=50; cerca de 2,0 GB.
- manifest.json contém 230 entradas, todas com source_url e sha256.
- Licenças declaradas: 180 CC-BY 4.0 e 50 CC0 1.0.
- Faixas CC-BY serão usadas com os créditos exigidos na ficha técnica, encerramento e/ou EPG; CC0 permanece rastreado no manifesto interno.

### Auditoria do master atualmente exibido — GSA Em Fé

- Mídia ativa: media-gsa-em-fe-15h-10min, arquivo /media/1/gsa-em-fe-10min/gsa-em-fe-15h-10min-master.mp4, duração de 600 segundos.
- O registro do banco informava incorretamente 1280x720 e 4.000 kbps; o arquivo físico medido é 1920x1080, 30 fps, H.264, aproximadamente 4.003 kbps, com áudio AAC estéreo 48 kHz aproximadamente 193 kbps.
- Loudness medido: -15,1 LUFS integrado, LRA 22,8 LU e true peak -1,3 dBFS; a dinâmica é excessivamente ampla para consistência broadcast e exige remasterização sonora.
- Inspeção de quadros em 5s, 120s, 300s e 500s confirmou uso de vídeos de natureza em movimento e repetição de cenário escuro de floresta entre o início e o final.
- O programa continua reprovado editorialmente pelo responsável por voz seca, pouca atmosfera espiritual/impacto e uso inadequado de ativo associado a outra produção; deverá ser reconstruído com ativos exclusivos, trilha faith, ambiência, transições e identidade própria.
- Nenhum novo master do GSA Em Fé foi promovido ao ar neste checkpoint.

### GSA News e ferramentas de criação

- Projeto GSA News 04/09/2026 continua aberto no Google Vids, com clipe animado de estúdio de 10 segundos inserido.
- Google Flow possui duas gerações de mapa meteorológico animado de 8 segundos.
- Pauta foi iniciada com fontes oficiais do dia.
- Bloqueio ainda vigente: não foi localizada credencial Fish Audio na VPS; as vozes oficiais Holt/Nyla não serão substituídas silenciosamente.
- Nenhum master novo do GSA News foi aprovado ou colocado no ar.

### Próximas ações já autorizadas e ainda pendentes

- Corrigir metadados técnicos do GSA Em Fé no banco e preparar reconstrução sem interromper o sinal atual.
- Concluir pacote editorial e visual do GSA News; a locução oficial depende da credencial Fish Audio.
- Produzir e aprovar, em lotes com QC, os 128 masters de identidade dos 32 programas.
- Finalizar aprovação/substituição do painel consolidado de 32 logos.
- Continuar registrando automaticamente toda ação relevante neste changelog, sem segredos.
`;
const n64=Buffer.from(note).toString('base64');
const sh=String.raw`set -euo pipefail
printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
wc -l -c /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 78 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
