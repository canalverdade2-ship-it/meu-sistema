# Original User Request

## 2026-08-28T14:12:08Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Implementar as 6 correções críticas (P0) apontadas no laudo de auditoria Realtime
> Requested team: Use a very large team of agents. Equipe de força-tarefa para correção de bugs críticos.

Executar o plano de remediação P0 (Crítico) do sistema GSA HUB baseado no laudo de auditoria `audit_realtime_report.md`. Corrigir as fundações do Supabase Realtime no React e no Webhook VPS.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: development

## Requirements

### R1. Corrigir Infraestrutura Base (useRealtime.ts)
Corrigir stale closures e index desync no arquivo `src/hooks/useRealtime.ts`. O array `callbacksRef.current` deve reter as referências mais recentes iterando sobre `options` fresco, e o loop de listeners deve parear os callbacks corretos mesmo quando algumas tabelas estiverem `enabled: false`.

### R2. Eliminar Violação de Hooks e Tabelas Fantasmas
- Mover os hooks `useEffect`/`useRealtimeSubscription` para a raiz (fora de funções assíncronas ou condicionais) nos arquivos: `ProdutosModule.tsx`, `OrdensAssinaturaModule.tsx`, `OrdensCompraModule.tsx`.
- Atualizar os nomes das tabelas para as corretas nos arquivos: `AdvertisingAdminModule.tsx` (gsa_ad_campaigns), `ServicePackagesModule.tsx` (servicos_pacotes), `TrabalheConoscoSection.tsx` e `CareersAdminModule.tsx` (gsa_careers_applications).

### R3. Migrar Hooks Legados e Aplicar Filtros de Segurança
- Migrar o uso de `useRealtimeTable` para o canônico `useRealtimeSubscription` em `OrcamentosWorkstation.tsx` e `ConfiguracoesModule.tsx`.
- Adicionar filtros de linha obrigatórios (`filter: 'coluna=eq.{id}'`) para evitar broadcasts globais em: `useClientNotifications.tsx` (cliente_id), `AfiliadoDashboard.tsx` (afiliado_id), `PurchasesPage.tsx` (cliente_id), `CouponsPage.tsx` (cliente_id), `PrestadorDetailDrawer.tsx` (prestador_id).

### R4. Corrigir Race Conditions no VPS Webhook
No arquivo `server_webhook_vps_live.cjs` (e `server_webhook.cjs`):
- Consertar o fallback de `SERVICE_ROLE_JWT` (linha ~2902).
- Proteger contra race conditions de múltiplas mensagens simultâneas (linha ~9153) implementando um `SessionMutex` ou fila por número.
- Garantir atomicidade na conversão de pontos RMW (Read-Modify-Write) (linha ~4990), preferencialmente via RPC atômica ou lock.

## Acceptance Criteria

### Verificação de Conformidade
- [ ] O script `scripts/check-realtime-audit.ts` passa com 100% de sucesso nas verificações de front-end (0 usos de hook legado, 0 warnings de vazamento).
- [ ] Inspeção manual do código do `useRealtime.ts` confirma a resolução dos problemas de stale closure e index.
- [ ] O Webhook VPS inicia sem erros de sintaxe e o código apresenta as proteções contra concorrência solicitadas.

## 2026-08-28T19:26:56Z

# Teamwork Project Prompt

> Goal: Concluir a implantação da feature "Entrar com recurso" (Appeal) para resgates de benefícios recusados, garantindo que caracteres especiais no WhatsApp (UTF-8) sejam corrigidos e preservando as restrições de infraestrutura do projeto.
> Requested team: Use a large team of agents to finish frontend implementation and webhook integrations.

Continuar o trabalho da IA anterior para a feature de "Recurso" de resgate. As migrations no banco (`parceiros_resgates_recursos` e `parceiros_resgates_eventos`) já foram aplicadas. O fluxo do cliente via UI e as respostas do ADM via painel precisam ser finalizados, assim como os webhooks transacionais para o WhatsApp com total aderência ao encoding UTF-8.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: development

**IMPORTANT CONSTRAINTS:**
- **NÃO usar Git ou GitHub.** Todo o trabalho é estritamente local ou direto no banco/VPS.
- **NÃO publicar no Cloudflare Pages.**
- **UTF-8 ESTRITO:** Todos os arquivos editados e webhooks n8n devem respeitar a codificação UTF-8 para evitar caracteres quebrados (ex: "NotificaÃ§Ã£o") nas mensagens do WhatsApp.

## Requirements

### R1. Frontend do Cliente (Página de Consulta de Protocolo)
Em `src/components/public/ProtocolConsultPage.tsx`:
- Quando o status do resgate for "recusado", o cliente deve ter a opção de "Entrar com recurso" (apenas uma única vez).
- O cliente deve poder enviar uma mensagem/justificativa e anexar até 3 fotos/documentos como evidência.
- Ao salvar, os dados devem ser enviados para a tabela `parceiros_resgates_recursos` e o status do protocolo em `parceiros_resgates` pode passar para `em_recurso` (ou similar conforme arquitetura).

### R2. Frontend do Administrador (Gestão de Resgates)
Em `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` e `FornecedoresSection.tsx`:
- O ADM deve conseguir visualizar os detalhes do recurso, incluindo os textos e imagens enviados pelo cliente.
- O ADM deve ter a opção de "Aceitar Recurso" ou "Negar Recurso".
- Histórico de eventos deve ser exibido (utilizando `parceiros_resgates_eventos`).

### R3. Notificações WhatsApp (Correção UTF-8 e Integração)
Em `src/utils/n8nWhatsApp.ts` e arquivos relacionados de disparo:
- Corrigir urgentemente o encoding (UTF-8) para que as mensagens enviadas aos clientes (e automações) não cheguem com caracteres especiais quebrados.
- Ao abrir um recurso, o cliente deve receber uma confirmação no WhatsApp.
- Ao ter o recurso avaliado (aceito/negado), o cliente deve receber o veredito via WhatsApp, também formatado corretamente.

## Acceptance Criteria

### Verificação de Fluxo
- [ ] O cliente com benefício recusado visualiza o botão de recurso na página pública, submete a justificativa e as evidências com sucesso.
- [ ] O administrador enxerga o recurso aberto no painel de Fornecedores/Parceiros e consegue dar o veredito final.
- [ ] As mensagens de notificação chegam no WhatsApp do cliente formatadas corretamente, SEM nenhum caractere estranho como "Ã§" ou "Ã£o".
- [ ] Nenhuma alteração foi commitada no Git ou enviada para o Cloudflare Pages.

## 2026-08-28T21:58:40Z

Uma auditoria profunda e exaustiva em todo o sistema (GSA HUB). A equipe deve encontrar bugs, vulnerabilidades de segurança, gargalos de performance e problemas nas integrações (Supabase, N8N, Evolution), e **corrigir automaticamente** os problemas encontrados diretamente no código-fonte.

Use a very large team of agents.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: development

## Requirements

### R1. Correção de Segurança e Performance (Frontend e Banco)
A equipe deve analisar os componentes do React, chamadas RPC do Supabase, e Webhooks. Falhas de segurança (exposição de credenciais, injeções) e problemas de performance (renderizações desnecessárias, gargalos em queries) devem ser corrigidos.

### R2. Estabilização de Integrações
Revisar as integrações com a Evolution API e n8n. Garantir tratamento de erros robusto (try/catch), proteção contra quebra de encoding (UTF-8), e estabilidade das chamadas assíncronas.

### R3. Validação Programática
A equipe deve rodar ferramentas locais, especialmente `npm run build` ou compiladores de TypeScript, a cada lote de correções feito, para garantir que as alterações resolvam os bugs sem quebrar a compilação do sistema.

## Acceptance Criteria

### Verificação de Correções
- [ ] O projeto compila com sucesso executando `npm run build` após todas as correções.
- [ ] A equipe gera um documento final (`scratch/auditoria_report.md`) listando de forma detalhada cada arquivo modificado e a respectiva correção aplicada.
- [ ] O log da compilação e execução não apresenta erros letais de tipagem TypeScript ou de violações das regras dos React Hooks nas áreas alteradas.

## 2026-09-04T19:28:42Z

# Teamwork Project Prompt — Draft

> Status: Launched.
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team

Build an automation system to search, curate, and download a massive package of ~200-250 royalty-free background music tracks and sound effects. The assets must be organized into specific categorized folders (News, Viral, Faith, Lifestyle, SFX) on the GSA TV VPS to establish the network's official Sonic Identity.

Working directory: ~/teamwork_projects/audio_identity_builder
Integrity mode: development

## Requirements

### R1. Audio Acquisition
Create an automation script or system that autonomously finds and downloads high-quality, royalty-free audio files (music beds and sound effects) suitable for professional television broadcasting. You are free to choose the best source (e.g., public APIs, scraping tools, open-source repositories).

