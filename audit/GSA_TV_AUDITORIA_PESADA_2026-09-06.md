# GSA TV — Auditoria pesada pós-migração

Data da coleta: 06/09/2026 (America/São_Paulo / VPS em UTC)  
Escopo: painel administrativo, Control Plane, Encoder Engine, ffplayout, watchdog, banco, grade, mídia, backup, segurança, observabilidade e recuperação.  
Método: inspeção somente leitura. Nenhum processo de transmissão foi reiniciado.

## Parecer executivo

O sinal estava operacional durante a coleta: um transportador RTMP, produtor ativo, HLS final recente, áudio limpo e ausência de erro corrente no Encoder Engine. Entretanto, a migração não está encerrada e o conjunto ainda não oferece a continuidade 24x7 pretendida. Foram confirmadas falhas críticas de confirmação falsa no painel, monitoramento enganoso, backup incompleto e falhando, programação futura sem ativos associados e recuperação insuficiente após reinicialização.

## Achados críticos

### C01 — O painel fabrica sucesso quando o RPC falha

`src/lib/gsaTvLiveControl.ts` captura falhas e retorna artificialmente `success: true`, `status: completed` e um identificador local. O operador pode acreditar que ligou, desligou ou trocou algo sem que o backend tenha recebido o comando.

### C02 — Watchdog declara HLS saudável com mais de 34 horas de atraso

As amostras mais recentes registram simultaneamente `hls_ok=true` e `hls_age_s` entre aproximadamente 120.780 e 124.426 segundos. O watchdog observa o HLS legado do ffplayout, não o HLS final do Encoder Engine. O indicador verde não comprova a saída enviada ao YouTube.

### C03 — Backup integral está quebrado e não cobre a nova arquitetura

Os backups de 03, 04 e 05/09 falharam com `restore row count mismatch`. As linhas correspondentes ficaram incorretamente em `running`. O último backup integral com restore test aprovado é de 02/09. O pacote `runtime-config.tgz` inclui Control Plane e watchdog, mas omite Encoder Engine e seu estado persistente.

### C04 — Toda a programação futura publicada está sem conteúdo executável

Foram encontrados 1.116 blocos futuros do tipo `content`; os 1.116 não possuem `media_item_id`, `episode_id` nem `live_source_id`. A grade contém horários e programas, mas não contém o ativo que deve ser reproduzido. O sistema depende de filler ou operação manual.

### C05 — Arquivos de mídia estão graváveis por qualquer usuário local

Grande parte de `/opt/gsa-tv/cache/media` está com permissão `777`, incluindo vídeos, áudios, logos, prompts e manifestos. Um processo local comprometido poderia substituir material que irá ao ar.

### C06 — Superfície externa excessiva da VPS

O firewall libera, além de 80/443/SSH, as portas 5680, 6379, 8080, 3001, 9999, 4000 e 5000. Há listeners em `0.0.0.0` ou `*` nas portas 3001 (PostgREST), 8080, 5000, 5680, 9999 e 4000. Isso amplia a superfície de ataque. Deve-se validar necessidade, autenticação e restrições de origem de cada serviço.

### C07 — Segredo administrativo com permissão ampla

`/opt/gsa-tv/control-plane/secrets/ffplayout-admin-password` está com modo `644`, apesar de outras cópias estarem em `400` ou `600`.

## Achados altos

### A01 — Recuperação pós-reboot tem corrida de inicialização

Control Plane e Encoder Engine usam `restart: unless-stopped`, mas não têm dependência/ordem de saúde. O Control Plane executa `restoreRuntime()` uma vez. Se o Engine não estiver pronto nesse instante, o painel pode entrar em falha enquanto o Engine se recupera separadamente.

### A02 — Saúde e heartbeat não representam o caminho real completo

O Control Plane monitora apenas ffplayout. Seu heartbeat confia em estado de memória e não reconcilia continuamente `outer_running`, `producer_running` e `last_error`. O `/health` do Engine retorna 200 se o transportador estiver vivo, mesmo que o produtor esteja morto.

### A03 — API do Engine não serializa comandos concorrentes

`/v1/ensure` e `/v1/stop` não possuem mutex/fila interna. Requisições simultâneas podem cruzar parada, troca e reinicialização. O guard de publicador único reduz o dano depois do fato, mas não elimina a corrida na origem.

### A04 — Estado do selo é otimista e erros são silenciados

O painel mostra sucesso logo após enfileirar a tarefa, sem esperar a conclusão. A leitura do Supabase ignora o campo `error`, portanto uma consulta negada ou falha pode manter estado incorreto silenciosamente.

### A05 — ffplayout recebe durações incompatíveis

Os logs mostram blocos planejados de 30, 45, 60 e 90 minutos apontando para um filler físico de aproximadamente 10 minutos. Também houve `produced no decodable audio or video frames; fallback generated`. Isso decorre da programação sem ativos e pode gerar comportamento de fallback imprevisível.

### A06 — Código implantado e repositório estão divergentes

Os hashes do Control Plane e do Encoder Engine na VPS não coincidem com as cópias do repositório local. O compose local ainda referencia Encoder Engine 1.0.0, enquanto produção usa 1.1.0. O watchdog local coincide com produção e continua legado. Uma reinstalação pelo repositório pode reintroduzir UDP ou remover hotfixes.

