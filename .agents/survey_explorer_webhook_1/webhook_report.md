# Relatório de Investigação Arquitetural: Webhook WhatsApp & Fluxo de Resgate de Benefícios com IA

**Data/Hora:** 2026-08-27T21:30:00Z  
**Autor:** `survey_explorer_webhook_1`  
**Escopo:** `server_webhook_vps_live.cjs`, `server_webhook.cjs`, `lib/antiBanEngine.cjs`, `src/features/partners/service.ts`, `src/components/public/PartnerBenefitRedeemModal.tsx` e migrações Supabase.

---

## Sumário Executivo

Este relatório apresenta uma análise aprofundada da infraestrutura do Webhook do WhatsApp (Evolution API / Meta API), do mecanismo de NLU com Google Gemini AI e do subsistema de resgate e consulta de benefícios de parceiros (`parceiros` e `parceiros_resgates`). 

O objetivo central é detalhar como a arquitetura atual opera e fornecer a especificação técnica exata para implementar o novo fluxo conversacional de intenção **`resgatar`** diretamente via chat no WhatsApp, garantindo **paridade 100% fiel** com o comportamento da interface web (`PartnerBenefitRedeemModal.tsx` e `redeemPartnerBenefit` em `src/features/partners/service.ts`), incluindo proteção estrita contra duplicidade (com coleta de justificativa e envio em `analise`), busca fuzzy interativa de parceiros no Supabase e entrega imediata de cupons ou roteamento de SLA 24h com alertas administrativos.

---

## 1. Recepção, Parsing e Roteamento de Mensagens de Entrada

### 1.1 Servidor HTTP e Endpoints
O servidor HTTP é instanciado em Node.js nativo (sem dependências externas pesadas) na porta configurada via `PORT` (padrão `5680`):
- **Arquivo de Produção:** `server_webhook_vps_live.cjs` (e espelho `server_webhook.cjs`).
- **Verificação do Webhook (GET `/webhook`):**
  - Valida os parâmetros `hub.mode === 'subscribe'` e `hub.verify_token === VERIFY_TOKEN`.
  - Responde imediatamente com o `hub.challenge` em texto plano com status 200 em caso de sucesso ou 403 Forbidden se inválido.
- **Ingresso de Mensagens (POST `/webhook`):**
  - **Não-bloqueante:** O servidor responde **imediatamente HTTP 200** (`{ status: 'ok' }`) ao chamador (Evolution API ou Meta API) antes de disparar o pipeline assíncrono. Isso previne estouros de timeout do webhook e reenvios indesejados.
  - **Sub-roteamento de Webhooks Especializados:**
    - `/webhook/supabase-update`: Encaminha para `handleSupabaseWebhook(req, res, body)` para eventos de banco de dados.
    - `/webhook/gsa-produtos-scraping`, `/webhook/gsa-viagens-scraping`, `/webhook/scraping`: Encaminha para `handleProductScraping(body)`.
    - `/webhook`: Fluxo principal de mensagens do WhatsApp.

### 1.2 Parsing do Payload Evolution API vs Meta API
A função de parsing identifica o formato recebido:

1. **Evolution API (`data.data && data.data.key`):**
   - **Filtro de Eco/Próprio Bot:** `if (data.data.key.fromMe) return;` — descarta mensagens enviadas pelo próprio número.
   - **Filtro de Eventos de Mensagem:** `if (data.event && data.event !== 'messages.upsert') return;` — ignora atualizações de status de entrega (`delivery`, `read`).
   - **Extração de JID / LID e Telefone:**
     - Trata identificadores `@lid` (WhatsApp Linked ID), `@s.whatsapp.net` e identificadores alternativos (`remoteJidAlt`, `participant`).
     - Normaliza o telefone do remetente (`fromPhone`) removendo caracteres não numéricos e prefixos indesejados.
     - **Registro de Contexto:** Chama `antiBanEngine.registerContactContext(fromPhone, actualTargetJid, data.data.key)` para vincular o telefone ao JID/LID correto para respostas subsequentes.
   - **Extração do Nome de Exibição:** `pushName = data.data.pushName || data.data.key?.pushName || ''`.
   - **Detecção de Tipos de Mídia:**
     - `imageMessage`: `mediaType = 'image'`, extrai `caption` ou `jpegThumbnail`/base64.
     - `audioMessage` / `pttMessage`: `mediaType = 'audio'`.
     - `videoMessage`: `mediaType = 'video'`.
     - `documentMessage`: `mediaType = 'document'`.
     - Mensagem de texto simples/estendida: `data.data.message.conversation || data.data.message.extendedTextMessage?.text`.