### R2. Categorization and Storage
The downloaded files must be organized into exactly these 5 subdirectories inside `/opt/gsa-tv/cache/media/1/identity/audio/`:
- `news` (tense, corporate, hard news beds)
- `viral` (upbeat, pop, comedy effects)
- `faith` (cinematic, peaceful, ambient)
- `lifestyle` (jazz, acoustic, organic)
- `sfx` (transitions, whooshes, impacts, tickers)

### R3. Environment
The system will run on an Oracle VPS running Linux. You must write the logic and ensure dependencies are installed (e.g., via npm, pip, or apt) without manual user intervention.

## Acceptance Criteria

### Execution & Output
- [ ] The directories `news`, `viral`, `faith`, `lifestyle`, and `sfx` exist at the specified path.
- [ ] A validation script (e.g., using `find` and `wc -l`) confirms there are at least 200 total audio files (.mp3, .wav, or .m4a) across the folders.
- [ ] A verification script (using `ffprobe` or `file`) runs on a sample of 10 random files and confirms they are valid, non-corrupt audio files.

## 2026-09-08T02:46:22Z

Finalizar o pacote de identidade visual (vinhetas de abertura/encerramento) da GSA TV completando 4 ações obrigatórias pendentes: baixar e auditar as regenerações do Google Flow, integrar o Program Builder à API Fish Audio para locuções de continuidade, refazer o QC do GSA Agro com a voz correta e montar o pacote final aprovado.

Working directory: /home/opc/gsa-ai
Integrity mode: development

## Contexto Técnico da VPS (LEITURA OBRIGATÓRIA)

**VPS:** Oracle Cloud Linux, `147.15.43.141:22`, usuário `opc`, chave SSH em `C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key`

**SSH Helper (Node.js):** `file:///C:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gest%C3%A3o-de-servi%C3%A7os%20-%20Copia%20(4)/scratch/ssh2-run.mjs`

**Estado atual da VPS (verificado em 07/09/2026 23:38 BRT):**
- Masters-v1 em `/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1/` — 50 MP4s originais do Flow, tecnicamente íntegros mas com defeitos visuais em algumas peças.
- Regenerações já aprovadas: GSA Esportes (encerramento) e GSA Hora da Palavra (abertura) — já baixadas e visualmente aprovadas.
- Regenerações PENDENTES (submetidas ao Flow, aguardando download/QC): GSA Sabor (abertura), GSA Bem Viver (encerramento), GSA Em Fé (encerramento), GSA Agro (abertura), GSA Motor (abertura), GSA News Noite (abertura), GSA Business (abertura).
- Estado da regeneração: `/home/opc/gsa-ai/regen-defective-state.json`
- Browser/Flow: Container `gsa-ai-browser`, CDP endpoint `http://127.0.0.1:9228` (Chromium headless com Puppeteer, conta adriano9865@gmail.com autenticada)
- Changelog obrigatório: `/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`

**API Fish Audio:**
- Endpoint: `https://api.fish.audio/v1/tts`
- Modelo: `s2.1-pro-free`
- Voz institucional de continuidade (chamadas/vinhetas): ID `5c8a9b5d0b2549c7ada853529199ebe5`
- A chave Fish Audio já está carregada de forma segura no ai_worker (`/opt/gsa-tv/ai-worker/ai_worker.mjs`). NÃO duplicar nem expor a chave em novos scripts — ler o worker para entender como acessar.
- Textos a gerar: "Estamos apresentando [Nome do Programa]" e "Estamos de volta / Voltamos a apresentar [Nome do Programa]"

**Program Builder:** Script Python existente em `/home/opc/gsa-ai/`. Atualmente usa MP3s antigos de `/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/`. Deve ser modificado para chamar a API Fish em vez de selecionar esses MP3s automaticamente.

**GSA Agro — teste publicado:** `/home/opc/gsa-ai/work/gsa-agro-builder-teste-publicado.mp4` (gerado com MP3 antigo — deve ser descartado e refeito com Fish).

**Regras invioláveis de qualidade:**
- PROIBIDO aplicar blur global, desaceleração artificial, ou sobrepor um segundo logo sobre vídeo do Flow que já contenha logo.
- A substituição só ocorre quando há defeito COMPROVADO e a peça substituta está visualmente aprovada.
- As peças originais sem defeito devem ser mantidas intactas.
- GSA Entrevista está EXCLUÍDO do escopo — não reintroduzir.
- Toda ação realizada DEVE ser registrada no `GSA_TV_MEMORY_CHANGELOG.md`.

## Requirements

### R1. Download e QC visual das 7 regenerações pendentes do Flow
Conectar ao container `gsa-ai-browser` via CDP, localizar os 7 projetos regenerados no Google Flow/Vids (GSA Sabor abertura, GSA Bem Viver encerramento, GSA Em Fé encerramento, GSA Agro abertura, GSA Motor abertura, GSA News Noite abertura, GSA Business abertura), exportar/baixar cada um como MP4, fazer QC técnico com `ffprobe` e QC visual gerando contact sheets nos tempos 1s, 5s e 9s. Aprovar as peças sem defeitos e rejeitar as que ainda apresentem logos sintéticos, textos inventados ou artefatos.

### R2. Integração do Program Builder com a API Fish Audio
Modificar o Program Builder para que as locuções de continuidade ("Estamos apresentando" / "Estamos de volta") sejam geradas dinamicamente via API Fish Audio usando a voz institucional `5c8a9b5d0b2549c7ada853529199ebe5` com modelo `s2.1-pro-free`, em vez de selecionar os MP3s antigos do diretório de bumpers. O áudio gerado deve ser WAV/MP3 48kHz estéreo, conformado a ~5s de duração com fade in/out.

### R3. Revalidação completa do GSA Agro
Com o Builder integrado ao Fish Audio, gerar um novo master completo do GSA Agro (abertura do Flow aprovada + locução Fish de continuidade + encerramento do Flow), passar por QC técnico completo com `ffprobe` e gerar contact sheets para validação visual. Publicar o novo master descartando os testes anteriores.

### R4. Montagem do pacote final aprovado
Consolidar todos os arquivos aprovados (originais bons do masters-v1 + substituições aprovadas das regenerações) em um diretório final `/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/`. Gerar um manifesto JSON listando cada programa, qual versão foi usada (original ou regenerada) e o hash SHA-256 de cada arquivo. Registrar a conclusão no `GSA_TV_MEMORY_CHANGELOG.md`.

## Acceptance Criteria

### Download e QC das Regenerações
- [ ] Os 7 MP4s das regenerações pendentes estão baixados na VPS.
- [ ] Contact sheets gerados para cada peça (tempos 1s, 5s, 9s) e salvos em `/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen/`.
- [ ] `ffprobe` confirma: H.264, 1920x1080, 30fps, áudio AAC 48kHz, duração entre 8s e 12s para cada arquivo aprovado.
- [ ] Nenhum arquivo com defeito comprovado (logo sintético, texto inventado) foi declarado aprovado.

### Integração Fish Audio
- [ ] O Program Builder gera locução de continuidade via Fish API para pelo menos um programa sem usar MP3 antigo.
- [ ] O áudio gerado tem duração entre 3s e 7s, amostragem 48kHz e canais estéreo (verificável via `ffprobe`).

### QC do GSA Agro
- [ ] Novo master do GSA Agro gerado com locução Fish e vinheta regenerada do Flow.
- [ ] `ffprobe` passa: H.264, 1920x1080, 30fps, AAC 48kHz estéreo.
- [ ] Contact sheet visual gerado e aprovado (sem texto sintético, sem logo duplo).

### Pacote Final
- [ ] Diretório `masters-final/` existe com pelo menos 40 MP4s (desconsiderando peças ainda em regeneração pendente).
- [ ] `manifest.json` lista todos os arquivos com campos: `program`, `piece_type` (opening/closing), `source` (original/regenerated), `sha256`, `approved_at`.
- [ ] Entrada registrada no `GSA_TV_MEMORY_CHANGELOG.md` com inventário final.

## 2026-09-09T19:51:10Z

Simplificar os fluxos de trabalho e processos dentro do módulo GSA TV para torná-los menos burocráticos, mantendo todas as abas e ferramentas atuais (Master Control, Grade, Acervo, IA, etc).

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)

## Requirements

### R1. Simplificar o Acervo de Mídia e Upload: Reduzir campos obrigatórios no upload de vídeos e remover qualquer fluxo de aprovação prévia (o vídeo entra direto como aprovado).

### R2. Simplificar Transmissão e Grade: Remover modais de confirmação duplos no Master Control e simplificar a adição de conteúdo na Grade de Programação, reduzindo o número de cliques.

### R3. Manter todas as ferramentas e abas existentes funcionais, alterando apenas a burocracia dos fluxos (UI mais direta).

