# Consolidado GSA HUB e GSA TV

Data: 12/09/2026. Horários em Brasília.

## Escopo e confiabilidade

Levantamento dos históricos acessíveis dos projetos GSA HUB e GSA TV. Foram percorridas todas as páginas retornadas para oito conversas, totalizando 275 registros de turnos. Seis mensagens longas de especificação/plano vieram truncadas pelo conector. Os anexos, documentos do Drive, arquivos de vídeo, logs da VPS e bancos citados nas conversas não foram auditados diretamente nesta consolidação. Conversas fora desses dois projetos não foram incluídas.

“Relatado como concluído” significa que a conversa informa execução e resultado; não equivale a uma nova comprovação técnica nesta sessão. A leitura local confirmou uma árvore Git com muitas alterações e a presença das cinco migrations de remediação entre os arquivos não rastreados. Não houve teste, deploy, mudança de banco, transmissão ou envio de mensagens a outras conversas neste levantamento.

O status `idle` da listagem não é suficiente para determinar se havia execução em andamento: duas rodadas apareceram posteriormente com horários de execução que se sobrepunham às consultas anteriores. O relatório prioriza mensagens e horários de conclusão, sem prometer monitoramento contínuo.

## Fontes consultadas

| Projeto | Conversa | Turnos recuperados | ID |
|---|---|---:|---|
| HUB | Trabalho no GSA Hub | 30 | 6aa1420a-6218-83e9-a5cd-7a26dc47ab79 |
| HUB | Avaliar fluxo ponta a ponta | 6 | 6aa44e96-5194-83e9-80fc-1f13e3cc54d8 |
| HUB | IA WHATSAPP | 41 | 6aa43c82-95ac-83e9-866a-94406b44723a |
| HUB | Sugestões para GSA HUB | 10 | 6aa4d385-2368-83e9-a8e8-20b06850c751 |
| HUB | Alterar link privacidade | 6 | 6aa586c8-597c-83e9-9b29-1db72c8779bf |
| TV | GSA TV Produção Contínua | 94 | 6aa0f6f9-54c0-83e9-8c2c-22a969ce5d3a |
| TV | Solicitação de transmissão | 57 | 6aa45476-dfd4-83e9-bbd3-83136977a86f |
| TV | Roteiros de abertura e encerramento | 31 | 6aa4a898-c980-83e9-90a9-fa9ac1bfcc49 |

## Decisões vigentes e preferências

- Correção expressa do usuário nesta conversa: os nomes oficiais dos âncoras são **Marcelo Valença e Lívia Fontes**. Boner Rodrigues e Sandra Ferraz são nomes anteriores substituídos. Conferir fichas, roteiros, créditos e arquivos já produzidos antes de reutilizá-los; o levantamento não renomeou arquivos nem alterou outros chats.
- HUB: alterações de desenvolvimento devem ocorrer diretamente no código-fonte da versão da porta 3000. Bundles publicados não devem ser a origem do desenvolvimento.
- Painel administrativo: simplificar a operação sem perder módulos, rotas, permissões ou funcionalidades.
- GSA TV: acesso exclusivo do administrador, com entrada própria pela página Acesso Restrito e experiência dedicada.
- A VPS armazena e executa a operação da TV. O frontend público do HUB é publicado no Cloudflare Pages; são responsabilidades distintas.
- Transmissão: um caminho principal ffplayout → H.264/AAC → RTMPS → YouTube. Entrada ao vivo, encoder intermediário e watchdog antigo foram removidos por solicitação do usuário, segundo o histórico.
- Mosca do canal permanente, inclusive sobre continuidade e vinhetas; padrão registrado de 240×240 em 1080p, no canto superior direito, com margens de 24 px. Ela pertence à transmissão e não deve ser duplicada no master.
- Cada programa deve ter seu próprio pacote gráfico. Para o News, a referência mais recente pede tela informativa, tag, data/edição, editoria, manchetes, identificação, créditos e assinatura.
- Vídeos dos apresentadores: avatar e voz oficiais, horizontal 16:9 real, sem barras laterais, download 1080p Upscaled. Configuração registrada: Veo 3.1 Lite, x1, 10 créditos por geração; isso é o padrão histórico, não verificação atual de preço/produto.
- Não reutilizar mídia audiovisual de edições antigas na reconstrução solicitada, nem repetir indiscriminadamente a mesma mídia na programação. Houve mudanças históricas sobre fontes permitidas; mais recentemente o usuário autorizou vídeos da internet e Flow, e a produção adotou Pexels. O manifesto de cada edição precisa refletir a fonte efetivamente utilizada.
- O computador Adriano é auxiliar: quedas de energia impedem tratá-lo como dependência permanente da emissora.