2. **Meta Cloud API (`data.entry[0].changes[0].value.messages[0]`):**
   - Extrai `from` (telefone) e `text.body`.

### 1.3 Pipeline de Processamento (`processMessage`)
A função `processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData)` orquestra:
1. **Comandos Administrativos de Atendente:** `#responder <telefone> <msg>` e `#encerrar <telefone>` (transbordo humano reverso).
2. **Sessão do Usuário:** Recupera ou instancia `userSessions[fromPhone] = { state: 'MAIN_MENU', errors: 0 }`.
3. **Mídias Especiais:** Transcrição de áudio via Gemini Flash (`handleAudioMessage`), busca visual por imagem via Gemini Vision (`handleImageProductSearch`) ou upload de documentos anexos.
4. **Captura de Nome Real:** Processa `pushName` validando se é um nome de pessoa para atualizar `session.clientName` e `session.clientFullName`.
5. **Interceptação de Protocolos (`PROT-RES-...`):** Regex `/b(PROT[-_]RES[-_]\d{4}[-_][A-Z0-9]{6}|PROT[-_]RES[-_][A-Z0-9]{6,10})\b/i`. Se presente ou se `session.state.startsWith('PROTOCOL_')`, desvia para `handleProtocolSelfServiceFlow`.
6. **Interceptação Global Conversacional:** Se o texto for natural (não sendo opção numérica pura de menu), dispara consulta ao catálogo de serviços e chama o assistente IA `callGSAAssistant`.

---

## 2. Configuração do Gemini AI / NLU, Prompts e Geração de Respostas

### 2.1 Credenciais e Parâmetros do Modelo
- **Chave de API:** `process.env.GEMINI_API_KEY` (com fallback nativo no código).
- **Modelo Utilizado:** `process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'`.
- **Endpoint HTTP Oficial:** `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}` (usando `https.request` nativo sem bibliotecas externas).
- **Parâmetros de Geração:**
  - NLU de Intenções: `temperature: 0.1`, `maxOutputTokens: 500`, `responseMimeType: 'application/json'`.
  - Assistente Geral: `temperature: 0.3`, `maxOutputTokens: 1500`, `responseMimeType: 'application/json'`.
  - Timeouts: 10s para NLU de protocolo; 25s para o assistente geral, com fallback automático em caso de timeout ou erro de rede.

### 2.2 Arquitetura de Prompts e Extração de Intenções

#### A. NLU de Protocolos (`callGeminiProtocolNLU`)
Possui prompt especializado em extrair intenções e entidades estruturadas em JSON estrito:
- **Intenções Reconhecidas:** `alterar`, `cancelar`, `confirmar_cancelamento`, `negar_cancelamento`, `consultar`, `outro`.
- **Entidades Extraídas:** `field` (`nome_completo`, `email`, `telefone`), `new_value` (valor novo extraído da frase) e `raw_entities`.
- **Mecanismo de Fallback Determinístico (`parseProtocolIntentFallback`):**
  - Se a chamada ao Gemini falhar ou exceder 10s, regras regex robustas extraem intenções de sim/não, cancelamento, consulta e padrões de email (`regex`), telefone (DDD + 8/9 dígitos) e nome completo.