Integrity mode: development

## Acceptance Criteria

### Verificação Objetiva (Agent-as-Judge)
- [ ] O componente de Upload deve permitir o envio de arquivos sem exigir preenchimento de campos de aprovação.
- [ ] O status das mídias enviadas deve ser automaticamente definido como "aprovado" ou "publicado" (sem estado pendente).
- [ ] As ações principais no Master Control (Play/Stop) devem ser executadas com 1 clique (sem alert/dialogs de dupla confirmação).
- [ ] Os formulários da Grade de Programação devem ter pelo menos 30% menos campos obrigatórios, focando apenas no essencial (Mídia, Horário).

## 2026-09-10T19:56:53Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Large-scale agent team

Use a very large team of agents.

Validação ponta a ponta e auditoria profunda dos módulos de carrinho, checkout, devoluções, trocas, sistema de pontos, cupons, saldo de carteira e promoções do marketplace. O objetivo é garantir que não existam falhas, deadlocks, race conditions ou inconsistências no código (React) e banco de dados (PostgreSQL), e corrigir proativamente qualquer vulnerabilidade encontrada.

Working directory: ~/teamwork_projects/marketplace_validation
Integrity mode: development

## Requirements

### R1. Auditoria e Correção do Fluxo de Compras e Promoções
Realizar leitura estática profunda e refatorar o ciclo do carrinho e checkout. Validar a aplicação de pontos, cupons, saldo em carteira e mecânicas de promoção, assegurando transações ACID e controle de estoque sem falhas de concorrência.

### R2. Auditoria e Correção de Pós-Venda (Devoluções e Trocas)
Investigar e validar os fluxos de devolução e troca no código. Garantir que os estornos (financeiros, de saldo e de pontos) e a reinserção de estoque sejam executados de forma atômica e correta, corrigindo o código onde necessário.

## Verification Resources
A equipe pode utilizar as suítes de testes já existentes no projeto para validar o comportamento esperado.

## Acceptance Criteria

### Testes e Simulações
- [ ] Foram criados e executados novos scripts de teste automatizados capazes de simular o fluxo de compras e concorrência (ex: multiplos checkouts/devoluções simultâneos).
- [ ] O relatório final da equipe atesta a aprovação nos testes e a ausência de *race conditions* ou furos lógicos nos referidos módulos.

### Correções Aplicadas
- [ ] Quaisquer bugs, vulnerabilidades ou gargalos identificados durante a revisão estática do código (React e SQL) foram corrigidos diretamente nos arquivos do projeto.

## 2026-09-10T22:29:06Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Large-scale agent team

Revisão técnica profunda e simulação de concorrência das correções ACID recém-implementadas no banco de dados para os fluxos de checkout e devolução do marketplace.

Working directory: ~/teamwork_projects/marketplace_acid_review
Integrity mode: benchmark

## Requirements

### R1. Auditoria de Concorrência no Checkout (Base Function)
Analisar a função `gsa_client_checkout_store_base_20260817` no arquivo `20260716183010_update_checkout_function.sql`. Verificar se a lógica que injeta o preço da variação `v_variant_price` está livre de vulnerabilidades de sobreposição global (evitando a mutação da tabela principal de produtos) e se os bloqueios `FOR UPDATE` impedem a venda de produtos sem estoque durante alta simultaneidade.

### R2. Auditoria de Estornos e Devoluções Atômicas
Analisar a migração `20260910180000_marketplace_acid_concurrency_remediation.sql` e a RPC `gsa_admin_atualizar_solicitacao_loja`. Verificar e garantir matematicamente que o fluxo de devoluções:
1. Devolve a quantidade exata ao estoque do `produto` e da sua `produto_variante` correspondente.
2. Estorna precisamente o valor em `carteira_saldo` se foi utilizado.
3. Estorna precisamente os `pontos_fidelidade` e os registra na tabela de movimentações.
4. Gera e cancela faturas com segurança transacional.

## Verification Resources
As migrations supracitadas (`20260716183010_update_checkout_function.sql`, `20260817120000_product_variations_marketplace.sql` e `20260910180000_marketplace_acid_concurrency_remediation.sql`) estão disponíveis no projeto em `supabase/migrations/`.

## Acceptance Criteria

### Testes de Estresse e Simulações 
- [ ] O time deve executar simulações lógicas de concorrência extrema para provar que duas transações simultâneas no mesmo milissegundo não corrompem os preços ou o estoque.

### Integridade do Pós-Venda
- [ ] O relatório deve atestar que não há furos no fluxo que permitam a aprovação de uma devolução sem que o estorno integral (Estoque, Pontos e Saldo) seja executado na mesma transação atômica.
- [ ] Se qualquer vulnerabilidade nas lógicas escritas manualmente for encontrada, a equipe deverá refatorar a respectiva migration e apresentar a correção.

## 2026-09-10T23:11:34Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Use a very large team of agents.

O usuário solicitou uma revisão minuciosa completa (auditoria geral) de todo o sistema do painel do cliente e banco de dados, para garantir que não haja mais gargalos de permissões (RLS), bugs de interface ou falhas nos RPCs de transação financeira.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Auditoria Frontend (React)
A equipe deve analisar os componentes do painel do cliente localizados em `src/components/client/` para garantir que não existam tags HTML corrompidas ou erros de sintaxe crônicos oriundos de substituições anteriores em massa.

### R2. Auditoria Backend (PostgreSQL & RPCs)
A equipe deve verificar as Remote Procedure Calls (RPCs) relacionadas a saques e resgates de pontos, bem como certificar-se de que todas as tabelas acessadas pelo painel do cliente possuem políticas de Row Level Security (RLS) ativas que permitam apenas ao próprio cliente visualizar seus dados.

### R3. Verificação Programática
A equipe deve rodar processos de build e scripts SQL reais para validar que o sistema está íntegro e compilável, não dependendo apenas de verificação visual do código.

## Acceptance Criteria

### Verificação de Compilação
- [ ] O comando `npm run build` no frontend deve executar com sucesso (código de saída 0), provando a ausência de erros de sintaxe fatais.

### Verificação de Segurança (RLS)
- [ ] Um script SQL deve ser executado no banco de dados validando que as tabelas `saques`, `pontos_movimentacoes` e `vouchers` possuem as políticas RLS corretas ativadas para a role `authenticated`.

## 2026-09-11T00:26:34Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Large-scale agent team

Revisão global e auditoria completa de todos os módulos do ecossistema GSA (Carrinhos, Checkout, Devolução, Troca, Pontos, Cupons, Saldo, Promoções) após a recente implementação pesada de correções de atomicidade ACID e prevenção de race-conditions.

Working directory: ~/teamwork_projects/global_marketplace_audit
Integrity mode: benchmark

## Requirements

### R1. Auditoria End-to-End do Frontend e Integrações
Inspecionar todo o ecossistema React (ex: `CheckoutPage.tsx`, `LojaTrocasModule.tsx`, `ProductPage.tsx`) para garantir que os componentes UI reagem perfeitamente às chamadas atômicas do PostgreSQL, que não há renderizações em loop (reactivity cascades) e que todas as dependências estão lidando corretamente com os novos cenários de rejeição por estoque esgotado.

### R2. Validação Definitiva do Banco de Dados
Realizar uma varredura final no ecossistema transacional (PostgreSQL). Provar matematicamente que as travas `FOR UPDATE` adicionadas recentemente em `20260716183010_update_checkout_function.sql` e a RPC de pós-venda `gsa_admin_atualizar_solicitacao_loja` (migration de concorrência) não introduziram novos gargalos de lentidão sistêmica (bottlenecks) em cenários de alta carga.

### R3. Avaliação de Test-Suites
Revisar a profundidade e a cobertura do teste massivo recém-criado (`src/tests/marketplace-concurrency-simulation.test.ts`), garantindo que ele cubra 100% das regras de negócio ativas para os carrinhos, cupons, saldo, pontos e trocas.

## Acceptance Criteria

### Integridade e Relatório de Vitória (Victory Audit)
- [ ] A equipe deve varrer ativamente o código, refatorar qualquer *warning* residual ou código ocioso (dead-code), e garantir que as dependências Typescript/SQL estão imaculadas.
- [ ] O relatório final deve atestar que a aplicação pode ser lançada para milhares de usuários simultâneos sem risco de perdas financeiras (estorno incompleto) ou vendas sem estoque.

## 2026-09-11T02:00:24Z

# Prompt de Escopo para a Equipe de Agentes (Teamwork)

**1. Role and Context:**
Vocês são um esquadrão de elite especializado em Qualidade de Software, Segurança e Arquitetura de Sistemas (QA & Security Team). Vocês estão assumindo o ecossistema "Grupo GSA" após uma grande rodada de refatorações estruturais.