## GSA HUB — situação consolidada

### 1. Arquitetura e ambientes

SPA React/Vite com catálogo de rotas e camada de segurança. Ecossistema composto por área pública, cliente PF, empresa PJ, prestador, colaborador, fornecedor, afiliado, anunciante, carreiras, marketplace e administração. PF e PJ compartilham a entidade central de clientes, com separação de acesso por área.

A fonte identificada nos históricos é o repositório local desta sessão, associado a `canalverdade2-ship-it/meu-sistema`, historicamente na branch `feat/gsa-tv-e2e-20260831`. Esse nome não representa sozinho o escopo atual: existem alterações de muitas áreas do HUB.

Foram relatados builds locais diferentes do frontend público, além de correções feitas diretamente em bundles na VPS. A consulta local desta sessão também mostrou muitas alterações ainda não consolidadas no Git. Não existe evidência suficiente para afirmar que fonte, build, site público e banco correspondem hoje a uma única versão validada.

### 2. Serviço do cliente até financeiro/fiscal

Fonte: **Avaliar fluxo ponta a ponta**.

O último registro declara homologado o percurso cadastro → solicitação → análise → documentos/orçamento → aprovação → OS → demanda → atribuição ao administrativo/colaborador/prestador → entrega → análise/ajuste → aprovação → conclusão → entregáveis → fatura → fiscal opcional → cobrança/pagamento → histórico/notificações.

Correções relatadas: finalização transacional por `gsa_admin_finalize_demand`; bloqueios de conclusão prematura ou sem entrega adequada; propagação dos entregáveis ao cliente; prevenção de duplicidade em retries; correção da notificação ao prestador (`nome` versus `nome_razao`); vínculo de cliente nas ordens fiscais históricas quando havia evidência.

Validação relatada: 31/31 testes aprovados e 12 verificações de integridade sem inconsistências. Testes financeiros/fiscais usaram rollback. Vínculos históricos de fatura sem evidência não foram inventados.

Limites: a emissão automática de NF por prefeitura/SEFAZ/provedor não foi demonstrada. O fluxo descrito cria a ordem fiscal; o administrativo informa número e documento. A homologação desse fluxo não certifica todos os módulos do HUB. Parte do fechamento foi alterada em bundle, exigindo reconciliação com o fonte.

### 3. Integrações e remediação entre painéis

Fonte: **Trabalho no GSA Hub**.

| Área | Correção relatada | Situação consolidada |
|---|---|---|
| Cliente → Admin | Notificação via `gsa_client_notify_admin`, substituindo INSERT barrado pela RLS | Banco e fonte corrigidos; fechamento da publicação do conjunto não comprovado |
| Cliente → próprio cliente | RPC `gsa_client_notify_self` com validação e controle do destinatário | Relatada como implantada |
| Saúde | RPCs ausentes, colunas incompatíveis, aceite/contratação e estados administrativos corrigidos | Banco e fonte tratados; validação integrada final pendente |
| Classificados | Proposta real em vez de ticket; contraproposta, aceite, recusa, cancelamento e chat | Fonte finalizado segundo a última atualização; publicação pendente |
| Moderação de Classificados | Propostas/mensagens só chegam ao destinatário após aprovação; isolamento RLS e transação/comissão únicas | Remediação relatada no banco, com testes de contrato aprovados |
| Marketplace | Isolamento de avaliações/favoritos; CEP só reflete sucesso após persistência | Correções relatadas |
| Afiliados | Perfil por RPC e Realtime nas tabelas atuais de comissões/saques | Correções relatadas; confirmar na versão entregue |
| Empresas/B2B | Cadastro via RPC e recarga real; remoção de sucesso fictício | Corrigido no fonte; Adicionar Filial permaneceu indisponível por falta de modelo persistente |
| Saúde/Seguros secundários | Botões fictícios redirecionados para operações reais; dependente fictício desabilitado; aliases duplicados removidos | Correções relatadas |
| Parceiros | Remoção de fallback que escrevia diretamente após falha de RPC | Relatado como corrigido; comunicação externa pós-operação continua exigindo revisão de cobertura |
| Fornecedores | Persistência/auditoria boas, mas alguns eventos sem refresh imediato do portal | Sem fechamento específico encontrado para todos os broadcasts faltantes |
| Viagens | Núcleo transacional avaliado positivamente; algumas escritas ainda por RLS direta | Dívida arquitetural, não vulnerabilidade comprovada no histórico |