#### B. Assistente Geral da Empresa (`callGSAAssistant`)
- Injeta dados cadastrais da empresa (`GSA_EMPRESA`), perfil do cliente identificado, histórico recente das últimas 6 mensagens (`session.history`) e catálogo dinâmico de serviços e produtos (com cache de 5 minutos).
- **Regras Rígidas Injetadas:**
  - Nunca inventar valores nem exibir preços sob consulta (`ocultar_valor = true`).
  - Nunca enviar o cliente para o site para resolver o que pode ser resolvido no WhatsApp.
  - Formatação Markdown nativa do WhatsApp: `*texto em negrito*` (1 asterisco, proibindo `**texto**`), listas com marcadores `•` ou numéricas `1️⃣`.
  - Ações JSON estruturadas: `reply`, `generate_calculator_pdf`, `client_account`, `client_statement`, `client_points`, `client_tickets`, `track_order`, `request_pro_voucher`, `search_service`, `search_product`, `create_ticket`, `menu`.

---

## 3. Gerenciamento do Estado da Conversa (State Machine)

### 3.1 Armazenamento de Sessão em Memória (`userSessions`)
O estado da conversa é mantido no objeto global `userSessions`, indexado pelo número de telefone limpo (`fromPhone`):

```javascript
userSessions[fromPhone] = {
  state: 'MAIN_MENU',                  // Estado atual da FSM
  protocolState: null,                 // Sub-estado do protocolo ('IDENTIFIED', 'AWAITING_FIELD', etc.)
  protocolCode: 'PROT-RES-2026-ABC123',// Código do protocolo ativo
  protocolRecord: { ... },             // Registro completo do banco parceiros_resgates
  targetField: null,                   // Campo sendo alterado ('nome_completo' | 'email' | 'telefone')
  history: [                           // Buffer circular de histórico de diálogo para a IA
    { role: 'user', content: '...' },
    { role: 'assistant', content: '...' }
  ],
  profile: { ... },                    // Cache de papéis do usuário (cliente, afiliado, fornecedor, prestador)
  clientData: { ... },                 // Dados da tabela clientes caso vinculado
  clientName: 'João',                  // Primeiro nome
  clientFullName: 'João da Silva',     // Nome completo
  pushName: 'João Silva',              // Nome informado pelo WhatsApp
  
  // ── Extensões para o fluxo de Resgate de Benefício de Parceiro ──
  redemptionState: null,               // Sub-estado do resgate ('AWAITING_PARTNER', 'CONFIRM_PARTNER', etc.)
  redemptionPartner: null,             // Objeto do parceiro selecionado (tabela parceiros)
  redemptionCandidates: [],            // Lista de parceiros candidatos quando a busca fuzzy traz múltiplos
  redemptionForm: {
    nomeCompleto: '',
    email: '',
    telefone: '',
    justificativa: ''
  },
  awaitingRedemptionField: null        // 'name' | 'email' | 'phone' | 'justification'
};
```

### 3.2 Transições e Resiliência de Navegação
- Digitar `0`, `voltar` ou `anterior` consulta o mapa `STATE_PARENTS[session.state]` para retornar ao menu pai correspondente sem quebrar a sessão.
- Digitar saudações como `oi`, `olá`, `início` reseta o estado para `MAIN_MENU` e exibe o menu principal contextualizado para o perfil do cliente.

---

## 4. Fluxo Existente de Protocolos e Integração da Nova Intenção `resgatar`

### 4.1 Fluxo Existente de Autoatendimento de Protocolos (`PROT-RES-...`)
Atualmente, `handleProtocolSelfServiceFlow`:
1. **Identificação:** Se o usuário envia um protocolo (`PROT-RES-2026-ABC123`), busca o registro em `parceiros_resgates` com relacionamento `parceiros(id,name,slug,logo_url,benefits)`.
2. **Exibição do Card:** Exibe titular, parceiro, email, telefone e status atual (`pendente`, `analise`, `concluido`, `cancelado`, `recusado`).
3. **Ações:**
   - **Alteração Cadastral:** Usuário pode pedir para alterar nome, email ou telefone (em uma frase só como "mudar email para teste@gsa.com" ou passo a passo). Valida os campos (`validateAndSanitizeField`), atualiza o banco com `supabasePatch` e dispara alerta administrativo para o Master (`5511971858372`).
   - **Cancelamento:** Solicita confirmação explícita (`SIM` / `NÃO`), atualiza `status = 'cancelado'`, preenche `data_cancelamento = now()` e dispara alerta administrativo.
   - **Consulta:** Exibe detalhes e motivo de recusa caso rejeitado.