**2. Goal and Objectives:**
O objetivo principal é "revisar tudo". A equipe deve vasculhar cada canto do sistema (Painéis do Prestador, Parceiro, Fornecedor, Colaborador, Afiliado e Anunciante) e do banco de dados (Supabase PostgreSQL) para garantir que não haja erros residuais, quebras de RLS ou falhas na lógica de negócio. A sincronia entre UI e Banco de Dados deve estar 100%.

**3. Core Requirements & Deliverables:**
- Verificar o log de compilação (Typescript) para garantir que o projeto builda perfeitamente.
- Auditar todas as Row Level Security (RLS) policies no banco de dados.
- Confirmar se não há "código morto" ou funções assíncronas falhando silenciosamente no Front-end.
- Entregar um relatório consolidado com a assinatura de aprovação da equipe.

**4. Strategy & Subagent Collaboration:**
- **Agente de Segurança (DBA):** Focará exclusivamente nas RLS, Triggers e RPCs (SECURITY DEFINER).
- **Agente Front-end:** Inspecionará os componentes React, formulários, e estado global.
- **Agente de Integração:** Validará chamadas de API, endpoints de Edge Functions e Webhooks.

**5. Tech Stack & Reference Material:**
- React (Vite), TypeScript, TailwindCSS.
- Supabase (Autenticação, Database, Edge Functions, Storage).
- Todas as migrations em `supabase/migrations/`.

**6. Environment Setup:**
Não alterar arquivos de configuração como `.env`, `vite.config.ts` ou `tsconfig.json` a menos que seja um bloqueio crítico. Utilizar ferramentas de CLI como `npx tsc --noEmit` para validações rápidas.

**7. Constraints & Guardrails:**
- NÃO alterar a lógica de negócios estabelecida sem reportar antes.
- NENHUMA alteração destrutiva no banco de dados (DROP TABLE, etc).
- Garantir a retrocompatibilidade das páginas já consertadas.

**8. Output Format & Definition of Done:**
- Todas as verificações documentadas.
- O projeto deve passar na checagem estrita de tipos sem erros (código 0).
- Nenhuma falha silenciosa permitida.

**9. Handoff / Next Steps:**
Após a conclusão das varreduras em paralelo, o Líder da Equipe compilará um relatório final para o usuário demonstrando que o ecossistema GSA está "100% à prova de balas".

## 2026-09-11T02:18:50Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

O usuário solicitou um levantamento técnico profundo de ponta a ponta do sistema, resultando na criação de um único documento técnico centralizado (`DOCUMENTACAO_SISTEMA.md`) que detalhe e mapeie o banco de dados e as funcionalidades do frontend.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Mapeamento do Banco de Dados (Backend)
A equipe deve usar scripts ou leitura profunda para documentar o esquema do banco de dados (tabelas principais, políticas RLS relevantes e RPCs vitais do sistema, como transações financeiras e autenticação).

### R2. Mapeamento do Frontend (React)
A equipe deve analisar o diretório `src/` e documentar a arquitetura visual, destacando os módulos de "Admin", "Cliente", "Fornecedor", "Colaborador", "Afiliado" e "Prestador", bem como as integrações de API.

### R3. Criação do Documento Central
A equipe deve consolidar todas as descobertas e gerar um único artefato chamado `DOCUMENTACAO_SISTEMA.md` na raiz do projeto. O documento deve explicar as regras de negócio exatas do sistema baseado na leitura real do código-fonte.

## Acceptance Criteria

### Verificação do Artefato
- [ ] O arquivo `DOCUMENTACAO_SISTEMA.md` deve existir na raiz do diretório.
- [ ] O documento deve conter seções explícitas para o Banco de Dados (listando tabelas/RPCs) e para o Frontend (listando módulos de usuários).
- [ ] O documento deve ter mais de 100 linhas, comprovando um nível de profundidade analítica condizente com a leitura do código-fonte e não apenas uma sumarização superficial.

## 2026-09-11T11:27:05Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

O usuário solicitou uma revisão focada estritamente na **Performance do Banco de Dados PostgreSQL**. O objetivo é identificar gargalos, queries lentas e falta de índices, aplicando as devidas correções e otimizações (`CREATE INDEX`, refatoração de RPCs) imediatamente no sistema.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Mapeamento de Gargalos (Missing Indexes)
A equipe deve analisar a estrutura do banco de dados para identificar colunas usadas frequentemente em junções (`JOIN`), filtros (`WHERE`) e chaves estrangeiras (`Foreign Keys`) que atualmente não possuem índices B-Tree ou Hash. Foco em tabelas pesadas como `saques`, `faturas`, `tickets`, `pontos_movimentacoes` e `vouchers`.

### R2. Otimização de Queries e RPCs
A equipe deve avaliar as Remote Procedure Calls (RPCs) financeiras e de listagem. Caso existam gargalos de plano de execução (verificáveis via `EXPLAIN ANALYZE`), a equipe deve reescrever as queries para maior eficiência.

### R3. Aplicação das Correções
A equipe deve não apenas gerar um relatório, mas efetivamente criar um script de migração SQL (`.sql`) com todas as otimizações e índices, e aplicá-lo ao banco de dados para ganho imediato de performance.

## Acceptance Criteria

### Artefato de Otimização
- [ ] Um arquivo de migração SQL (ex: `supabase/migrations/xxxx_performance_indexes.sql`) deve ser criado contendo as instruções `CREATE INDEX`.

### Verificação Programática
- [ ] O script SQL gerado deve ser sintaticamente válido e executável no PostgreSQL sem falhas, provando que os índices e refatorações foram aplicados com sucesso.

## 2026-09-15T03:25:13Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval.
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Monitor the nightly autonomous generation of the 15/09 grid until 06:00 AM, instantly fixing any errors that arise to ensure 100% completion.

Working directory: /opt/gsa-tv/

## Requirements

### R1. Continuous Monitoring
Monitor the execution log of `night-production.py` for the 15/09 grid on the VPS.

### R2. Instant Remediation
If any script crashes, fails to render, or hits API limits, immediately write patches or commands to resolve the issue and restart/resume the production.

### R3. Guarantee 06:00 AM Deadline
Ensure that by 05:59 AM, all programs for the 24h schedule of 15/09 are fully synthesized, rendered, and registered in the database.

## Acceptance Criteria

### Production Validation
- [ ] No programs in the schedule are left missing or failed.
- [ ] The `2026-09-15-execution.log` concludes with a full 24h block generated successfully.

## 2026-09-16T11:07:35Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team

Uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Mapeamento da Arquitetura e Matriz de Rastreabilidade
O time deve mapear todas as aplicações, rotas, componentes, funções, APIs, banco de dados e integrações, criando uma matriz de rastreabilidade completa e um grafo de dependências entre os módulos.

### R2. Teste e Validação Exaustiva de UI e Fluxos (Local)
O time deve levantar a aplicação localmente com um banco de dados mockado/local. A equipe deve instalar bibliotecas de testes (como Playwright, Cypress ou Jest) e criar scripts de automação para testar individualmente todos os botões, formulários e elementos clicáveis, bem como executar todos os fluxos completos de ponta a ponta (E2E).

### R3. Teste de APIs, Backend e Banco de Dados
O time deve auditar as operações CRUD de cada entidade, testar todos os endpoints das APIs, e analisar o schema do banco de dados em busca de problemas estruturais ou de performance. O banco local será modificado para criar massa de dados e simular cenários de falha.

### R4. Relatórios e Correções Seguras
Para cada problema encontrado, o time deve investigar a causa raiz antes de corrigir. As correções implementadas devem passar por regressão, e o time entregará relatórios (Matriz de Módulos, Matriz de Conexões) detalhando o status de cada área.

## Acceptance Criteria

### Verificação do Mapeamento
- [ ] O artefato da matriz de rastreabilidade lista cada funcionalidade e sua cadeia completa (Função -> UI -> API -> Banco).

### Verificação de Testes (Programática)
- [ ] Foram criados e executados scripts de automação ou suítes de testes que cobrem os fluxos críticos.
- [ ] Os scripts de teste validam os cenários de falha (erros HTTP, inputs inválidos, timeouts).

### Verificação de Modificações
- [ ] As correções possuem um teste automatizado associado garantindo que o bug não retorne.
- [ ] O relatório final indica explicitamente se cada conexão do sistema foi validada com sucesso ou bloqueada.

## 2026-09-16T11:11:22Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval (Revised Draft)
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team

Uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Inventário e Mapeamento de Cobertura (Não Presumida)
- O time deve realizar um levantamento sistemático e criar um Inventário de Testes detalhando: páginas, rotas, módulos, submódulos, componentes, botões, formulários, modais, tabelas, endpoints, serviços, integrações, webhooks, eventos e entidades do banco.
- Criar um **Grafo de Conexões** explícito mapeando todas as arestas (ex: UI → função → API → Controller → Banco).
- Produzir uma Matriz de Rastreabilidade (ID, Módulo, Rota, Elemento, Teste planejado, Teste executado, Resultado, Evidência, Status).