Cinco migrations foram copiadas da VPS e conferidas por hash, segundo a conversa; a presença local foi observada nesta sessão:

- `20260912011000_gsa_hub_flow_integrity_remediation.sql`
- `20260912011100_gsa_client_notify_self.sql`
- `20260912011200_classificados_final_remediation.sql`
- `20260912011300_classificados_chat_rls_remediation.sql`
- `20260912011400_classificados_message_moderation_notify.sql`

Os contratos de Classificados, Afiliados, Realtime, segurança do cliente e restauração de sessão foram relatados como aprovados. A última rodada ampla de TypeScript travou; houve passagem anterior bem-sucedida, mas antes de alterações adicionais. O deploy pelo fluxo Cloudflare Pages não foi encerrado nesse histórico.

### 4. IA do WhatsApp

Fonte: **IA WHATSAPP**.

Objetivo aprovado: interpretar linguagem livre, consultar conhecimento oficial e dados reais, executar ferramentas controladas e transferir para humano apenas quando adequado. O menu é um atalho, não a única forma de interação.

Implementação relatada: AI Core, interpretador semântico, orquestrador, estado e contexto persistidos, Policy Engine, Tool Registry/Runtime, versionamento de prompts, auditoria, confirmações, autenticação e handoff humano. Busca híbrida textual/vetorial com pgvector, HNSW e embeddings de 768 dimensões; os registros evoluíram de 20 para 21 chunks vetorizados. Isso não demonstra cobertura integral de todos os assuntos do HUB.

Produção relatada na porta 5681, com Evolution direcionado a ela, supervisor testado e fallback textual quando a busca vetorial falha. O atendimento principal na 5680 foi descrito em outra conversa como componente intencional distinto. A 5682 foi usada como canário e depois encerrada.

Foram corrigidos: reconhecimento de afiliados e linguagem informal; Trabalhe Conosco; detalhamento contextual de pontos/pedidos; formatação de Markdown e espaçamento; restauração do contexto; preservação das etapas PIN e confirmação; normalização `order_id/order_code`; gatilho de tickets que barrava execução interna; proteção contra duplicidade.

Fluxo final de contestação descrito: identificar pedido e proprietário → PIN validado no backend → SIM/NÃO → criar solicitação para análise → devolver protocolo. Não há estorno automático. O último registro declara teste de Runtime completo e recarga de produção; não há confirmação posterior do usuário completando a jornada real no WhatsApp após essa última correção.

Segurança relatada: PIN deixou de passar pelo interpretador e registros indevidos foram removidos; atendentes só operam handoffs autorizados, inclusive após restart; secrets principais foram retirados do código ativo e carregados de arquivo protegido. **Rotação coordenada das credenciais historicamente presentes em backups/scripts continua sem conclusão encontrada.** Nenhum segredo é reproduzido neste documento.

### 5. Painel Administrativo V2

Fonte: **Sugestões para GSA HUB**. Última execução registrada: 18:09:09–18:35:11 de 12/09.

Implementado segundo a última mensagem: Início, Trabalho, Comercial, Financeiro, Relacionamento e Gestão; Minha Fila com prioridades reais; busca Ctrl+K respeitando permissões; ações rápidas; retorno de Promoções à navegação; auditoria sem módulo renderizado órfão; correção da validação segura de sessão; acentuação de Saúde/Seguros; correções TypeScript da busca e do roteamento de privacidade.

A suíte administrativa executável passou. **Dois testes dependentes de `ADMIN_RUNTIME_DB_URL` foram SKIP**, não aprovados. O build anterior transformou 4.552 módulos, mas não substitui o build após as últimas correções.

Pendências explícitas: TypeScript final, build final e teste visual autenticado desktop/mobile. Recentes, Favoritos pessoais, busca de todos os registros de negócio e padronização de próxima ação por contexto aparecem no plano; não há comprovação suficiente de entrega integral dessas funcionalidades.

