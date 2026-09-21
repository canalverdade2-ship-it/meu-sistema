const fs=require('fs');
const base='/home/opc/gsa-ai';
const file=base+'/GSA_TV_MEMORY_CHANGELOG.md';
const marker='full-grid-production-catalogue-decisions-20260909';
const now=new Date();
const backup=file+'.bak-consolidacao-grade-'+now.toISOString().replace(/[:.]/g,'-');
const clock=JSON.parse(fs.readFileSync(base+'/work/grade-definitiva-20260909-clock.json','utf8'));
if(fs.readFileSync(file,'utf8').includes(marker)){console.log('Registro consolidado já existe.');process.exit(0);}
const entry=`
## ${now.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} BRT — Consolidação detalhada: reorganização definitiva da grade, produção, painel e acervos

### 1. Escopo aprovado e descarte das referências antigas
- O usuário determinou desconsiderar as produções e durações anteriores como referência para o novo planejamento, especialmente o News de uma hora. Não solicitou apagar arquivos, cadastros de programas ou histórico.
- Permanecem os nomes dos programas da grade semanal anterior; muda a distribuição diária e a duração. A nova grade deve comandar a produção, e não ser adaptada para acomodar masters antigos inadequados.
- A aprovação final foi expressa: aplicar a grade organizada e fixá-la como definitiva na programação. A tabela abaixo é a versão autorizada, igual de segunda a domingo; assuntos, episódios e filmes variam por edição/dia.
- Não repetir nenhum programa no mesmo dia, exceto GSA Em Fé e GSA News nas três edições distintas (Manhã, Meio Dia e Noite). Desenhos, documentários e Music não podem ganhar segunda faixa no mesmo dia sob outro rótulo para contornar a regra.
- GSA Hora da Palavra e GSA Histórias da Bíblia não devem ser consecutivos. Troca aprovada: GSA Tech às 09h, Histórias da Bíblia às 09h30 e Hora da Palavra às 16h30.

### 2. Relógio definitivo de segunda a domingo — Brasília
| Horário | Programa | Duração total |
|---|---|---|
${clock.map(c=>`| ${c.start}–${c.end} | ${c.start==='06:00'?'Abertura oficial + ':''}${c.title} | ${c.slot_duration_s/60} minutos |`).join('\n')}

- 27 faixas por dia, incluindo o encerramento; 189 faixas semanais habilitadas. São 25 nomes de programas editoriais, contando as três edições do News separadamente; Em Fé possui duas entradas e a continuidade representa o encerramento.
- Duração total diária validada: 64.740 segundos = 17h59, de 06h a 23h59. Programação regular até 23h50, encerramento 23h50–23h59; parada prevista às 23h59.
- Abertura oficial de 40s está DENTRO da primeira faixa de 30min, não adicionada antes das 06h ou sobreposta ao programa seguinte.
- Vinhetas e intervalos devem caber dentro das durações das faixas. Nenhum master maior que o slot pode ser promovido fingindo compatibilidade.
- Mundo, Destinos, Planeta Terra e Mistérios: 60min cada. Music e Desenhos: 30min cada. Tempo: 15min. News: 30min em cada edição.
- Agro 45min; Bem Viver, Sabor e Esportes 60min; demais conforme tabela. Esses ajustes fizeram parte da proposta posteriormente aprovada.

### 3. Sessão Pipoca e aquisição de filmes
- O usuário chegou a restringir filmes aos sábados e domingos, mas REVOGOU essa orientação antes da aplicação: Sessão Pipoca permanece TODOS OS DIAS, segunda a domingo, 20h–22h.
- Reserva de 120min inclui filme, identificação e intervalos. Exibir o filme integral, sem truncar a obra para caber; conferir duração real antes de fechar a playlist. Filme mais curto exige composição editorial da janela; não há preenchimento adicional aprovado automaticamente.
- GSA Cinema 19h30–20h e GSA Sessão Pipoca 20h–22h são programas distintos e foram preservados.
- Preferência operacional discutida: baixar arquivos autorizados antecipadamente, verificar integridade/codec/duração/áudio e armazenar no playout; não depender de link externo que pode expirar/falhar no momento da exibição.
- Filmes e desenhos adquiridos podem precisar de conversão e preparação, mas não de produção do zero. Isso não significa que qualquer filme disponível gratuitamente esteja autorizado para retransmissão.
- A pergunta sobre manter áudio original licenciado de filmes/desenhos ainda não recebeu resposta expressa. Não considerar revogada automaticamente a regra anterior de remover áudio externo e usar somente áudio GSA.

### 4. Janela de produção e limites da automação
- Produção reservada de 00h a 05h59; 05h59–06h para preparação final da transmissão; abertura às 06h. Entre 23h59 e 00h há janela técnica de um minuto, sem programa.
- Objetivo do usuário: emissora 100% automatizada, seguindo a grade fixa semanal, sem depender de aprovação humana diária de cada bloco.
- O usuário já forneceu/configurou APIs, fontes, ferramentas de imagem/vídeo e vozes. Prioridade: integrar e provar o funcionamento do existente, não criar mais automações desconectadas.
- Separar produção pesada e transmissão reduz competição por recursos. Usar intensivamente CPU durante a madrugada não autoriza esgotar RAM/disco nem criar concorrência ilimitada.
- Capacidade de produzir todo o conteúdo do zero em seis horas NÃO foi comprovada. Quase 18h de exibição em seis horas exigiria vazão média de cerca de 3h de programação por hora, além de aquisição e QC; não prometer essa capacidade sem teste real.
- Melhorias discutidas: receita fixa por programa; roteiro associado às cenas; render por blocos reentrantes; fila única guiada pela grade; conferência prévia de APIs/créditos/fontes/disco; distinguir tarefa recebida de conteúdo aprovado/publicado/agendado.
- Filmes/desenhos e episódios temáticos podem ser preparados com antecedência; edições diárias precisam atualização e marcação temporal correta. News noturno produzido de madrugada não deve se apresentar como atualização do instante da exibição.
- Reservas foram discutidas como contingência, não como comprovação de edição nova produzida. Uso de reserva deve ser identificado e falha de produção registrada.
- Permanecem 1080p30, nunca reduzir para 720p; tags superiores à esquerda; créditos inferiores à esquerda; vinheta aprovada; áudio e imagem devem corresponder. Regra anterior do News de pelo menos 90% de vídeo novo sem repetição permanece registrada; numa edição total de 30min isso corresponde a pelo menos 27min, não aos 54min do master antigo de uma hora.

### 5. Diagnóstico real do painel e automações nesta conversa
- Consulta às 11h24–11h26 BRT encontrou serviços principais de controle/encoder/playout/watchdog ativos, com contêineres informando saúde normal; isso não é prova editorial de conteúdo correto nem de reprodução pública.
- Banco informava canal online/running/sending em 1080p30, com media-gsa-historias-biblia-filho-prodigo-tag-20260909 como fonte. Naquela análise não foi confirmada reprodução pública pelo navegador.
- Disco em 91% de uso, cerca de 18GiB livres; RAM disponível aproximadamente 18GiB e load 0.12/0.21/1.96 naquele instante. Não extrapolar esses valores como estado permanente.
- 12 workflows n8n GSA TV habilitados, com execuções recentes: Media Readiness Reconcile, Schedule Compile, VPS Storage Readiness, Playout Monitor, YouTube Transport Monitor, Rights Watch, Approved AI Production, Daily Operational Report, Fixed Grid Horizon, Editorial Source Collect, Editorial Project Preparation e Production Package Builder.
- Nas 24h consultadas, Schedule Compile tinha 24 execuções success no n8n, mas os jobs no sistema tinham 21 compile_playlist failed e 3 completed. Evidência de que sucesso do disparo não comprova entrega do trabalho assíncrono.
- Falhas recorrentes em /media/1/filler/gsa-tv-filler-600.mp4: ffprobe retornava moov atom not found / Invalid data. Não foi corrigido esse arquivo nesta operação de grade.
- A tabela de agendamentos de mídia não continha horários futuros naquele instante; a grade editorial semanal e as versões diárias existiam separadamente. Não confundir ausência de slots de mídia com exclusão da grade semanal.
- Código local da tela tinha lista fixa antiga de 18 blocos/24h, diferente da grade semanal do banco; o botão de sincronizar apenas mostrava sucesso e atualizava consultas, sem sincronizar a grade. O selo de no-ar/exibido era inferido do relógio, não da execução.
- Simplificação proposta, ainda NÃO implementada como redesenho completo: Mesa Master, Programação e Automação como áreas principais; biblioteca/APIs/ajustes técnicos em Configurações. Nenhuma automação foi desligada por esta análise.

### 6. Pesquisa de acervos e direitos — fatos confirmados versus candidatos
- Tela Brasil confirmada como plataforma pública gratuita com login gov.br. Pesquisa inicial foi insuficiente; investigação posterior leu o texto oficial dos Termos de Uso carregado pela plataforma.
- Item 2 dos termos destina uso a exibição não comercial cultural/educativa e restringe reprodução, distribuição, download e transmissão fora dos limites autorizados; uso comercial/publicitário não fica liberado por ser gratuito ao cidadão.
- Existe Rede Exibidora: termo de adesão voltado a pontos de exibição não comerciais; exclui pessoas jurídicas com fins lucrativos e exibidores comerciais. Menção a modo on-line/off-line não comprova permissão para retransmitir pelo YouTube. Não houve cadastro de exibidor, download de obra ou aceite de termos nesta pesquisa.
- Links oficiais consultados: https://telabrasil.cultura.gov.br/minha-conta/termos?tab=termos-de-uso ; https://telabrasil.cultura.gov.br/minha-conta/termos?tab=termo-de-adesao ; texto de termos obtido sem login em https://cdn.telabrasil.cultura.gov.br/api/v1/info/policies/terms.json ; cartilha https://www.gov.br/cultura/pt-br/centrais-de-conteudo/publicacoes/cartilha-cineclubes-2/sav_cineclube-2edicao-cartilha-v2.pdf/ . Contato publicado: contatotelabrasil@cultura.gov.br. Nenhum e-mail foi enviado.
- Acervos candidatos pesquisados: Internet Archive Feature Films (https://archive.org/details/feature_films); Library of Congress Free to Use/Public Domain Films (https://www.loc.gov/free-to-use/public-domain-films-from-the-national-film-registry); Wikimedia Commons (https://commons.wikimedia.org/wiki/Category:Films_in_the_public_domain); Public Domain Torrents (https://publicdomaintorrents.info/nshowcat.html?category=ALL); Cinemateca Brasileira/Banco de Conteúdos Culturais (https://cinemateca.org.br/acervo/base-de-dados/); Blender Studio (https://studio.blender.org/films/); NASA para ciência/espaço (https://www.nasa.gov/nasa-brand-center/images-and-media/).
- Archive declara não garantir direitos informados por uploaders. Public Domain Torrents declara acreditar no domínio público, sem constituir prova suficiente por si só. Cinemateca possui procedimento de licenciamento. Direitos de cópia, trilha, dublagem, legendas e território precisam conferência individual.
- The Hitch-Hiker, Under Western Stars e Popeye the Sailor Meets Sindbad the Sailor foram encontrados na seleção de domínio público da Library of Congress; são candidatos, NÃO títulos adquiridos/aprovados para GSA TV. Domínio público nos EUA não foi tratado como liberação universal.
- A pesquisa ampla de acervos não resolveu expressamente a antiga restrição de origem YouTube-autorizado. Conciliar essa escolha antes da aquisição; não alegar permissão geral dada por conta da pesquisa.
- Nenhum filme novo foi baixado, licenciado ou inserido na grade nesta rodada. A presença de Sessão Pipoca na grade é reserva editorial, não confirmação de um filme disponível.

### 7. Aplicação efetivamente concluída e pendências separadas
- Migration aplicada em transação: 20260909160000_gsa_tv_definitive_daily_grid.sql. Sete dias com 27 faixas; validações de duração, continuidade, ausência de madrugada e duplicação passaram.
- Backup antes da alteração: /home/opc/gsa-ai/work/grade-definitiva-backup-20260909-xKQGLH/grade-before.sql ; materializer-before.sql e policy-before.json na mesma pasta. Histórico anterior preservado; nenhuma mídia apagada.
- 31 versões editoriais anteriores da grade fixa foram canceladas, preservando registros; 31 novas versões geradas de 09/09 a 09/10 com 27 blocos. State published nesse modelo significa grade editorial publicada, NÃO masters produzidos/QC_OK.
- Política de horários gravada em gsa_tv_channels.config.broadcast_schedule_policy. Metadados de abertura, encerramento e proteção de corte do filme passam ao materializador. Durações padrão dos 25 programas alinhadas.
- Plano de produção /home/opc/gsa-ai/work/daily-automation-2026-09-09/grade-plan.json atualizado com backup, 27 jobs e novas durações. /home/opc/gsa-ai/work/grade-definitiva-20260909.json contém plano consolidado; /home/opc/gsa-ai/work/grade-definitiva-20260909-clock.json contém relógio exportado do banco.
- Arquivos novos de conteúdo continuam pendentes. Nenhuma chamada de restart/start/stop ou compilação/publicação de playlist foi feita por esta mudança.
- Produção noturna e liga/desliga automático NÃO foram validados de ponta a ponta. O compilador legado ainda possui preenchimento de 24h: precisa alinhamento ao controlador antes de considerar funcionamento noturno concluído. Reserva de janela no banco não equivale a controlador implementado.
- Tela local GsaTvScheduleTab.tsx corrigida para 27 faixas, horário de Brasília por minuto, sem sucesso falso de sincronização e sem afirmar no-ar/exibido a partir do relógio. Validação TSX e continuidade 06h–23h59 passaram. Build completo foi iniciado e seu resultado ainda precisa ser registrado separadamente.
- Publicação visual BLOQUEADA nesta rodada: Sites retornou project_not_found para o projeto associado ao workspace. A tela de produção não deve ser declarada atualizada; nenhuma alternativa de publicação foi usada para contornar a indisponibilidade e nenhuma alteração não relacionada do workspace foi publicada.
- Ainda pendentes: publicar correção visual, resolver mecanismo de publicação do painel, validar controlador diário, corrigir playlist/reserva inválida, produzir/QC os conteúdos e selecionar filmes autorizados com áudio/idioma/qualidade adequados.
- Identificador: ${marker}
`;
fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
fs.appendFileSync(file,entry,'utf8');
const verified=fs.readFileSync(file,'utf8');
if(!verified.endsWith(entry))throw Error('Registro não confirmado');
console.log(JSON.stringify({registered:true,file,backup,marker,entryCharacters:entry.length,clockEntries:clock.length},null,2));