### R2. Teste e Validação Exaustiva e Prática (Local)
- Levantar a aplicação localmente (banco mockado/local) e executar automações ou interações. Não considerar leitura de código como teste.
- **UI & Formulários:** Testar botões, estados de loading, bloqueio de múltiplos cliques, validações de form (vazios, inválidos, numéricos, datas), success/error handlers e logs do console.
- **CRUD e APIs:** Executar todas as operações CRUD individuais e em sequências (CREATE→READ→UPDATE→DELETE). Testar todos os endpoints (payloads válidos/inválidos, falha na auth, rate limit).
- **Autenticação, Banco e Jobs:** Validar controle de acesso no backend, N+1 queries no DB, integridade referencial, webhooks e idempotência.
- **Responsividade:** Executar smoke tests para Desktop, Tablet e Mobile.

### R3. Relatórios, Evidências e Correções Seguras
- Nenhuma refatoração ou alteração estrutural não justificada deve ser feita.
- Qualquer bug encontrado deve ser reproduzido, ter causa raiz identificada, ser minimamente corrigido e passar por reteste e regressão.
- As conexões, módulos e componentes devem receber o status final explícito: VALIDADO, FALHOU, CORRIGIDO E RETESTADO, BLOQUEADO ou NÃO TESTADO. Jamais fabricar cobertura.
- Entregar um Relatório de Conexões com comprovação de evidências (ex: logs, asserts).

## Acceptance Criteria

### Verificação do Mapeamento e Conexões
- [ ] O Inventário de Testes e a Matriz de Conexões (Arestas) foram criados catalogando todo o escopo descoberto.
- [ ] Cada aresta/conexão documentada possui um status final e uma evidência verificável (nome do teste, request, log, etc.).

### Verificação de Testes (Programática/Evidencial)
- [ ] Os fluxos, componentes de UI, endpoints, banco e relacionamentos possuem testes concretos que verificam não apenas o happy path, mas os corner cases e fluxos de exceção.
- [ ] Nenhum elemento foi marcado como "VALIDADO" baseado apenas em inspeção estática ou de código.

### Verificação de Finalização (Métricas)
- [ ] O sistema apresenta métricas finais absolutas: Totais descobertos (módulos, páginas, formulários, endpoints, conexões) separados quantitativamente por seus status (Validados, Falharam, Não Testados, etc).
- [ ] A porcentagem de cobertura operacional e a justificativa para tudo que foi bloqueado/não testado estão explícitas.

## 2026-09-16T11:15:31Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval (Final Strict Draft)
> Goal: Craft prompt → delegate to teamwork_preview
> Requested team: Full team

Uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Inventário de Cobertura e Baseline
- O time deve mapear o escopo total (módulos, páginas, endpoints, botões, tabelas, etc) e registrar o **Baseline Inicial** (erros de lint, TS, build, testes passando/falhando) antes de qualquer alteração.
- O time deve construir um **Grafo de Conexões** e testar a comunicação entre cada aresta (UI→Handler→Service→API→DB).

### R2. Teste Dinâmico Obrigatório (Isolado e Fluxo Completo)
- A equipe deve maximizar a execução de testes dinâmicos (positivos e negativos). O status "NÃO TESTADO" só é aceito com justificativa técnica concreta de bloqueio.
- Realizar validação de Persistência Real (recarregar página, checar banco local) e Propagação (Dado inserido em A aparece em B e no Dashboard).
- Executar testes de jornada E2E completos e testar ativamente cenários negativos (acesso negado, inputs inválidos, double-click, timeouts).

### R3. Ciclo de Correção Seguro e Segunda Varredura
- A correção de bugs deve seguir estritamente o ciclo: Identificar → Reproduzir → Escrever Teste → Identificar Causa → Corrigir → Retestar → Regressão. Nenhuma regressão pode ser introduzida.
- Após as correções iniciais, o time deve executar uma **Segunda Varredura** para caçar código órfão, novas regressões, ou falhas indiretas causadas pelas mudanças.

### R4. Relatório de Bugs e Métricas Finais Absolutas
- Entregar um Relatório de Bugs detalhado (Severidade, Passos para Reproduzir, Causa, Fix, Reteste).
- Produzir Métricas Finais com números absolutos do inventário vs. o que foi testado, falhou, foi corrigido, bloqueado ou não testado. Jamais fabricar 100% de cobertura.

## Acceptance Criteria

### Verificação do Baseline e Conexões
- [ ] O Relatório de Baseline documenta todos os problemas preexistentes do sistema (lint, TS, exceptions conhecidas).
- [ ] O Grafo de Conexões foi transformado em matriz de testes onde cada aresta possui uma tentativa de validação dinâmica com evidência (ou justificativa clara documentada).

### Verificação de Testes e Segunda Varredura
- [ ] Cenários E2E, testes de persistência real e validação de propagação inter-módulos possuem evidências concretas.
- [ ] A Segunda Varredura (após a primeira onda de correções) foi explicitamente executada e o inventário reconciliado.

### Verificação de Modificações e Encerramento
- [ ] As correções possuem rastreabilidade desde a reprodução do bug até o sucesso no reteste da mesma regressão.
- [ ] O Relatório Quantitativo Final foi apresentado refletindo perfeitamente a realidade sem inflar cobertura.

## 2026-09-16T11:18:52Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval (Approved & Ultimate Draft)
> Goal: Craft prompt → delegate to teamwork_preview
> Requested team: Full team

Uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Inventário de Cobertura e Baseline
- Mapear escopo total (módulos, páginas, endpoints, botões, tabelas, etc). Construir **Grafo de Conexões** e testar comunicação (UI→Handler→Service→API→DB).
- Registrar **Baseline Inicial** (erros de lint, TS, build, testes passando/falhando) antes de qualquer alteração.
- Diferenciar explicitamente os status: DESCOBERTO, ANALISADO ESTATICAMENTE, TESTADO DINAMICAMENTE, VALIDADO, CORRIGIDO E RETESTADO, BLOQUEADO, NÃO TESTADO.

### R2. Teste Dinâmico e Preservação do Sistema
- Maximizar testes dinâmicos (positivos e negativos), Persistência Real e Propagação (A→B).
- **Proibido Mascarar Falhas e Simplificar Sistema**: Não remover assertions, não silenciar erros/exceptions, não usar retornos estáticos apenas para passar testes. Mocks não podem alterar indevidamente o comportamento real. Não executar operações destrutivas em produção.

### R3. Ciclo de Correção Seguro, Regressão e Segunda Varredura
- Ciclo obrigatório: Identificar → Reproduzir → Escrever Teste → Causa Raiz → Corrigir → Retestar → Regressão.
- **Não parar no primeiro verde**: Após a suíte ficar verde, reexecutar build/typecheck/lint, fazer **Segunda Varredura**, reconciliar inventário e verificar novamente o grafo de conexões. Nenhuma regressão indireta é permitida.

### R4. Entregáveis Finais Obrigatórios
- Produzir obrigatoriamente a seguinte lista de artefatos: BASELINE_INICIAL, INVENTARIO_COMPLETO, MATRIZ_RASTREABILIDADE, GRAFO_CONEXOES, MATRIZ_TESTES_CONEXOES, RELATORIO_TESTES_UI, RELATORIO_TESTES_API, RELATORIO_BANCO, RELATORIO_E2E, RELATORIO_BUGS, RELATORIO_CORRECOES, RELATORIO_REGRESSAO, SEGUNDA_VARREDURA, PENDENCIAS_E_BLOQUEIOS, METRICAS_FINAIS, RELATORIO_FINAL_AUDITORIA.
- O relatório final consolidará os números absolutos de itens descobertos vs. validados.

## Acceptance Criteria

### Verificação do Baseline e Conexões
- [ ] O Relatório de Baseline documenta todos os problemas preexistentes (lint, TS, exceptions) e o Grafo de Conexões possui tentativas documentadas para cada aresta.
- [ ] O status "VALIDADO" só foi aplicado onde há evidência de teste dinâmico correspondente.

### Verificação de Testes e Segunda Varredura
- [ ] Nenhuma funcionalidade ou validação foi "mascarada", removida ou silenciada para fingir sucesso.
- [ ] A Segunda Varredura e a regressão final (incluindo lint/typecheck) estão documentadas e não apresentam novas regressões.

### Verificação de Modificações e Encerramento
- [ ] Todos os 16 relatórios entregáveis obrigatórios foram produzidos.
- [ ] O Relatório Quantitativo Final apresenta métricas exatas (X descobertos vs Y testados, Z bloqueados), sem falsas alegações de 100% de cobertura.

