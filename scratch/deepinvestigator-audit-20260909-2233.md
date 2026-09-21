# Auditoria independente GSA TV — 09/09/2026 22:31–22:33 BRT

Somente leitura na VPS; nenhum start, stop, ensure, compile ou alteração remota executados.

## Resultado

Não aprovado como pipeline 100% pronto. Configuração dos horários e presença dos arquivos comprovadas, mas playlist editorial incompleta e controlador sem validação de conclusão.

## Timers e permissões

- Relógio remoto 2026-09-10T01:31:31+00:00, Timezone GMT, NTPSynchronized=yes.
- Os três timers ativos e enabled, com America/Sao_Paulo explícito: signoff23:50, stop23:59, morning-start06:00. Próximos disparos UTC02:50,02:59,09:00, respectivamente: conversão correta.
- LastTriggerUSec e ExecMainStartTimestamp vazios. Result=success/status0 dos serviços inativos não prova execução anterior.
- Persistent=yes e AccuracyUSec=1min nos três: há tolerância de disparo e possível recuperação tardia após indisponibilidade, sem guardas de horário no controlador.
- Serviços oneshot, User vazio (padrão root), arquivos em /etc/systemd/system/.
- /opt/gsa-tv/bin/gsa-tv-night-controller.sh: root:root0755, mtime2026-09-10 01:14:58UTC; bash -n aprovado.
- SHA25628a9db336b3a0589ac0fe684a5cfbf5e400e755b00c3dc800584610d6b0ed76f.

## Controlador atual

- signoff apenas emite mensagem; não seleciona vinheta/asset de encerramento.
- stop/start usam chamadas e inserções stream_stop/stream_start no banco; nenhum teste de execução foi provocado.
- start solicita compilação, espera15segundos fixos e segue para início, sem aguardar estado completed do job nem aprovar mídia/playlist. A frase de transmissão iniciada é incondicional.
- Sem set-e, lock ou controle completo de falhas/horário/QC. Nenhuma produção noturna invocada nesse script.
- Há credenciais embutidas no script legível por outros usuários; valores deliberadamente omitidos deste relatório.

## Playlist de10/09/2026

Dois arquivos examinados:

- /opt/gsa-tv/playlists/1/2026/09/2026-09-10.json
- /opt/gsa-tv/playlists/1/2026-09-10.json

Ambos: JSON válido,142entradas,86400segundos(24h), três arquivos únicos:

- /media/1/filler/gsa-tv-filler-600.mp4 —140entradas,82800segundos no conjunto(23h).
- /media/1/program-masters/gsa-manha-news-20260909-30m.mp4 —1entrada,1800segundos.
- /media/1/program-masters/gsa-historias-da-biblia-o-filho-prodigo-30m.mp4 —1entrada,1800segundos.

O container gsa-tv-ffplayout monta /opt/gsa-tv/cache/media em /media, e /opt/gsa-tv/playlists em /playlists. Todos os três arquivos existem, com4534750/948303396/547228668bytes respectivamente. ffprobe retornou0: H2641920x1080,30/1,AAC; duração600.000000/1800.022000/1800.033000segundos.

Isso comprova presença e cabeçalhos, não decodificação completa, áudio correto, correspondência editorial ou direitos. A playlist não comprova os27programas da grade64740segundos06:00–23:59: contém23h de repetição do mesmo filler e somente dois masters. Não há autorização técnica para declarar prontidão integral da manhã.

Jobs/control-plane ficam na auditoria paralela do agente principal.