### 4.2 Arquitetura Requerida para a Nova Intenção `resgatar` (Paridade 1:1 com a Web)

O fluxo da Web (`PartnerBenefitRedeemModal.tsx` e `service.ts`) possui regras de negócio essenciais que devem ser replicadas exatamente no WhatsApp:

```
                                  [Usuário diz "quero resgatar benefício da Petlove" / "cupom de desconto"]
                                                                      │
                                                                      ▼
                                                       [Gemini NLU / Intent Router]
                                                                      │
                                                ┌─────────────────────┴─────────────────────┐
                                                ▼                                           ▼
                                    [Termo de Busca Identificado]               [Sem termo ou genérico]
                                                │                                           │
                                                ▼                                           ▼
                                    [Fuzzy Search em parceiros]                 [Exibe categorias/parceiros top]
                                                │
                     ┌──────────────────────────┼──────────────────────────┐
                     ▼                          ▼                          ▼
               [0 matches]                [1 match forte]            [2+ matches]
                     │                          │                          │
                     ▼                          ▼                          ▼
          [Sugere parceiros        [Confirma Parceiro &       [Lista opções numeradas
           próximos ou busca]       Exibe Benefício]           1️⃣, 2️⃣, 3️⃣ para escolha]
                                                │
                                                ▼
                                    [Coleta / Confirmação de Dados]
                                    • Nome Completo (mín. 2 palavras)
                                    • E-mail válido (regex)
                                    • WhatsApp com DDD (10-11 dígitos)
                                                │
                                                ▼
                                   [Verificação de Duplicidade]
                           (checkDuplicateRedemption: mesmo parceiro_id
                                 + mesmo telefone ou email)
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
             [Não Duplicado]                                           [Duplicado]
                     │                                                     │
                     │                                                     ▼
                     │                                         [Solicita Justificativa]
                     │                                         "Você já resgatou este benefício.
                     │                                          Para solicitar novamente, por favor
                     │                                          digite o motivo/justificativa:"
                     │                                                     │
                     │                                                     ▼
                     │                                         [Usuário digita justificativa]
                     │                                                     │
                     ▼                                                     ▼
       [Invoca RPC de Resgate]                                  [Invoca RPC com forceOverride=true]
   gsa_public_resgatar_beneficio_parceiro                   gsa_public_resgatar_beneficio_parceiro +
   (p_parceiro_id, p_nome, p_telefone, p_email)             UPDATE parceiros_resgates SET alerta_duplicidade=true,
                     │                                      justificativa_duplicidade=..., status='analise'
                     │                                                     │
                     ├─────────────────────────────────────────────────────┘
                     ▼
             [Tipo de Entrega do Benefício]
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
[Cupom / Imediato]           [SLA 24h / Manual / Link / Análise]
(has_coupon=true &           (delay_24h=true OU status='analise' OU
 delay_24h=false)             sem cupom/voucher/link direto)
       │                           │
       ▼                           ▼
[Entrega código do cupom      [Informa protocolo PROT-RES-...,
 no chat imediatamente +       avisa prazo de 24h e notifica
 instruções de uso +           Admin Master 5511971858372]
 protocolo gerado]
```