## 2026-09-16T11:21:20Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval (Approved & Ultimate Draft)
> Goal: Craft prompt → delegate to teamwork_preview
> Requested team: Full team

Uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Inventário de Cobertura e Baseline
- Mapear escopo total (módulos, páginas, endpoints, botões, tabelas, etc). Construir **Grafo de Conexões** e testar comunicação (UI→Handler→Service→API→DB).
- Registrar **Baseline Inicial** (erros de lint, TS, build, testes passando/falhando) antes de qualquer alteração.
- Diferenciar explicitamente os status: DESCOBERTO, ANALISADO ESTATICAMENTE, TESTADO DINAMICAMENTE, VALIDADO, CORRIGIDO E RETESTADO, BLOQUEADO, NÃO TESTADO.

### R2. Teste Dinâmico e Preservação do Sistema
- Maximizar testes dinâmicos (positivos e negativos), Persistência Real e Propagação (A→B).
- **Proibido Mascarar Falhas e Simplificar Sistema**: Não remover assertions, não silenciar erros/exceptions, não usar retornos estáticos apenas para passar testes. Mocks não podem alterar indevidamente o comportamento real. Não executar operações destrutivas em produção.

### R3. Ciclo de Correção Seguro, Regressão e Segunda Varredura
- Ciclo obrigatório: Identificar → Reproduzir → Escrever Teste → Causa Raiz → Corrigir → Retestar → Regressão.
- **Não parar no primeiro verde**: Após a suíte ficar verde, reexecutar build/typecheck/lint, fazer **Segunda Varredura**, reconciliar inventário e verificar novamente o grafo de conexões. Nenhuma regressão indireta é permitida.

### R4. Entregáveis Finais Obrigatórios
- Produzir obrigatoriamente a seguinte lista de artefatos: BASELINE_INICIAL, INVENTARIO_COMPLETO, MATRIZ_RASTREABILIDADE, GRAFO_CONEXOES, MATRIZ_TESTES_CONEXOES, RELATORIO_TESTES_UI, RELATORIO_TESTES_API, RELATORIO_BANCO, RELATORIO_E2E, RELATORIO_BUGS, RELATORIO_CORRECOES, RELATORIO_REGRESSAO, SEGUNDA_VARREDURA, PENDENCIAS_E_BLOQUEIOS, METRICAS_FINAIS, RELATORIO_FINAL_AUDITORIA.
- O relatório final consolidará os números absolutos de itens descobertos vs. validados.

## Prioridades Máximas (Regras de Ouro)
1. Preservar o comportamento e a arquitetura funcional existente.
2. Estabelecer o baseline antes de qualquer correção.
3. Inventariar sistematicamente o sistema antes de alegar cobertura.
4. Testar dinamicamente as funcionalidades sempre que tecnicamente possível.
5. Validar não apenas os módulos, mas principalmente as conexões/arestas entre eles.
6. Comprovar persistência e propagação de dados entre módulos.
7. Corrigir somente após reprodução e identificação da causa raiz.
8. Retestar cada correção e executar regressão das dependências afetadas.
9. Executar obrigatoriamente a Segunda Varredura após a primeira rodada de correções.
10. Entregar todos os 16 artefatos definidos no plano.
11. Não fabricar cobertura nem utilizar "VALIDADO" sem evidência correspondente.
12. Documentar explicitamente qualquer BLOQUEADO ou NÃO TESTADO e a razão técnica.
13. O relatório final DEVE reconciliar matematicamente o inventário para as categorias principais (módulos, páginas/rotas, componentes, forms, endpoints, entidades, integrações, arestas).

## Acceptance Criteria

### Verificação do Baseline e Conexões
- [ ] O Relatório de Baseline documenta todos os problemas preexistentes (lint, TS, exceptions) e o Grafo de Conexões possui tentativas documentadas para cada aresta.
- [ ] O status "VALIDADO" só foi aplicado onde há evidência de teste dinâmico correspondente.

### Verificação de Testes e Segunda Varredura
- [ ] Nenhuma funcionalidade ou validação foi "mascarada", removida ou silenciada para fingir sucesso.
- [ ] A Segunda Varredura e a regressão final (incluindo lint/typecheck) estão documentadas e não apresentam novas regressões.

### Verificação de Modificações e Encerramento
- [ ] Todos os 16 relatórios entregáveis obrigatórios foram produzidos.
- [ ] O Relatório Quantitativo Final apresenta métricas exatas e reconciliadas matematicamente (X descobertos vs Y testados, Z bloqueados), sem falsas alegações de 100% de cobertura.

## 2026-09-16T14:01:09Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → delegate to teamwork_preview
> Requested team: Full team

Uma auditoria técnica profunda, end-to-end (frontend, backend, banco de dados, APIs), validando e testando cada conexão, fluxo, formulário e componente do sistema.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Inventário de Cobertura e Baseline
- Mapear escopo total (módulos, páginas, endpoints, botões, tabelas, etc). Construir **Grafo de Conexões** e testar comunicação (UI→Handler→Service→API→DB).
- Registrar **Baseline Inicial** (erros de lint, TS, build, testes passando/falhando) antes de qualquer alteração.
- Diferenciar explicitamente os status: DESCOBERTO, ANALISADO ESTATICAMENTE, TESTADO DINAMICAMENTE, VALIDADO, CORRIGIDO E RETESTADO, BLOQUEADO, NÃO TESTADO.

### R2. Teste Dinâmico e Preservação do Sistema
- Maximizar testes dinâmicos (positivos e negativos), Persistência Real e Propagação (A→B).
- **Proibido Mascarar Falhas e Simplificar Sistema**: Não remover assertions, não silenciar erros/exceptions, não usar retornos estáticos apenas para passar testes. Mocks não podem alterar indevidamente o comportamento real. Não executar operações destrutivas em produção.

### R3. Ciclo de Correção Seguro, Regressão e Segunda Varredura
- Ciclo obrigatório: Identificar → Reproduzir → Escrever Teste → Causa Raiz → Corrigir → Retestar → Regressão.
- **Não parar no primeiro verde**: Após a suíte ficar verde, reexecutar build/typecheck/lint, fazer **Segunda Varredura**, reconciliar inventário e verificar novamente o grafo de conexões. Nenhuma regressão indireta é permitida.

### R4. Entregáveis Finais Obrigatórios
- Produzir obrigatoriamente a seguinte lista de artefatos: BASELINE_INICIAL, INVENTARIO_COMPLETO, MATRIZ_RASTREABILIDADE, GRAFO_CONEXOES, MATRIZ_TESTES_CONEXOES, RELATORIO_TESTES_UI, RELATORIO_TESTES_API, RELATORIO_BANCO, RELATORIO_E2E, RELATORIO_BUGS, RELATORIO_CORRECOES, RELATORIO_REGRESSAO, SEGUNDA_VARREDURA, PENDENCIAS_E_BLOQUEIOS, METRICAS_FINAIS, RELATORIO_FINAL_AUDITORIA.
- O relatório final consolidará os números absolutos de itens descobertos vs. validados.

## Prioridades Máximas (Regras de Ouro)
1. Preservar o comportamento e a arquitetura funcional existente.
2. Estabelecer o baseline antes de qualquer correção.
3. Inventariar sistematicamente o sistema antes de alegar cobertura.
4. Testar dinamicamente as funcionalidades sempre que tecnicamente possível.
5. Validar não apenas os módulos, mas principalmente as conexões/arestas entre eles.
6. Comprovar persistência e propagação de dados entre módulos.
7. Corrigir somente após reprodução e identificação da causa raiz.
8. Retestar cada correção e executar regressão das dependências afetadas.
9. Executar obrigatoriamente a Segunda Varredura após a primeira rodada de correções.
10. Entregar todos os 16 artefatos definidos no plano.
11. Não fabricar cobertura nem utilizar "VALIDADO" sem evidência correspondente.
12. Documentar explicitamente qualquer BLOQUEADO ou NÃO TESTADO e a razão técnica.
13. O relatório final DEVE reconciliar matematicamente o inventário para as categorias principais (módulos, páginas/rotas, componentes, forms, endpoints, entidades, integrações, arestas).

## Acceptance Criteria

### Verificação do Baseline e Conexões
- [ ] O Relatório de Baseline documenta todos os problemas preexistentes (lint, TS, exceptions) e o Grafo de Conexões possui tentativas documentadas para cada aresta.
- [ ] O status "VALIDADO" só foi aplicado onde há evidência de teste dinâmico correspondente.

### Verificação de Testes e Segunda Varredura
- [ ] Nenhuma funcionalidade ou validação foi "mascarada", removida ou silenciada para fingir sucesso.
- [ ] A Segunda Varredura e a regressão final (incluindo lint/typecheck) estão documentadas e não apresentam novas regressões.