A proposta maior de Action Gateway, comandos por domínio, eventos/outbox, timeline única e redução progressiva do legado é direção arquitetural, não implantação integral comprovada.

### 6. Privacidade e caracteres corrompidos

Fonte: **Alterar link privacidade**.

Página `/privacidade` e navegação dos três rodapés foram relatadas como concluídas diretamente no desenvolvimento, com HTTP 200 e build. Modal permanece permitido em formulários de aceite.

A última demanda é uma auditoria global de caracteres corrompidos em vários módulos. Há reparo posterior específico em Saúde/Seguros na conversa do Painel V2, mas isso não fecha o problema global, inclusive Classificados. Falta comprovação de varredura e validação visual geral.

## GSA TV — situação consolidada

### 1. Transmissão e recursos

Fonte: **Solicitação de transmissão**.

O pipeline antigo fazia duas codificações e chegou a consumir aproximadamente 3,2 núcleos de uma VPS de 4 vCPUs. Testes históricos não encontraram encoder H.264 por hardware utilizável nessa VPS. A evolução removeu encoder intermediário, ingest/entrada ao vivo, relay antigo e watchdog, mantendo ffplayout e control plane como componentes centrais.

Último desenho relatado: conteúdo → ffplayout + mosca permanente → H.264/AAC → RTMPS/443 → YouTube. Preview interno nativo pode existir sem participar do envio ao YouTube.

Isolamento relatado: CPUs 0–1 para transmissão, limite de 2 CPUs; renders nas CPUs 2–3, limitados a 1,5 CPU, com peso reduzido e guard periódico. Isso precisa ser auditado também para os demais serviços da VPS antes de tratar os núcleos como exclusivamente reservados contra toda carga possível.

Filler corrigido para distinguir duração física do arquivo de trecho exibido. Após a correção, não foram relatados novos erros de duração na janela observada. Medições de saúde, disco, memória e CPU são históricas, não leituras atuais.

Perda funcional documentada: GC/lower thirds e ticker dinâmicos do canal não estão ativos; `graphics_reload` ficou sem aplicação. GC renderizado dentro do programa continua possível. Uma camada gráfica leve futura foi sugerida, sem entrega comprovada.

### 2. Operação diária e fábrica noturna

Fonte: **GSA TV Produção Contínua**.

Decisão explícita registrada: programação 06:00–23:49:59, encerramento 23:50–23:59:59 e fim da transmissão à meia-noite; madrugada para produção, QC e preparação. Um timer observado depois disparava a fábrica às 01:00. A diferença entre a janela planejada à meia-noite e a configuração às 01:00 deve ser reconciliada. Referências posteriores a capacidade 24/7 não comprovam mudança dessa grade horária.

Houve supervisor de dez em dez minutos durante uma madrugada, mas execução do supervisor não significou entrega dos programas. Um levantamento encontrou 13 jobs concluídos e 61 falhados, sobretudo por limite de API; 27 blocos tinham mídia associada, porém apenas quatro mídias únicas. O início automático às 06:00 foi relatado como funcionando, usando master já existente.

**Não foi encontrada comprovação de um ciclo completo produzindo, aprovando e exibindo toda a grade diária solicitada.** A produção posterior concentrou-se no News. Grade completa, ausência de repetições, direitos, duração e preparação antecipada permanecem critérios a provar.

### 3. GSA News Noite de 11/09

Última execução registrada: 18:10:10–18:36:58 de 12/09.

Histórico: exportação do Google Vids descartada por áudio/legendas antigos e quadros brancos; versão de cartelas/slides rejeitada pelo usuário; reconstrução com vídeos em movimento, Flow e locuções oficiais; V2 com mosca duplicada; V3 e V4 publicados e depois retirados por inadequação visual; V5 Rich GC recebeu novas correções editoriais nas cenas 24–30 e 32.

Último artefato relatado:

`gsa-news-noite-2026-09-11-master-v5-richgc-FINAL2-30m-1080p30.mp4`