#### Regras de Negócio Críticas de Paridade:
1. **Validação Rigorosa de Entradas:**
   - Nome Completo: Mínimo 2 partes/palavras (nome e sobrenome) e 3 caracteres.
   - E-mail: Regex estrito `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
   - Telefone: Normalizado com DDD (10 a 11 dígitos, prefixo 55 internacional tratado de forma idempotente).
2. **Bloqueio de Duplicidade e Justificativa (`R3`):**
   - Antes da criação direta, verifica se já existe resgate para aquele `parceiro_id` com aquele `telefone` ou `email` cujo status não seja `recusado`.
   - Se duplicado: bot entra no estado `REDEMPTION_AWAITING_JUSTIFICATION`, explica amigavelmente que já existe um resgate e solicita o motivo.
   - Ao receber a justificativa: executa o resgate com flag de override, definindo `alerta_duplicidade = true`, `justificativa_duplicidade = justificativa` e `status = 'analise'`.
3. **Roteamento de Cupom Imediato vs 24h (`R4`):**
   - Se `redemption_has_coupon = true` e `delay_24h = false`: retorna o código do cupom (`codigo_gerado` / `redemption_coupon_code`), instruções e protocolo no mesmo chat.
   - Se `delay_24h = true` ou `status = 'analise'`: envia mensagem de protocolo em processamento (SLA até 24h) e dispara notificação para o Admin Master (`5511971858372`).

---

## 5. Formatação de Respostas WhatsApp, Evolution API, Presença e Proteções

### 5.1 Mecanismo Anti-Ban Shield (`lib/antiBanEngine.cjs`)
Toda mensagem enviada pelo webhook passa obrigatoriamente pela engine de proteção contra banimento:

1. **Fila FIFO por Contato (`ContactQueue`):**
   - Isolamento concorrente: Cada contato possui sua fila FIFO individual. Mensagens para o mesmo número nunca colidem nem são enviadas fora de ordem.
   - Intervalo randômico entre mensagens consecutivas para o mesmo contato: `2.000ms a 6.000ms`.
   - Coleta de lixo: Filas inativas são desalocadas automaticamente após 30 segundos (`evictIdleQueue`).

2. **Coreografia e Emulação de Presença Humana (`R2`):**
   - Antes de enviar texto: Envia `/chat/sendPresence/${instance}` com presença `composing` (digitando).
   - Duração dinâmica do "digitando": Calculada por fórmula baseada no número de caracteres da mensagem:
     $$\text{delay} = \text{clamp}(1500\text{ms},\, \text{base} + \text{charCount} \times 35\text{ms} + \text{random}(0, 500\text{ms}),\, 8000\text{ms})$$
   - Para áudio: Envia presença `recording` (gravando áudio) por 2,5s a 5,0s.
   - Para documentos/PDFs: Simula seleção e upload por 2,0s a 3,5s.
   - Ao concluir o envio: Reseta a presença para `paused`.

3. **Sanitização de Markdown para WhatsApp Nativo (`formatToWhatsAppMarkdown`):**
   - Converte títulos `# Titulo` em `*Titulo*`.
   - Substitui marcadores `+` e `-` por `•` (bullets limpos).
   - Corrige asteriscos duplicados (`**texto**` $\rightarrow$ `*texto*`).
   - Remove espaços internos adjacentes a asteriscos que quebram a formatação no WhatsApp (`* texto *` $\rightarrow$ `*texto*`).
   - Converte links markdown `[Texto](URL)` $\rightarrow$ `Texto (URL)`.

4. **Variação Textual (Spintax & Saudações Dinâmicas):**
   - Processamento recursivo de Spintax `{Opção A|Opção B|Opção C}` preservando variáveis `{nome}`.
   - `getDynamicGreeting`: Saudações contextualizadas pelo horário do Brasil (UTC-3: Bom dia, Boa tarde, Boa noite) com variações humanizadas.

5. **Resiliência de Rede e Backoff Exponencial (`R4`):**
   - Timeout de 15 segundos em chamadas HTTP à Evolution API.
   - Retentativas com backoff exponencial e jitter para erros 5xx, 429 (Rate Limit) e falhas de conexão (`ECONNRESET`, `ETIMEDOUT`).
   - Fast-fail imediato para erros de cliente não-retentáveis (400, 401, 404).

---

## 6. Busca Fuzzy Interativa de Parceiros no Supabase