### A07 — Não existe alta disponibilidade real

Há um único host, um único Encoder Engine e um único evento público do YouTube. O sistema reinicia processos localmente, mas não possui nó reserva, failover externo nem mecanismo autenticado para reabrir automaticamente uma live pública encerrada pelo YouTube. “Nunca cair” não pode ser garantido por essa topologia.

### A08 — Jobs abandonados não possuem lease/timeout/requeue

Existe `collect_editorial_sources` em `running` há mais de 37 horas. Não há recuperação automática após crash. Também existem 15 falhas recentes distribuídas entre geração Vids, compilação, media take, reload e probe.

### A09 — Testes contratuais não cobrem a migração real

`npm run test:gsa-tv` falhou em três contratos: navegação de Operações, oito workflows n8n versionados e distinção relay/YouTube confirmado. O teste de backup passou verificando arquivos estáticos antigos, embora o backup real da VPS esteja falhando e omita o Engine. Isso demonstra falso positivo de cobertura.

### A10 — Isolamento de recursos insuficiente

Control Plane, Encoder Engine e watchdog não têm limites de CPU, memória ou PIDs. O produtor consumia cerca de 215% de CPU na amostra. A VPS ainda tinha capacidade, mas outro serviço pode competir com o encoder e causar degradação.

## Achados médios

1. Permanecem `streamProcess`, `terminateRelay` e lock stub da arquitetura antiga no Control Plane.
2. `process_pid` continua nulo no status do Control Plane.
3. Permanecem `ENCODER_UDP_PORT` e `UDP_PORT`, embora UDP esteja proibido no caminho principal.
4. O estado lógico de pausa diverge: Control Plane pode estar `paused` enquanto Engine continua `running` alimentando fallback.
5. O arquivo persistente do Engine contém os argumentos completos do encoder. Está em modo `600`, mas precisa ser classificado como segredo no backup.
6. Não há rotação de logs configurada para Control Plane, Encoder Engine e watchdog. Outros contêineres já acumularam logs de centenas de MB.
7. A tabela `gsa_tv_ai_provider_credentials` está com RLS desativado. Não foram observadas permissões de escrita amplas para `anon`/`authenticated`, mas a proteção é inconsistente com as demais tabelas de segredo.
8. Existem três incidentes não resolvidos, dois críticos e um warning antigo.
9. A documentação ainda atribui ao ffplayout o HLS que seguiria ao relay, descrição incompatível com a arquitetura atual.
10. Contadores históricos do kernel registram 99.630 erros de buffer UDP, 122.554 retransmissões TCP e 56.601 timeouts TCP. Não houve medição de delta indicando problema corrente, mas os contadores precisam de série temporal.
11. A VPS usa 2,6 GiB de swap, embora tenha aproximadamente 18 GiB disponíveis. Não havia swap-in/swap-out na coleta; é memória histórica, não gargalo atual.
12. A tabela de watchdog possui quase 20 mil amostras e cresce continuamente; é necessário definir retenção.

## Controles que funcionaram

1. Exatamente um transportador RTMP foi observado.
2. O guard de proprietário único está ativo a cada cinco segundos.
3. O HLS final do Encoder Engine estava atualizando em tempo real.
4. Produtor e transportador estavam ativos e sem erro corrente.
5. As rotas sensíveis externas testadas retornaram 401 sem sessão; somente `/health` é público.
6. As portas internas 9202, 9210 e 5577 estão vinculadas a localhost.
7. Contêineres GSA TV usam usuário não-root, filesystem somente leitura e não são privilegiados.
8. A grade semanal cobre 24 horas em todos os sete dias e não possui referências a programas inexistentes.
9. As 25 mídias prontas possuem caminho, duração e direitos válidos; 17 estão em 1080p30/48 kHz e 8 em 720p30/48 kHz.

## Ordem de correção recomendada

1. Remover confirmações falsas do painel e aguardar estado terminal real dos jobs.
2. Corrigir watchdog/health/heartbeat para observar produtor, transportador, HLS final e estado público do YouTube.
3. Adicionar mutex idempotente no Engine e reconciliação contínua no Control Plane.
4. Corrigir backup, marcar execuções abandonadas e realizar restore test da arquitetura 1.1.0.
5. Materializar os ativos dos 1.116 blocos futuros e recompilar a grade com durações reais.
6. Fechar portas desnecessárias, corrigir permissões `777/644` e revisar RLS.
7. Sincronizar repositório e produção, versionar imagens e preparar rollback verificável.
8. Adicionar limites/reservas de recursos, rotação de logs, retenção e alertas úteis.
9. Executar teste controlado de reboot, crash de produtor, crash de transportador, concorrência de comandos e retorno ao ar.
10. Planejar alta disponibilidade fora da VPS caso a exigência seja continuidade mesmo com falha total do host.

## Critério para declarar a migração concluída

A migração somente deve ser declarada concluída quando todos os itens críticos e altos estiverem corrigidos, o restore test reproduzir a arquitetura nova, a grade futura possuir ativos executáveis e uma janela controlada comprovar recuperação automática sem segundo publicador RTMP.