### Verificação de Modificações e Encerramento
- [ ] Todos os 16 relatórios entregáveis obrigatórios foram produzidos.
- [ ] O Relatório Quantitativo Final apresenta métricas exatas e reconciliadas matematicamente (X descobertos vs Y testados, Z bloqueados), sem falsas alegações de 100% de cobertura.

## 2026-09-16T16:21:01Z

# Teamwork Project Prompt — Remediação de Cobertura da Auditoria

> Status: Launched
> Goal: Executar a fase de Remediação de Cobertura da Auditoria.
> Requested team: Full team

Trata-se de uma fase de REMEDIAÇÃO DE COBERTURA para o sistema GSA HUB. O inventário do M1 é a base, mas o objetivo agora é desbloquear e executar os testes que foram marcados como "bloqueados" por falta de ambiente isolado (Staging/Local). 

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Provisionamento de Infraestrutura Isolada (Local)
- **Supabase Local**: Provisionar e inicializar um ambiente Supabase local (`supabase start`, `supabase db reset --local`). Proibido usar dados de produção.
- **Seed Determinístico**: Criar scripts de seed SQL contendo dados suficientes para representar todas as identidades das jornadas (cliente, admin/colaborador, prestador, fornecedor, afiliado, parceiro) e suas entidades relacionadas (produtos, carrinho, pedidos, OS/demandas, agenda, fidelidade, cupons, etc).
- **Serviços Backend Locais**: Levantar as Edge Functions localmente (`supabase functions serve`) e o webhook (`node server_webhook.cjs`) sempre que tecnicamente possível.
- **Integrações Externas**: Configurar sandboxes, mocks ou contract tests para APIs pagas/de terceiros para evitar custos e side-effects, enquanto APIs read-only públicas devem ser testadas dinamicamente.

### R2. Execução Dinâmica Completa (100% E2E e Arestas)
- Re-executar as 6 Jornadas E2E (E2E-01 a E2E-06) de ponta a ponta utilizando **exclusivamente o ambiente local**. Não utilizar dados da produção (ex: CPFs reais).
- Testar dinamicamente todas as 80 arestas do `GRAFO_CONEXOES`. Cada aresta deve ter status individual suportado por evidência (log/asserção).
- Testar CRUDs, persistência real no banco de dados local e **propagação entre módulos** (verificar se as alterações de um módulo aparecem no consumidor).
- Manter RLS habilitado no ambiente local e testar as permissões positivas e negativas com os diferentes usuários do seed.

### R3. Taxonomia e Classificação Estrita
- Estabelecer e usar estritamente uma **ÚNICA TAXONOMIA** em todos os relatórios:
  - DESCOBERTO
  - ANALISADO ESTATICAMENTE
  - EXECUTADO DINAMICAMENTE — PASSOU
  - EXECUTADO DINAMICAMENTE — FALHOU
  - CORRIGIDO E RETESTADO
  - BLOQUEADO
  - NÃO TESTADO
- `test.skip` é obrigatoriamente `BLOQUEADO` ou `NÃO TESTADO`. Jamais reportar como "testado dinamicamente".
- Um item não pode mudar de categoria entre relatórios sem explicação técnica explícita.
- Separar claramente na classificação de problemas: `BUG DO SISTEMA`, `BUG DA SUÍTE DE TESTE`, `PROBLEMA DE INFRAESTRUTURA`, e `DESCOBERTA ARQUITETURAL`.
- Corrigir a contabilização dos BUG-001 a BUG-006 antigos, que eram BUG DA SUÍTE DE TESTE.

### R4. Geração Consistente dos Relatórios Finais
- Produzir/Atualizar os seguintes 9 artefatos na raiz do projeto (resolvendo todas as inconsistências quantitativas entre eles):
  1. `MATRIZ_TESTES_CONEXOES.md`
  2. `RELATORIO_E2E.md`
  3. `RELATORIO_TESTES_API.md`
  4. `RELATORIO_BANCO.md`
  5. `RELATORIO_REGRESSAO.md`
  6. `SEGUNDA_VARREDURA.md`
  7. `PENDENCIAS_E_BLOQUEIOS.md`
  8. `METRICAS_FINAIS.md`
  9. `RELATORIO_FINAL_AUDITORIA.md`

## Acceptance Criteria

### Verificação da Infraestrutura e Seed
- [ ] O Supabase local está em execução e um script de seed SQL foi aplicado com sucesso antes dos testes.
- [ ] As Edge Functions estão servidas localmente e testadas via request/response local.

### Verificação dos Testes Dinâmicos
- [ ] Todas as 6 jornadas (E2E-01 a E2E-06) foram executadas e possuem evidências de interação, sem usar banco de produção.
- [ ] As 80 arestas do grafo possuem tentativa concreta de teste dinâmico registrada.

### Verificação de Integridade dos Artefatos
- [ ] A taxonomia unificada foi aplicada rigorosamente em todos os relatórios.
- [ ] A reconciliação matemática está perfeita entre todos os relatórios (soma de itens testados, bloqueados e analisados bate exatamente com o inventário original sem conflitos).
- [ ] Bugs da suíte de testes E2E estão classificados como `BUG DA SUÍTE DE TESTE` e não como bugs do GSA HUB.

## 2026-09-16T16:52:43Z

# Teamwork Project Prompt — Remediação de Cobertura da Auditoria

> Status: Launched
> Goal: Executar a fase de Remediação de Cobertura da Auditoria em ambiente 100% isolado.
> Requested team: Full team

Trata-se de uma fase de REMEDIAÇÃO DE COBERTURA MASSIVA para o sistema GSA HUB. O objetivo não é apenas desbloquear as 6 jornadas e 80 arestas, mas maximizar a conversão de todos os 1.643 itens do inventário (anteriormente em análise estática) para execução dinâmica em um laboratório isolado.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Bloqueio Absoluto de Produção e Infraestrutura Isolada
- **PREFLIGHT AUTOMÁTICO DE ISOLAMENTO**: Criar script executável obrigatório anterior aos testes. A suíte DEVE abortar (exit code != 0) se detectar: URL Supabase de prod, project ref de prod, banco remoto, service role prod, endpoints VPS de prod não autorizados, ou integrações de prod sem sandbox. A saída do preflight deve constar na evidência.
- O frontend utilizado nos testes DEVE apontar explicitamente para o Supabase local.
- **Supabase Local & Seed**: Provisionar `supabase start`, `supabase db reset --local`. O seed DEVE ser determinístico, conter identidades completas (cliente, admin, prestador, afiliado) e entidades relacionadas. O ambiente DEVE poder ser destruído e recriado limpo.

### R2. Cobertura Dinâmica Massiva além das Jornadas
- Não limitar a remediação às 6 jornadas E2E e 80 arestas. Criar cobertura dinâmica para o inventário total: 72 rotas, 54 forms, 118 botões, 48 modais, 42 grids, 294 tabelas, 692 RPCs, 186 RLS, 17 Edge Functions, 15 Webhooks, 10 APIs.
- O objetivo central é reduzir ao mínimo a coluna "ANALISADO ESTATICAMENTE SOMENTE".
- **EVIDÊNCIA RASTREÁVEL POR ID**: Para cada item do inventário, o relatório deve apontar o ID exato (Ex: RLS-001 -> TEST-X). Totais sem rastreabilidade individual não contam. 

### R3. Profundidade das Validações Dinâmicas (Banco, UI e APIs)
- **COBERTURA RPC/RLS/TABELA ITEM A ITEM**: A cobertura no backend não pode ser inferida por uma jornada passando. Deve registrar: ID, Teste, Cenário, Identidade, Resultado, Evidência e Status. RPC testado = RPC foi chamada e o banco comprova os efeitos (incluindo falhas intencionais). RLS testado = política e operação correspondente exercitadas explicitamente.
- **RLS Habilitado**: NUNCA desabilitar o RLS. Testar PERMITIDO, NEGADO (não autorizado ou acessando dados cruzados) e ANÔNIMO.
- **UI Completa**: Testar interação, persistência, erro/sucesso, e propagação entre módulos.
- **Integrações e Edge Functions**: Levantar `functions serve` e `server_webhook.cjs` localmente. Para mocks, incluir **Testes de Falha** (timeout, HTTP 400, 401, 403, 404, 429, 500, etc).