- Duração: 1800,013 s.
- SHA-256: `8cf05aa1ba7b7433375bf616464a0d176f22885994ba659737000f359f6835a2`.
- Render final e full-decode terminaram, segundo o chat.
- Manifesto: `RIGHTS_MANIFEST_FINAL2.json`, com 141 fontes audiovisuais únicas relatadas. A existência do manifesto não constitui nova verificação de licenças nesta sessão.
- Última saída descrita: continuidade oficial, com `signal_state=sending`.

Pendências expressas: concluir leitura do relatório de áudio; inspecionar montagem visual das 33 cenas; copiar ao playout; comparar hash; registrar/aprovar a mídia; executar tomada; confirmar arquivo em reprodução; registrar changelog. A confirmação visual no player público também permanece uma evidência necessária para fechar a entrega ao espectador.

O FINAL2 **não foi declarado colocado no ar**. Métricas de loudness e aprovações dos V3/V4/V5 anteriores não devem ser atribuídas automaticamente ao FINAL2. Como a edição é de 11/09, uma futura retomada deve conferir identificação e atualidade editorial antes de apresentá-la como edição do dia.

### 4. GSA Manhã News e Histórias da Bíblia

O Manhã News teve roteiro de 60 minutos, 30 locuções Fish e master de 33 segmentos; surgiu conflito com slot de 30 minutos. Um master chegou ao ar e foi retirado após relato de sobreposição de áudio e imagens incompatíveis. A reconstrução do News Noite não encerra automaticamente essa pendência do Manhã.

Para **Histórias da Bíblia — O Filho Pródigo**, há introdução de Salomão Oliveira em 1080p30, 32 segundos, validada segundo o chat. Houve bloqueio de crédito Fish e dificuldades com material narrativo adequado. Uma reconstrução foi mencionada em render posteriormente, mas não foi encontrada conclusão definitiva com QC/publicação da nova versão completa. Um master estável antigo foi utilizado temporariamente na transmissão.

### 5. Aberturas e encerramentos

Fonte: **Roteiros de abertura e encerramento**.

O histórico corrigiu a falsa impressão de falta de avatares: há registro de 22 identidades aprovadas, além dos dois âncoras fixos do núcleo News. Parte das imagens está nas três pranchas de casting do Drive, sem arquivo individual inicialmente vinculado à VPS.

Bases horizontais relatadas como aprovadas para 16 apresentadores: Eduardo Salles, Clara Venturi, Patrícia Silva, Ricardo Brandão, Caio Nex, Bruna Ventura, Daniel Campos, Olívia Valverde, Marina Horizonte, Lucas Sereno, Chef Lorena Prado, Pastor Samuel Veredas, Elisa Monteiro, Nina Conecta, André Linhares e Aurora Alencar.

Seis bases ainda sem fechamento encontrado: Mauro Beat, Thea Lumière, Beto Pipoca, Gaia Monteverde, Salomão Oliveira e Luna Alegria. O inventário posterior de 14 bases por media-ID no Flow não deve ser confundido com as 16 bases arquivadas na VPS; é preciso cruzar os dois conjuntos.

Três masters 1080p com áudio foram relatados para o Manhã News: abertura masculina, abertura feminina e encerramento feminino. Foram produzidos sob os nomes anteriores Boner/Sandra e precisam ser conferidos quanto a fala, créditos e metadados diante da decisão atual Marcelo/Lívia. O encerramento masculino ficou bloqueado. André Linhares tem visual de abertura de 8 segundos, H.264 1920×1080; voz/masterização definitiva permanecem pendentes.

Bloqueios relatados: sessão Google expirada, recusas de geração por identificação de pessoa proeminente e falha de áudio. As recusas específicas foram descritas como sem cobrança; não foi feita auditoria total de créditos. Elisa foi cadastrada como personagem reutilizável, mas isso não resolveu a geração. A tentativa de entregar visual e aplicar voz oficial depois ainda não fechou o lote.

Há divergência histórica entre roteiro pensado para 10 segundos e geração efetiva de 8 segundos; o ajuste deve respeitar duração real e fala completa. A característica Elisa com voz oficial de Salomão aparece como decisão do cadastro histórico e merece preservação/conferência, sem substituição automática.

### 6. Identidade, acervo e máquina auxiliar

Vinheta oficial corrigida foi promovida, segundo o histórico, para `Vinheta_Oficial_GSA_TV_MASTER_1080p_PRO_40s.mp4`, 1920×1080/30, H.264/AAC 48 kHz e 40 segundos. Não confundir com a versão fonte 24 fps nem com masters antigos anteriores às cenas corrigidas.