### 6.1 Estrutura de Dados e Metadados do Parceiro
A tabela `public.parceiros` no Supabase contém as seguintes colunas essenciais:
- `id` (uuid), `slug` (text), `name` (text), `category` (text), `short_description` (text), `description` (text), `benefits` (text), `services` (text[]), `products` (text[]), `status` (text).
- Configurações de resgate: `redemption_has_coupon` (bool), `redemption_coupon_code` (text), `redemption_has_voucher` (bool), `redemption_has_link` (bool), `redemption_link` (text), `redemption_auto_redirect` (bool), `redemption_instructions` (text), `redemption_delay_24h` (bool).

### 6.2 Estratégia de Cache e Algoritmo Fuzzy de Alto Desempenho
Para manter a latência de resposta no WhatsApp abaixo de 200ms e evitar sobrecarga de consultas SQL repetitivas:

1. **Cache em Memória de Parceiros Ativos:**
   - Renovado a cada 5 minutos (`_partnersCache` / `_partnersCacheTs`), idêntico ao `_catalogCache` já utilizado com sucesso para produtos e serviços.
   - Filtro: `status = 'ativo'`.

2. **Algoritmo de Correspondência em Múltiplas Camadas (Multi-Tier Fuzzy Matcher):**
   - **Normalização:** Conversão para minúsculas, remoção de acentos/diacríticos (`normalize('NFD').replace(/[\u0300-\u036f]/g, '')`), limpeza de stop-words comuns de intenção ("quero", "resgatar", "desconto", "cupom", "parceiro", "beneficio", "parceria", "de", "da", "do", "para").
   - **Camada 1 — Correspondência Exata / Slug:**
     - Se o termo limpo corresponder exatamente ao `slug` ou ao `name` normalizado $\rightarrow$ Score 1.0 (Confiança Absoluta).
   - **Camada 2 — Correspondência de Substring / Palavras-Chave no Nome:**
     - Se o nome do parceiro contiver todas as palavras do termo de busca $\rightarrow$ Score 0.90.
     - Se o termo de busca for substring do nome $\rightarrow$ Score 0.85.
   - **Camada 3 — Correspondência na Categoria e Benefícios:**
     - Se a categoria (`Centros Veterinários`, `Saúde`, `Alimentação`) ou a descrição de benefícios contiver o termo $\rightarrow$ Score 0.70 - 0.80.
   - **Camada 4 — Similaridade Fonética e Distância Levenshtein / Token Ratio:**
     - Para capturar erros de digitação (ex: "petlovy" $\rightarrow$ "Petlove", "unimed" $\rightarrow$ "Unimed", "odonto" $\rightarrow$ "OdontoCompany") $\rightarrow$ Score proporcional (0.50 a 0.75).

3. **Tomada de Decisão Interativa:**
   - **Cenário A: Correspondência Única com Alta Confiança ($\ge 0.80$):**
     - O bot seleciona o parceiro automaticamente e avança direto para a confirmação do benefício e dos dados do cliente.
   - **Cenário B: Múltiplos Candidatos ($\ge 0.50$):**
     - O bot exibe uma lista numerada e amigável:
       ```text
       Encontrei estas opções de parceiros:
       1️⃣ *Petlove* (Centros Veterinários) — Primeira Mensalidade 100% Grátis
       2️⃣ *Petz* (Pet Shop & Banho) — 15% de Desconto em Compras
       3️⃣ *Hospital Veterinário Pet Care* — 20% em Consultas
       
       Qual deles você gostaria de resgatar? Digite o número correspondente (1 a 3) ou 0 para voltar.
       ```
     - A sessão entra no estado `REDEMPTION_SELECT_PARTNER` com `session.redemptionCandidates = [...]`.
   - **Cenário C: Nenhum Candidato Encontrado ($< 0.50$):**
     - O bot responde gentilmente informando que não encontrou o parceiro com aquele nome, sugere algumas categorias populares ou exibe os parceiros em destaque (`featured = true`) cadastrados no sistema.

---

## 7. Blueprint Técnico de Implementação