### R4. Taxonomia Única e Relatórios Reconciliados
- Utilizar estritamente: DESCOBERTO, ANALISADO ESTATICAMENTE SOMENTE, EXECUTADO DINAMICAMENTE — PASSOU, EXECUTADO DINAMICAMENTE — FALHOU, CORRIGIDO E RETESTADO, BLOQUEADO, NÃO TESTADO. `test.skip` é obrigatoriamente BLOQUEADO ou NÃO TESTADO.
- Separar causas: BUG DO SISTEMA, BUG DA SUÍTE DE TESTE, PROBLEMA DE INFRAESTRUTURA, DESCOBERTA ARQUITETURAL.
- Produzir 9 artefatos perfeitamente reconciliados e idênticos em números: MATRIZ_TESTES_CONEXOES, RELATORIO_E2E, RELATORIO_TESTES_API, RELATORIO_BANCO, RELATORIO_REGRESSAO, SEGUNDA_VARREDURA, PENDENCIAS_E_BLOQUEIOS, METRICAS_FINAIS, RELATORIO_FINAL_AUDITORIA.
- **Métricas Separadas**: COBERTURA DE INVENTÁRIO (itens com classificação) vs COBERTURA DINÂMICA (efetivamente exercitados). 

## Acceptance Criteria

### Integridade do Ambiente e Seed
- [ ] Preflight automático criado e atestando exit code 0 antes de cada bateria. Saída incluída nos relatórios.
- [ ] Supabase local e seed determinístico recriados pelo menos duas vezes com sucesso e consistência.

### Execução e Cobertura Dinâmica
- [ ] Rastreabilidade ITEM A ITEM (ID do Inventário -> ID do Teste e Evidência) provada para RLS, RPCs, Edge Functions, Rotas, etc. Nenhuma inferência genérica.
- [ ] Validação profunda: Testes de Falha (HTTP errors simulados), limites RLS (cruzamento de usuários), CRUDs transacionais provando propagação.

### Reconciliação e Artefatos Finais
- [ ] 9 Artefatos gerados com taxonomia única inalterável.
- [ ] Relatório Final exibe reconciliação idêntica entre o inventário total e a taxonomia final.
- [ ] Totais no relatório final podem ser validados individualmente mapeando IDs para testes.

## 2026-09-16T17:03:11Z

# Teamwork Project Prompt — Remediação de Cobertura da Auditoria

> Status: Launched
> Goal: Executar a fase de Remediação de Cobertura da Auditoria em ambiente 100% isolado.
> Requested team: Full team

Trata-se de uma fase de REMEDIAÇÃO DE COBERTURA MASSIVA para o sistema GSA HUB. O objetivo não é apenas desbloquear as 6 jornadas e 80 arestas, mas maximizar a conversão de todos os 1.643 itens do inventário (anteriormente em análise estática) para execução dinâmica em um laboratório isolado.

Working directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)
Integrity mode: benchmark

## Requirements

### R1. Bloqueio Absoluto de Produção e Infraestrutura Isolada
- **PREFLIGHT AUTOMÁTICO DE ISOLAMENTO**: Criar script executável obrigatório anterior aos testes. A suíte DEVE abortar (exit code != 0) se detectar: URL Supabase de prod, project ref de prod, banco remoto, service role prod, endpoints VPS de prod não autorizados, ou integrações de prod sem sandbox. A saída do preflight deve constar na evidência.
- O frontend utilizado nos testes DEVE apontar explicitamente para o Supabase local.
- **Supabase Local & Seed Determinístico**: Provisionar `supabase start`, `supabase db reset --local`. O seed DEVE possuir, no mínimo, as identidades de: cliente; administrador/colaborador; prestador; fornecedor; afiliado; parceiro (e quaisquer outras necessárias para RLS/RBAC/fluxos inter-módulos). Cada identidade deve possuir dados e relacionamentos determinísticos suficientes para executar fluxos completos (OS, estoque, pontos, fidelidade, etc). O ambiente deve ser reproduzível via script.

### R2. Cobertura Dinâmica Massiva e Rastreabilidade por ID
- O **INVENTÁRIO DE ITENS é estritamente 1.643**: (294 tabelas; 692 RPCs; 186 RLS; 80 arestas; 17 Edge Functions; 15 Webhooks; 10 APIs; 72 rotas; 54 forms; 118 botões; 15 módulos; 42 grids; 48 modais).
- As **6 Jornadas E2E** são cenários de validação transversal e NÃO somam no denominador de 1.643 itens.
- **EVIDÊNCIA RASTREÁVEL POR ID**: Para cada um dos 1.643 itens do inventário, o relatório deve apontar o ID exato (Ex: RLS-001 -> TEST-X). Totais sem rastreabilidade individual não contam. 

### R3. Profundidade das Validações Dinâmicas (Banco, UI e APIs)
- **COBERTURA RPC/RLS/TABELA ITEM A ITEM**: A cobertura no backend não pode ser inferida. Deve registrar: ID, Teste, Cenário, Identidade, Resultado, Evidência e Status. RPC testada requer comprovação de efeitos (incluindo falhas intencionais). RLS testado = política explícita exercitada.
- **RLS Habilitado**: NUNCA desabilitar o RLS. Testar PERMITIDO, NEGADO e ANÔNIMO.
- **UI Completa**: Testar interação, persistência, erro/sucesso, e propagação.
- **Integrações e Edge Functions**: Levantar `functions serve` e `server_webhook.cjs` localmente. Para mocks, incluir **Testes de Falha** (HTTP 400, 401, 404, 429, 500, etc).

### R4. Taxonomia Única e Relatórios Reconciliados
- Utilizar estritamente UM ÚNICO STATUS FINAL para cada um dos 1.643 itens: ANALISADO ESTATICAMENTE SOMENTE, EXECUTADO DINAMICAMENTE — PASSOU, EXECUTADO DINAMICAMENTE — FALHOU, CORRIGIDO E RETESTADO, BLOQUEADO, ou NÃO TESTADO. (`DESCOBERTO` não é status final de auditoria).
- A **EQUAÇÃO OBRIGATÓRIA** será: 1.643 = Soma exata dos 6 status finais acima (sem duplicidade de IDs).
- Separar causas de falhas: BUG DO SISTEMA, BUG DA SUÍTE DE TESTE, PROBLEMA DE INFRAESTRUTURA, DESCOBERTA ARQUITETURAL.
- Produzir 9 artefatos perfeitamente reconciliados e idênticos em números (MATRIZ, E2E, API, BANCO, REGRESSAO, VARREDURA, BLOQUEIOS, METRICAS, FINAL_AUDITORIA).

## Acceptance Criteria

### Integridade do Ambiente e Seed
- [ ] Preflight automático criado e atestando exit code 0 antes de cada bateria. Saída incluída nos relatórios.
- [ ] Supabase local e seed determinístico (com TODAS as identidades) recriados limpos pelo menos duas vezes.

### Execução e Cobertura Dinâmica
- [ ] As 3 métricas de cobertura são apresentadas e tratadas SEPARADAMENTE, sem mesclá-las:
      1) **JORNADAS**: X/6 executadas ponta a ponta.
      2) **ARESTAS**: Y/80 com tentativa dinâmica individual.
      3) **INVENTÁRIO**: Z/1.643 itens efetivamente exercitados dinamicamente.
- [ ] Rastreabilidade ITEM A ITEM (ID -> Teste -> Evidência) provada. Nenhuma inferência genérica.

### Reconciliação e Artefatos Finais
- [ ] A equação final do inventário (1.643 = Soma de 6 status) é matematicamente exata e sem o uso do termo 'DESCOBERTO' nos numerais de fechamento.
- [ ] 9 Artefatos gerados com taxonomia única inalterável.

## 2026-09-19T19:10:56Z

Use a very large team of agents. Migração nativa e completa do ERP Web GSA (React/Supabase, 50+ módulos) para o aplicativo móvel (React Native/Expo), replicando 100% das funcionalidades operacionais, regras de negócio e fluxos de banco de dados.

Working directory: gsa-admin-mobile
Integrity mode: development

## Requirements

### R1. Functional Parity
Replicate the operational logic of all 50+ web modules (from `../src/components/admin/`) natively in the React Native project. This includes data fetching, insertions, RPC bypassing, and module routing.

### R2. Mobile UX Adaptation
Intelligently adapt desktop-centric UI patterns (large tables, massive forms) into mobile-friendly Native views. The team is free to decide the best UX approach per module (e.g., cards, horizontal scrolls, modals).

### R3. Data Constraint Preservation
Ensure all Supabase updates respect the existing constraints, triggers, and ENUM rules established in the original Postgres database (e.g., wallet limits, status enums).

## Acceptance Criteria

### Coverage & Routing
- [ ] Programmatic script confirms that for every `.tsx` component found in the web `src/components/admin/` folder, a corresponding React Native screen exists and is correctly routed in `App.tsx`.

### Stability & Build
- [ ] TypeScript compilation (`npx tsc --noEmit`) passes with exit code 0 inside the `gsa-admin-mobile` directory.

### UX Adaptation (Agent-as-Judge)
- [ ] An independent reviewer agent confirms against a rubric that no hardcoded large UI elements (like 1000px tables) exist on mobile screens, ensuring proper responsive or card-based patterns.