Referências canônicas relatadas: `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, `/home/opc/gsa-ai/docs/GSA_TV_GC_STANDARD.md`, `/home/opc/gsa-ai/config/program-gc-profiles.json`, fichas técnicas e casting no Google Drive. Esses conteúdos não foram abertos diretamente neste levantamento.

O Adriano teve tarefa de logon `DesktopCommanderRemote` testada manualmente, restauração de sessão e suspensão/hibernação em tomada desativadas. Não foi localizada comprovação final do teste após reiniciar o Windows. Essa automação não resolve queda de energia nem garante execução antes do login.

## Pendências consolidadas e critérios de fechamento

Prioridades propostas para organizar a retomada, sem executar mudanças nesta sessão.

| ID | Frente | Próxima entrega verificável |
|---|---|---|
| H01 | Fonte e ambientes | Identificar versão oficial; incorporar patches feitos em bundles; conferir migrations; preparar uma entrega reproduzível |
| H02 | Remediação do HUB | TypeScript, testes direcionados e amplos pertinentes, build e validação integrada; confirmar o que chegou ao público |
| H03 | Painel V2 | Build/typecheck após últimas alterações; testes de banco antes ignorados; smoke autenticado desktop/mobile |
| H04 | Encoding global | Corrigir strings corrompidas restantes e inspecionar as telas afetadas |
| H05 | WhatsApp | Jornada completa após última correção: contexto, PIN, confirmação, ticket, protocolo, retry e cancelamento |
| H06 | Credenciais históricas | Planejar e comprovar rotação coordenada de todos os consumidores, sem interromper integrações |
| H07 | Fornecedores/Parceiros | Fechar refresh de produto, entrega e pagamento; confirmar cobertura de comunicação/outbox |
| H08 | Acesso TV | Conferir fonte e versão entregue: cartão próprio, layout, administrador autorizado e demais perfis bloqueados |
| H09 | Melhorias planejadas | Separar Recentes/Favoritos/Next Action e arquitetura por domínios do que já foi implementado |
| T01 | FINAL2 | QC final, hash, registro, instalação, tomada, confirmação no ffplayout e player público |
| T02 | Grade diária | Provar ciclo completo com blocos corretos, mídias distintas, duração, direitos e entrega antecipada |
| T03 | Fábrica noturna | Reconciliar horário 00:00/01:00 e limites de recursos; provar produção efetiva e não apenas disparo de timer |
| T04 | Manhã News/Bíblia | Fechar versões corretas separadamente; não usar conclusão do News Noite como substituto |
| T05 | Apresentadores | Inventário individual dos 24 avatares, bases e clips; seis bases pendentes; aberturas/encerramentos e voz oficial |
| T06 | Nomes oficiais | Aplicar Marcelo Valença/Lívia Fontes em fichas, roteiros, créditos e novos renders; revisar os três clips antigos |
| T07 | Gráficos dinâmicos | Registrar indisponibilidade atual e separar eventual implementação de GC/ticker do gráfico embutido nos programas |
| T08 | Operação e monitoramento | Conferir agendamentos reais, jobs/renders ativos, isolamento dos demais serviços e saúde externa |

Não somar testes de frentes/versões diferentes como uma única homologação. Não tratar `HTTP 200`, `healthy`, `sending`, build bem-sucedido ou mensagem de “meta ativa” isoladamente como conclusão da experiência ponta a ponta.

## Estado da consulta e conclusão

Na listagem consultada para esta consolidação, as oito conversas apareciam como `idle`; as mensagens finais de TV Produção Contínua e Sugestões para GSA HUB confirmam encerramento das rodadas às 18:36:58 e 18:35:11, respectivamente. Isso não comprova ausência de processos externos, nem existência/execução de agendamentos futuros.

O HUB tem correções transacionais e funcionais relevantes, mas o fechamento de uma versão integrada e publicada ainda precisa ser comprovado. A TV tem pipeline de transmissão simplificado e um master FINAL2 produzido, mas ainda não há comprovação da entrega completa da grade diária, do lote de apresentadores nem de todos os programas solicitados. A prioridade de gestão é manter um único registro por entrega com versão, ambiente, evidência e próxima pendência, respeitando as decisões mais recentes do usuário.