### 7.1 Módulos a Serem Adicionados em `server_webhook_vps_live.cjs` e `server_webhook.cjs`

#### 1. Consulta RPC e Helper de Duplicidade

```javascript
// ─── HELPER: RPC SUPABASE NATIVO ──────────────────────────────────────────
function supabaseRpc(rpcName, params, callback) {
  const cleanRpc = rpcName.replace(/^\/rpc\//, '');
  const payload = JSON.stringify(params || {});
  const supaKey = SERVICE_ROLE_JWT || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: `/rpc/${cleanRpc}`,
    method: 'POST',
    headers: {
      'apikey': supaKey,
      'Authorization': `Bearer ${supaKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try { callback(null, JSON.parse(data)); } catch (e) { callback(null, data); }
      } else {
        callback(new Error(data || `HTTP ${res.statusCode}`), null);
      }
    });
  });
  req.on('error', err => callback(err, null));
  req.setTimeout(10000, () => { req.destroy(); callback(new Error('Timeout RPC'), null); });
  req.write(payload);
  req.end();
}

// ─── HELPER: CHECAGEM DE DUPLICIDADE DE RESGATE ───────────────────────────
function checkDuplicateRedemptionDb(parceiroId, email, telefone, callback) {
  if (!parceiroId || (!email && !telefone)) return callback(null, false);
  
  const cleanPhone = (telefone || '').replace(/\D/g, '');
  const cleanEmail = (email || '').trim().toLowerCase();
  
  let orFilters = [];
  if (cleanEmail) orFilters.push(`email.eq.${encodeURIComponent(cleanEmail)}`);
  if (cleanPhone) {
    orFilters.push(`telefone.eq.${cleanPhone}`);
    if (!cleanPhone.startsWith('55')) orFilters.push(`telefone.eq.55${cleanPhone}`);
    else orFilters.push(`telefone.eq.${cleanPhone.substring(2)}`);
  }
  
  const url = `/parceiros_resgates?parceiro_id=eq.${parceiroId}&status=neq.recusado&or=(${orFilters.join(',')})&select=id,status,codigo_gerado&limit=1`;
  supabaseGet(url, (err, rows) => {
    if (err || !rows || rows.length === 0) {
      return callback(null, false, null);
    }
    return callback(null, true, rows[0]);
  });
}
```

#### 2. Cache e Busca Fuzzy de Parceiros

```javascript
let _partnersCache = null;
let _partnersCacheTs = 0;

function fetchPartnersForAI(callback) {
  const now = Date.now();
  if (_partnersCache && (now - _partnersCacheTs) < 300000) {
    return callback(_partnersCache);
  }
  const url = `/parceiros?status=eq.ativo&select=id,slug,name,category,short_description,description,benefits,logo_url,cover_url,redemption_has_coupon,redemption_coupon_code,redemption_has_voucher,redemption_has_link,redemption_link,redemption_delay_24h,redemption_instructions,featured,display_order&order=featured.desc,display_order.asc,name.asc&limit=100`;
  supabaseGet(url, (err, rows) => {
    const list = (!err && Array.isArray(rows)) ? rows : [];
    _partnersCache = list;
    _partnersCacheTs = Date.now();
    callback(list);
  });
}

function searchPartnersFuzzy(query, partnersList) {
  if (!query || !partnersList || partnersList.length === 0) return [];
  
  const cleanQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(quero|resgatar|resgate|beneficio|benefício|cupom|desconto|parceiro|parceria|da|do|de|para|com|o|a|os|as|por favor)\b/gi, '')
    .trim();

  if (!cleanQuery) return partnersList.slice(0, 5);

  const scored = partnersList.map(p => {
    const pName = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pSlug = (p.slug || '').toLowerCase();
    const pCat = (p.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pBen = (p.benefits || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let score = 0;
    if (pSlug === cleanQuery || pName === cleanQuery) score = 1.0;
    else if (pName.startsWith(cleanQuery)) score = 0.92;
    else if (pName.includes(cleanQuery)) score = 0.85;
    else if (pCat.includes(cleanQuery)) score = 0.75;
    else if (pBen.includes(cleanQuery)) score = 0.70;
    else {
      // Token overlap
      const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length >= 3);
      let matchCount = 0;
      queryTokens.forEach(t => {
        if (pName.includes(t) || pCat.includes(t) || pBen.includes(t)) matchCount++;
      });
      if (queryTokens.length > 0 && matchCount > 0) {
        score = 0.5 + (matchCount / queryTokens.length) * 0.3;
      }
    }
    return { partner: p, score };
  });

  return scored
    .filter(item => item.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .map(item => item.partner);
}
```

#### 3. Estados da Máquina de Resgate (`REDEMPTION_*`)

| Estado | Responsabilidade |
|---|---|
| `REDEMPTION_SELECT_PARTNER` | Apresenta múltiplos parceiros encontrados na busca fuzzy e aguarda escolha numérica (ex: 1, 2, 3). |
| `REDEMPTION_CONFIRM_PARTNER` | Exibe resumo do parceiro selecionado e benefícios; pede confirmação para iniciar resgate. |
| `REDEMPTION_COLLECT_NAME` | Solicita nome completo (caso não esteja no cadastro do cliente). |
| `REDEMPTION_COLLECT_EMAIL` | Solicita e-mail válido para envio de comprovante e ativação. |
| `REDEMPTION_COLLECT_PHONE` | Confirma o WhatsApp ou solicita número alternativo de contato com DDD. |
| `REDEMPTION_AWAITING_JUSTIFICATION` | **(R3 Duplicidade)** Ativado quando `checkDuplicateRedemptionDb` retorna `true`. Solicita justificativa textual do usuário. |
| `REDEMPTION_EXECUTING` | Dispara `gsa_public_resgatar_beneficio_parceiro` e se tiver justificativa faz `PATCH` em `parceiros_resgates` (`alerta_duplicidade=true`, `justificativa_duplicidade=...`, `status='analise'`). |

---

## 8. Estratégia de Testes Automatizados (`test_whatsapp_redemption.js`)

Para cumprir os critérios de aceitação do projeto, será criado o script de testes de integração e ponta a ponta `test_whatsapp_redemption.js`:

1. **Mock de Mensagens HTTP POST para o Webhook Local:**
   - Envio de JSON simulando payload da Evolution API (`messages.upsert`).
2. **Cenário 1 — Busca Fuzzy de Parceiro:**
   - Mensagem: `"Olá, quero resgatar o benefício do parceiro petlove"`.
   - Validação: Webhook identifica o parceiro Petlove e inicia a coleta de dados.
3. **Cenário 2 — Resgate de Cupom Automático (Imediato):**
   - Envio de Nome, Email e Telefone para parceiro com `redemption_has_coupon = true`.
   - Validação: Resposta do webhook contém o código do cupom (`PETLOVE...`) e protocolo `PROT-RES-...`.
4. **Cenário 3 — Detecção e Interceptação de Duplicidade:**
   - Nova requisição imediata com o mesmo telefone e parceiro.
   - Validação: Bot recusa resgate direto e responde solicitando a justificativa textual.
5. **Cenário 4 — Envio de Justificativa com Override:**
   - Envio da justificativa: `"Preciso de mais um cupom para outro animal de estimação"`.
   - Validação: Registro criado em `parceiros_resgates` com `status = 'analise'`, `alerta_duplicidade = true` e a justificativa preenchida.
6. **Cenário 5 — Notificação Administrativa Master:**
   - Validação: Registro de disparo de alerta para o número `ADMIN_MASTER_PHONE` (`5511971858372`).

---

## Conclusão e Próximos Passos
A arquitetura do webhook e da engine anti-ban está sólida e pronta para receber a extensão da intenção `resgatar`. Os pontos de integração com o PostgREST (porta 3001) e RPCs do Supabase foram completamente mapeados, garantindo paridade 100% fiel com o fluxo já aprovado e testado da interface web.
