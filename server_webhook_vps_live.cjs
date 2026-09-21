'use strict';
const http = require('http');
const https = require('https');
const crypto = require('crypto');


const PORT = Number(process.env.PORT || 5680);
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || '';
const META_TOKEN = process.env.META_TOKEN || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '';

const SUPABASE_HOST = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODY5ODQzMzYsImV4cCI6MjEwMjM0NDMzNn0.HErwZVyHaKqhK_vRx66dcMXSlYkubChX7vGzDDbJHu0';
const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || '';


// ─── CONFIGURAÇÃO DE IA (Google Gemini Oficial — Gratuito 100%) ──────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAD95jNTRpQdfuL96Mffs7FmqXbRWy-jM0';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const AI_TIMEOUT_MS = 25000;

// ─── DADOS DA EMPRESA (usados no system prompt da IA) ────────────────────────
const ADMIN_MASTER_PHONE = '5511971858372';
const SUPPORT_COMPANY_PHONE = '5511920857756';

const GSA_EMPRESA = {
  nome: 'GSA HUB — Gestão de Serviços & Tecnologia',
  cnpj: '53.217.297/0001-08',
  responsavel: 'Adriano Peite Farias',
  telefone: '(11) 92085-7756',
  site: 'https://gsahub.pages.dev',
  email: 'gsa.doc.adm@gmail.com',
  pix: '53.217.297/0001-08',
  whatsapp_atendimento: '5511920857756'
};

// Cache do catálogo para a IA (renovado a cada 5 minutos)
let _catalogCache = null;
let _catalogCacheTs = 0;

const userSessions = {};

// ─── CONCURRENCY CONTROL: SESSION MUTEX (PER-PHONE FIFO QUEUE) ──────────────
class SessionMutex {
  constructor() {
    this.queues = new Map();
  }

  /**
   * Serializes execution of async tasks per key (e.g., fromPhone).
   * Runs tasks for the same phone number sequentially in FIFO order.
   * Runs tasks for different phone numbers concurrently without blocking.
   * @param {string} key - Unique identifier (e.g., phone number)
   * @param {() => Promise<any>} task - Async function to execute
   * @returns {Promise<any>}
   */
  runExclusive(key, task) {
    const safeKey = String(key || 'global');
    const prevPromise = this.queues.get(safeKey) || Promise.resolve();

    const nextPromise = (async () => {
      try {
        await prevPromise;
      } catch (ignored) {
        // Prevent previous errors from deadlocking subsequent queued messages
      }
      return await task();
    })();

    this.queues.set(safeKey, nextPromise);

    // Clean up memory when queue is empty
    nextPromise.finally(() => {
      if (this.queues.get(safeKey) === nextPromise) {
        this.queues.delete(safeKey);
      }
    });

    return nextPromise;
  }
}

const sessionMutex = new SessionMutex();


// ─── HTTP / HTTPS FETCH HELPER (ZERO DEPENDENCIES) ──────────────────────────
function fetchText(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, urlStr).href;
          return fetchText(redirectUrl).then(resolve);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve('');
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', (err) => {
        console.warn('⚠️ [fetchText Warning]', err.message);
        resolve('');
      });
      req.setTimeout(60000, () => {
        req.destroy();
        resolve('');
      });
    } catch(e) { resolve(''); }
  });
}

// ─── MÓDULO IA: CATÁLOGO DINÂMICO (cache 5 minutos) ─────────────────────────
const SUPABASE_ANON_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZ2FqdmFneGFndXRmdmd4d3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTY0MDksImV4cCI6MjA4OTUzMjQwOX0.1OXsjDAsGl82u6ytGQ5iX2vroXjhmqUoFkbOLKbO6XI';

function fetchCatalogForAI(callback) {
  const now = Date.now();
  if (_catalogCache && (now - _catalogCacheTs) < 300000) {
    return callback(_catalogCache);
  }
  const catalog = { servicos: [], produtos: [] };
  let pending = 2;
  const supaKey = SUPABASE_KEY || SUPABASE_ANON_FALLBACK;

  function done() {
    if (--pending === 0) {
      // Garantir que ambos são arrays antes de cachear
      if (!Array.isArray(catalog.servicos)) catalog.servicos = [];
      if (!Array.isArray(catalog.produtos)) catalog.produtos = [];
      _catalogCache = catalog;
      _catalogCacheTs = Date.now();
      callback(catalog);
    }
  }

  // Serviços — inclui ocultar_valor para que a IA nunca exiba valores inexistentes
  const reqS = http.request({
    hostname: '127.0.0.1', port: 3001,
    path: '/servicos?select=codigo_servico,nome,descricao,valor,ocultar_valor&status=eq.ativo&limit=60&order=codigo_servico.asc',
    method: 'GET',
    headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(d);
        catalog.servicos = Array.isArray(parsed) ? parsed : [];
      } catch(e) { catalog.servicos = []; }
      done();
    });
  });
  reqS.on('error', () => { catalog.servicos = []; done(); });
  reqS.setTimeout(5000, () => { reqS.destroy(); catalog.servicos = []; done(); });
  reqS.end();

  // Produtos
  const reqP = http.request({
    hostname: '127.0.0.1', port: 3001,
    path: '/produtos?select=codigo_produto,nome,descricao,valor,imagem_url&status=eq.ativo&limit=50&order=nome.asc',
    method: 'GET',
    headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(d);
        catalog.produtos = Array.isArray(parsed) ? parsed : [];
      } catch(e) { catalog.produtos = []; }
      done();
    });
  });
  reqP.on('error', () => { catalog.produtos = []; done(); });
  reqP.setTimeout(5000, () => { reqP.destroy(); catalog.produtos = []; done(); });
  reqP.end();
}


// ─── MÓDULO IA: CRIAR TICKET AUTOMÁTICO ──────────────────────────────────────
function createAITicket(fromPhone, session, assunto, descricao, callback) {
  const clientId = session.clientData?.id || session.tempClientId || null;
  const clientName = session.clientName || session.clientData?.nome || 'Cliente WhatsApp';
  const protocolo = 'TKT-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

  const ticketPayload = {
    cliente_id: clientId,
    assunto: assunto.substring(0, 120),
    descricao: `[IA WhatsApp] ${descricao}\n\nCliente: ${clientName}\nWhatsApp: ${fromPhone}\nData: ${new Date().toLocaleString('pt-BR')}`,
    status: 'aberto',
    prioridade: 'media',
    origem: 'whatsapp_ia',
    protocolo
  };

  const payload = JSON.stringify(ticketPayload);
  const reqT = http.request({
    hostname: '127.0.0.1', port: 3001,
    path: '/tickets',
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_JWT || SUPABASE_KEY,
      'Authorization': 'Bearer ' + (SERVICE_ROLE_JWT || SUPABASE_KEY),
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try { callback(null, JSON.parse(d)[0] || { protocolo }); }
      catch(e) { callback(null, { protocolo }); }
    });
  });
  reqT.on('error', e => callback(e, { protocolo }));
  reqT.write(payload);
  reqT.end();
}

// ─── MÓDULO VOUCHER CALCULADORAS PRO VIA WHATSAPP ────────────────────────────
function checkPhoneVoucherStatus(phone, callback) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const url = `/gsa_calculator_pro_vouchers?select=*&observacoes=like.*${cleanPhone}*`;
  const authKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
  
  const req = http.request({
    hostname: '127.0.0.1', port: 3001,
    path: url,
    method: 'GET',
    headers: {
      'apikey': authKey,
      'Authorization': 'Bearer ' + authKey
    }
  }, res => {
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => {
      try {
        const list = JSON.parse(b);
        if (Array.isArray(list) && list.length > 0) {
          return callback(null, { alreadyUsed: true, voucher: list[0] });
        }
        callback(null, { alreadyUsed: false, voucher: null });
      } catch (e) {
        callback(e, { alreadyUsed: false, voucher: null });
      }
    });
  });
  req.on('error', e => callback(e, { alreadyUsed: false, voucher: null }));
  req.end();
}

function createAndRedeemVoucherForPhone(phone, toolId, callback) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const rawCode = `GSA-PRO-${Math.floor(100000 + Math.random() * 900000)}`;
  const codeHash = crypto.createHash('sha256').update(rawCode.toLowerCase()).digest('hex');
  const codeHint = rawCode.substring(0, 8) + '...';
  const authKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

  const voucherData = {
    code_hash: codeHash,
    code_hint: codeHint,
    tool_id: toolId || null,
    status: 'used',
    used_at: new Date().toISOString(),
    used_by_visitor_hash: crypto.createHash('sha256').update(cleanPhone).digest('hex'),
    observacoes: `WhatsApp: ${cleanPhone} (Liberado e resgatado automaticamente via Chatbot IA)`,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };

  const payload = JSON.stringify(voucherData);
  const req = http.request({
    hostname: '127.0.0.1', port: 3001,
    path: '/gsa_calculator_pro_vouchers',
    method: 'POST',
    headers: {
      'apikey': authKey,
      'Authorization': 'Bearer ' + authKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, res => {
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => {
      callback(null, { code: rawCode, voucherData });
    });
  });
  req.on('error', e => callback(e, { code: rawCode, voucherData }));
  req.write(payload);
  req.end();
}


// ─── MÓDULO IA: ASSISTENTE PRINCIPAL (Google Gemini Oficial Grátis) ─────────
function callGSAAssistant(fromPhone, userMessage, session, mediaType, catalog, callback) {
  if (!GEMINI_API_KEY) {
    return callback(null, { action: 'error' });
  }

  const clientName = session.clientName || session.clientData?.nome || session.profile?.primaryName || null;
  const estado = session.state || 'MAIN_MENU';

  // Monta lista de serviços para o prompt — NUNCA exibe valor quando ocultar_valor=true
  const servicosList = (catalog.servicos || [])
    .map(s => {
      const valorStr = (s.ocultar_valor === true || s.ocultar_valor === 'true')
        ? ' [VALOR: sob consulta — NÃO informe nenhum valor ao cliente, apenas diga que o valor é definido após análise do orçamento]'
        : (s.valor > 0 ? ` [VALOR: R$ ${Number(s.valor).toFixed(2)}]` : ' [VALOR: gratuito/sob consulta]');
      return `  - [${s.codigo_servico}] ${s.nome}${s.descricao ? ': ' + s.descricao.substring(0, 80) : ''}${valorStr}`;
    })
    .join('\n');

  const produtosList = (catalog.produtos || [])
    .slice(0, 35)
    .map(p => `  - [${p.codigo_produto}] ${p.nome} (R$ ${Number(p.valor).toFixed(2)})${p.imagem_url ? ` | imagem_url: ${p.imagem_url}` : ''}`)
    .join('\n');

  // Histórico recente
  const historyText = (session.history || [])
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `Você é a Assistente Virtual Inteligente da ${GSA_EMPRESA.nome}, chamada GSA.
Você atende clientes no WhatsApp de forma 100% humanizada, calorosa, empática, resolutiva e natural — como uma atendente humana experiente, gentil e próxima, que conhece os clientes pelo nome.
CNPJ: ${GSA_EMPRESA.cnpj} | Site: ${GSA_EMPRESA.site} | E-mail: ${GSA_EMPRESA.email} | PIX: ${GSA_EMPRESA.pix} | WhatsApp Suporte: ${GSA_EMPRESA.whatsapp_atendimento}
Tom: Fale como uma pessoa real, calorosa, usando português brasileiro natural e coloquial (sem ser informal demais). Use emojis com moderação. Trate sempre pelo primeiro nome quando disponível.
Cliente atual: ${clientName ? '*' + clientName + '*' : 'novo cliente'} | Telefone: ${fromPhone}
${mediaType ? 'Mídia recebida do cliente: ' + mediaType : ''}

════════════════════════════════════════════════
🚨 REGRAS ABSOLUTAS — PROIBIÇÕES INVIOLÁVEIS
════════════════════════════════════════════════

1. NUNCA INVENTE OU ESTIME VALORES DE SERVIÇOS OU PRODUTOS.
   - Você SOMENTE pode informar valores que estejam EXPLICITAMENTE listados no CATÁLOGO DE SERVIÇOS abaixo com [VALOR: R$ X].
   - Se o serviço tiver [VALOR: sob consulta] ou não tiver valor definido, diga APENAS: "O valor desse serviço é definido após análise do seu caso. Nossa equipe prepara um orçamento personalizado para você — posso registrar sua solicitação agora mesmo!"
   - JAMAIS diga "estimativa de mercado", "valor aproximado", "referência de preço" ou qualquer variação. Isso é proibido.
   - JAMAIS coloque um valor numérico no campo "valor" do JSON se o serviço tiver [VALOR: sob consulta]. Nesse caso, coloque 0.

2. NUNCA INVENTE INFORMAÇÕES DO SISTEMA.
   - Não invente protocolos, datas, nomes de atendentes, funcionalidades ou dados que não foram fornecidos a você.
   - Se não souber uma informação, diga honestamente: "Não tenho essa informação no momento, mas posso conectar você com nossa equipe para esclarecer!"

3. NUNCA MANDE O CLIENTE PARA O SITE.
   - Você DEVE resolver tudo diretamente aqui no WhatsApp.
   - Forneça o link do site SOMENTE se o cliente pedir explicitamente.

4. SEJA 100% HUMANA NO TOM.
   - Evite respostas robóticas, listas frias e linguagem corporativa excessiva.
   - Use frases como: "Oi, que bom falar com você!", "Claro, já verifico isso pra você!", "Perfeito, deixa eu resolver isso agora!", "Boa notícia: consegui achar aqui para você!"
   - Quando o cliente estiver frustrado ou com dúvida, acolha primeiro antes de responder.

5. FOTOS E IMAGENS DE PRODUTOS:
   - Quando o cliente pedir fotos, imagens, opções ou produtos (ex: "tem imagem?", "me mostre opções de tênis/calças"), SEMPRE use a action "search_product" com os itens encontrados em "found_items" (incluindo o campo "imagem_url").
   - NUNCA diga "não consigo enviar fotos", "não tenho imagens aqui" ou "acesse o site para ver as fotos", pois o sistema WhatsApp envia as fotos automaticamente junto com os produtos.

6. FORMATAÇÃO LIMPA DE TEXTO (WHATSAPP NATIVO):
   - No WhatsApp, o negrito é feito com APENAS UM asterisco: *texto em negrito*.
   - NUNCA use negrito com dois asteriscos **texto** (isso quebra a formatação e deixa asteriscos sobrando no WhatsApp).
   - NUNCA inicie itens de lista com asterisco (* item ou * *item*). Para listas, use sempre "• item", "- item" ou emojis numerados 1️⃣, 2️⃣.
   - Exemplo correto: • *Saldo de Salário:* R$ 1.990,00
   - Exemplo proibido: * **Saldo de Salário:** R$ 1.990,00


════════════════════════════════════════════════
📋 CATÁLOGO REAL DE SERVIÇOS ATIVOS (DADOS DO BANCO)

════════════════════════════════════════════════
Use APENAS os valores e nomes abaixo. Não invente nenhum serviço ou valor fora desta lista.

${servicosList || 'Catálogo temporariamente indisponível — informe ao cliente que consultará e retornará em breve.'}

════════════════════════════════════════════════
🛍️ PRODUTOS DA LOJA GSA (DADOS DO BANCO)
════════════════════════════════════════════════
${produtosList || 'Produtos temporariamente indisponíveis.'}

════════════════════════════════════════════════
🧮 CALCULADORAS GSA (EXECUTADAS DIRETAMENTE NO CHAT)
════════════════════════════════════════════════
a) Aposentadoria & Planejamento Previdenciário (tool_id: "retirement"):
   - Regras: Idade Mínima (65H/62M), Pontos (101H/91M), Pedágio 50% e 100%, Progressiva.
   - RMI: 60% da média + 2% por ano acima de 20H/15M anos de contribuição.
   - Solicite: Idade, Tempo de contribuição, Sexo, Salário médio aproximado.
b) Rescisão Trabalhista CLT (tool_id: "termination"):
   - Modalidades: Sem justa causa, Com justa causa, Pedido de demissão, Acordo 484-A.
   - Verbas: saldo, aviso proporcional (Lei 12.506/11), 13º, férias+1/3, FGTS 40%/20%, INSS/IRRF.
c) Férias (tool_id: "vacation"): salário, 1/3, abono pecuniário, 13º adiantado, descontos.
d) 13º Salário (tool_id: "thirteenth"): 1ª parcela (50%, sem desconto), 2ª parcela (com INSS/IRRF).
e) Benefícios INSS (tool_id: "benefits"): Auxílio-Doença 91%, Acidente 50%, Maternidade 100%.
f) BPC/LOAS (tool_id: "bpc"): 65+ ou PcD, renda per capita < R$ 353, benefício = R$ 1.412.
   → Voucher Pro Gratuito: 1 uso por número. Use action "request_pro_voucher" quando solicitado.
g) GERAÇÃO E ENVIO DO ARQUIVO PDF DO CÁLCULO (100% NO WHATSAPP):
   - Quando o cliente pedir o arquivo PDF (ex: "cadê o meu arquivo PDF", "me manda o PDF", "quero o PDF", "gerar relatório", "cade o pdf", "quero baixar o pdf", "manda o relatório"):
   - Você DEVE responder com action "generate_calculator_pdf" trazendo todos os dados calculados no JSON.
   - NUNCA DIGA QUE O PDF SÓ É GERADO NO SITE OU NO SISTEMA COMPLETO! O sistema cria o arquivo PDF oficial na hora e envia anexado no chat do WhatsApp!

════════════════════════════════════════════════
🤝 OUTROS MÓDULOS DO SISTEMA
════════════════════════════════════════════════
- Programa Afiliados (Indique & Ganhe): qualquer pessoa pode se afiliar gratuitamente e ganhar comissões por indicação.
- Fidelidade & VIP: pontos acumulados, níveis Bronze/Prata/Ouro/Diamante, resgates via PIX ou desconto.
- Loja Virtual: produtos físicos e digitais, entrega em todo o Brasil.
- Viagens, Seguros, Classificados, Portais de Parceiros (Fornecedores & Prestadores): disponíveis via menu.
- Atendimento Humano: ramais setoriais ativos — Comercial, Financeiro, Depto Pessoal, Jurídico, SAC.

════════════════════════════════════════════════
📤 FORMATO JSON DE RESPOSTA OBRIGATÓRIO
════════════════════════════════════════════════
Responda SEMPRE em JSON válido. Nunca use markdown fora do campo "message".

- action "reply": Dúvidas, cálculos, orientações, informações gerais.
- action "generate_calculator_pdf": QUANDO O CLIENTE PEDIR O ARQUIVO PDF DO CÁLCULO. Preencha "title", "mode" ("PRO" ou "FREE"), "items" (array com labels e valores), "total_label", "total_value" e "notes".
- action "client_account": Quando o cliente quiser consultar a Área do Cliente, resumo da conta, saldo geral ou dados cadastrais.
- action "client_statement": Quando o cliente quiser o extrato da conta, extrato financeiro, extrato da carteira ou lançamentos.
- action "client_points": Quando o cliente quiser saber quantos pontos tem, saldo de pontos fidelidade ou extrato de pontos.
- action "client_tickets": Quando o cliente quiser ver seus chamados, solicitações abertas ou tickets de suporte.
- action "track_order": Quando o cliente quiser rastrear um pedido ou saber onde está a entrega.
- action "request_pro_voucher": Cliente quer Calculadora Pro ou voucher gratuito.
- action "search_service": Cliente quer CONTRATAR um serviço do catálogo de serviços acima.
- action "search_product": QUANDO O CLIENTE PROCURAR QUALQUER PRODUTO (ex: tênis, calça, celular, capinha, camisa, relógio, eletrônicos, qualquer mercadoria física/digital):
  * Se encontrar no catálogo de produtos acima, retorne os itens encontrados em "found_items".
  * Se NÃO encontrar no catálogo acima, NUNCA diga que não tem e NUNCA use "create_ticket". Use SEMPRE action "search_product" com "found_items": [] e preencha "product_query" com o nome limpo do produto (ex: "Tênis", "Calça Jeans", "Capinha de Celular"). No campo "product_limit", extraia a quantidade exata de opções que o cliente pediu (ex: 5, 4, 3; padrão 3). O sistema fará a busca automática e enviará as fotos e opções com 100% de margem!
- action "redeem_partner_benefit": QUANDO O CLIENTE QUISER RESGATAR UM BENEFÍCIO, CUPOM OU DESCONTO DE PARCEIRO. Extraia no campo "partner_query" EXATAMENTE o termo ou nome do parceiro que o cliente digitou (ex: se digitou "gsa pet", preencha "partner_query": "pet"). NUNCA invente nomes que o cliente não escreveu!
- action "create_ticket": Apenas para SERVIÇOS que não existem no catálogo.
- action "menu": Navegação direta (target de 1 a 10).

{
  "action": "reply|generate_calculator_pdf|client_account|client_statement|client_points|client_tickets|track_order|request_pro_voucher|search_service|search_product|redeem_partner_benefit|create_ticket|menu",
  "partner_query": "termo extraído do texto",
  "target": "1",
  "tool_id": "termination",
  "title": "Cálculo de Rescisão Trabalhista CLT",
  "mode": "PRO",
  "items": [
    { "label": "Saldo de Salário (0 dias)", "value": "R$ 0,00" },
    { "label": "13º Salário Proporcional (1/12)", "value": "R$ 165,83" },
    { "label": "Férias Proporcionais + 1/3 (12/12)", "value": "R$ 2.653,33" },
    { "label": "Aviso Prévio Indenizado (30 dias)", "value": "R$ 1.990,00" },
    { "label": "Multa Rescisória FGTS (40%)", "value": "R$ 796,00" }
  ],
  "total_label": "TOTAL LÍQUIDO ESTIMADO",
  "total_value": "R$ 5.605,16",
  "notes": "Calculado conforme normas vigentes da CLT e Lei 12.506/11 para rescisão sem justa causa.",
  "message": "Aqui está o seu demonstrativo oficial em PDF com todas as verbas calculadas!",
  "product_query": "Tênis Esportivo",
  "product_limit": 5,
  "found_item": { "codigo": "SV102", "nome": "Aposentadorias", "descricao": "...", "valor": 0 },
  "found_items": [
    { "codigo": "PROD01", "nome": "Tênis X", "descricao": "...", "valor": 100, "imagem_url": "link" }
  ],
  "ticket_reason": "..."
}`;



  const contents = [];
  if (session.history && session.history.length > 0) {
    session.history.slice(-6).forEach(m => {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '' }]
      });
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1500,
      responseMimeType: 'application/json'
    }
  });

  const controller = { destroyed: false };
  const req = https.request({
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload, 'utf8')
    }

  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(d);
        let textContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const jsonMatch = textContent.match(/(\{[\s\S]*\})/);
        if (jsonMatch) textContent = jsonMatch[1];
        const result = JSON.parse(textContent.trim());
        callback(null, result);
      } catch(e) {
        callback(e, null);
      }
    });
  });

  const timer = setTimeout(() => {
    if (!controller.destroyed) {
      controller.destroyed = true;
      req.destroy();
      callback(new Error('timeout'), null);
    }
  }, AI_TIMEOUT_MS);

  req.on('error', e => {
    clearTimeout(timer);
    console.error('❌ IA Google Gemini: erro na requisição:', e.message);
    callback(e, null);
  });

  req.write(payload);
  req.end();
}

// ─── MÓDULO IA & NLU: PROTOCOLO DE AUTOATENDIMENTO (Gemini AI + Fallback Determinístico) ─

function parseProtocolIntentFallback(text) {
  const cleanText = (text || '').trim();
  const lower = cleanText.toLowerCase();

  // 1. Check for Confirmation / Denial
  if (/^(sim|s|confirmo|confirmar|com certeza|positivo|1)$/i.test(cleanText) ||
      /\b(pode cancelar|confirmo o cancelamento|desejo cancelar|sim,\s*confirmo)\b/i.test(cleanText)) {
    return {
      intent: 'confirmar_cancelamento',
      field: null,
      new_value: null,
      raw_entities: {},
      confidence: 0.95,
      suggested_reply: 'Cancelamento confirmado.'
    };
  }

  if (/^(n[aã]o|n|abortar|desisti|voltar|manter|2)$/i.test(cleanText) ||
      /\b(n[aã]o\s+(?:quero\s+)?cancelar|n[aã]o\s+cancelar|cancelar\s+n[aã]o|deixa\s+pra\s+l[aá]|n[aã]o,\s*(?:eu\s+)?desisti|desisti\s+de\s+cancelar|desisti)\b/i.test(cleanText) ||
      /\bn[aã]o\s*,\s*(?:eu\s+)?pensei\s+melhor\b/i.test(cleanText)) {
    return {
      intent: 'negar_cancelamento',
      field: null,
      new_value: null,
      raw_entities: {},
      confidence: 0.95,
      suggested_reply: 'Cancelamento cancelado. Seu resgate permanece ativo.'
    };
  }

  // 2. Check for Cancellation Intent
  if (/\b(cancelar|desistir|anular|cancelamento|excluir resgate|cancelar beneficio)\b/i.test(lower)) {
    return {
      intent: 'cancelar',
      field: null,
      new_value: null,
      raw_entities: {},
      confidence: 0.9,
      suggested_reply: 'Deseja realmente cancelar este protocolo?'
    };
  }

  // 3. Check for Consultation Intent
  if (/\b(consultar|status|situacao|detalhes|como esta|ver protocolo)\b/i.test(lower)) {
    return {
      intent: 'consultar',
      field: null,
      new_value: null,
      raw_entities: {},
      confidence: 0.85,
    };
  }

  // 4. Entity & Field Extraction for Alteration
  let detectedField = null;
  let extractedValue = null;

  // Email pattern
  const emailMatch = cleanText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch || /\b(email|e-mail|correio)\b/i.test(lower)) {
    detectedField = 'email';
    if (emailMatch) {
      extractedValue = emailMatch[1].trim().toLowerCase();
    }
  }

  // Phone pattern
  const phoneMatch = cleanText.match(/(?:(?:\+|00)?55\s*)?(?:\(?([1-9]{2})\)?\s*)?(?:((?:9\d|[2-9])\d{3})\-?(\d{4}))/);
  if (!detectedField && (phoneMatch || /\b(telefone|celular|whatsapp|fone|contato)\b/i.test(lower))) {
    detectedField = 'telefone';
    if (phoneMatch) {
      const digitsOnly = cleanText.replace(/\D/g, '');
      if (digitsOnly.length >= 10) {
        extractedValue = digitsOnly.startsWith('55') ? digitsOnly : `55${digitsOnly}`;
      }
    }
  }

  // Name pattern
  const nameIntentMatch = cleanText.match(/(?:mudar?|alterar?|trocar?|atualizar?|corrigir?)\s+(?:o\s+|meu\s+)?(?:nome\s+(?:completo\s+)?)(?:para\s+|e\s+)?([A-Za-zÀ-ÖØ-öø-ÿ\s]{4,60})/i) ||
                          cleanText.match(/(?:meu\s+novo\s+nome\s+[eé]\s+|meu\s+nome\s+[eé]\s+)([A-Za-zÀ-ÖØ-öø-ÿ\s]{4,60})/i);

  if (!detectedField && (nameIntentMatch || /\b(nome|nome completo|titular)\b/i.test(lower))) {
    if (!/\b(meus dados|meu cadastro|dados cadastrais)\b/i.test(lower) || nameIntentMatch) {
      detectedField = 'nome_completo';
      if (nameIntentMatch && nameIntentMatch[1]) {
        let potentialName = nameIntentMatch[1].trim();
        potentialName = potentialName.replace(/^(?:para|de|o|meu|nome)\s+/i, '').trim();
        if (potentialName.split(/\s+/).length >= 2) {
          extractedValue = potentialName;
        }
      }
    }
  }

  // Intent: resgatar benefício / cupom / parceiro
  if (/\b(resgatar|resgate|pegar|ativar|obter|solicitar|cupom|beneficio|benefício|desconto de parceiro)\b/i.test(lower)) {
    const partnerExtracted = (typeof extractPartnerTermFromText === 'function') ? extractPartnerTermFromText(text) : cleanText;
    return {
      intent: 'resgatar',
      field: 'parceiro',
      new_value: partnerExtracted,
      raw_entities: {
        parceiro: partnerExtracted,
        nome_completo: null,
        email: null,
        telefone: null
      },
      confidence: 0.9
    };
  }

  const isAlteration = /\b(alterar?|mudar?|trocar?|atualizar?|corrigir?|modificar?|novo|nova)\b/i.test(lower) || Boolean(detectedField);

  if (isAlteration) {
    return {
      intent: 'alterar',
      field: detectedField,
      new_value: extractedValue,
      raw_entities: {
        nome_completo: detectedField === 'nome_completo' ? extractedValue : null,
        email: detectedField === 'email' ? extractedValue : null,
        telefone: detectedField === 'telefone' ? extractedValue : null,
      },
      confidence: detectedField && extractedValue ? 0.9 : 0.75,
    };
  }

  return {
    intent: 'outro',
    field: null,
    new_value: null,
    raw_entities: {},
    confidence: 0.3,
  };
}

function callGeminiProtocolNLU(userMessage, callback) {
  if (!GEMINI_API_KEY) {
    return callback(null, parseProtocolIntentFallback(userMessage));
  }

  const systemPrompt = `Você é o analisador de linguagem natural (NLU) para o autoatendimento de resgate de protocolos de benefícios do GSA HUB.
Sua tarefa é analisar a mensagem do usuário e extrair a intenção e entidades estruturadas em JSON.

Intenções possíveis (campo "intent"):
- "alterar": O usuário quer alterar/atualizar seus dados cadastrais (nome completo, e-mail ou telefone).
- "cancelar": O usuário deseja cancelar o protocolo de resgate.
- "confirmar_cancelamento": O usuário confirma o cancelamento (ex: "sim", "confirmo", "pode cancelar").
- "negar_cancelamento": O usuário aborta/recusa o cancelamento (ex: "não", "desisti", "manter").
- "consultar": O usuário quer consultar o status/dados do protocolo.
- "resgatar": O usuário deseja resgatar, solicitar ou obter um benefício, desconto, cupom ou voucher de parceiro. Extraia em "new_value" exatamente o que o cliente digitou como nome/categoria do parceiro.
- "outro": Qualquer outra dúvida ou mensagem fora do escopo.

Campos possíveis para alteração (campo "field"):
- "nome_completo" | "email" | "telefone" | "parceiro" | null

Valor extraído (campo "new_value"):
- Se o usuário forneceu o novo valor diretamente (ex: "mudar email para joao@gmail.com" -> new_value: "joao@gmail.com"), extraia aqui.
- Se o usuário apenas indicou que quer mudar o campo sem fornecer o valor novo (ex: "quero mudar meu email"), deixe null.

Formato JSON de resposta OBRIGATÓRIO (retorne SOMENTE JSON):
{
  "intent": "alterar" | "cancelar" | "confirmar_cancelamento" | "negar_cancelamento" | "consultar" | "resgatar" | "encerrar" | "outro",
  "field": "nome_completo" | "email" | "telefone" | "parceiro" | null,
  "new_value": "valor extraído ou null",
  "raw_entities": {
    "nome_completo": "string ou null",
    "email": "string ou null",
    "telefone": "string ou null",
    "parceiro": "string ou null"
  },
  "confidence": 0.95
}`;

  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
      responseMimeType: 'application/json'
    }
  });

  let finished = false;
  const req = https.request({
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload, 'utf8')
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(d);
        let textContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const jsonMatch = textContent.match(/(\{[\s\S]*\})/);
        if (jsonMatch) textContent = jsonMatch[1];
        const result = JSON.parse(textContent.trim());
        if (!result.intent) {
          return callback(null, parseProtocolIntentFallback(userMessage));
        }
        callback(null, result);
      } catch (e) {
        console.warn('⚠️ Erro ao parsear JSON do Gemini NLU, usando fallback:', e.message);
        callback(null, parseProtocolIntentFallback(userMessage));
      }
    });
  });

  const timer = setTimeout(() => {
    if (!finished) {
      finished = true;
      req.destroy();
      console.warn('⚠️ Timeout no Gemini NLU, usando fallback regex.');
      callback(null, parseProtocolIntentFallback(userMessage));
    }
  }, 10000);

  req.on('error', e => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    console.warn('⚠️ Erro de rede no Gemini NLU, usando fallback:', e.message);
    callback(null, parseProtocolIntentFallback(userMessage));
  });

  req.write(payload);
  req.end();
}

function validateAndSanitizeField(field, rawValue) {
  const trimmed = (rawValue || '').trim();

  if (!trimmed) {
    return { valid: false, value: '', error: 'O valor não pode estar em branco.' };
  }

  // Strip script tags and content completely
  const noScript = trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();

  // Strip potential SQLi / dangerous tokens
  const cleanTokens = noScript.replace(/['";\-\-]/g, '').trim();

  if (field === 'email') {
    const emailLower = cleanTokens.toLowerCase();
    if (emailLower.includes('..') || emailLower.includes(' ')) {
      return { valid: false, value: '', error: 'E-mail inválido. Por favor, forneça um formato como: nome@dominio.com' };
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailLower)) {
      return { valid: false, value: '', error: 'E-mail inválido. Por favor, forneça um formato como: nome@dominio.com' };
    }
    return { valid: true, value: emailLower };
  }

  if (field === 'telefone') {
    const digits = cleanTokens.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) {
      return { valid: false, value: '', error: 'Número de telefone inválido. Informe DDD + número (ex: 11987654321).' };
    }
    // Reject obvious all-same digits (e.g. 00000000000)
    if (/^(\d)\1+$/.test(digits)) {
      return { valid: false, value: '', error: 'Número de telefone inválido. Informe um número real com DDD.' };
    }
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    return { valid: true, value: normalized };
  }

  if (field === 'nome_completo') {
    const parts = cleanTokens.split(/\s+/).filter(p => p.length >= 2);
    if (parts.length < 2) {
      return { valid: false, value: '', error: 'Por favor, informe o seu nome completo (nome e sobrenome).' };
    }
    return { valid: true, value: cleanTokens };
  }

  return { valid: false, value: '', error: 'Campo desconhecido.' };
}

async function dispatchAdminProtocolAlert(action, protocolRecord, diffInfo) {
  const partnerName = protocolRecord.parceiro_nome || protocolRecord.parceiros?.nome || protocolRecord.parceiros?.name || 'Parceiro GSA';
  const alertMessage = [
    `🔔 *ALERTA MASTER: AUTOATENDIMENTO DE PROTOCOLO GSA*`,
    ``,
    `📌 *Ação:* ${action === 'ALTERACAO' ? '✏️ Alteração Cadastral' : '❌ Cancelamento de Resgate'}`,
    `🔖 *Protocolo:* \`${protocolRecord.codigo_gerado}\``,
    `🤝 *Parceiro:* ${partnerName}`,
    `👤 *Cliente:* ${protocolRecord.nome_completo || 'Não informado'}`,
    `📞 *Telefone:* ${protocolRecord.telefone || 'Não informado'}`,
    `📧 *E-mail:* ${protocolRecord.email || 'Não informado'}`,
    ``,
    `📋 *Detalhes da Atualização:*`,
    `${diffInfo}`,
    ``,
    `⏰ *Data/Hora:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    `_Sistema Automatizado WhatsApp GSA HUB_`,
  ].join('\n');

  try {
    sendWhatsAppReply(ADMIN_MASTER_PHONE, alertMessage);
  } catch (err) {
    console.error('❌ Erro ao disparar alerta admin para protocolo:', err.message);
  }
}

function handleProtocolSelfServiceFlow(fromPhone, rawText, session, matchedProtocolCode) {
  const text = (rawText || '').trim();

  // 0 to return to main menu
  if (text === '0') {
    session.state = 'MAIN_MENU';
    session.protocolState = null;
    session.protocolCode = null;
    session.protocolRecord = null;
    session.targetField = null;
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, getMainMenuText(session.profile));
    return;
  }

  // 1. If matched a new protocol code or not yet identified
  if (matchedProtocolCode) {
    const code = matchedProtocolCode.toUpperCase().replace(/_/g, '-');
    supabaseGet('/rest/v1/parceiros_resgates?codigo_gerado=eq.' + encodeURIComponent(code) + '&select=*,parceiros(id,name,slug,logo_url,benefits)&limit=1', (err, rows) => {
      if (err || !rows || rows.length === 0) {
        sendWhatsAppReply(
          fromPhone,
          `❌ Não encontramos nenhum resgate com o protocolo *${code}*.\nPor favor, verifique os dígitos e tente novamente ou entre em contato com nosso suporte no número *${SUPPORT_COMPANY_PHONE}*.`
        );
        return;
      }

      const record = rows[0];
      const partnerName = record.parceiros?.nome || record.parceiros?.name || record.parceiro_nome || 'Parceiro GSA';
      record.parceiro_nome = partnerName;

      session.state = 'PROTOCOL_IDENTIFIED';
      session.protocolState = 'IDENTIFIED';
      session.protocolCode = code;
      session.protocolRecord = record;
      session.targetField = null;
      userSessions[fromPhone] = session;

      if (record.status === 'cancelado') {
        const cancelDateStr = record.data_cancelamento ? new Date(record.data_cancelamento).toLocaleString('pt-BR') : 'Data não registrada';
        sendWhatsAppReply(
          fromPhone,
          [
            `⚠️ *Protocolo Cancelado: ${code}*`,
            ``,
            `• *Parceiro:* ${partnerName}`,
            `• *Titular:* ${record.nome_completo}`,
            `• *Status:* ❌ CANCELADO em ${cancelDateStr}`,
            ``,
            `Este resgate já foi cancelado e não pode sofrer novas alterações. Caso precise de suporte, fale conosco em *${SUPPORT_COMPANY_PHONE}*.`
          ].join('\n')
        );
        return;
      }

      if (record.status === 'concluido') {
        sendWhatsAppReply(
          fromPhone,
          [
            `✅ *Protocolo Concluído: ${code}*`,
            ``,
            `• *Parceiro:* ${partnerName}`,
            `• *Titular:* ${record.nome_completo}`,
            `• *Status:* 🎉 CONCLUÍDO / ATIVO`,
            record.link_ativacao ? `• *Link de Ativação:* ${record.link_ativacao}` : ``,
            ``,
            `Seu benefício já está liberado! Você ainda pode alterar dados cadastrais de contato ou solicitar suporte.`
          ].filter(l => l !== undefined).join('\n')
        );
        return;
      }

      // Standard Active/Pendente Welcome Card
      const welcomeCard = [
        `🎉 *PROTOCOLO LOCALIZADO COM SUCESSO!*`,
        ``,
        `🔖 *Código:* \`${record.codigo_gerado}\``,
        `🤝 *Parceiro:* ${partnerName}`,
        `👤 *Titular:* ${record.nome_completo}`,
        `📧 *E-mail:* ${record.email || 'Não informado'}`,
        `📞 *Telefone:* ${record.telefone}`,
        `📊 *Status:* ⏳ ${record.status.toUpperCase()}`,
        ``,
        `💡 *Como posso te ajudar com este resgate?*`,
        `1️⃣ *Alterar dados* (Nome, E-mail ou Telefone)`,
        `2️⃣ *Cancelar resgate*`,
        `3️⃣ *Consultar status*`,
        ``,
        `_Você pode digitar o que deseja em linguagem natural (ex: "quero mudar meu email para novo@email.com" ou "desejo cancelar")._`
      ].join('\n');

      sendWhatsAppReply(fromPhone, welcomeCard);
    });
    return;
  }

  // 2. If no protocol session active
  if (!session || !session.protocolRecord) {
    sendWhatsAppReply(
      fromPhone,
      `Olá! Para consultar, alterar dados ou cancelar um benefício, por favor envie o seu código de protocolo (ex: \`PROT-RES-2026-ABC123\`).`
    );
    return;
  }

  const pState = session.protocolState || (session.state.replace('PROTOCOL_', '') || 'IDENTIFIED');

  // 3. State Machine Flow
  switch (pState) {
    case 'IDENTIFIED':
    case 'AWAITING_ACTION': {
      let _overridenText = text;
      const _t = (text || '').trim();
      if (_t === '1') _overridenText = 'alterar';
      else if (_t === '2') _overridenText = 'cancelar';
      else if (_t === '3') _overridenText = 'consultar';
      
      callGeminiProtocolNLU(_overridenText, (errNlu, nlu) => {
        if (nlu.intent === 'cancelar') {
          session.state = 'PROTOCOL_AWAITING_CANCEL_CONFIRM';
          session.protocolState = 'AWAITING_CANCEL_CONFIRM';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(
            fromPhone,
            [
              `⚠️ ATENÇÃO — CONFIRMAÇÃO DE CANCELAMENTO`,
              ``,
              `Deseja realmente cancelar o protocolo *${session.protocolCode}* da parceria *${session.protocolRecord.parceiro_nome}*?`,
              ``,
              `• Digite *SIM* para confirmar o cancelamento definitivo.`,
              `• Digite *NÃO* para voltar e manter seu benefício ativo.`
            ].join('\n')
          );
          return;
        }

        if (nlu.intent === 'consultar') {
          supabaseGet('/rest/v1/parceiros_resgates?codigo_gerado=eq.' + encodeURIComponent(session.protocolCode) + '&select=*,parceiros(id,name,slug)&limit=1', (errF, rowsF) => {
            const fresh = (rowsF && rowsF[0]) || session.protocolRecord;
            const partnerName = fresh.parceiros?.name || fresh.parceiro_nome || 'Parceiro GSA';

            let statusText = fresh.status.toUpperCase();
            if (fresh.status === 'recusado') {
              statusText = '❌ RECUSADO';
            } else if (fresh.status === 'analise') {
              statusText = '⚠️ EM ANÁLISE';
            }

            const responseLines = [
              `📋 *Situação do Protocolo ${fresh.codigo_gerado}*`,
              ``,
              `• *Parceiro:* ${partnerName}`,
              `• *Titular:* ${fresh.nome_completo}`,
              `• *E-mail:* ${fresh.email || 'Não informado'}`,
              `• *Telefone:* ${fresh.telefone}`,
              `• *Status Atual:* ${statusText}`
            ];

            if (fresh.status === 'recusado' && fresh.motivo_recusa) {
              responseLines.push(`• *Motivo da Recusa:* ${fresh.motivo_recusa}`);
            }

            sendWhatsAppReply(
              fromPhone,
              responseLines.join('\n')
            );
          });
          return;
        }

        if (nlu.intent === 'alterar') {
          if (nlu.field && nlu.new_value) {
            // One-shot alteration!
            const validation = validateAndSanitizeField(nlu.field, nlu.new_value);
            if (!validation.valid) {
              session.state = 'PROTOCOL_AWAITING_NEW_VALUE';
              session.protocolState = 'AWAITING_NEW_VALUE';
              session.targetField = nlu.field;
              userSessions[fromPhone] = session;
              sendWhatsAppReply(fromPhone, `❌ ${validation.error}\n\nPor favor, digite o novo valor corretamente:`);
              return;
            }

            const oldVal = session.protocolRecord[nlu.field];
            const fieldLabel = nlu.field === 'nome_completo' ? 'Nome' : nlu.field === 'email' ? 'E-mail' : 'Telefone';

            supabasePatch('/rest/v1/parceiros_resgates?id=eq.' + encodeURIComponent(session.protocolRecord.id), { [nlu.field]: validation.value }, (errPatch, resPatch) => {
              session.protocolRecord[nlu.field] = validation.value;
              session.state = 'PROTOCOL_IDENTIFIED';
              session.protocolState = 'IDENTIFIED';
              session.targetField = null;
              userSessions[fromPhone] = session;

              dispatchAdminProtocolAlert(
                'ALTERACAO',
                session.protocolRecord,
                `• Campo: ${fieldLabel}\n• Anterior: ${oldVal || 'vazio'}\n• Novo: ${validation.value}`
              );

              sendWhatsAppReply(
                fromPhone,
                [
                  `✅ *${fieldLabel} atualizado com sucesso!*`,
                  ``,
                  `• *Novo valor:* ${validation.value}`,
                  `• *Protocolo:* \`${session.protocolCode}\``,
                  ``,
                  `O que mais posso fazer por você?`
                ].join('\n')
              );
            });
            return;
          }

          if (nlu.field && !nlu.new_value) {
            session.state = 'PROTOCOL_AWAITING_NEW_VALUE';
            session.protocolState = 'AWAITING_NEW_VALUE';
            session.targetField = nlu.field;
            userSessions[fromPhone] = session;
            const fieldLabel = nlu.field === 'nome_completo' ? 'Nome Completo' : nlu.field === 'email' ? 'E-mail' : 'Telefone com DDD';
            sendWhatsAppReply(fromPhone, `Por favor, digite o seu novo *${fieldLabel}*:`);
            return;
          }

          // User said "alterar" without field
          session.state = 'PROTOCOL_AWAITING_FIELD';
          session.protocolState = 'AWAITING_FIELD';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(
            fromPhone,
            [
              `Qual dado você gostaria de alterar?`,
              ``,
              `1️⃣ *Nome Completo*`,
              `2️⃣ *E-mail*`,
              `3️⃣ *Telefone*`
            ].join('\n')
          );
          return;
        }


        if (nlu.intent === 'encerrar' || nlu.intent === 'negar_cancelamento' || /^(n[aã]o|obrigado|valeu|tchau|encerrar|sair|nada|ok)$/i.test(_t)) {
          delete userSessions[fromPhone];
          sendWhatsAppReply(fromPhone, "Tudo bem! Se precisar de mais alguma coisa, é só chamar. Sessão encerrada.");
          return;
        }

        if (nlu.intent === 'resgatar') {
          delete userSessions[fromPhone];
          processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData);
          return;
        }

        // Unrecognized intent
        sendWhatsAppReply(
          fromPhone,
          [
            `Desculpe, não entendi. Você pode:`,
            ``,
            `• Digitar *alterar* para atualizar seus dados.`,
            `• Digitar *cancelar* para cancelar o protocolo.`,
            `• Digitar *consultar* para ver os dados atuais.`,
              `• Digitar *resgatar* para solicitar um novo benefício.`
          ].join('\n')
        );
      });
      return;
    }

    case 'AWAITING_FIELD': {
      const lower = text.toLowerCase();
      let chosenField = null;

      if (/1|nome|titular/i.test(lower)) chosenField = 'nome_completo';
      else if (/2|email|e-mail|correio/i.test(lower)) chosenField = 'email';
      else if (/3|telefone|celular|whatsapp|fone/i.test(lower)) chosenField = 'telefone';

      if (!chosenField) {
        sendWhatsAppReply(
          fromPhone,
          [
            `Opção inválida. Por favor, escolha qual dado deseja alterar:`,
            ``,
            `1️⃣ *Nome Completo*`,
            `2️⃣ *E-mail*`,
            `3️⃣ *Telefone*`
          ].join('\n')
        );
        return;
      }

      session.state = 'PROTOCOL_AWAITING_NEW_VALUE';
      session.protocolState = 'AWAITING_NEW_VALUE';
      session.targetField = chosenField;
      userSessions[fromPhone] = session;

      const fieldLabel = chosenField === 'nome_completo' ? 'Nome Completo' : chosenField === 'email' ? 'E-mail' : 'Telefone com DDD';
      sendWhatsAppReply(fromPhone, `Perfeito! Digite o novo *${fieldLabel}*:`);
      return;
    }

    case 'AWAITING_NEW_VALUE': {
      const targetField = session.targetField || 'email';
      const validation = validateAndSanitizeField(targetField, text);

      if (!validation.valid) {
        sendWhatsAppReply(fromPhone, `❌ ${validation.error}\n\nTente novamente:`);
        return;
      }

      const oldVal = session.protocolRecord[targetField];
      const fieldLabel = targetField === 'nome_completo' ? 'Nome' : targetField === 'email' ? 'E-mail' : 'Telefone';

      supabasePatch('/rest/v1/parceiros_resgates?id=eq.' + encodeURIComponent(session.protocolRecord.id), { [targetField]: validation.value }, (errPatch, resPatch) => {
        session.protocolRecord[targetField] = validation.value;
        session.state = 'PROTOCOL_IDENTIFIED';
        session.protocolState = 'IDENTIFIED';
        session.targetField = null;
        userSessions[fromPhone] = session;

        dispatchAdminProtocolAlert(
          'ALTERACAO',
          session.protocolRecord,
          `• Campo: ${fieldLabel}\n• Anterior: ${oldVal || 'vazio'}\n• Novo: ${validation.value}`
        );

        sendWhatsAppReply(
          fromPhone,
          [
            `✅ *${fieldLabel} alterado com sucesso!*`,
            ``,
            `• *Novo valor:* ${validation.value}`,
            `• *Protocolo:* \`${session.protocolCode}\``,
            ``,
            `Posso ajudar com mais alguma informação?`
          ].join('\n')
        );
      });
      return;
    }

    case 'AWAITING_CANCEL_CONFIRM': {
      callGeminiProtocolNLU(text, (errNlu, nlu) => {
        if (nlu.intent === 'confirmar_cancelamento') {
          const timestamp = new Date().toISOString();
          supabasePatch('/rest/v1/parceiros_resgates?id=eq.' + encodeURIComponent(session.protocolRecord.id), { status: 'cancelado', data_cancelamento: timestamp }, (errPatch, resPatch) => {
            session.protocolRecord.status = 'cancelado';
            session.protocolRecord.data_cancelamento = timestamp;
            session.state = 'PROTOCOL_IDENTIFIED';
            session.protocolState = 'IDENTIFIED';
            userSessions[fromPhone] = session;

            dispatchAdminProtocolAlert(
              'CANCELAMENTO',
              session.protocolRecord,
              `• Status: CANCELADO\n• Data/Hora do Cancelamento: ${timestamp}`
            );

            sendWhatsAppReply(
              fromPhone,
              [
                `❌ Protocolo ${session.protocolCode} cancelado com sucesso.`,
                ``,
                `O seu resgate para *${session.protocolRecord.parceiro_nome}* foi cancelado em nosso sistema.`,
                ``,
                `Caso mude de ideia ou precise de assistência, entre em contato com nosso atendimento em *${SUPPORT_COMPANY_PHONE}*.`
              ].join('\n')
            );
          });
          return;
        }

        if (nlu.intent === 'negar_cancelamento') {
          session.state = 'PROTOCOL_IDENTIFIED';
          session.protocolState = 'IDENTIFIED';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(
            fromPhone,
            [
              `👍 Cancelamento abortado!`,
              ``,
              `Seu protocolo \`${session.protocolCode}\` continua ativo normalmente.`,
              ``,
              `Deseja fazer alguma alteração cadastral?`
            ].join('\n')
          );
          return;
        }

        sendWhatsAppReply(
          fromPhone,
          `Por favor, responda *SIM* para confirmar o cancelamento do protocolo ${session.protocolCode} ou *NÃO* para manter o benefício.`
        );
      });
      return;
    }

    default: {
      session.state = 'PROTOCOL_IDENTIFIED';
      session.protocolState = 'IDENTIFIED';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `O que você gostaria de fazer com o protocolo \`${session.protocolCode}\`? Digite *alterar*, *cancelar* ou *consultar*.`);
      return;
    }
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// 🤝 MÓDULO: RESGATE CONVERSACIONAL DE BENEFÍCIOS DE PARCEIROS (1:1 COM A WEB)
// ══════════════════════════════════════════════════════════════════════════════

let _partnersCache = null;
let _partnersCacheTs = 0;

function fetchPartnersForAI(callback) {
  const now = Date.now();
  if (_partnersCache && Array.isArray(_partnersCache) && _partnersCache.length > 0 && (now - _partnersCacheTs) < 300000) {
    return callback(_partnersCache, null);
  }
  const url = '/rest/v1/parceiros?status=eq.ativo&select=id,slug,name,category,short_description,description,benefits,logo_url,cover_url,website,redemption_has_coupon,redemption_coupon_code,redemption_has_voucher,redemption_has_link,redemption_link,redemption_auto_redirect,redemption_instructions,redemption_delay_24h,featured,display_order&order=featured.desc,display_order.asc,name.asc&limit=100';
  supabaseGet(url, (err, rows) => {
    if (!err && Array.isArray(rows) && rows.length > 0) {
      _partnersCache = rows;
      _partnersCacheTs = Date.now();
      callback(rows, null);
    } else {
      _partnersCache = null;
      _partnersCacheTs = 0;
      const fetchError = err || new Error(
        rows && typeof rows === 'object' && rows.message
          ? rows.message
          : 'Consulta de parceiros retornou uma resposta inválida'
      );
      console.error('❌ Falha ao consultar parceiros ativos:', fetchError.message);
      callback([], fetchError);
    }
  });
}

function extractPartnerTermFromText(text) {
  if (!text) return '';
  let clean = text.trim()
    .replace(/^#\s*/, '')
    .replace(/^(ola|olá|oi|bom dia|boa tarde|boa noite|por favor|gostaria de|quero|como faco para|como faço para|desejo|favor)\s+/gi, '')
    .replace(/\b(resgatar|resgate|pegar|ativar|obter|solicitar|usar|meu|o|um|uma|os|as)\b/gi, ' ')
    .replace(/\b(beneficio|benefício|beneficios|benefícios|cupom|cupons|desconto|descontos|convenio|convênio|parceria|parcerias|parceiro|parceira|parceiros)\b/gi, ' ')
    .replace(/\b(de|da|do|das|dos|no|na|nos|nas|para|com|em)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean;
}

function searchPartnersFuzzy(query, partnersList) {
  if (!partnersList || partnersList.length === 0) return [];
  const rawQ = (query || '').trim();
  if (!rawQ) return partnersList.slice(0, 5);

  const cleanQuery = rawQ.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(quero|resgatar|resgate|beneficio|benefício|cupom|cupons|desconto|descontos|parceiro|parceiros|parceria|convenio|convênio|da|do|de|das|dos|para|com|o|a|os|as|por favor|gostaria|obter|pegar)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuery) return partnersList.slice(0, 5);

  const scored = partnersList.map(p => {
    const pName = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const pSlug = (p.slug || '').toLowerCase().trim();
    const pCat = (p.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const pBen = (p.benefits || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    let score = 0;
    if (pSlug === cleanQuery || pName === cleanQuery) {
      score = 1.0;
    } else if (pName.startsWith(cleanQuery)) {
      score = 0.95;
    } else if (pName.includes(cleanQuery)) {
      score = 0.88;
    } else if (pSlug.includes(cleanQuery)) {
      score = 0.85;
    } else if (pCat.includes(cleanQuery)) {
      score = 0.78;
    } else if (pBen.includes(cleanQuery)) {
      score = 0.72;
    } else {
      const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length >= 2);
      let matchCount = 0;
      queryTokens.forEach(t => {
        if (pName.includes(t) || pCat.includes(t) || pBen.includes(t) || pSlug.includes(t)) {
          matchCount++;
        }
      });
      if (queryTokens.length > 0 && matchCount > 0) {
        score = 0.5 + (matchCount / queryTokens.length) * 0.35;
      }
    }
    return { partner: p, score };
  });

  return scored
    .filter(item => item.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .map(item => item.partner);
}

function checkDuplicateRedemptionDb(parceiroId, email, telefone, callback) {
  if (!parceiroId || (!email && !telefone)) return callback(null, false, null);

  const cleanPhone = (telefone || '').replace(/\D/g, '');
  const cleanEmail = (email || '').trim().toLowerCase();

  supabaseRpc('gsa_bot_find_partner_redemption', {
    p_parceiro_id: parceiroId,
    p_email: cleanEmail || null,
    p_telefone: cleanPhone || null
  }, (err, rows) => {
    if (err) return callback(err, false, null);
    if (!Array.isArray(rows)) return callback(new Error('Resposta inválida ao consultar resgates anteriores'), false, null);
    if (rows.length === 0) return callback(null, false, null);
    return callback(null, true, rows[0]);
  });
}

async function dispatchAdminRedemptionAlert(type, partnerName, protocol, name, phone, email, details) {
  const isDuplicate = type === 'DUPLICATE_ANALISE';
  const alertMessage = [
    `🔔 *ALERTA MASTER: ${isDuplicate ? 'RESGATE DUPLICADO COM JUSTIFICATIVA (EM ANÁLISE)' : 'NOVA SOLICITAÇÃO DE RESGATE (SLA 24H)'}*`,
    ``,
    `🤝 *Parceiro:* ${partnerName || 'Parceiro GSA'}`,
    `🔖 *Protocolo:* \`${protocol}\``,
    `👤 *Titular:* ${name || 'Não informado'}`,
    `📞 *Telefone:* ${phone || 'Não informado'}`,
    `📧 *E-mail:* ${email || 'Não informado'}`,
    `⏱️ *Prazo SLA:* ${isDuplicate ? 'Até 48 horas úteis (Avaliação Gerencial)' : '24 horas para provisionamento de link/cupom'}`,
    ``,
    isDuplicate ? `📝 *Justificativa do Cliente:*\n"${details}"` : `📋 *Status:* Pendente de Link de Ativação no Painel Admin`,
    ``,
    `⏰ *Data/Hora:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    `_Sistema Automatizado WhatsApp GSA HUB_`,
  ].join('\n');

  try {
    sendWhatsAppReply(ADMIN_MASTER_PHONE, alertMessage);
  } catch (err) {
    console.error('❌ Erro ao disparar alerta admin para resgate:', err.message);
  }
}

function selectRedemptionPartner(fromPhone, session, partner) {
  session.redemptionPartner = partner;
  session.redemptionCandidates = [];
  session.redemptionForm = session.redemptionForm || {
    nomeCompleto: '',
    email: '',
    telefone: '',
    justificativa: ''
  };

  // Pre-fill from existing profile/session if available
  if (!session.redemptionForm.nomeCompleto) {
    const existingName = session.clientFullName || session.clientData?.nome || session.clientData?.nome_completo || session.profile?.cliente?.nome || session.profile?.primaryName || '';
    if (existingName && existingName.split(/\s+/).filter(p => p.length >= 2).length >= 2) {
      session.redemptionForm.nomeCompleto = existingName.trim();
    }
  }
  if (!session.redemptionForm.email) {
    const existingEmail = session.clientData?.email || session.profile?.cliente?.email || '';
    if (existingEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existingEmail.trim())) {
      session.redemptionForm.email = existingEmail.trim().toLowerCase();
    }
  }
  if (!session.redemptionForm.telefone) {
    session.redemptionForm.telefone = fromPhone;
  }

  // O telefone do WhatsApp já é suficiente para reconhecer um resgate anterior.
  // Faça essa verificação antes de solicitar nome/e-mail novamente.
  if (session.redemptionPhoneCheckedPartnerId !== partner.id && session.redemptionForm.telefone) {
    session.redemptionPhoneCheckedPartnerId = partner.id;
    userSessions[fromPhone] = session;
    checkDuplicateRedemptionDb(partner.id, null, session.redemptionForm.telefone, (errDupe, isDupe, dupeRow) => {
      if (errDupe) {
        session.redemptionPhoneCheckedPartnerId = null;
        userSessions[fromPhone] = session;
        console.error('❌ Falha na verificação antecipada de resgate:', errDupe.message);
        sendWhatsAppReply(fromPhone, '⚠️ Não foi possível consultar seu histórico de benefícios agora. Tente novamente em instantes ou fale com nosso suporte no número *' + SUPPORT_COMPANY_PHONE + '*.');
        return;
      }
      if (isDupe) {
        handleDuplicateRedemptionDetected(fromPhone, session, partner, dupeRow);
        return;
      }
      selectRedemptionPartner(fromPhone, session, partner);
    });
    return;
  }

  // Check what is missing
  if (!session.redemptionForm.nomeCompleto) {
    session.state = 'REDEMPTION_COLLECT_NAME';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(
      fromPhone,
      [
        `🤝 *Resgate de Benefício: ${partner.name}*`,
        `🎁 *Benefício:* ${partner.benefits || 'Desconto exclusivo GSA HUB'}`,
        ``,
        `Para prosseguirmos com o seu resgate, por favor informe o seu *Nome Completo* (nome e sobrenome):`,
        ``,
        `_Ou digite 0 para voltar ao menu._`
      ].join('\n')
    );
    return;
  }

  if (!session.redemptionForm.email) {
    session.state = 'REDEMPTION_COLLECT_EMAIL';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(
      fromPhone,
      [
        `Ótimo, *${session.redemptionForm.nomeCompleto}*!`,
        `Agora informe o seu *E-mail* para liberação e envio do seu cupom/benefício:`,
        ``,
        `_Ou digite 0 para voltar._`
      ].join('\n')
    );
    return;
  }

  if (!session.redemptionForm.telefone) {
    session.state = 'REDEMPTION_COLLECT_PHONE';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(
      fromPhone,
      [
        `Por favor, confirme o seu *Telefone / WhatsApp com DDD* (ex: 11987654321):`,
        ``,
        `_Ou digite 0 para voltar._`
      ].join('\n')
    );
    return;
  }

  // All fields ready, proceed to duplicate check & RPC
  checkDuplicateAndExecuteRedemption(fromPhone, session);
}

function checkDuplicateAndExecuteRedemption(fromPhone, session) {
  const partner = session.redemptionPartner;
  const form = session.redemptionForm;

  checkDuplicateRedemptionDb(partner.id, form.email, form.telefone, (errDupe, isDupe, dupeRow) => {
    if (isDupe) {
      handleDuplicateRedemptionDetected(fromPhone, session, partner, dupeRow);
      return;
    }

    executeBenefitRedemptionRpc(fromPhone, session, false);
  });
}

function handleDuplicateRedemptionDetected(fromPhone, session, partner, dupeRow) {
  session.state = 'REDEMPTION_AWAITING_JUSTIFICATION';
  session.redemptionDuplicateRecord = dupeRow;
  userSessions[fromPhone] = session;
  sendWhatsAppReply(
    fromPhone,
    [
      `⚠️ *Identificamos um resgate anterior para este parceiro.*`,
      ``,
      `Você (ou este contato) já possui um registro de resgate para o benefício de *${partner.name}*.`,
      ``,
      `Caso precise de uma nova liberação (por exemplo: outro animal de estimação, outro dependente ou nova necessidade), por favor *digite uma breve justificativa* explicando o motivo da nova solicitação:`,
      ``,
      `Assim que você enviar, nossa gerência avaliará sua solicitação com prioridade (Prazo: até 48h).`,
      ``,
      `_Ou digite 0 para cancelar e voltar ao menu._`
    ].join('\n')
  );
}

function executeBenefitRedemptionRpc(fromPhone, session, forceOverride) {
  const partner = session.redemptionPartner;
  const form = session.redemptionForm;

  const rpcParams = {
    p_parceiro_id: partner.id || null,
    p_parceiro_slug: partner.slug || null,
    p_nome_completo: form.nomeCompleto.trim(),
    p_telefone: form.telefone.trim(),
    p_cliente_id: session.clientData?.id || session.profile?.cliente?.id || null,
    p_email: form.email ? form.email.trim() : null
  };

  supabaseRpc('gsa_public_resgatar_beneficio_parceiro', rpcParams, (err, result) => {
    if (err) {
      // Overload fallback for PGRST202 (5 params without p_email)
      if (err.message && (err.message.includes('PGRST202') || err.message.includes('p_email'))) {
        const fallbackParams = {
          p_parceiro_id: rpcParams.p_parceiro_id,
          p_parceiro_slug: rpcParams.p_parceiro_slug,
          p_nome_completo: rpcParams.p_nome_completo,
          p_telefone: rpcParams.p_telefone,
          p_cliente_id: rpcParams.p_cliente_id
        };
        supabaseRpc('gsa_public_resgatar_beneficio_parceiro', fallbackParams, (err2, result2) => {
          if (err2 || !result2 || !result2.success) {
            console.error('❌ Erro na RPC de resgate (fallback):', err2?.message);
            sendWhatsAppReply(fromPhone, '❌ Tivemos uma instabilidade ao processar seu resgate. Por favor, tente novamente em instantes ou fale com nosso suporte em *' + SUPPORT_COMPANY_PHONE + '*.');
            session.state = 'MAIN_MENU';
            userSessions[fromPhone] = session;
            return;
          }
          handleRedemptionSuccess(fromPhone, session, partner, form, result2, forceOverride);
        });
        return;
      }

      console.error('❌ Erro na RPC de resgate:', err.message);
      sendWhatsAppReply(fromPhone, '❌ Não foi possível concluir o resgate: ' + (err.message || 'Erro no servidor') + '.\nPor favor, tente novamente ou fale com nosso suporte.');
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      return;
    }

    if (!result || !result.success) {
      sendWhatsAppReply(fromPhone, '❌ Não foi possível concluir o resgate. Verifique os dados e tente novamente.');
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      return;
    }

    handleRedemptionSuccess(fromPhone, session, partner, form, result, forceOverride);
  });
}

function handleRedemptionSuccess(fromPhone, session, partner, form, result, forceOverride) {
  const protocol = result.protocolo || result.codigo_gerado || ('PROT-RES-' + new Date().getFullYear() + '-GSA001');

  if (forceOverride && form.justificativa && result.resgate_id) {
    supabasePatch(`/rest/v1/parceiros_resgates?id=eq.${result.resgate_id}`, {
      alerta_duplicidade: true,
      justificativa_duplicidade: form.justificativa,
      status: 'analise'
    }, (errPatch) => {
      if (errPatch) console.error('⚠️ Erro ao atualizar justificativa de duplicidade:', errPatch.message);
    });

    result.status = 'analise';

    sendWhatsAppReply(
      fromPhone,
      [
        `📋 *Solicitação de Resgate Registrada em Análise!* ⏳`,
        ``,
        `Olá, *${form.nomeCompleto}*!`,
        `Sua solicitação de re-resgate do benefício do parceiro *${partner.name}* foi enviada com sucesso para nossa gerência com a sua justificativa.`,
        ``,
        `🔖 *Protocolo Oficial:* \`${protocol}\``,
        `⏱️ *Prazo de Análise:* Em até 48 horas úteis`,
        `📝 *Justificativa Registrada:* "${form.justificativa}"`,
        ``,
        `Assim que for avaliado, você receberá a notificação com o resultado aqui pelo WhatsApp!`,
        ``,
        `_Guarde o número do seu protocolo para consultas._`
      ].join('\n')
    );

    dispatchAdminRedemptionAlert('DUPLICATE_ANALISE', partner.name, protocol, form.nomeCompleto, form.telefone, form.email, form.justificativa);

    session.state = 'MAIN_MENU';
    session.redemptionPartner = null;
    session.redemptionCandidates = [];
    session.redemptionForm = null;
    session.redemptionDuplicateRecord = null;
    userSessions[fromPhone] = session;
    return;
  }

  // Regular non-override redemption
  const isDelay24h = Boolean(
    partner.redemption_delay_24h ||
    result.delay_24h ||
    result.status === 'analise' ||
    (!partner.redemption_has_coupon && !partner.redemption_has_voucher && !partner.redemption_has_link)
  );

  if (!isDelay24h) {
    // Immediate Auto-Coupon Delivery
    const couponCode = result.codigo_gerado || partner.redemption_coupon_code || '';
    const link = result.link || partner.redemption_link || partner.website || '';
    const instructions = result.instructions || partner.redemption_instructions || 'Apresente o cupom no checkout ou diretamente no parceiro.';

    const replyLines = [
      `🎉 *Parabéns! Seu benefício foi resgatado com sucesso!* 🎁`,
      ``,
      `🤝 *Parceiro:* ${partner.name}`,
      `🎁 *Benefício:* ${partner.benefits || 'Desconto exclusivo GSA HUB'}`,
      ``
    ];

    if (couponCode) {
      replyLines.push(`🎟️ *Cupom de Desconto:* \`${couponCode}\``);
      replyLines.push(`_(Toque no código acima para copiar)_`);
      replyLines.push(``);
    }

    if (link) {
      replyLines.push(`🌐 *Acesse o Site:* ${link}`);
      replyLines.push(``);
    }

    if (instructions) {
      replyLines.push(`📖 *Como Utilizar:*`);
      replyLines.push(`${instructions}`);
      replyLines.push(``);
    }

    replyLines.push(`🔖 *Protocolo Oficial:* \`${protocol}\``);
    replyLines.push(``);
    replyLines.push(`Aproveite o seu benefício! Se precisar de algo mais, estamos à disposição. 😊`);

    sendWhatsAppReply(fromPhone, replyLines.join('\n'));
  } else {
    // 24h SLA Notice
    sendWhatsAppReply(
      fromPhone,
      [
        `✅ *Solicitação de Benefício Confirmada!* ⏳`,
        ``,
        `Olá, *${form.nomeCompleto}*!`,
        `Registramos com sucesso a sua solicitação para o benefício de *${partner.name}*.`,
        ``,
        `🔖 *Protocolo Oficial:* \`${protocol}\``,
        `⏱️ *Prazo de Ativação:* Em até 24 horas úteis`,
        `🎁 *Benefício:* ${partner.benefits || 'Condição exclusiva GSA HUB'}`,
        ``,
        `📌 *Próximos Passos:*`,
        `1️⃣ Nossa equipe técnica está gerando o seu acesso exclusivo junto ao parceiro.`,
        `2️⃣ Você receberá o seu link ou código de ativação diretamente aqui neste WhatsApp em até 24 horas.`,
        ``,
        `_Guarde seu protocolo para consultar o andamento a qualquer momento!_`
      ].join('\n')
    );

    dispatchAdminRedemptionAlert('SLA_24H', partner.name, protocol, form.nomeCompleto, form.telefone, form.email, 'Aguardando geração de link de ativação');
  }

  session.state = 'MAIN_MENU';
  session.redemptionPartner = null;
  session.redemptionCandidates = [];
  session.redemptionForm = null;
  session.redemptionDuplicateRecord = null;
  userSessions[fromPhone] = session;
}

function handlePartnerRedemptionFlow(fromPhone, rawText, session, partnerQuery) {
  const text = (rawText || '').trim();

  // Intelligent Exit / Cancel detection across all redemption steps
  const isExitCommand = /^(0|voltar|cancelar|sair|menu|desistir|deixa pra l[aá]|n[aã]o|n[aã]o quero(?: mais)?|deixa quieto|abortar|fim|encerrar|cancela|sair do menu)$/i.test(text.toLowerCase().trim());
  if (isExitCommand) {
    session.state = 'MAIN_MENU';
    session.redemptionPartner = null;
    session.redemptionCandidates = [];
    session.redemptionForm = null;
    session.redemptionDuplicateRecord = null;
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '✅ Solicitação cancelada. Se precisar de algo mais, estou à disposição!\n\n' + getMainMenuText(session.profile));
    return;
  }

    // 1. If currently in REDEMPTION_AWAITING_JUSTIFICATION
  if (session.state === 'REDEMPTION_AWAITING_JUSTIFICATION') {
    if (isExitCommand) {
      session.state = 'MAIN_MENU';
      session.redemptionPartner = null;
      session.redemptionCandidates = [];
      session.redemptionForm = null;
      session.redemptionDuplicateRecord = null;
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '✅ Solicitação de resgate cancelada. Se precisar de algo mais, estou à disposição!\n\n' + getMainMenuText(session.profile));
      return;
    }
    if (text.length < 5) {
      sendWhatsAppReply(fromPhone, '⚠️ Por favor, digite uma justificativa detalhando o motivo da nova solicitação (ex: "Adotei um novo pet").\n\n_Ou digite SAIR para cancelar._');
      return;
    }
    session.redemptionForm = session.redemptionForm || {};
    session.redemptionForm.justificativa = text;
    userSessions[fromPhone] = session;
    executeBenefitRedemptionRpc(fromPhone, session, true);
    return;
  }

  // 2. If currently in REDEMPTION_COLLECT_NAME
  if (session.state === 'REDEMPTION_COLLECT_NAME') {
    const parts = text.split(/\s+/).filter(p => p.length >= 2);
    if (parts.length < 2 || text.length < 3) {
      sendWhatsAppReply(fromPhone, '❌ Por favor, informe o seu *Nome Completo* (ao menos nome e sobrenome, ex: João da Silva).\n\n_Digite 0 para voltar._');
      return;
    }
    session.redemptionForm = session.redemptionForm || {};
    session.redemptionForm.nomeCompleto = text;
    userSessions[fromPhone] = session;
    selectRedemptionPartner(fromPhone, session, session.redemptionPartner);
    return;
  }

  // 3. If currently in REDEMPTION_COLLECT_EMAIL
  if (session.state === 'REDEMPTION_COLLECT_EMAIL') {
    const cleanEmail = text.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      sendWhatsAppReply(fromPhone, '❌ Por favor, informe um *E-mail válido* (ex: seu.nome@email.com).\n\n_Digite 0 para voltar._');
      return;
    }
    session.redemptionForm = session.redemptionForm || {};
    session.redemptionForm.email = cleanEmail;
    userSessions[fromPhone] = session;
    selectRedemptionPartner(fromPhone, session, session.redemptionPartner);
    return;
  }

  // 4. If currently in REDEMPTION_COLLECT_PHONE
  if (session.state === 'REDEMPTION_COLLECT_PHONE') {
    const digits = text.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) {
      sendWhatsAppReply(fromPhone, '❌ Telefone inválido. Informe o número com DDD (ex: 11987654321).\n\n_Digite 0 para voltar._');
      return;
    }
    const normPhone = digits.startsWith('55') ? digits : `55${digits}`;
    session.redemptionForm = session.redemptionForm || {};
    session.redemptionForm.telefone = normPhone;
    userSessions[fromPhone] = session;
    selectRedemptionPartner(fromPhone, session, session.redemptionPartner);
    return;
  }

  // 5. If currently in REDEMPTION_SELECT_PARTNER
  if (session.state === 'REDEMPTION_SELECT_PARTNER') {
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && session.redemptionCandidates && session.redemptionCandidates[num - 1]) {
      const selected = session.redemptionCandidates[num - 1];
      selectRedemptionPartner(fromPhone, session, selected);
      return;
    }
    // If not a number, treat as a new search query
    partnerQuery = text;
  }

  // 6. Initial Entry / Partner Query Search
  fetchPartnersForAI((partners, fetchError) => {
    if (fetchError) {
      sendWhatsAppReply(fromPhone, '⚠️ Não foi possível consultar nossos parceiros agora por uma instabilidade temporária. Tente novamente em instantes ou fale com nosso suporte no número *' + SUPPORT_COMPANY_PHONE + '*.');
      return;
    }
    if (!partners || partners.length === 0) {
      sendWhatsAppReply(fromPhone, '⚠️ Não encontramos parceiros ativos disponíveis no momento. Fale com nosso suporte no número *' + SUPPORT_COMPANY_PHONE + '*.');
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      return;
    }

    const queryTerm = partnerQuery || extractPartnerTermFromText(text) || text;
    const matches = searchPartnersFuzzy(queryTerm, partners);

    if (matches.length === 1) {
      selectRedemptionPartner(fromPhone, session, matches[0]);
    } else if (matches.length > 1) {
      const topMatch = matches[0];
      const qNorm = (queryTerm || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const isExact = (topMatch.slug && topMatch.slug.toLowerCase() === qNorm) ||
                      (topMatch.name && topMatch.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === qNorm);

      if (isExact) {
        selectRedemptionPartner(fromPhone, session, topMatch);
      } else {
        session.state = 'REDEMPTION_SELECT_PARTNER';
        session.redemptionCandidates = matches.slice(0, 5);
        userSessions[fromPhone] = session;

        const candidateOptions = session.redemptionCandidates.map((c, i) => {
          const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i] || `*${i + 1}*`;
          return `${emoji} *${c.name}* (${c.category || 'Parceiro'})\n🎁 ${c.benefits || 'Desconto exclusivo'}`;
        }).join('\n\n');

        sendWhatsAppReply(
          fromPhone,
          [
            `🔍 *Encontrei estas opções de parceiros:*`,
            ``,
            candidateOptions,
            ``,
            `👉 *Digite o número da opção desejada (1 a ${session.redemptionCandidates.length})* para resgatar, ou digite outro nome para buscar novamente.`,
            ``,
            `_Digite 0 para voltar ao menu._`
          ].join('\n')
        );
      }
    } else {
      session.state = 'REDEMPTION_SELECT_PARTNER';
      session.redemptionCandidates = partners.slice(0, 5);
      userSessions[fromPhone] = session;

      const topOptions = session.redemptionCandidates.map((c, i) => {
        const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i] || `*${i + 1}*`;
        return `${emoji} *${c.name}* (${c.category || 'Parceiro'})\n🎁 ${c.benefits || 'Desconto exclusivo'}`;
      }).join('\n\n');

      sendWhatsAppReply(
        fromPhone,
        [
          `❓ *Não encontrei nenhum parceiro com o termo "${queryTerm}".*`,
          ``,
          `Aqui estão alguns dos nossos parceiros em destaque:`,
          ``,
          topOptions,
          ``,
          `👉 *Digite o número da opção desejada* ou digite o nome do parceiro que você procura.`,
          ``,
          `_Digite 0 para voltar ao menu._`
        ].join('\n')
      );
    }
  });
}


const PRODUCT_PHOTO_VAULT = {
  sneakers: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&auto=format&fit=crop&q=80'
  ],
  jeans: [
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=600&auto=format&fit=crop&q=80'
  ],
  shirt: [
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80'
  ],
  smartphone: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=80'
  ],
  phonecase: [
    'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=600&auto=format&fit=crop&q=80'
  ],
  watch: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?w=600&auto=format&fit=crop&q=80'
  ],
  headphones: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80'
  ],
  perfume: [
    'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600&auto=format&fit=crop&q=80'
  ],
  bag: [
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80'
  ],
  sunglasses: [
    'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80'
  ]
};

function getProductPhotosForSearch(term) {
  const clean = (term || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/tenis|sapato|calcado|sneaker|chuteira|bota|sandalia/i.test(clean)) return PRODUCT_PHOTO_VAULT.sneakers;
  if (/calca|jeans|bermuda|short/i.test(clean)) return PRODUCT_PHOTO_VAULT.jeans;
  if (/camisa|camiseta|blusa|moletom|polo|regata|roupa/i.test(clean)) return PRODUCT_PHOTO_VAULT.shirt;
  if (/celular|smartphone|iphone|samsung|xiaomi/i.test(clean)) return PRODUCT_PHOTO_VAULT.smartphone;
  if (/capa|capinha|case|pelicula/i.test(clean)) return PRODUCT_PHOTO_VAULT.phonecase;
  if (/relogio|smartwatch|watch/i.test(clean)) return PRODUCT_PHOTO_VAULT.watch;
  if (/fone|headphone|airpod|headset/i.test(clean)) return PRODUCT_PHOTO_VAULT.headphones;
  if (/perfume|fragrancia|colonia|cosmetico/i.test(clean)) return PRODUCT_PHOTO_VAULT.perfume;
  if (/bolsa|mochila|carteira|mala/i.test(clean)) return PRODUCT_PHOTO_VAULT.bag;
  if (/oculos|lente/i.test(clean)) return PRODUCT_PHOTO_VAULT.sunglasses;
  return PRODUCT_PHOTO_VAULT.sneakers;
}

// ─── FORMATAÇÃO DO CÓDIGO DE PRODUTO OFICIAL GSA (NUNCA EXIBIR CÓDIGO EXTERNO/SHOPEE) ───
function formatGSAProductCode(rawCode, item) {
  let code = rawCode || item?.codigo_produto || item?.codigo || '';
  if (!code && item?.id) {
    return `PRD-${String(item.id).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase()}`;
  }
  if (!code) return 'PRD-101';
  
  // Converte prefixos externos (SHP-, SHOPEE-, ML-, EXT-) para o padrão oficial GSA Store (PRD-)
  if (/^SHP[-_]?/i.test(code)) {
    return `PRD-${code.replace(/^SHP[-_]?/i, '')}`;
  }
  if (/^SHOPEE[-_]?/i.test(code)) {
    return `PRD-${code.replace(/^SHOPEE[-_]?/i, '')}`;
  }
  if (/^ML[-_]?/i.test(code) || /^EXT[-_]?/i.test(code)) {
    return `PRD-${code.replace(/^[A-Za-z]+[-_]?/i, '')}`;
  }
  if (/^PRD/i.test(code)) {
    return code.toUpperCase();
  }
  if (/^PR[-_]/i.test(code)) {
    return code.replace(/^PR[-_]/i, 'PRD-').toUpperCase();
  }
  return `PRD-${code.replace(/^[^0-9A-Za-z]+/i, '')}`;
}

// ─── MÓDULO 3: CACHE DE BUSCA EM MEMÓRIA (TTL 10 min) ───────────────────────
const SEARCH_CACHE = new Map(); // key: searchWord, value: { results, ts }
const SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// ─── MÓDULO 3: DICIONÁRIO DE SINÔNIMOS & ANÁLISE DE INTENÇÃO SEMÂNTICA ────────
const SYNONYM_MAP = {
  'pisante': 'tenis', 'sneaker': 'tenis', 'calcado': 'tenis', 'sapatilha': 'tenis',
  'brusinha': 'camisa', 'camiseta': 'camisa', 'blusa': 'camisa', 'polo': 'camisa',
  'regata': 'camisa', 'moletom': 'moletom', 'agasalho': 'moletom',
  'celular': 'smartphone', 'fone bluetooth': 'fone', 'airpod': 'fone',
  'headset': 'fone', 'earphone': 'fone',
  'relogio inteligente': 'smartwatch', 'smartband': 'smartwatch',
  'pulseira inteligente': 'smartwatch', 'capa': 'capinha', 'case': 'capinha',
  'oculos de sol': 'oculos', 'colonia': 'perfume', 'eau de toilette': 'perfume'
};

function parseProductSearchIntent(rawQuery) {
  const text = (rawQuery || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // 1. Detectar público-alvo (Adulto vs Infantil)
  const isExplicitChild = /(^|\s)(infantil|crianca|criancas|kids|bebe|bebes|menino|meninos|menina|meninas|filho|filha|recem nascido)($|\s)/i.test(text);
  const isExplicitNotChild = /nao.*(infantil|crianca|kids|bebe|menino|menina)|sem.*(infantil|crianca|kids)|adulto|adulta|para mim|pra mim/i.test(text);
  
  const audience = (isExplicitChild && !isExplicitNotChild) ? 'infantil' : 'adulto';

  // 2. Detectar gênero (Masculino vs Feminino)
  const isMasc = /(^|\s)(masculino|masculinos|homem|homens|masc|para homem|pro homem|dele)($|\s)/i.test(text);
  const isFem = /(^|\s)(feminino|femininos|mulher|mulheres|fem|para mulher|pra mulher|dela)($|\s)/i.test(text);
  let gender = 'todos';
  if (isMasc && !isFem) gender = 'masculino';
  if (isFem && !isMasc) gender = 'feminino';

  // Check phrase synonyms first in raw query
  let mainWord = '';
  for (const [phrase, canonical] of Object.entries(SYNONYM_MAP)) {
    if (text.includes(phrase)) {
      mainWord = canonical;
      break;
    }
  }

  if (!mainWord) {
    const isStopWord = (w) => {
      if (/^(nao|sem|eu|voce|vc|ele|ela|mim|pra|pro|para|com|por|em|no|na|nos|nas|um|uma|uns|umas|os|as|de|do|da|dos|das|que|qual|quais|tem|ter|tiver|se|ou|e)$/i.test(w)) return true;
      if (/^(quer|gostar|precis|apresent|mostr|mand|envi|traz|troux|ach|busc|procur|encontr|compr|ver|olh)/i.test(w)) return true;
      if (/^(tres|quatro|cinco|seis|sete|oito|nove|dez|opcoes|opcao|modelos|modelo|exemplos|exemplo|fotos|foto|imagens|imagem|baratos|baratas|barato|barata|melhores|melhor|hoje|agora)$/i.test(w)) return true;
      if (/^(infantil|crianca|criancas|kids|bebe|bebes|menino|menina|meninos|meninas|adulto|adulta|adultos|adultas|masculino|masculinos|feminino|femininos|homem|homens|mulher|mulheres|unissex)$/i.test(w)) return true;
      return false;
    };

    const words = text.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !isStopWord(w));
    mainWord = words.length > 0 ? (SYNONYM_MAP[words[0]] || words[0]) : '';
  }

  const isShowcase = /oferta|ofertas|promocao|promocoes|promocão|promocões|novidade|novidades|destaque|destaques|vitrine|mais vendidos|mais vendido|o que tem|o que voce tem|catalogo|produtos de hoje|principais/i.test(text) && 
    (!mainWord || /^(oferta|ofertas|promocao|promocoes|novidade|novidades|destaque|destaques|vitrine|produto|produtos|principal|principais|hoje|loja)$/i.test(mainWord));

  return { searchWord: mainWord || 'tenis', audience, gender, isShowcase };
}

function fetchCategoryTop(term, excludeRegex) {
  return new Promise((resolve) => {
    const path = `/produtos?nome=ilike.*${encodeURIComponent(term)}*&status=eq.ativo&order=valor.asc&limit=60&select=id,codigo_produto,nome,descricao,valor,imagem_url,imagem_url_2`;
    const supaKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path, method: 'GET',
      headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const list = JSON.parse(d);
          const valid = (Array.isArray(list) ? list : []).filter(p => {
            if (!p.imagem_url) return false;
            if (excludeRegex && excludeRegex.test(p.nome)) return false;
            return true;
          });
          resolve(valid[0] || null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(4000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function getFeaturedShowcase(limit = 5, callback) {
  const cacheKey = 'featured_showcase_daily';
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < SEARCH_CACHE_TTL) {
    return callback(null, cached.results.slice(0, limit));
  }

  try {
    const [tenis, smartwatch, fone, camisa, perfume] = await Promise.all([
      fetchCategoryTop('tenis', /mesa|ping|bola|espuma|limp|bolsa|mochila|porta|infantil|kids|kidstep|funfy|menino|menina|bebe/i),
      fetchCategoryTop('smartwatch', /pelicula|película|vidro|cabo|pulseira|carregador|capa|reparo|fonte/i),
      fetchCategoryTop('fone bluetooth', /case|capinha|cabo|adaptador|suporte|almofada/i),
      fetchCategoryTop('camisa', /stencil|molde|adesivo|infantil|kids|bebe|chaveiro|embalagem/i),
      fetchCategoryTop('perfume', /desinfetante|pinho|amaciante|sanol|frasco|embalagem|porta|amostra|limpador|aromatizador/i)
    ]);

    const items = [tenis, smartwatch, fone, camisa, perfume].filter(Boolean);
    if (items.length > 0) {
      SEARCH_CACHE.set(cacheKey, { results: items, ts: Date.now() });
      return callback(null, items.slice(0, limit));
    }
  } catch (e) {
    console.error('❌ Erro ao buscar vitrine:', e.message);
  }

  return callback(null, []);
}

function searchDatabaseProducts(query, limit = 3, callback) {
  const { searchWord, audience, gender, isShowcase } = parseProductSearchIntent(query);
  
  if (isShowcase) {
    return getFeaturedShowcase(limit > 3 ? limit : 5, callback);
  }

  if (!searchWord || searchWord.length < 2) {
    return getFeaturedShowcase(limit > 3 ? limit : 5, callback);
  }

  const cacheKey = `${searchWord}_${audience}_${gender}`;
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < SEARCH_CACHE_TTL) {
    return callback(null, cached.results.slice(0, limit));
  }

  // Fetch up to 100 items from PostgREST to ensure plenty of candidates
  const path = `/produtos?nome=ilike.*${encodeURIComponent(searchWord)}*&status=eq.ativo&order=valor.asc&limit=100&select=id,codigo_produto,nome,descricao,valor,imagem_url,imagem_url_2`;
  
  const supaKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
  const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path,
    method: 'GET',
    headers: {
      'apikey': supaKey,
      'Authorization': 'Bearer ' + supaKey
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const list = JSON.parse(d);
        if (!Array.isArray(list)) return callback(null, []);

        let filtered = list;

        // 1. Filtro de Ruído/Acessórios para Calçados e Roupas
        if (searchWord === 'tenis' || searchWord === 'sapato' || searchWord === 'calcado') {
          filtered = filtered.filter(p => !/mesa|ping|bola|espuma|limp|bolsa|mochila|porta|raquete|frescobol|chinelo slide|slide\b/i.test(p.nome));
        }

        // 2. Filtro de Público-Alvo (Adulto vs Infantil)
        if (audience === 'adulto') {
          filtered = filtered.filter(p => !/infantil|kids|kidstep|funfy|menino|menina|bebe|bebê|primeiros passos|recem nascido|escolar infantil|desenho|personagem|luzinha|led sonic/i.test(p.nome));
        } else if (audience === 'infantil') {
          filtered = filtered.filter(p => /infantil|kids|kidstep|funfy|menino|menina|bebe|bebê|primeiros passos|recem nascido|escolar infantil|desenho|personagem|luzinha|led/i.test(p.nome));
        }

        // 3. Filtro de Gênero
        if (gender === 'masculino') {
          filtered = filtered.filter(p => !/feminino(?!.*masculino)|menina|pink|salto|lingerie|vestido|saia/i.test(p.nome));
        } else if (gender === 'feminino') {
          filtered = filtered.filter(p => !/masculino(?!.*feminino)|menino|cueca/i.test(p.nome));
        }

        // Armazenar no cache e retornar
        SEARCH_CACHE.set(cacheKey, { results: filtered.slice(0, 30), ts: Date.now() });
        callback(null, filtered.slice(0, limit));
      } catch (e) {
        callback(e, []);
      }
    });
  });
  req.on('error', err => callback(err, []));
  req.setTimeout(5000, () => { req.destroy(); callback(null, []); });
  req.end();
}

// ─── MÓDULO 7: TRANSCRIÇÃO DE ÁUDIO (GEMINI FLASH 1.5) ──────────────────────
async function handleAudioMessage(fromPhone, session, rawMessageData) {
  try {
    sendWhatsAppReply(fromPhone, '🎙️ Recebi seu áudio! Deixa eu ouvir aqui...');

    // 1. Baixar base64 do áudio via Evolution API (Evolution v2 espera o objeto completo com key e message)
    const msgPayload = {
      message: {
        key: rawMessageData.key || {},
        message: rawMessageData.message || rawMessageData
      },
      convertToMp4: false
    };

    console.log(`🎙️ Solicitando base64 do áudio para ${fromPhone}...`);
    let evoResp = await fetch('http://127.0.0.1:8080/chat/getBase64FromMediaMessage/GSA_WhatsApp', {
      method: 'POST',
      headers: {
        'apikey': 'gsa_hub_evolution_token_2026',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(msgPayload)
    });

    let evoJson = await evoResp.json();
    console.log(`🎙️ Resposta Evolution API base64:`, evoJson?.base64 ? 'OK (base64 presente)' : JSON.stringify(evoJson).substring(0, 200));

    // Fallback se o formato acima não retornou base64
    if (!evoJson?.base64) {
      evoResp = await fetch('http://127.0.0.1:8080/chat/getBase64FromMediaMessage/GSA_WhatsApp', {
        method: 'POST',
        headers: {
          'apikey': 'gsa_hub_evolution_token_2026',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: rawMessageData, convertToMp4: false })
      });
      evoJson = await evoResp.json();
      console.log(`🎙️ Resposta Fallback Evolution API:`, evoJson?.base64 ? 'OK' : JSON.stringify(evoJson).substring(0, 200));
    }

    const audioBase64 = evoJson?.base64 || evoJson?.data?.base64;
    if (!audioBase64) {
      console.error('❌ Falha ao obter base64 do áudio:', evoJson);
      sendWhatsAppReply(fromPhone, '😅 Ops, não consegui processar seu áudio. Pode me escrever o que precisa? Estou aqui para ajudar!');
      return;
    }

    // MIME type limpo para o Gemini (ex: audio/ogg)
    let rawMime = evoJson.mimetype || 'audio/ogg';
    const cleanMime = rawMime.split(';')[0].trim();

    // 2. Transcrever com Gemini 1.5 Flash (suporta áudio nativo)
    const transcribePayload = JSON.stringify({
      contents: [{
        parts: [
          { text: 'Transcreva exatamente o que está sendo dito neste áudio em português brasileiro. Retorne SOMENTE o texto transcrito, sem aspas, sem explicações, sem formatação extra.' },
          { inline_data: { mime_type: cleanMime || 'audio/ogg', data: audioBase64 } }
        ]
      }]
    });

    const transcribeResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: transcribePayload
      }
    );
    const transcribeJson = await transcribeResp.json();
    const transcribedText = transcribeJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!transcribedText || transcribedText.length < 2) {
      console.warn('⚠️ Transcrição vazia ou inválida:', JSON.stringify(transcribeJson));
      sendWhatsAppReply(fromPhone, '🔇 Não consegui entender o áudio. O som estava muito baixo ou com ruído. Pode repetir ou me escrever?');
      return;
    }

    console.log(`🎙️ Áudio transcrito com sucesso para ${fromPhone}: "${transcribedText}"`);
    sendWhatsAppReply(fromPhone, `🎙️ _Entendi: "${transcribedText}"_`);

    // 3. Processar o texto transcrito como se fosse uma mensagem normal
    await processMessage(fromPhone, transcribedText, null, session.clientName || '', rawMessageData);

  } catch (err) {
    console.error('❌ Erro ao processar áudio:', err.message);
    sendWhatsAppReply(fromPhone, '😅 Não consegui processar seu áudio. Pode me escrever sua dúvida? Estou aqui!');
  }
}

// ─── MÓDULO 2: BUSCA VISUAL POR IMAGEM (GEMINI VISION) ──────────────────────
function handleImageProductSearch(fromPhone, session, mediaBase64, mediaMimeType) {
  if (!mediaBase64) return;
  sendWhatsAppReply(fromPhone, '🔍 Analisando a imagem do produto... Aguarde um instante!');

  const payload = JSON.stringify({
    contents: [{
      parts: [
        { text: 'Você é um especialista em e-commerce brasileiro. Analise esta imagem de produto e retorne SOMENTE um JSON válido com os campos: { "category": "string", "product_name": "string em português", "color": "string", "search_keyword": "string (palavra-chave principal sem acento, ex: tenis, camisa, celular)" }. Não inclua texto fora do JSON.' },
        { inline_data: { mime_type: mediaMimeType || 'image/jpeg', data: mediaBase64 } }
      ]
    }]
  });

  const visionReq = https.request({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload, 'utf8') }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(d);
        let textContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const jsonMatch = textContent.match(/(\{[\s\S]*\})/);
        if (jsonMatch) textContent = jsonMatch[1];
        const visionResult = JSON.parse(textContent.trim());
        const keyword = visionResult.search_keyword || visionResult.category || 'produto';

        console.log(`[Vision] Produto detectado: ${visionResult.product_name} | keyword: ${keyword}`);

        searchDatabaseProducts(keyword, 3, (err, dbProducts) => {
          if (!err && dbProducts && dbProducts.length > 0) {
            let msg = `🎯 *Encontrei produtos semelhantes na nossa loja!*\n\n_Produto identificado: ${visionResult.product_name}${visionResult.color ? ' — Cor: ' + visionResult.color : ''}_\n\n`;
            dbProducts.forEach((item, index) => {
              msg += `*${index + 1}️⃣ ${item.nome}*\n🔖 Código: ${formatGSAProductCode(item.codigo_produto, item)}\n💰 *Valor:* R$ ${Number(item.valor).toFixed(2).replace('.', ',')}\n\n`;
              const imgUrl = item.imagem_url || item.imagem_url_2;
              if (imgUrl) {
                setTimeout(() => {
                  sendWhatsAppMedia(fromPhone, imgUrl, 'produto.jpg', `📸 ${item.nome} — R$ ${Number(item.valor).toFixed(2).replace('.', ',')}`, 'image');
                }, (index + 1) * 800);
              }
            });
            msg += `👉 Digite o número da opção desejada (*1*, *2* ou *3*) para comprar ou 0 para voltar ao menu.`;
            session.state = 'MULTIPLE_PRODUCT_INTEREST';
            session.aiFoundProducts = dbProducts;
            userSessions[fromPhone] = session;
            sendWhatsAppReply(fromPhone, msg);
            session.history.push({ role: 'assistant', content: msg });
            scheduleCartAbandonmentCheck(fromPhone, session);
          } else {
            sendWhatsAppReply(fromPhone, `🔍 Produto detectado: *${visionResult.product_name}*\n\nNão encontrei este modelo exato no estoque mas posso buscar algo parecido!\n\nDescreva o produto que deseja e encontrarei as melhores opções. 😊`);
            session.state = 'MAIN_MENU';
            userSessions[fromPhone] = session;
          }
        });
      } catch (e) {
        console.error('[Vision Error]', e.message);
        sendWhatsAppReply(fromPhone, 'Não consegui identificar o produto na imagem. Por favor, descreva o que você está procurando! 😊');
      }
    });
  });
  visionReq.on('error', () => {
    sendWhatsAppReply(fromPhone, 'Tive dificuldade ao analisar a imagem. Por favor, descreva o produto em texto! 😊');
  });
  visionReq.setTimeout(15000, () => { visionReq.destroy(); });
  visionReq.write(payload);
  visionReq.end();
}

// ─── MÓDULO 4: RASTREAMENTO DE PEDIDOS ──────────────────────────────────────
function handleOrderTracking(fromPhone, session) {
  const supaKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
  const clientPhone = fromPhone.replace(/\D/g, '');

  const path = `/loja_pedidos?select=id,status,total,metodo_pagamento,codigo_rastreio,transportadora,previsao_entrega,created_at&order=created_at.desc&limit=3`;
  
  const req = http.request({
    hostname: '127.0.0.1', port: 3001, path, method: 'GET',
    headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const pedidos = JSON.parse(d);
        if (!Array.isArray(pedidos) || pedidos.length === 0) {
          sendWhatsAppReply(fromPhone, `📦 Não encontrei pedidos associados ao seu número.\n\nVerifique se o pedido foi feito com este WhatsApp ou fale com suporte pelo ${GSA_EMPRESA.whatsapp_atendimento}.\n\n_Digite 0 para voltar ao menu._`);
          session.state = 'MAIN_MENU';
          userSessions[fromPhone] = session;
          return;
        }

        const statusEmojis = {
          'pendente': '⏳ Pendente', 'pago': '✅ Pago', 'aprovado': '✅ Aprovado',
          'em_preparacao': '📦 Em Preparação', 'em_expedicao': '📦 Expedindo',
          'em_transporte': '🚚 Em Transporte', 'enviado': '🚚 Enviado',
          'concluido': '🎉 Entregue', 'entregue': '🎉 Entregue',
          'cancelado': '❌ Cancelado'
        };

        let msg = `📦 *Seus Pedidos Recentes:*\n\n`;
        pedidos.forEach((p, i) => {
          const statusKey = String(p.status || '').toLowerCase();
          const statusLabel = statusEmojis[statusKey] || p.status || 'Em processamento';
          const shortId = p.id ? String(p.id).substring(0, 8).toUpperCase() : String(i + 1);
          msg += `*Pedido #${shortId}*\n`;
          msg += `📊 Status: ${statusLabel}\n`;
          msg += `💰 Total: R$ ${Number(p.total || 0).toFixed(2).replace('.', ',')}\n`;
          if (p.codigo_rastreio) {
            msg += `🔢 Rastreio: \`${p.codigo_rastreio}\`\n`;
            if (p.transportadora) msg += `🚚 Transportadora: ${p.transportadora}\n`;
          }
          if (p.previsao_entrega) {
            const dt = new Date(p.previsao_entrega).toLocaleDateString('pt-BR');
            msg += `📅 Previsão: ${dt}\n`;
          }
          msg += `\n`;
        });
        msg += `_Para mais detalhes: ${GSA_EMPRESA.site}_\n_Digite 0 para voltar ao menu._`;

        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, msg);
      } catch (e) {
        sendWhatsAppReply(fromPhone, '📦 Não consegui consultar seus pedidos no momento. Tente novamente ou fale com nosso suporte.');
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
      }
    });
  });
  req.on('error', () => {
    sendWhatsAppReply(fromPhone, 'Serviço de rastreio temporariamente indisponível. Tente novamente em instantes.');
  });
  req.setTimeout(5000, () => { req.destroy(); });
  req.end();
}

// ─── MÓDULO 8: ÁREA DO CLIENTE, EXTRATO & PONTOS FIDELIDADE ─────────────────

function fetchClientRecord(phone, callback) {
  const pClean = phone.replace(/\D/g, '').replace(/^55/, '');
  const pWith55 = `55${pClean}`;
  const supaKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

  const path = `/clientes?or=(telefone.eq.${pClean},telefone.eq.${pWith55},telefone.ilike.*${pClean}*)&limit=1`;
  const req = http.request({
    hostname: '127.0.0.1', port: 3001, path, method: 'GET',
    headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const list = JSON.parse(d);
        callback(null, Array.isArray(list) && list.length > 0 ? list[0] : null);
      } catch (e) { callback(e, null); }
    });
  });
  req.on('error', err => callback(err, null));
  req.end();
}

function handleClientAccountOverview(fromPhone, session) {
  fetchClientRecord(fromPhone, (err, client) => {
    if (!client) {
      sendWhatsAppReply(fromPhone, `👤 *ÁREA DO CLIENTE GSA HUB*\n\nNão localizei um cadastro ativo com o número *${fromPhone}*.\n\nSe você já possui cadastro com outro número ou CPF, você pode consultar digitando o seu CPF ou entrar em contato com nosso suporte!\n\n_Digite 0 para voltar ao menu principal._`);
      return;
    }

    session.client = client;
    session.clientName = client.nome ? client.nome.split(' ')[0] : 'Cliente';
    userSessions[fromPhone] = session;

    const saldoCarteira = Number(client.saldo_carteira || 0).toFixed(2).replace('.', ',');
    const saldoPontos = client.saldo_pontos || 0;
    const pontosTotais = client.pontos_totais || 0;
    const limiteDisp = Number(client.limite_credito_disponivel || 0).toFixed(2).replace('.', ',');
    const limiteTotal = Number(client.limite_credito_total || 0).toFixed(2).replace('.', ',');

    const msg = `👤 *ÁREA DO CLIENTE GSA HUB*\n\nOlá, *${client.nome}*! (Cód: \`${client.codigo_cliente || 'CL'}\`)\nAqui está o resumo da sua conta:\n\n💰 *Saldo em Carteira:* R$ ${saldoCarteira}\n⭐ *Pontos Fidelidade:* ${saldoPontos} pts _(Acumulado: ${pontosTotais} pts)_\n💳 *Limite de Crédito:* R$ ${limiteDisp} disponível _(Total: R$ ${limiteTotal})_\n📋 *Status da Conta:* Ativo ✅\n\n*O que você gostaria de consultar?*\n1️⃣ 📄 *Extrato da Conta / Carteira*\n2️⃣ ⭐ *Extrato de Pontos Fidelidade*\n3️⃣ 🎫 *Meus Chamados & Solicitações*\n0️⃣ Voltar ao menu principal`;

    session.state = 'CLIENT_AREA_MENU';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, msg);
  });
}

function handleClientStatement(fromPhone, session) {
  fetchClientRecord(fromPhone, (err, client) => {
    if (!client) {
      sendWhatsAppReply(fromPhone, `📄 *EXTRATO FINANCEIRO*\n\nNão localizei um cadastro associado a este número de WhatsApp.\n\n_Digite 0 para voltar ao menu principal._`);
      return;
    }

    const supaKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
    const path = `/carteira_lancamentos?cliente_id=eq.${client.id}&order=data_lancamento.desc&limit=5`;
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path, method: 'GET',
      headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const lancamentos = JSON.parse(d);
          const saldo = Number(client.saldo_carteira || 0).toFixed(2).replace('.', ',');

          let msg = `📄 *EXTRATO DA SUA CONTA / CARTEIRA*\n\n👤 *Cliente:* ${client.nome}\n💰 *Saldo Atual:* R$ ${saldo}\n\n📋 *Últimos Lançamentos:*\n`;

          if (Array.isArray(lancamentos) && lancamentos.length > 0) {
            lancamentos.forEach(l => {
              const dt = l.data_lancamento ? new Date(l.data_lancamento).toLocaleDateString('pt-BR') : '';
              const isCred = l.tipo === 'credito' || l.tipo === 'entrada';
              const icon = isCred ? '🟢' : '🔴';
              const sign = isCred ? '+' : '-';
              const val = Number(l.valor || 0).toFixed(2).replace('.', ',');
              msg += `\n${icon} *${sign} R$ ${val}* — _${dt}_\n   ${l.descricao || 'Movimentação em carteira'}\n`;
            });
          } else {
            msg += `\n_Nenhuma movimentação recente registrada na sua carteira._\n`;
          }

          msg += `\n👉 Digite *0* para voltar ao menu principal.`;
          sendWhatsAppReply(fromPhone, msg);
        } catch (e) {
          sendWhatsAppReply(fromPhone, `❌ Não foi possível carregar seu extrato agora. Tente novamente mais tarde.`);
        }
      });
    });
    req.end();
  });
}

function handleClientPointsStatement(fromPhone, session) {
  fetchClientRecord(fromPhone, (err, client) => {
    if (!client) {
      sendWhatsAppReply(fromPhone, `⭐ *PONTOS FIDELIDADE*\n\nNão localizei um cadastro associado a este número de WhatsApp.\n\n_Digite 0 para voltar ao menu principal._`);
      return;
    }

    const supaKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
    const path = `/pontos_movimentacoes?cliente_id=eq.${client.id}&order=data_movimentacao.desc&limit=5`;
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path, method: 'GET',
      headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const movimentacoes = JSON.parse(d);
          const saldoPts = client.saldo_pontos || 0;
          const totalPts = client.pontos_totais || 0;

          let msg = `⭐ *EXTRATO DE PONTOS FIDELIDADE (VIP)*\n\n👤 *Cliente:* ${client.nome}\n🌟 *Saldo Disponível:* ${saldoPts} pontos\n🏆 *Total Histórico:* ${totalPts} pontos\n\n📋 *Últimas Movimentações:*\n`;

          if (Array.isArray(movimentacoes) && movimentacoes.length > 0) {
            movimentacoes.forEach(m => {
              const dt = m.data_movimentacao ? new Date(m.data_movimentacao).toLocaleDateString('pt-BR') : '';
              const pts = m.pontos || 0;
              const sign = pts >= 0 ? '+' : '';
              const icon = pts >= 0 ? '🟢' : '🔴';
              msg += `\n${icon} *${sign}${pts} pts* — _${dt}_\n   ${m.descricao || 'Pontuação fidelidade'}\n`;
            });
          } else {
            msg += `\n_Nenhuma movimentação de pontos registrada recentemente._\n`;
          }

          msg += `\n💡 *Você pode resgatar seus pontos por PIX ou descontos!*\n👉 Digite *0* para voltar ao menu principal.`;
          sendWhatsAppReply(fromPhone, msg);
        } catch (e) {
          sendWhatsAppReply(fromPhone, `❌ Não foi possível carregar seus pontos agora.`);
        }
      });
    });
    req.end();
  });
}

function handleClientTickets(fromPhone, session) {
  fetchClientRecord(fromPhone, (err, client) => {
    if (!client) {
      sendWhatsAppReply(fromPhone, `🎫 *MEUS CHAMADOS*\n\nNão localizei um cadastro associado a este número de WhatsApp.\n\n_Digite 0 para voltar ao menu principal._`);
      return;
    }

    const supaKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
    const path = `/tickets?cliente_id=eq.${client.id}&order=data_abertura.desc&limit=5`;
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path, method: 'GET',
      headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const tickets = JSON.parse(d);
          let msg = `🎫 *MEUS CHAMADOS & SOLICITAÇÕES*\n\n👤 *Cliente:* ${client.nome}\n\n`;

          if (Array.isArray(tickets) && tickets.length > 0) {
            tickets.forEach(t => {
              const dt = t.data_abertura ? new Date(t.data_abertura).toLocaleDateString('pt-BR') : '';
              const st = (t.status || 'aberto').toLowerCase();
              const badge = st === 'concluido' || st === 'fechado' ? '✅ Concluído' : st === 'em andamento' ? '⏳ Em Andamento' : '📬 Aberto';
              msg += `*${t.codigo_ticket || 'TKT'}* — ${badge}\n📌 *Assunto:* ${t.assunto || 'Sem assunto'}\n📅 *Abertura:* ${dt}\n\n`;
            });
          } else {
            msg += `_Você não possui chamados abertos no momento._\n\n`;
          }

          msg += `👉 Digite *0* para voltar ao menu principal.`;
          sendWhatsAppReply(fromPhone, msg);
        } catch (e) {
          sendWhatsAppReply(fromPhone, `❌ Não foi possível carregar seus chamados agora.`);
        }
      });
    });
    req.end();
  });
}

// ─── MÓDULO 5: CARRINHO ABANDONADO ──────────────────────────────────────────
const abandonedCartTimers = new Map();
const CART_ABANDON_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos
const CART_REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas

function scheduleCartAbandonmentCheck(fromPhone, session) {
  const existing = abandonedCartTimers.get(fromPhone);
  if (existing && existing.timerId) clearTimeout(existing.timerId);

  const products = session.aiFoundProducts || session.extrProducts || [];
  if (!products || products.length === 0) return;

  const productName = products[0]?.nome || 'o produto escolhido';
  const clientName = session.clientName || 'cliente';

  const timerId = setTimeout(() => {
    const current = abandonedCartTimers.get(fromPhone);
    if (!current) return;
    const now = Date.now();
    if (current.lastReminder && (now - current.lastReminder) < CART_REMIND_COOLDOWN_MS) return;

    const currentSession = userSessions[fromPhone];
    if (!currentSession) return;
    if (currentSession.state !== 'MULTIPLE_PRODUCT_INTEREST' && currentSession.state !== 'DROPSHIP_INTEREST') return;

    sendWhatsAppReply(fromPhone, `⏰ *Oi, ${clientName}!*\n\nNotei que você se interessou por *${productName.substring(0, 50)}* mas não finalizou a compra. 😊\n\nAinda posso reservar este item para você!\n\nDigite o número do produto desejado para retomar ou 0 para cancelar.`);
    abandonedCartTimers.set(fromPhone, { ...current, timerId: null, lastReminder: now });
  }, CART_ABANDON_TIMEOUT_MS);

  abandonedCartTimers.set(fromPhone, {
    timerId, productName,
    lastReminder: existing?.lastReminder || null
  });
}

function clearCartAbandonmentTimer(fromPhone) {
  const existing = abandonedCartTimers.get(fromPhone);
  if (existing && existing.timerId) {
    clearTimeout(existing.timerId);
    abandonedCartTimers.delete(fromPhone);
  }
}

// ─── MÓDULO IA: ROTEADOR DE RESPOSTA DA IA ───────────────────────────────────
function handleAIResponse(fromPhone, session, aiResult, originalText) {
  if (!aiResult || !aiResult.action) {
    sendWhatsAppReply(fromPhone, `❓ Não entendi bem. Como posso te ajudar?\n\n${getMainMenuText(session.profile)}`);
    return;
  }

  if (!session.history) session.history = [];
  session.history.push({ role: 'user', content: originalText });

  switch (aiResult.action) {
    case 'menu': {
      const botReply = aiResult.message || '';
      if (botReply) {
        sendWhatsAppReply(fromPhone, botReply);
        session.history.push({ role: 'assistant', content: botReply });
        userSessions[fromPhone] = session;
        setTimeout(() => processMessage(fromPhone, aiResult.target || '0'), 800);
      } else {
        processMessage(fromPhone, aiResult.target || '0');
      }
      break;
    }

    case 'redeem_partner_benefit': {
      const q = aiResult.partner_query || aiResult.found_partner || originalText;
      handlePartnerRedemptionFlow(fromPhone, originalText, session, q);
      break;
    }

    case 'search_service': {
      const item = aiResult.found_item;
      if (!item) {
        const msg = aiResult.message || 'Encontrei serviços relacionados. Digite *2* no menu para ver todos os serviços disponíveis.';
        sendWhatsAppReply(fromPhone, msg);
        session.history.push({ role: 'assistant', content: msg });
        break;
      }
      fetchCatalogForAI((catalog) => {
        const realService = (catalog.servicos || []).find(
          s => s.codigo_servico === item.codigo || s.codigo_servico === item.codigo_servico ||
               (s.nome || '').toLowerCase().trim() === (item.nome || '').toLowerCase().trim()
        );
        let precoStr = '';
        if (realService) {
          const ocultarValor = realService.ocultar_valor === true || realService.ocultar_valor === 'true';
          const valorReal = Number(realService.valor || 0);
          if (!ocultarValor && valorReal > 0) {
            precoStr = `\n💰 *Investimento:* R$ ${valorReal.toFixed(2)}`;
          } else {
            precoStr = `\n💰 *Investimento:* Valor definido após análise — peço apenas alguns dados para gerar seu orçamento personalizado!`;
          }
          item.valor = (!ocultarValor && valorReal > 0) ? valorReal : 0;
          item.nome = realService.nome || item.nome;
          item.descricao = realService.descricao || item.descricao || '';
        } else {
          precoStr = `\n💰 *Investimento:* Valor sob consulta — vou gerar um orçamento personalizado para você!`;
          item.valor = 0;
        }
        const msg = `📋 *Serviço Encontrado:*\n\n🔷 *${item.nome}*\n🔖 Código: ${item.codigo || item.codigo_servico}${item.descricao ? '\n📄 ' + item.descricao.substring(0, 120) : ''}${precoStr}\n\nDeseja prosseguir?\n1️⃣ ✅ Contratar agora\n2️⃣ 💬 Falar com especialista\n0️⃣ Voltar ao menu`;
        session.state = 'SERVICE_INTEREST';
        session.aiFoundService = item;
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, msg);
        session.history.push({ role: 'assistant', content: msg });
      });
      break;
    }

    case 'search_product': {
      const combinedQuery = `${aiResult.product_query || ''} ${originalText || ''}`.trim() || 'Produto';
      
      let requestedLimit = 3;
      if (aiResult.product_limit && Number(aiResult.product_limit) > 0) {
        requestedLimit = Math.min(10, Math.max(1, Number(aiResult.product_limit)));
      } else {
        const numMatch = (originalText || '').match(/\b(10|dez|9|nove|8|oito|7|sete|6|seis|5|cinco|4|quatro|3|tr[eê]s|2|dois|duas|1|um|uma)\b/i);
        if (numMatch) {
          const wordToNum = {
            '1': 1, 'um': 1, 'uma': 1,
            '2': 2, 'dois': 2, 'duas': 2,
            '3': 3, 'tres': 3, 'três': 3,
            '4': 4, 'quatro': 4,
            '5': 5, 'cinco': 5,
            '6': 6, 'seis': 6,
            '7': 7, 'sete': 7,
            '8': 8, 'oito': 8,
            '9': 9, 'nove': 9,
            '10': 10, 'dez': 10
          };
          const n = wordToNum[numMatch[1].toLowerCase()];
          if (n && n >= 1 && n <= 10) requestedLimit = n;
        }
      }

      // 1. Busca primeiro nos 92.402 produtos reais do banco de dados (Shopee)
      searchDatabaseProducts(combinedQuery, requestedLimit, (err, dbProducts) => {
        if (!err && dbProducts && dbProducts.length > 0) {
          let msg = `🛍️ *Encontrei os melhores produtos para você na nossa loja!* 🎉\n\n`;
          dbProducts.forEach((item, index) => {
            msg += `*${index + 1}️⃣ ${item.nome}*\n🔖 Código: ${formatGSAProductCode(item.codigo_produto, item)}\n💰 *Valor:* R$ ${Number(item.valor).toFixed(2).replace('.', ',')}\n\n`;
            
            const imgUrl = item.imagem_url || item.imagem_url_2;
            if (imgUrl) {
              setTimeout(() => {
                sendWhatsAppMedia(fromPhone, imgUrl, 'produto.jpg', `📸 ${item.nome} — R$ ${Number(item.valor).toFixed(2).replace('.', ',')}`, 'image');
              }, (index + 1) * 800);
            }
          });
          const optNums = dbProducts.map((_, i) => `*${i + 1}*`).join(', ');
          msg += `👉 Digite o número da opção desejada (${optNums}) para comprar ou 0 para voltar ao menu.`;

          session.state = 'MULTIPLE_PRODUCT_INTEREST';
          session.aiFoundProducts = dbProducts;
          userSessions[fromPhone] = session;

          sendWhatsAppReply(fromPhone, msg);
          session.history.push({ role: 'assistant', content: msg });
          // ─── Módulo 5: Agendar lembrete de carrinho abandonado
          scheduleCartAbandonmentCheck(fromPhone, session);
          return;
        }

        // 2. Se não estiver no banco, executa o Dropshipping com 100% de margem
        let term = searchTerm
          .replace(/^(me apresente|apresente|gostaria de|quero|procuro|tem|quais|qual|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|op[cç][oõ]es de|op[cç][aã]o de|mais baratos|mais baratas|mais barato|mais barata|baratos|baratas|por favor)\s*/gi, '')
          .replace(/\s*(mais baratos|mais baratas|mais barato|mais barata|de hoje|por favor)\s*$/gi, '')
          .trim();
        if (!term || term.length < 2) term = 'Tênis';

        const photoList = getProductPhotosForSearch(term);
        const baseCost = 45 + Math.random() * 80;
        
        const modelNames = ['Esportivo Air', 'Casual Confort', 'Premium Flex', 'Street Classic', 'Urban Runner', 'Ultra Light', 'Sport Pro', 'Max Comfort', 'Elite Edition', 'Pro Dynamic'];
        const extrProducts = [];
        for (let i = 0; i < requestedLimit; i++) {
          extrProducts.push({
            id: i + 1,
            codigo_produto: `PRD-${Math.floor(10000000 + Math.random() * 90000000)}`,
            nome: `${term} - Modelo ${modelNames[i % modelNames.length]}`,
            custo: baseCost * (1 - (i * 0.04)),
            link: `https://shopee.com.br/search?keyword=${encodeURIComponent(term)}`,
            imagem_url: photoList[i % photoList.length]
          });
        }

        let msg = `Temos sim, ${session.clientName || 'cliente'}! 🎉 Encontrei ${extrProducts.length} opções excelentes com ótimo custo-benefício:\n\n`;
        extrProducts.forEach((p, index) => {
          const salePrice = p.custo * 2;
          msg += `*${p.id}️⃣ ${p.nome}*\n🔖 Código: ${p.codigo_produto}\n💰 Valor: R$ ${salePrice.toFixed(2).replace('.', ',')}\n\n`;
          setTimeout(() => {
            sendWhatsAppMedia(fromPhone, p.imagem_url, 'produto.jpg', `📸 ${p.nome} — R$ ${salePrice.toFixed(2).replace('.', ',')}`, 'image');
          }, (index + 1) * 800);
        });
        const optNumsDropship = extrProducts.map((p) => p.id).join(', ');
        msg += `Qual dessas opções você prefere? Digite o número (${optNumsDropship}) para eu gerar seu pedido!`;

        session.state = 'DROPSHIP_INTEREST';
        session.extrProducts = extrProducts;
        userSessions[fromPhone] = session;

        sendWhatsAppReply(fromPhone, msg);
        session.history.push({ role: 'assistant', content: msg });
        // ─── Módulo 5: Agendar lembrete de carrinho abandonado
        scheduleCartAbandonmentCheck(fromPhone, session);

        let adminAlert = `🚨 *NOVO PRODUTO SOLICITADO (NÃO CADASTRADO)* 🚨\n\n`;
        adminAlert += `👤 *Cliente:* ${session.clientName || fromPhone} (${fromPhone})\n`;
        adminAlert += `📦 *Procurou por:* ${term}\n\n`;
        adminAlert += `🤖 *Opções que a IA enviou pro cliente (com 100% margem):*\n`;
        extrProducts.forEach(p => {
          adminAlert += `• ${p.nome}\n  Custo Real: R$ ${p.custo.toFixed(2)} | Venda: R$ ${(p.custo * 2).toFixed(2)}\n  Link: ${p.link}\n\n`;
        });
        adminAlert += `💡 _Você pode finalizar a venda no WhatsApp e encomendar pelo link de custo!_`;
        notifyAdmin(adminAlert);
      });
      break;
    }

    // ─── MÓDULO 4: Rastreamento de Pedido via IA ──────────────────────────────
    case 'track_order': {
      handleOrderTracking(fromPhone, session);
      break;
    }

    // ─── MÓDULO 8: Área do Cliente, Extrato, Pontos & Chamados ────────────────
    case 'client_account': {
      handleClientAccountOverview(fromPhone, session);
      break;
    }

    case 'client_statement': {
      handleClientStatement(fromPhone, session);
      break;
    }

    case 'client_points': {
      handleClientPointsStatement(fromPhone, session);
      break;
    }

    case 'client_tickets': {
      handleClientTickets(fromPhone, session);
      break;
    }

    case 'create_ticket': {
      const reason = aiResult.ticket_reason || originalText;
      const clientName = session.clientName || session.clientData?.nome || 'Cliente';
      const msg = `Entendi que você está procurando: *${reason.substring(0, 80)}*\n\nAinda não temos isso disponível, mas vou registrar seu interesse! 📋\n\nPode me contar mais detalhes? Pode enviar:\n📝 Uma descrição mais detalhada\n📷 Foto de referência\n🎙️ Áudio explicando\n\n_Ou digite *pronto* quando quiser finalizar a solicitação._\n_Digite *0* para cancelar._`;
      session.state = 'AI_TICKET_COLLECT';
      session.aiTicketReason = reason;
      session.aiTicketDetails = [];
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, msg);
      session.history.push({ role: 'assistant', content: msg });
      break;
    }

    case 'request_pro_voucher': {
      session.state = 'MAIN_MENU';
      const toolId = aiResult.tool_id || 'retirement';
      checkPhoneVoucherStatus(fromPhone, (err, vStatus) => {
        if (vStatus && vStatus.alreadyUsed) {
          const usedHint = vStatus.voucher?.code_hint || 'GSA-PRO';
          const msg = `ℹ️ *Voucher Pro Já Resgatado*\n\nIdentificamos que o voucher gratuito de uso único para este número já foi utilizado anteriormente (${usedHint}).\n\n${aiResult.message || 'Você pode continuar realizando cálculos no modo padrão gratuitamente por aqui!'}\n\nCaso queira um estudo aprofundado e acompanhamento com nosso especialista:\n1️⃣ 📋 Contratar Planejamento Previdenciário\n2️⃣ 💬 Falar com Consultor Humano\n0️⃣ Voltar ao menu`;
          session.state = 'SERVICE_INTEREST';
          session.aiFoundService = { codigo: 'SV101', nome: 'Planejamento Previdenciário', valor: 0 };
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, msg);
          session.history.push({ role: 'assistant', content: msg });
        } else {
          createAndRedeemVoucherForPhone(fromPhone, toolId, (errV, resV) => {
            const voucherCode = resV?.code || 'GSA-PRO-ATIVO';
            const botMsg = `🎉 *Voucher Pro Ativado com Sucesso!*\n\n🎫 *Código Único:* \`${voucherCode}\`\n✨ *Status:* Liberado para seu WhatsApp!\n\n${aiResult.message || 'Seu cálculo e relatório Pro completo estão liberados!'}`;
            sendWhatsAppReply(fromPhone, botMsg);
            session.history.push({ role: 'assistant', content: botMsg });
            userSessions[fromPhone] = session;
          });
        }
      });
      break;
    }

    case 'generate_calculator_pdf': {
      session.state = 'MAIN_MENU';
      const clientFullName = session.clientFullName
        || session.clientData?.nome_completo 
        || session.clientData?.nome 
        || session.profile?.cliente?.nome_completo 
        || session.profile?.cliente?.nome 
        || session.profile?.primaryName 
        || session.pushName 
        || session.clientName 
        || 'Cliente GSA HUB';

      const protocol = `CALC-${Date.now().toString().slice(-6)}`;
      const reportData = {
        title: aiResult.title || 'Relatório de Cálculo GSA HUB',
        mode: aiResult.mode || 'PRO',
        clientName: clientFullName,
        protocol: protocol,
        items: aiResult.items || [],
        total_label: aiResult.total_label || 'VALOR TOTAL ESTIMADO',
        total_value: aiResult.total_value || 'R$ 0,00',
        notes: aiResult.notes || 'Documento emitido automaticamente pelo Assistente Virtual GSA HUB.'
      };

      try {
        const pdfBase64 = generateCalculatorReportPdfBase64(reportData);
        const cleanTitle = (aiResult.title || 'Calculo').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
        const fileName = `Relatorio_${cleanTitle}_${protocol}.pdf`;
        const caption = `📄 *Relatório Oficial GSA HUB*\n📌 *Protocolo:* ${protocol}\n👤 *Cliente:* ${clientFullName}\n💰 *${reportData.total_label}:* ${reportData.total_value}`;
        
        sendWhatsAppMedia(fromPhone, pdfBase64, fileName, caption, 'document');
        
        const followUpMsg = aiResult.message || `✅ Relatório em PDF gerado e enviado com sucesso acima!\n\nCaso queira prosseguir com o acompanhamento ou contratar nossos serviços especializados, estou à sua disposição!`;
        setTimeout(() => sendWhatsAppReply(fromPhone, followUpMsg), 900);
        
        session.history.push({ role: 'assistant', content: `${caption}\n\n${followUpMsg}` });
        userSessions[fromPhone] = session;
      } catch (e) {
        console.error('❌ Erro ao gerar PDF de cálculo:', e.message);
        sendWhatsAppReply(fromPhone, aiResult.message || 'Houve uma instabilidade ao gerar o arquivo PDF, mas segue o resumo dos seus valores acima.');
      }
      break;
    }

    case 'reply':
    case 'ask_more': {
      session.state = 'MAIN_MENU';
      const msg = aiResult.message || 'Como posso te ajudar com algo mais?';
      sendWhatsAppReply(fromPhone, msg);
      session.history.push({ role: 'assistant', content: msg });
      userSessions[fromPhone] = session;
      break;
    }


    default: {
      session.state = 'MAIN_MENU';
      const msg = aiResult.message || `Como posso te ajudar?\n\n${getMainMenuText(session.profile)}`;
      sendWhatsAppReply(fromPhone, msg);
      session.history.push({ role: 'assistant', content: msg });
      userSessions[fromPhone] = session;
    }

  }

  // Limita histórico a 10 entradas
  if (session.history.length > 10) session.history = session.history.slice(-10);
  userSessions[fromPhone] = session;
}

// ─── MÓDULO IA: VALIDAR PUSH NAME ────────────────────────────────────────────
function validatePushNameAsPersonName(pushName) {
  // Heurística rápida local antes de chamar a IA
  const clean = (pushName || '').trim();
  if (!clean || clean.length < 2 || clean.length > 50) return false;
  // Rejeita se tiver números demais, emoji, ou parecer username
  const hasExcessiveNumbers = (clean.match(/\d/g) || []).length > 2;
  const hasEmoji = /[\u{1F300}-\u{1FFFF}]/u.test(clean);
  const looksLikeUsername = /[_\-\.]{2,}/.test(clean) || /^\d/.test(clean) || /^(gsa|gsahub|cliente|user|admin|tel|fone|zap|wp)/i.test(clean);
  const wordCount = clean.split(/\s+/).length;
  const allWords = clean.split(/\s+/).every(w => /^[A-Za-zÀ-ÿ\.]+$/.test(w));
  if (hasExcessiveNumbers || hasEmoji || looksLikeUsername) return false;
  if (wordCount >= 1 && wordCount <= 5 && allWords) return true;
  return false;
}

function extractFirstName(pushName) {
  const clean = (pushName || '').trim().split(/\s+/)[0];
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

// ─── SUPABASE HELPER ────────────────────────────────────────────────────────

function supabaseGet(path, callback) {
  const cleanPath = path.replace(/^\/rest\/v1/, '');
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: cleanPath,
    method: 'GET',
    headers: {
      'apikey': SERVICE_ROLE_JWT,
      'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
      'Content-Type': 'application/json'
    }
  };
  let req;
  try {
    req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          callback(null, result);
        } catch (e) {
          console.error('❌ Erro ao parsear resposta local PostgREST:', e.message, '| data:', data.substring(0, 200));
          callback(e, null);
        }
      });
    });
    req.setTimeout(8000, () => {
      console.error('⏰ Timeout na consulta local PostgREST:', cleanPath);
      req.destroy();
      callback(new Error('Timeout'), null);
    });
    req.on('error', (err) => {
      console.error('❌ Erro HTTP supabaseGet local:', err.message);
      callback(err, null);
    });
    req.end();
  } catch (e) {
    console.error('❌ Exceção ao criar requisição Supabase:', e.message);
    callback(e, null);
  }
}

function supabasePost(path, body, callback) {
  const cleanPath = path.replace(/^\/rest\/v1/, '');
  const payload = JSON.stringify(body);
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: cleanPath,
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_JWT,
      'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
      'Content-Type': 'application/json',
      'Prefer': path.includes('on_conflict=') ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try { callback(null, JSON.parse(data || '[]')); } catch(e) { callback(null, []); }
      } else {
        console.error('❌ Erro POST Supabase local:', data);
        callback(new Error(data), null);
      }
    });
  });
  req.on('error', err => callback(err, null));
  req.write(payload);
  req.end();
}

function supabasePatch(path, body, callback) {
  const cleanPath = path.replace(/^\/rest\/v1/, '');
  const payload = JSON.stringify(body);
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: cleanPath,
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_ROLE_JWT,
      'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
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
        try { callback(null, JSON.parse(data || '[]')); } catch(e) { callback(null, []); }
      } else {
        console.error('❌ Erro PATCH Supabase local:', data);
        callback(new Error(data), null);
      }
    });
  });
  req.on('error', err => callback(err, null));
  req.write(payload);
  req.end();
}

function supabaseRpc(rpcName, params, callback) {
  const cleanRpc = rpcName.replace(/^(\/rest\/v1)?\/rpc\//, '').replace(/^\//, '');
  const payload = JSON.stringify(params || {});
  const supaKey = SERVICE_ROLE_JWT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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
        try {
          const parsed = JSON.parse(data);
          callback(null, parsed, res.statusCode);
        } catch (e) {
          callback(null, data, res.statusCode);
        }
      } else {
        const err = new Error(data || `HTTP ${res.statusCode}`);
        err.statusCode = res.statusCode;
        err.data = data;
        callback(err, null, res.statusCode);
      }
    });
  });
  req.on('error', err => callback(err, null));
  req.setTimeout(10000, () => {
    req.destroy();
    callback(new Error('Timeout RPC'), null);
  });
  req.write(payload);
  req.end();
}

function supabaseUpsertProduct(path, body, callback) {
  return supabaseUpsertCustom(path, 'codigo_produto', body, callback);
}

function supabaseUpsertCustom(path, onConflict, body, callback) {
  const cleanPath = path.replace(/^\/rest\/v1/, '');
  const payload = JSON.stringify(body);
  const conflictParam = onConflict ? `?on_conflict=${onConflict}` : '';
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: `${cleanPath}${conflictParam}`,
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_JWT,
      'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try { callback(null, JSON.parse(data || '[]'), res.statusCode); } catch(e) { callback(null, [], res.statusCode); }
      } else {
        console.error('❌ Erro UPSERT Supabase local:', data);
        callback(new Error(data), null, res.statusCode);
      }
    });
  });
  req.on('error', err => callback(err, null, 500));
  req.write(payload);
  req.end();
}


function fetchClientByDoc(docClean, callback) {
  const filter = docClean.length > 11 ? `cnpj=eq.${docClean}` : `cpf=eq.${docClean}`;
  supabaseGet(`/rest/v1/clientes?${filter}&select=*`, (err, res) => {
    if (err) return callback(err, null);
    if (!Array.isArray(res) || res.length === 0) return callback(null, null);
    callback(null, res[0]);
  });
}

function fetchSupplierByDoc(docClean, callback) {
  supabaseGet(`/rest/v1/fornecedores?or=(documento.eq.${docClean},cnpj.eq.${docClean},cpf.eq.${docClean})&select=*`, (err, res) => {
    if (err) return callback(err, null);
    if (!Array.isArray(res) || res.length === 0) return callback(null, null);
    callback(null, res[0]);
  });
}

function fetchProviderByDoc(docClean, callback) {
  supabaseGet(`/rest/v1/prestadores?or=(cpf.eq.${docClean},cnpj.eq.${docClean},documento.eq.${docClean})&select=*`, (err, res) => {
    if (err) return callback(err, null);
    if (!Array.isArray(res) || res.length === 0) return callback(null, null);
    callback(null, res[0]);
  });
}

function fetchServices(tipo, callback) {
  const filter = tipo ? `&tipo_cliente=in.(${tipo},ambos)` : '';
  supabaseGet(`/rest/v1/servicos?status=eq.ativo${filter}&select=id,codigo_servico,nome,descricao,valor,ocultar_valor&order=ordem_catalogo.asc.nullslast&limit=10`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchProducts(callback) {
  supabaseGet(`/rest/v1/produtos?status=eq.ativo&select=id,codigo_produto,nome,descricao,valor,desconto_ativo,valor_promocional,imagem_url,imagens&limit=10`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchTravelPackages(callback) {
  supabaseGet(`/rest/v1/viagens_pacotes?status=eq.publicado&select=id,titulo,preco_venda,data_ida&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}


function fetchClientByPhone(phone, callback) {
  fetchUserProfile(phone, (profile) => {
    if (profile && profile.cliente) {
      callback(null, profile.cliente);
    } else {
      callback(null, null);
    }
  });
}

function parseStorePurchaseMessage(text) {
  let prodName = '';
  let prodCode = '';
  let prodQty = 1;
  let prodPrice = 0;
  let prodUuid = '';

  const lines = (text || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[^\w\*a-zA-Z0-9#]+/g, '').trim();

    if (!prodName && /^\*?(?:produto|item)\*?:\s*/i.test(line)) {
      prodName = line.replace(/^\*?(?:produto|item)\*?:\s*/i, '').replace(/[\*\_]/g, '').trim();
    }

    if (!prodCode && /^\*?(?:código|codigo|ref|cod)\*?:\s*/i.test(line)) {
      prodCode = line.replace(/^\*?(?:código|codigo|ref|cod)\*?:\s*/i, '').replace(/[\*\_]/g, '').trim();
    }

    if (/^\*?(?:quantidade|qtd)\*?:\s*/i.test(line)) {
      const qMatch = line.match(/\b(\d+)\b/);
      if (qMatch) {
        prodQty = parseInt(qMatch[1], 10) || 1;
      }
    }

    if (prodPrice === 0 && /^\*?(?:valor|preço|preco)\*?:\s*/i.test(line)) {
      const vMatch = line.match(/R\$\s*([\d\.,]+)/i);
      if (vMatch && vMatch[1]) {
        const cleanP = vMatch[1].replace(/\./g, '').replace(',', '.');
        prodPrice = parseFloat(cleanP) || 0;
      }
    }

    if (!prodUuid) {
      const uMatch = rawLine.match(/produtos\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uMatch && uMatch[1]) {
        prodUuid = uMatch[1];
      }
    }
  }

  if (!prodCode) {
    const rawCodeMatch = (text || '').match(/(PRD-[\w-]+|SHP-[\w-]+|PROD-[\w-]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (rawCodeMatch) prodCode = rawCodeMatch[1].trim();
  }

  return {
    prodName: prodName || 'Produto da Loja GSA',
    prodCode: prodCode || (prodUuid ? `PRD-${prodUuid.substring(0,8).toUpperCase()}` : 'PROD-LOJA'),
    prodQty: prodQty > 0 ? prodQty : 1,
    prodPrice: prodPrice > 0 ? prodPrice : 0,
    prodUuid: prodUuid
  };
}

function findProductByQuery(parsed, callback) {
  const code = (parsed.prodCode || '').trim();
  const uuid = (parsed.prodUuid || '').trim();
  const name = (parsed.prodName || '').trim();

  let filter = '';
  if (uuid) {
    filter = `id=eq.${uuid}`;
  } else if (code && code !== 'PROD-LOJA' && code !== 'N/A') {
    const cleanDigits = code.replace(/^[A-Za-z]+[-_]?/i, '');
    filter = `or=(codigo_produto.eq.${encodeURIComponent(code)},codigo_produto.eq.SHP-${encodeURIComponent(cleanDigits)},codigo_produto.ilike.*${encodeURIComponent(cleanDigits)}*)`;
  } else if (name) {
    const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 30);
    filter = `nome=ilike.*${encodeURIComponent(cleanName)}*`;
  }

  if (!filter) {
    return callback(null, null);
  }

  supabaseGet(`/rest/v1/produtos?${filter}&select=id,codigo_produto,nome,descricao,valor,desconto_ativo,valor_promocional,imagem_url&limit=1`, (err, res) => {
    if (!err && Array.isArray(res) && res.length > 0) {
      return callback(null, res[0]);
    }
    if (name && (code || uuid)) {
      const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 30);
      supabaseGet(`/rest/v1/produtos?nome=ilike.*${encodeURIComponent(cleanName)}*&select=id,codigo_produto,nome,descricao,valor,desconto_ativo,valor_promocional,imagem_url&limit=1`, (err2, res2) => {
        if (!err2 && Array.isArray(res2) && res2.length > 0) {
          return callback(null, res2[0]);
        }
        return callback(null, null);
      });
    } else {
      return callback(null, null);
    }
  });
}

function parseServiceRequestMessage(text) {
  let packageName = '';
  let audience = '';
  let services = [];
  let isFullPackage = false;

  const lines = (text || '').split(/\r?\n/);
  let capturingServices = false;

  for (let rawLine of lines) {
    const cleanLine = rawLine.replace(/^[^\w\*a-zA-Z0-9#•\-\+]+/g, '').trim();
    if (!cleanLine) continue;

    if (!packageName && /(?:pacote)\*?:\s*/i.test(cleanLine)) {
      packageName = cleanLine.replace(/^.*?(?:pacote)\*?:\s*/i, '').replace(/[\*\_]/g, '').trim();
      continue;
    }

    if (!audience && /(?:perfil)\*?:\s*/i.test(cleanLine)) {
      audience = cleanLine.replace(/^.*?(?:perfil)\*?:\s*/i, '').replace(/[\*\_]/g, '').trim();
      continue;
    }

    if (/(?:serviços|servicos)\s*(?:solicitados|escolhidos)/i.test(cleanLine)) {
      capturingServices = true;
      continue;
    }

    if (capturingServices) {
      if (rawLine.includes('•') || rawLine.includes('-') || cleanLine.startsWith('•') || cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        const cleanSvc = cleanLine.replace(/^[•\-\*\s]+/, '').replace(/[\*\_]/g, '').trim();
        if (cleanSvc.toLowerCase().includes('pacote completo')) {
          isFullPackage = true;
        }
        if (cleanSvc) {
          services.push(cleanSvc);
        }
      } else if (/^(?:gostaria|obrigado|por favor|ola|olá)/i.test(cleanLine)) {
        capturingServices = false;
      }
    }
  }

  if (!packageName) {
    const matchPkg = text.match(/pacote\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\.|\n|$)/i);
    if (matchPkg) {
      packageName = matchPkg[1].trim();
    } else {
      packageName = 'Pacote de Serviços GSA';
    }
  }

  if (services.length === 0) {
    services.push(packageName);
    isFullPackage = true;
  }

  return {
    packageName,
    audience,
    services,
    isFullPackage
  };
}

function handleServiceRequest(fromPhone, text, session) {
  const parsed = parseServiceRequestMessage(text);
  console.log(`🛠️ Processando Solicitação de Serviços para ${fromPhone}:`, JSON.stringify(parsed));

  sendWhatsAppReply(fromPhone, '🔄 *Recebendo sua solicitação de serviços e iniciando seu atendimento...*');

  const orcYear = new Date().getFullYear();
  const orcRand = Math.floor(1000 + Math.random() * 9000);
  const orcCod = `ORC-${orcYear}-${orcRand}`;

  let obs = `🏛️ [SOLICITAÇÃO DE SERVIÇO VIA WHATSAPP]\n`;
  obs += `• Pacote: ${parsed.packageName}\n`;
  if (parsed.audience) obs += `• Perfil: ${parsed.audience}\n`;
  obs += `• Escopo: ${parsed.isFullPackage ? 'Pacote Completo' : 'Serviços Selecionados'}\n`;
  obs += `• Serviços Solicitados:\n`;
  parsed.services.forEach((s) => {
    obs += `  - ${s}\n`;
  });
  obs += `• Solicitante: ${fromPhone}\n`;
  obs += `• Data: ${new Date().toLocaleString('pt-BR')}\n`;

  const finalizeServiceRequest = (clientObj) => {
    const clientId = clientObj?.id || null;
    const rawNome = clientObj?.nome || clientObj?.nome_completo || clientObj?.razao_social || 'Cliente';
    const clientName = formatBoldName(rawNome);

    const orcData = {
      codigo_orcamento: orcCod,
      cliente_id: clientId,
      categoria: 'servico',
      status: 'aberto',
      titulo_solicitacao: `Solicitação: ${parsed.packageName}`,
      descricao_solicitacao: `Serviços: ${parsed.services.join(', ')}`,
      observacoes_servico: obs,
      total: 0,
      total_contrato: 0,
      data_criacao: new Date().toISOString()
    };

    const sendResponse = (createdOrcamento) => {
      session.state = 'SERVICE_REQUEST_FOLLOWUP';
      session.currentServiceOrcamento = createdOrcamento || { codigo_orcamento: orcCod, id: null };
      session.currentServiceData = parsed;
      session.serviceClientId = clientId;
      userSessions[fromPhone] = session;

      let msg = `🏛️ *GSA HUB — SOLICITAÇÃO REGISTRADA COM SUCESSO* 🏛️\n\n`;
      msg += `Olá, *${clientName}*! Seu pedido de atendimento foi registrado em nosso sistema:\n\n`;
      msg += `📦 *Pacote:* ${parsed.packageName}\n`;
      if (parsed.audience) msg += `👤 *Perfil:* ${parsed.audience}\n`;
      msg += `🛠️ *Serviço(s) Solicitado(s):*\n`;
      parsed.services.forEach((s) => {
        msg += `  • ${s}\n`;
      });
      msg += `\n`;
      msg += `📋 *Protocolo / Orçamento:* *${createdOrcamento?.codigo_orcamento || orcCod}*\n`;
      msg += `⏱️ *Status:* Solicitação Aberta em Análise\n\n`;
      msg += `Como você deseja prosseguir para darmos andamento no seu atendimento?\n\n`;
      msg += `1️⃣ 📄 *Enviar Detalhes / Informações Adicionais*\n`;
      msg += `2️⃣ 👤 *Falar com um Consultor Especialista*\n`;
      msg += `3️⃣ 🌐 *Acompanhar pelo Portal do Cliente*\n`;
      msg += `0️⃣ 🏠 *Voltar ao Menu Principal*\n\n`;
      msg += `_Digite o número da opção desejada:_`;

      sendWhatsAppReply(fromPhone, msg);
    };

    if (clientId) {
      supabasePost('/rest/v1/orcamentos', orcData, (errOrc, resOrc) => {
        if (errOrc) {
          console.error('❌ Erro ao criar orçamento de serviço:', errOrc);
        }
        const created = (resOrc && resOrc[0]) ? resOrc[0] : { codigo_orcamento: orcCod };
        sendResponse(created);
      });
    } else {
      const tempClientData = {
        nome: `Cliente WhatsApp ${fromPhone.slice(-4)}`,
        telefone: fromPhone,
        tipo_pessoa: parsed.audience?.toLowerCase().includes('empresa') ? 'pj' : 'pf',
        origem: 'whatsapp_services',
        status: 'lead'
      };

      supabasePost('/rest/v1/clientes', tempClientData, (errC, resC) => {
        const newClientId = (resC && resC[0]) ? resC[0].id : null;
        orcData.cliente_id = newClientId;
        session.serviceClientId = newClientId;

        supabasePost('/rest/v1/orcamentos', orcData, (errOrc, resOrc) => {
          const created = (resOrc && resOrc[0]) ? resOrc[0] : { codigo_orcamento: orcCod };
          sendResponse(created);
        });
      });
    }
  };

  if (session.clientData && session.clientData.id) {
    return finalizeServiceRequest(session.clientData);
  }
  if (session.profile && session.profile.cliente) {
    return finalizeServiceRequest(session.profile.cliente);
  }

  fetchClientByPhone(fromPhone, (errCli, clientFound) => {
    finalizeServiceRequest(clientFound);
  });
}

function handleStoreDirectPurchase(fromPhone, text, session) {
  const parsed = parseStorePurchaseMessage(text);
  console.log(`🛒 Processando Compra Direta Loja para ${fromPhone}:`, JSON.stringify(parsed));

  sendWhatsAppReply(fromPhone, '🔄 *Identificando seu produto e preparando o atendimento...*');

  findProductByQuery(parsed, (errProd, prodDb) => {
    const prodName = prodDb?.nome || parsed.prodName || 'Produto da Loja GSA';
    const prodCode = prodDb?.codigo_produto || parsed.prodCode || 'PROD-LOJA';
    const unitPrice = prodDb ? (prodDb.desconto_ativo && prodDb.valor_promocional ? Number(prodDb.valor_promocional) : Number(prodDb.valor || parsed.prodPrice)) : parsed.prodPrice;
    const finalUnitPrice = unitPrice > 0 ? unitPrice : (parsed.prodPrice > 0 ? parsed.prodPrice : 10.00);
    const total = finalUnitPrice * parsed.prodQty;
    const prodImage = prodDb?.imagem_url || null;

    session.cart = [{
      produto: {
        id: prodDb?.id || parsed.prodUuid || parsed.prodCode,
        codigo_produto: prodCode,
        nome: prodName,
        valor: finalUnitPrice,
        desconto_ativo: prodDb?.desconto_ativo || false,
        valor_promocional: prodDb?.valor_promocional || null,
        imagem_url: prodImage
      },
      quantidade: parsed.prodQty
    }];
    session.checkoutType = 'store';
    session.directProductPurchase = true;
    session.directProductTotal = total;

    const presentOrderMenu = (clientRecord) => {
      session.clientData = clientRecord;
      session.tempClientId = clientRecord.id;
      session.state = 'STORE_DIRECT_PAY_OPTIONS';

      const cepClean = (clientRecord.cep || '').replace(/\D/g, '');
      if (cepClean && cepClean.length >= 8) {
        const logr = clientRecord.endereco || '';
        const num = clientRecord.numero || '';
        const bai = clientRecord.bairro || '';
        const cid = clientRecord.cidade || '';
        const uf = clientRecord.estado || '';
        session.savedClientAddress = {
          cep: cepClean,
          endereco: logr,
          numero: num,
          bairro: bai,
          cidade: cid,
          estado: uf,
          formatado: `${logr ? logr + ', ' : ''}${num ? 'Nº ' + num + ' - ' : ''}${bai ? bai + ', ' : ''}${cid ? cid + '/' + uf + ' - ' : ''}CEP: ${cepClean.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`
        };
        session.cep = cepClean;
        session.addressNum = num;
        session.fullDeliveryAddress = session.savedClientAddress.formatado;
      }

      userSessions[fromPhone] = session;

      const rawNome = clientRecord.nome || clientRecord.nome_completo || clientRecord.razao_social || 'Cliente';
      const nome = formatBoldName(rawNome);

      let msg = `🛒 *PEDIDO LOJA GSA HUB* 🛒\n\n`;
      msg += `Olá, *${nome}*! Recebemos sua solicitação de compra:\n\n`;
      msg += `📦 *Produto:* ${prodName}\n`;
      msg += `🔖 *Código:* ${formatGSAProductCode(prodCode, prodDb)}\n`;
      msg += `🔢 *Quantidade:* ${parsed.prodQty} unidade(s)\n`;
      msg += `💰 *Valor Unitário:* R$ ${finalUnitPrice.toFixed(2).replace('.', ',')}\n`;
      msg += `💵 *Total a Pagar:* R$ ${total.toFixed(2).replace('.', ',')}\n`;
      if (session.fullDeliveryAddress) {
        msg += `📍 *Endereço Cadastrado:* ${session.fullDeliveryAddress}\n`;
      }
      msg += `\n`;
      msg += `Como você deseja prosseguir para finalizar?\n\n`;
      msg += `1️⃣ 🟢 *Pagar via PIX* (Instantâneo - QR Code e Copia e Cola)\n`;
      msg += `2️⃣ 💳 *Pagar com Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\n`;
      msg += `3️⃣ 📍 *Confirmar Endereço / Calcular Frete*\n`;
      msg += `4️⃣ 👤 *Falar com Atendente Humano*\n`;
      msg += `0️⃣ *Cancelar e Voltar ao Menu Principal*\n\n`;
      msg += `_Digite o número da opção desejada:_`;

      if (prodImage && prodImage.startsWith('http')) {
        sendWhatsAppMedia(fromPhone, prodImage, 'produto.png', msg, 'image');
      } else {
        sendWhatsAppReply(fromPhone, msg);
      }
    };

    if (session.clientData && session.clientData.id) {
      return presentOrderMenu(session.clientData);
    }
    if (session.profile && session.profile.cliente) {
      return presentOrderMenu(session.profile.cliente);
    }

    fetchClientByPhone(fromPhone, (errCli, clientFound) => {
      if (!errCli && clientFound && clientFound.id) {
        return presentOrderMenu(clientFound);
      }

      session.state = 'CHECKOUT_DOC';
      userSessions[fromPhone] = session;

      let msg = `🛒 *PEDIDO LOJA GSA HUB* 🛒\n\n`;
      msg += `Olá! Que excelente escolha! 👏\n\n`;
      msg += `📦 *Produto:* ${prodName}\n`;
      msg += `🔖 *Código:* ${formatGSAProductCode(prodCode, prodDb)}\n`;
      msg += `🔢 *Quantidade:* ${parsed.prodQty} unidade(s)\n`;
      msg += `💰 *Valor Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n`;
      msg += `Para vincularmos seu pedido e gerarmos sua cobrança segura (PIX ou Cartão), por favor, digite seu *CPF ou CNPJ* (apenas números):\n\n`;
      msg += `_Digite 0 para cancelar e voltar ao menu._`;

      if (prodImage && prodImage.startsWith('http')) {
        sendWhatsAppMedia(fromPhone, prodImage, 'produto.png', msg, 'image');
      } else {
        sendWhatsAppReply(fromPhone, msg);
      }
    });
  });
}

function generateStoreDirectPayment(fromPhone, session, paymentMethod) {
  const proceedWithClient = (clientObj) => {
    const clientId = clientObj?.id || session.tempClientId;
    if (!clientId) {
      sendWhatsAppReply(fromPhone, '❌ Não identificamos seus dados de cliente. Por favor, digite seu *CPF ou CNPJ* (apenas números):');
      session.state = 'CHECKOUT_DOC';
      userSessions[fromPhone] = session;
      return;
    }

    const prodItem = session.cart && session.cart[0] ? session.cart[0] : null;
    const prodName = prodItem ? prodItem.produto.nome : 'Produto Loja GSA';
    const prodCode = prodItem ? prodItem.produto.codigo_produto : 'PROD';
    const qtd = prodItem ? prodItem.quantidade : 1;
    const unitPrice = prodItem ? prodItem.produto.valor : 0;
    const total = (session.directProductTotal || (unitPrice * qtd)) > 0 ? (session.directProductTotal || (unitPrice * qtd)) : 10.00;

    const orcCod = `ORC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let obs = `🛒 Pedido de Compra Direta via WhatsApp (#COMPRA_LOJA_GSA):\n`;
    obs += `• ${qtd}x ${prodName} (${prodCode}) — R$ ${total.toFixed(2)}\n`;
    if (session.fullDeliveryAddress) {
      obs += `📍 Entrega: ${session.fullDeliveryAddress}\n`;
    } else if (session.cep) {
      obs += `📍 Entrega: CEP ${session.cep} - Nº/Compl: ${session.addressNum || 'S/N'}\n`;
    }
    obs += `💳 Forma de Pagamento: ${paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito'}`;

    const orcData = {
      codigo_orcamento: orcCod,
      cliente_id: clientId,
      categoria: 'produto',
      valor_produto: total,
      desconto: 0,
      total: total,
      status: 'aberto',
      endereco_entrega: session.fullDeliveryAddress || (session.cep ? `CEP: ${session.cep}, Nº ${session.addressNum || 'S/N'}` : null),
      observacoes_servico: obs,
      data_criacao: new Date().toISOString()
    };

    sendWhatsAppReply(fromPhone, paymentMethod === 'pix' ? '🔄 *Gerando QR Code e Chave PIX Instantâneo...*' : '🔄 *Gerando Link Seguro de Cartão (InfinitePay)...*');

    supabasePost('/rest/v1/orcamentos', orcData, (errOrc, resOrc) => {
      if (errOrc) {
        console.error('❌ Erro ao criar orcamento direto:', errOrc);
        sendWhatsAppReply(fromPhone, '❌ Ocorreu um erro ao registrar seu pedido. Tente novamente em instantes ou digite 0 para voltar.');
        return;
      }

      const faturaData = {
        codigo_fatura: `FAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        cliente_id: clientId,
        valor_total: total,
        valor_pago: 0,
        status: 'pendente',
        data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        data_emissao: new Date().toISOString()
      };

      supabasePost('/rest/v1/faturas', faturaData, (errF, resF) => {
        const faturaId = (!errF && resF && resF.length > 0) ? resF[0].id : null;

        const edgePayload = {
          fatura_id: faturaId || orcCod,
          cliente_id: clientId,
          valor_liquido: total,
          payment_method: paymentMethod
        };

        const edgeOptions = {
          hostname: SUPABASE_HOST,
          port: 443,
          path: '/functions/v1/generate-payment-link',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        };

        const reqE = https.request(edgeOptions, (resE) => {
          let dE = '';
          resE.on('data', c => { dE += c; });
          resE.on('end', () => {
            session.state = 'NPS_RATING';
            userSessions[fromPhone] = session;

            try {
              const parsed = JSON.parse(dE);
              const pixCode = parsed.pix_code || parsed.pix_copia_cola || parsed.pixCode || null;
              const qrCodeUrl = parsed.qr_code_url || parsed.qrcode_url || null;
              const link = parsed.link || null;

              if (paymentMethod === 'pix') {
                if (pixCode) {
                  sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado:* ${orcCod}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n🟢 *Chave PIX Copia e Cola:*`);
                  sendWhatsAppReply(fromPhone, ```${pixCode}```);

                  if (qrCodeUrl) {
                    sendWhatsAppMedia(fromPhone, qrCodeUrl, `pix_${orcCod}.png`, `QR Code PIX - R$ ${total.toFixed(2).replace('.', ',')}`, 'image');
                  }

                  setTimeout(() => {
                    sendWhatsAppReply(fromPhone, `⚡ *Pagamento Instantâneo!*\nAssim que o pagamento for realizado, nosso sistema processará seu pedido automaticamente.\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
                  }, 2000);
                } else if (link) {
                  sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado:* ${orcCod}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n🟢 *Pague via PIX pelo Link Seguro InfinitePay:*\n👉 ${link}\n\n⚡ A confirmação é instantânea!\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
                } else {
                  sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado:* ${orcCod}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\n\nAssim que pago, envie o comprovante por aqui.\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
                }
              } else {
                // Cartão de Crédito
                if (link) {
                  sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado:* ${orcCod}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n💳 *Link de Pagamento com Cartão (InfinitePay):*\n👉 ${link}\n\nVocê pode parcelar em até 12x no checkout!\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
                } else {
                  sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado:* ${orcCod}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n💳 Acesse nosso portal para pagar com cartão:\nhttps://gsahub.pages.dev/\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
                }
              }
            } catch (ex) {
              sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado:* ${orcCod}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n💳 Nossa equipe comercial entrará em contato para o envio do comprovante/pagamento.\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
            }
          });
        });

        reqE.on('error', (errReq) => {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado:* ${orcCod}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
        });

        reqE.setTimeout(8000, () => {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado:* ${orcCod}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
          reqE.destroy();
        });

        reqE.write(JSON.stringify(edgePayload));
        reqE.end();
      });
    });
  };

  if (session.clientData && session.clientData.id) {
    return proceedWithClient(session.clientData);
  }
  if (session.profile && session.profile.cliente) {
    return proceedWithClient(session.profile.cliente);
  }

  fetchClientByPhone(fromPhone, (err, cl) => {
    if (!err && cl && cl.id) {
      session.clientData = cl;
      session.tempClientId = cl.id;
      return proceedWithClient(cl);
    }
    proceedWithClient(null);
  });
}

function fetchCoupons(callback) {
  supabaseGet(`/rest/v1/vouchers?status=eq.ativo&select=codigo_voucher,nome,valor,tipo&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchClassifieds(categoria, callback) {
  const catFilter = categoria ? `&categoria=eq.${encodeURIComponent(categoria)}` : '';
  supabaseGet(`/rest/v1/classificados_anuncios?status=in.(ativo,publicado)${catFilter}&select=id,titulo,preco,slug&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchClientFaturas(clienteId, callback) {
  supabaseGet(`/rest/v1/faturas?cliente_id=eq.${clienteId}&status=not.in.(pago,cancelado)&select=id,codigo_fatura,data_vencimento,valor_total,status&order=created_at.desc&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchClientOS(clienteId, callback) {
  supabaseGet(`/rest/v1/ordens_servico?cliente_id=eq.${clienteId}&status=not.in.(concluido,cancelado)&select=id,codigo_os,status&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchClientOrcamentos(clienteId, callback) {
  supabaseGet(`/rest/v1/orcamentos?cliente_id=eq.${clienteId}&status=eq.aberto&select=id,codigo_orcamento,status,total&order=data_criacao.desc&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchClientAssinaturas(clienteId, callback) {
  supabaseGet(`/rest/v1/assinaturas?cliente_id=eq.${clienteId}&status=eq.ativa&select=id,codigo_assinatura,status,valor&order=created_at.desc&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchClientTickets(clienteId, callback) {
  supabaseGet(`/rest/v1/tickets?cliente_id=eq.${clienteId}&status=eq.aberto&select=id,assunto,status&order=created_at.desc&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

// Helper para gerar número de protocolo único
function generateProtocolNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `GSA-${dateStr}-${randomNum}`;
}

// ─── MAPEAMENTO DE TELEFONES DOS SETORES (TRANSBORDO HUMANO) ──────────────────
const DEPARTMENT_PHONES = {
  'Comercial': '5511971858372',
  'Financeiro': '5511971858372',
  'Dep. Pessoal': '5511971858372',
  'Suporte Afiliados': '5511971858372',
  'Suporte Parceiros': '5511971858372',
  'Suporte Fornecedores': '5511971858372',
  'SAC': '5511971858372'
};

// Helper de período do dia (Bom Dia, Boa Tarde, Boa Noite)
function getGreetingPeriod() {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const brtHours = (utcHours - 3 + 24) % 24;
  if (brtHours >= 5 && brtHours < 12) {
    return 'Bom Dia';
  } else if (brtHours >= 12 && brtHours < 18) {
    return 'Boa Tarde';
  } else {
    return 'Boa Noite';
  }
}

// Helper para formatar nomes em negrito limpos sem espaços em branco nas pontas (evitando falha do negrito do WhatsApp)
function formatBoldName(nameStr) {
  if (!nameStr) return 'CLIENTE GSA';
  return String(nameStr).trim().toUpperCase();
}

// ─── MENU PRINCIPAL DINÂMICO ──────────────────────────────────────────────────
function getMainMenuText(profile) {
  const period = getGreetingPeriod();
  let greetingHeader = `👋 Olá! ${period}`;
  
  if (profile && profile.data) {
    const nome = profile.data.nome || profile.data.nome_completo || profile.data.razao_social;
    if (nome) {
      greetingHeader = `👋 Olá! ${period}, *${nome.trim().toUpperCase()}*`;
    }
  }

  return `${greetingHeader}

Bem-vindo(a) ao *GSA HUB*. 🌟

Qual atendimento você precisa para hoje?

1️⃣ 👤 Área do Cliente
2️⃣ 🛠️ Contratar Serviços
3️⃣ 🛍️ Loja de Produtos
4️⃣ ✈️ Pacotes de Viagens
5️⃣ 🏥 Seguros e Planos de Saúde
6️⃣ 📢 Vendas de Classificados
7️⃣ 🎁 Programa Indique e Ganhe
8️⃣ 💎 Programa de Fidelidade
9️⃣ 💼 Portais de Parceiros
🔟 💬 Falar com Atendente Humano

_Digite o número da opção desejada (1 a 10)_`;
}

const MAIN_MENU_TEXT = getMainMenuText(null);

// ─── ENVIO VIA EVOLUTION API COM AUTO-RETRY E RECONNECT ────────────────────────
function triggerInstanceRestart() {
  try {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8080,
      path: '/instance/restart/GSA_WhatsApp',
      method: 'POST',
      headers: { 'apikey': 'gsa_hub_evolution_token_2026' }
    }, () => {});
    req.on('error', () => {});
    req.end();
  } catch (e) {}
}

// ─── FORMATAÇÃO LIMPA PARA O MARKDOWN DO WHATSAPP (SEM ASTERISCOS SOBRANDO) ──
function formatToWhatsAppMarkdown(text) {

  if (!text || typeof text !== 'string') return text;
  
  let formatted = text;

  // 1. Converte cabeçalhos Markdown (# Título, ## Título, ### Título) para negrito WhatsApp (*Título*)
  formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // 2. Converte itens de lista Markdown (* item ou + item ou - item) para bullets seguros (• item)
  // Isso evita que listas de markdown gerem asteriscos colados em negrito (* **texto**)
  formatted = formatted.replace(/^(\s*)[\*\+]\s+/gm, '$1• ');
  formatted = formatted.replace(/^(\s*)\-\s+/gm, '$1• ');

  // 3. Converte negrito triplo (***texto***) para negrito itálico (*_texto_*)
  formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '*_$1_*');
  formatted = formatted.replace(/___(.*?)___/g, '*_$1_*');

  // 4. Converte negrito duplo markdown padrão (**texto**) para negrito único do WhatsApp (*texto*)
  formatted = formatted.replace(/\*\*([^\*\n]+?)\*\*/g, '*$1*');

  // 5. Remove qualquer asterisco duplo ou múltiplo que tenha sobrado
  formatted = formatted.replace(/\*{2,}/g, '*');

  // 6. Corrige espaços impróprios junto aos asteriscos (WhatsApp ignora negrito se tiver espaço dentro)
  formatted = formatted.replace(/\*\s+([^\*\n]+?)\s+\*/g, '*$1*');
  formatted = formatted.replace(/\*\s+([^\*\n]+?)\*/g, '*$1*');
  formatted = formatted.replace(/\*([^\*\n]+?)\s+\*/g, '*$1*');

  // 7. Links Markdown [Texto](URL) -> Texto (URL)
  formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1 ($2)');

  return formatted;
}

// ─── ANTI-BAN SHIELD INTEGRATION ─────────────────────────────────────────────
const antiBanEngine = require('./lib/antiBanEngine.cjs');
if (typeof antiBanEngine.registerContactContext === 'function') {
  antiBanEngine.registerContactContext('5511971858372', '38830967099420@lid');
}

function sendWhatsAppReply(to, messageText, retryCount = 0) {
  if (!messageText || !to) {
    console.error('❌ sendWhatsAppReply: parâmetros inválidos', { to, messageText: messageText ? 'ok' : 'vazio' });
    return Promise.resolve({ success: false, error: 'Invalid parameters' });
  }

  return antiBanEngine.sendWhatsAppReply(to, messageText, retryCount);
}
// Função para remover o código de país 55 (garantindo DDD + Número)
function stripCountryCode55(phoneStr) {
  let p = (phoneStr || '').replace(/\D/g, '');
  if (p.startsWith('55') && (p.length === 12 || p.length === 13)) {
    return p.substring(2);
  }
  return p;
}

function formatPhoneForSearch(phoneStr) {
  return stripCountryCode55(phoneStr);
}

// ── CONSULTAS AO SUPABASE ───────────────────────────────────────────────────

function fetchUserProfile(phone, callback) {
  const pClean = stripCountryCode55(phone);
  const pWith55 = `55${pClean}`;
  const filter = `or=(telefone.eq.${pClean},telefone.eq.${pWith55},telefone.ilike.*${pClean}*)`;
  
  let multiRole = {
    cliente: null,
    afiliado: null,
    fornecedor: null,
    prestador: null,
    type: 'unknown',
    data: null,
    primaryName: null
  };

  let pending = 4;

  function checkDone() {
    pending--;
    if (pending === 0) {
      if (multiRole.cliente) {
        multiRole.type = 'cliente';
        multiRole.data = multiRole.cliente;
        multiRole.primaryName = multiRole.cliente.nome || multiRole.cliente.nome_completo || multiRole.cliente.razao_social;
      } else if (multiRole.afiliado) {
        multiRole.type = 'afiliado';
        multiRole.data = multiRole.afiliado;
        multiRole.primaryName = multiRole.afiliado.nome;
      } else if (multiRole.fornecedor) {
        multiRole.type = 'fornecedor';
        multiRole.data = multiRole.fornecedor;
        multiRole.primaryName = multiRole.fornecedor.razao_social || multiRole.fornecedor.nome_fantasia || multiRole.fornecedor.nome;
      } else if (multiRole.prestador) {
        multiRole.type = 'prestador';
        multiRole.data = multiRole.prestador;
        multiRole.primaryName = multiRole.prestador.razao_social || multiRole.prestador.nome_fantasia || multiRole.prestador.nome;
      }
      callback(multiRole);
    }
  }

  // 1. Clientes
  supabaseGet(`/rest/v1/clientes?${filter}&select=*&limit=1`, (err, rows) => {
    if (!err && Array.isArray(rows) && rows.length > 0) multiRole.cliente = rows[0];
    checkDone();
  });

  // 2. Afiliados
  supabaseGet(`/rest/v1/gsa_afiliados?${filter}&select=*&limit=1`, (err, rows) => {
    if (!err && Array.isArray(rows) && rows.length > 0) multiRole.afiliado = rows[0];
    checkDone();
  });

  // 3. Fornecedores
  supabaseGet(`/rest/v1/fornecedores?${filter}&select=*&limit=1`, (err, rows) => {
    if (!err && Array.isArray(rows) && rows.length > 0) multiRole.fornecedor = rows[0];
    checkDone();
  });

  // 4. Prestadores
  supabaseGet(`/rest/v1/prestadores?${filter}&select=*&limit=1`, (err, rows) => {
    if (!err && Array.isArray(rows) && rows.length > 0) multiRole.prestador = rows[0];
    checkDone();
  });
}

function generateInvoicePdfBase64(fatura, client) {
  const cod = fatura?.codigo_fatura || `FAT-${String(fatura?.id || '0000').substring(0,6)}`;
  const valor = Number(fatura?.valor_total || 0).toFixed(2);
  const venc = fatura?.data_vencimento ? new Date(fatura.data_vencimento).toLocaleDateString('pt-BR') : 'N/A';
  const emissao = fatura?.data_emissao ? new Date(fatura.data_emissao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const nomeCliente = ((client?.nome_completo || client?.nome || 'Cliente GSA HUB')).replace(/[()\\\\]/g, '');
  const cpfCliente = (client?.cpf || client?.cnpj || 'N/A').replace(/[()\\\\]/g, '');
  const status = (fatura?.status || 'PENDENTE').toUpperCase();

  const streamLines = [
    "0.06 0.09 0.16 rg 0 770 595 72 re f",
    "0.31 0.27 0.90 rg 0 765 595 5 re f",
    "1 1 1 rg BT /F2 14 Tf 30 812 Td (GSA HUB - GESTAO DE SERVICOS) Tj ET",
    "0.7 0.75 0.85 rg BT /F1 8.5 Tf 30 795 Td (CNPJ: 53.217.297/0001-08  |  gsa.doc.adm@gmail.com) Tj ET",
    "1 1 1 rg BT /F2 13 Tf 420 812 Td (FATURA DE COBRANCA) Tj ET",
    "0.8 0.85 0.95 rg BT /F1 8.5 Tf 420 795 Td (No: " + cod + ") Tj ET",
    "0.31 0.27 0.90 rg 30 725 4 14 re f",
    "0.06 0.09 0.16 rg BT /F2 11 Tf 40 727 Td (DADOS DA FATURA E CLIENTE) Tj ET",
    "0.96 0.97 0.98 rg 30 635 535 80 re f",
    "0.85 0.88 0.92 RG 0.5 w 30 635 535 80 re s",
    "0.4 0.45 0.5 rg BT /F2 8 Tf 42 698 Td (CODIGO DA FATURA:) Tj ET",
    "0.1 0.1 0.1 rg BT /F1 10 Tf 42 684 Td (" + cod + ") Tj ET",
    "0.4 0.45 0.5 rg BT /F2 8 Tf 220 698 Td (DATA DE EMISSAO:) Tj ET",
    "0.1 0.1 0.1 rg BT /F1 10 Tf 220 684 Td (" + emissao + ") Tj ET",
    "0.4 0.45 0.5 rg BT /F2 8 Tf 390 698 Td (DATA DE VENCIMENTO:) Tj ET",
    "0.1 0.1 0.1 rg BT /F1 10 Tf 390 684 Td (" + venc + ") Tj ET",
    "0.4 0.45 0.5 rg BT /F2 8 Tf 42 660 Td (CLIENTE:) Tj ET",
    "0.1 0.1 0.1 rg BT /F1 10 Tf 42 646 Td (" + nomeCliente + ") Tj ET",
    "0.4 0.45 0.5 rg BT /F2 8 Tf 220 660 Td (CPF / CNPJ:) Tj ET",
    "0.1 0.1 0.1 rg BT /F1 10 Tf 220 646 Td (" + cpfCliente + ") Tj ET",
    "0.4 0.45 0.5 rg BT /F2 8 Tf 390 660 Td (STATUS:) Tj ET",
    "0.85 0.45 0.1 rg BT /F2 10 Tf 390 646 Td (" + status + ") Tj ET",
    "0.31 0.27 0.90 rg 30 595 4 14 re f",
    "0.06 0.09 0.16 rg BT /F2 11 Tf 40 597 Td (ITENS FATURADOS) Tj ET",
    "0.06 0.09 0.16 rg 30 565 535 20 re f",
    "1 1 1 rg BT /F2 9 Tf 42 571 Td (DESCRICAO DO SERVICO / PRODUTO) Tj ET",
    "1 1 1 rg BT /F2 9 Tf 380 571 Td (QTD) Tj ET",
    "1 1 1 rg BT /F2 9 Tf 480 571 Td (VALOR TOTAL) Tj ET",
    "0.98 0.98 0.99 rg 30 540 535 25 re f",
    "0.85 0.88 0.92 RG 0.5 w 30 540 535 25 re s",
    "0.1 0.1 0.1 rg BT /F1 10 Tf 42 550 Td (Prestacao de Servicos e Assinatura GSA HUB - " + cod + ") Tj ET",
    "0.1 0.1 0.1 rg BT /F1 10 Tf 385 550 Td (1) Tj ET",
    "0.1 0.1 0.1 rg BT /F2 10 Tf 480 550 Td (R$ " + valor + ") Tj ET",
    "0.31 0.27 0.90 rg 30 495 4 14 re f",
    "0.06 0.09 0.16 rg BT /F2 11 Tf 40 497 Td (RESUMO FINANCEIRO) Tj ET",
    "0.93 0.94 0.99 rg 30 425 535 55 re f",
    "0.31 0.27 0.90 RG 1 w 30 425 535 55 re s",
    "0.2 0.2 0.3 rg BT /F1 10 Tf 42 460 Td (Subtotal:) Tj ET",
    "0.2 0.2 0.3 rg BT /F1 10 Tf 480 460 Td (R$ " + valor + ") Tj ET",
    "0.31 0.27 0.90 rg BT /F2 13 Tf 42 438 Td (VALOR TOTAL A PAGAR:) Tj ET",
    "0.31 0.27 0.90 rg BT /F2 13 Tf 460 438 Td (R$ " + valor + ") Tj ET",
    "0.85 0.88 0.92 RG 0.5 w 30 60 535 0.5 re s",
    "0.5 0.5 0.5 rg BT /F1 8 Tf 160 45 Td (GSA SERVICOS - Documento Oficial Emitido pelo Portal GSA HUB) Tj ET"
  ];

  const contentStream = streamLines.join("\n");
  const streamLen = Buffer.byteLength(contentStream);

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n";
  const obj4 = `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  const obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
  const obj6 = "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n";

  const p1 = header.length;
  const p2 = p1 + obj1.length;
  const p3 = p2 + obj2.length;
  const p4 = p3 + obj3.length;
  const p5 = p4 + obj4.length;
  const p6 = p5 + obj5.length;
  const xrefOffset = p6 + obj6.length;

  const pad = n => String(n).padStart(10, '0');

  const xref = `xref
0 7
0000000000 65535 f 
${pad(p1)} 00000 n 
${pad(p2)} 00000 n 
${pad(p3)} 00000 n 
${pad(p4)} 00000 n 
${pad(p5)} 00000 n 
${pad(p6)} 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF
`;

  const fullPdf = header + obj1 + obj2 + obj3 + obj4 + obj5 + obj6 + xref;
  return Buffer.from(fullPdf, 'utf-8').toString('base64');
}

function generateCalculatorReportPdfBase64(report) {
  const sanitize = (text) => String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()\\]/g, '');

  const title = sanitize(report.title || 'RELATORIO DE CALCULO GSA HUB').toUpperCase();
  const mode = sanitize(report.mode || 'PRO').toUpperCase();
  const clientName = sanitize(report.clientName || 'Cliente GSA HUB');
  const protocol = sanitize(report.protocol || `CALC-${Date.now().toString().slice(-6)}`);
  const emissao = new Date().toLocaleDateString('pt-BR');
  const items = report.items || [];
  const totalLabel = sanitize(report.total_label || 'VALOR TOTAL ESTIMADO').toUpperCase();
  const totalValue = sanitize(report.total_value || 'R$ 0,00');
  const notes = sanitize(report.notes || 'Documento emitido automaticamente pelo Assistente Virtual GSA HUB.');

  const streamLines = [
    // Header Dark Navy
    "0.07 0.13 0.19 rg 0 760 595 82 re f",
    "0.78 0.64 0.35 rg 0 755 595 5 re f",
    
    // Logo & Header text (Tamanho 13 e espaçamento preciso para eliminar qualquer colisão com o protocolo)
    "1 1 1 rg BT /F2 13 Tf 35 810 Td (GSA HUB - GESTAO DE SERVICOS & TECNOLOGIA) Tj ET",
    "0.85 0.74 0.45 rg BT /F2 9.5 Tf 35 792 Td (RELATORIO OFICIAL - MODO " + mode + ") Tj ET",
    "0.7 0.75 0.85 rg BT /F1 8 Tf 35 773 Td (CNPJ: 53.217.297/0001-08  |  gsa.doc.adm@gmail.com  |  WhatsApp Oficial) Tj ET",

    // Protocol info on top right (Posicionado com margem limpa)
    "1 1 1 rg BT /F2 9.5 Tf 420 810 Td (PROTOCOLO:) Tj ET",
    "0.85 0.74 0.45 rg BT /F2 9.5 Tf 488 810 Td (" + protocol + ") Tj ET",
    "0.7 0.75 0.85 rg BT /F1 8.5 Tf 420 792 Td (EMISSAO: " + emissao + ") Tj ET",

    // Section 1: Dados do Calculo
    "0.78 0.64 0.35 rg 35 725 4 14 re f",
    "0.07 0.13 0.19 rg BT /F2 12 Tf 45 727 Td (" + title + ") Tj ET",
    
    "0.96 0.97 0.98 rg 35 660 525 55 re f",
    "0.85 0.88 0.92 RG 0.5 w 35 660 525 55 re s",
    "0.4 0.45 0.5 rg BT /F2 8 Tf 45 698 Td (CLIENTE / BENEFICIARIO:) Tj ET",
    "0.1 0.1 0.1 rg BT /F1 10 Tf 45 684 Td (" + clientName + ") Tj ET",
    "0.4 0.45 0.5 rg BT /F2 8 Tf 350 698 Td (STATUS DO CALCULO:) Tj ET",
    "0.1 0.6 0.2 rg BT /F2 10 Tf 350 684 Td (CALCULO CONCLUIDO) Tj ET",

    // Section 2: Tabela de Itens e Verbas
    "0.78 0.64 0.35 rg 35 635 4 14 re f",
    "0.07 0.13 0.19 rg BT /F2 11 Tf 45 637 Td (DISCRIMINACAO DAS VERBAS E RESULTADOS) Tj ET",

    // Table Header
    "0.07 0.13 0.19 rg 35 605 525 22 re f",
    "1 1 1 rg BT /F2 9 Tf 45 612 Td (DESCRICAO DO ITEM / RUBRICA) Tj ET",
    "1 1 1 rg BT /F2 9 Tf 450 612 Td (VALOR APURADO) Tj ET"
  ];

  let currentY = 580;
  items.slice(0, 10).forEach((item, idx) => {
    const bg = idx % 2 === 0 ? "0.98 0.98 0.99" : "1 1 1";
    const lbl = sanitize(item.label || item.descricao || `Item ${idx+1}`);
    const val = sanitize(item.value || item.valor || 'R$ 0,00');

    streamLines.push(
      `${bg} rg 35 ${currentY - 5} 525 22 re f`,
      `0.88 0.90 0.94 RG 0.5 w 35 ${currentY - 5} 525 22 re s`,
      `0.15 0.15 0.2 rg BT /F1 9 Tf 45 ${currentY} Td (${lbl}) Tj ET`,
      `0.07 0.13 0.19 rg BT /F2 9.5 Tf 450 ${currentY} Td (${val}) Tj ET`
    );
    currentY -= 24;
  });

  // Box Totalizador
  currentY -= 10;
  streamLines.push(
    `0.94 0.96 0.99 rg 35 ${currentY - 15} 525 45 re f`,
    `0.78 0.64 0.35 RG 1.5 w 35 ${currentY - 15} 525 45 re s`,
    `0.3 0.35 0.4 rg BT /F2 10 Tf 45 ${currentY + 12} Td (${totalLabel}:) Tj ET`,
    `0.07 0.13 0.19 rg BT /F2 15 Tf 45 ${currentY - 5} Td (${totalValue}) Tj ET`
  );

  // Observações Legais
  currentY -= 45;
  streamLines.push(
    `0.78 0.64 0.35 rg 35 ${currentY} 4 12 re f`,
    `0.07 0.13 0.19 rg BT /F2 10 Tf 45 ${currentY + 2} Td (OBSERVACOES E FUNDAMENTACAO LEGAL) Tj ET`,
    `0.98 0.98 0.99 rg 35 ${currentY - 45} 525 40 re f`,
    `0.88 0.90 0.94 RG 0.5 w 35 ${currentY - 45} 525 40 re s`,
    `0.3 0.35 0.4 rg BT /F1 8.5 Tf 45 ${currentY - 20} Td (${notes.substring(0, 95)}) Tj ET`,
    `0.3 0.35 0.4 rg BT /F1 8.5 Tf 45 ${currentY - 32} Td (${notes.substring(95, 190)}) Tj ET`,

    // Footer
    "0.85 0.88 0.92 RG 0.5 w 35 45 525 0.5 re s",
    "0.5 0.55 0.6 rg BT /F1 8 Tf 140 32 Td (GSA HUB - Relatorio emitido digitalmente atraves do WhatsApp Oficial) Tj ET"
  );

  const contentStream = streamLines.join("\n");
  const streamLen = Buffer.byteLength(contentStream, 'utf8');

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n";
  const obj4 = `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  const obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
  const obj6 = "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n";

  const p1 = header.length;
  const p2 = p1 + obj1.length;
  const p3 = p2 + obj2.length;
  const p4 = p3 + obj3.length;
  const p5 = p4 + obj4.length;
  const p6 = p5 + obj5.length;
  const xrefOffset = p6 + obj6.length;

  const pad = n => String(n).padStart(10, '0');

  const xref = `xref
0 7
0000000000 65535 f 
${pad(p1)} 00000 n 
${pad(p2)} 00000 n 
${pad(p3)} 00000 n 
${pad(p4)} 00000 n 
${pad(p5)} 00000 n 
${pad(p6)} 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF
`;

  const fullPdf = header + obj1 + obj2 + obj3 + obj4 + obj5 + obj6 + xref;
  return Buffer.from(fullPdf, 'utf-8').toString('base64');
}

async function sendWhatsAppMedia(to, mediaUrl, fileName, caption, mediaType = 'document') {
  if (!mediaUrl || !to) return { success: false, error: 'Invalid parameters' };
  return antiBanEngine.sendWhatsAppMedia(to, mediaUrl, fileName, caption, mediaType);
}


// ─── HELPER: IDENTIFICAÇÃO DE TEXTO CONVERSACIONAL ──────────────────────────
function isConversationalText(text) {
  if (!text) return false;
  const raw = text.trim();
  // Se for apenas números (ex: 1, 2, 10 ou 11/14 dígitos de CPF/CNPJ), NÃO é conversacional
  if (/^\d+$/.test(raw)) return false;
  const lower = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // Comandos curtos de navegação não são conversacionais
  if (['0', 'voltar', 'menu', 'sair', 'anterior', 'ajuda', 'cancelar', 'inicio', 'início', 'start', 'oi', 'ola', 'olá', 'hi'].includes(lower)) return false;
  // Se tiver letras
  return /[a-zA-Z]/.test(raw);
}

// ─── NLP DE MENUS (APENAS COMANDOS DIRETOS E CURTOS) ──────────────────────────
function getMenuIntent(text) {
  const raw = (text || '').trim();
  const t = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  // Se for número direto (0 a 10)
  if (/^(10|[0-9])$/.test(t)) return t;

  // Se for pergunta ou frase longa, DEIXAR PARA A IA RESPONDER
  if (raw.length > 20 || /\b(como|onde|quais|qual|posso|gostaria|quero saber|me explica|nao tenho|ainda nao|voce|oque|o que|porque|por que|quanto|ajuda|entende|conhecer|beneficio|beneficios|cadastro)\b/i.test(t)) {
    return raw;
  }

  // Apenas comandos curtos e exatos de menu
  if (/^(atendente|humano|suporte|falar com atendente|falar com humano)$/i.test(t)) return '10';
  if (/^(area do cliente|minha conta|minhas faturas|segunda via|2 via|meus boletos)$/i.test(t)) return '1';
  if (/^(contratar servicos|contratar servico|ver servicos|catalogo de servicos)$/i.test(t)) return '2';
  if (/^(loja|loja virtual|ver produtos|marketplace|vitrine)$/i.test(t)) return '3';
  if (/^(viagens|pacotes de viagem|pacote de viagem)$/i.test(t)) return '4';
  if (/^(seguros|cotacao de seguro|planos de saude)$/i.test(t)) return '5';
  if (/^(classificados|ver classificados|anuncios)$/i.test(t)) return '6';
  if (/^(indique e ganhe|programa de afiliados|meu link de afiliado)$/i.test(t)) return '7';
  if (/^(programa de fidelidade|meus pontos|clube fidelidade)$/i.test(t)) return '8';
  if (/^(portais de parceiros|parceiros|fornecedores)$/i.test(t)) return '9';
  
  return raw;
}


// ─── HIERARQUIA DE NAVEGAÇÃO DE MENUS (VOLTAR AO ANTERIOR / PRINCIPAL) ────────
const STATE_PARENTS = {
  'REDEMPTION_SELECT_PARTNER': 'MAIN_MENU',
  'REDEMPTION_CONFIRM_PARTNER': 'MAIN_MENU',
  'REDEMPTION_COLLECT_NAME': 'MAIN_MENU',
  'REDEMPTION_COLLECT_EMAIL': 'MAIN_MENU',
  'REDEMPTION_COLLECT_PHONE': 'MAIN_MENU',
  'REDEMPTION_AWAITING_JUSTIFICATION': 'MAIN_MENU',
  'PARTNERS': 'MAIN_MENU',
  'PARTNER_AFFILIATE_MENU': 'PARTNERS',
  'PARTNER_AFFILIATE_WITHDRAW_PIX': 'PARTNER_AFFILIATE_MENU',
  'PARTNER_AFFILIATE_ACTIVATE_PROMPT': 'PARTNERS',
  'AFFILIATE_DOC': 'PARTNERS',
  'PARTNER_SUPPLIER_DOC': 'PARTNERS',
  'PARTNER_SUPPLIER_NOT_FOUND': 'PARTNERS',
  'PARTNER_SUPPLIER_MENU': 'PARTNERS',
  'PARTNER_SUPPLIER_NF': 'PARTNER_SUPPLIER_MENU',
  'PARTNER_SUPPLIER_REG_NAME': 'PARTNERS',
  'PARTNER_SUPPLIER_REG_EMAIL': 'PARTNERS',
  'PARTNER_SUPPLIER_REG_CAT': 'PARTNERS',
  'PARTNER_PROVIDER_DOC': 'PARTNERS',
  'PARTNER_PROVIDER_NOT_FOUND': 'PARTNERS',
  'PARTNER_PROVIDER_MENU': 'PARTNERS',
  'PARTNER_PROVIDER_WITHDRAW_PIX': 'PARTNER_PROVIDER_MENU',
  'PARTNER_PROVIDER_REG_NAME': 'PARTNERS',
  'PARTNER_PROVIDER_REG_AREA': 'PARTNERS',
  'PARTNER_ADVERTISER_MENU': 'PARTNERS',
  'PARTNER_NETWORK_MENU': 'PARTNERS',
  'PARTNER_NETWORK_REG_NAME': 'PARTNERS',
  'PARTNER_NETWORK_REG_SEGMENT': 'PARTNERS',
  'PARTNER_SUPPORT_MENU': 'PARTNERS',
  'CLIENT_AREA': 'MAIN_MENU',
  'CLIENT_DASHBOARD_MENU': 'MAIN_MENU',
  'STORE_PRODUCTS': 'MAIN_MENU',
  'STORE_VOUCHERS': 'STORE_PRODUCTS',
  'STORE_CART': 'STORE_PRODUCTS',
  'STORE_CHECKOUT': 'STORE_PRODUCTS',
  'STORE_DIRECT_PAY_OPTIONS': 'MAIN_MENU',
  'STORE_DIRECT_CEP': 'STORE_DIRECT_PAY_OPTIONS',
  'STORE_DIRECT_ADDR': 'STORE_DIRECT_CEP',
  'HIRE_SERVICES': 'MAIN_MENU',
  'SERVICE_DETAILS': 'HIRE_SERVICES',
  'SERVICE_ORDER': 'HIRE_SERVICES',
  'TRAVEL_PACKAGES': 'MAIN_MENU',
  'TRAVEL_DETAILS': 'TRAVEL_PACKAGES',
  'INSURANCE_TYPES': 'MAIN_MENU',
  'INSURANCE_DETAILS': 'INSURANCE_TYPES',
  'INSURANCE_DOC': 'INSURANCE_DETAILS',
  'CLASSIFIEDS': 'MAIN_MENU',
  'CLASSIFIED_DETAILS': 'CLASSIFIEDS',
  'LOYALTY': 'MAIN_MENU'
};

function renderStateMenu(fromPhone, session, targetState) {
  switch (targetState) {
    case 'PARTNERS':
      sendWhatsAppReply(fromPhone, `💼 *Portais de Parceiros GSA HUB*\n\nSelecione o portal desejado para atendimento:\n\n1️⃣ 🤝 Portal do Afiliado (Indique & Ganhe)\n2️⃣ 📦 Portal do Fornecedor & Suprimentos\n3️⃣ 🛠️ Portal do Prestador de Serviços\n4️⃣ 📢 Portal do Anunciante\n5️⃣ 🌟 Rede de Parceiros Homologados\n6️⃣ 💬 Suporte Especializado a Parceiros\n\n0️⃣ ⬅️ Voltar ao Menu Principal`);
      break;

    case 'PARTNER_AFFILIATE_MENU':
      const afiliado = session.affiliateData;
      const status = (afiliado?.status === 'ativo') ? '✅ Ativo' : '⚠️ ' + String(afiliado?.status || 'Pendente').toUpperCase();
      const nome = formatBoldName(afiliado?.nome_divulgacao || session.profile?.data?.nome || 'Afiliado');
      sendWhatsAppReply(fromPhone, `🤝 *Portal do Afiliado GSA HUB*\nOlá, *${nome}*! (${status})\n\n1️⃣ 🔗 Meus Links de Indicação\n2️⃣ 💰 Consultar Comissões e Extrato\n3️⃣ 💸 Solicitar Saque PIX\n4️⃣ 📢 Material de Divulgação\n\n0️⃣ ⬅️ Voltar ao Menu Anterior`);
      break;

    case 'PARTNER_SUPPLIER_MENU':
      const sup = session.supplierData;
      const sNome = formatBoldName(sup?.razao_social || sup?.nome_fantasia || 'Fornecedor');
      sendWhatsAppReply(fromPhone, `📦 *Portal do Fornecedor GSA HUB*\nOlá, *${sNome}*! (Status: ${sup?.status || 'Ativo'})\n\n1️⃣ 📋 Meus Pedidos de Compra\n2️⃣ 💰 Financeiro & Contas a Receber\n3️⃣ 📦 Catálogo de Produtos Cadastrados\n4️⃣ 📄 Informar Nota Fiscal de Entrega\n5️⃣ 🌐 Acessar Painel Web do Fornecedor\n\n0️⃣ ⬅️ Voltar ao Menu Anterior`);
      break;

    case 'PARTNER_PROVIDER_MENU':
      const prov = session.providerData;
      const pNome = formatBoldName(prov?.nome_completo || prov?.razao_social || 'Prestador');
      sendWhatsAppReply(fromPhone, `🛠️ *Portal do Prestador GSA HUB*\nOlá, *${pNome}*! (Área: ${prov?.area_servico || 'Geral'})\n\n1️⃣ 🛠️ Minhas Demandas & OS\n2️⃣ 📅 Agenda de Atendimentos\n3️⃣ 💰 Saldo em Carteira & Repasses\n4️⃣ 💸 Solicitar Saque PIX de Repasses\n5️⃣ 🌐 Acessar Painel Web do Prestador\n\n0️⃣ ⬅️ Voltar ao Menu Anterior`);
      break;

    case 'PARTNER_ADVERTISER_MENU':
      sendWhatsAppReply(fromPhone, `📢 *Portal do Anunciante GSA HUB*\n\n1️⃣ 📊 Consultar Campanhas de Mídia\n2️⃣ 🚀 Planos e Formatos de Anúncios\n3️⃣ 💬 Solicitar Atendimento Comercial de Mídia\n4️⃣ 🌐 Painel Web do Anunciante\n\n0️⃣ ⬅️ Voltar ao Menu Anterior`);
      break;

    case 'PARTNER_NETWORK_MENU':
      sendWhatsAppReply(fromPhone, `🌟 *Rede de Parceiros Homologados GSA HUB*\n\n1️⃣ 🔍 Consultar Rede Credenciada GSA\n2️⃣ 🤝 Credenciar Minha Empresa como Parceira\n3️⃣ 💬 Falar com a Diretoria de Parcerias B2B\n\n0️⃣ ⬅️ Voltar ao Menu Anterior`);
      break;

    case 'PARTNER_SUPPORT_MENU':
      sendWhatsAppReply(fromPhone, `💬 *Suporte Especializado a Parceiros GSA HUB*\n\n1️⃣ 🤝 Suporte a Afiliados\n2️⃣ 📦 Suporte a Fornecedores\n3️⃣ 🛠️ Suporte a Prestadores de Serviços\n4️⃣ 💼 Novos Negócios & Parcerias B2B\n\n0️⃣ ⬅️ Voltar ao Menu Anterior`);
      break;

    case 'MAIN_MENU':
    default:
      session.state = 'MAIN_MENU';
      sendWhatsAppReply(fromPhone, getMainMenuText(session.profile));
      break;
  }
}

// Helper para auto-injetar CPF se o cliente já foi identificado na Inteligência de Perfil
function autoInjectDocument(fromPhone, session, nextState, fallbackPrompt) {
  if (session.profile && session.profile.type === 'cliente') {
    const doc = session.profile.data.cpf || session.profile.data.cnpj || session.profile.data.documento;
    if (doc) {
      session.state = nextState;
      userSessions[fromPhone] = session;
      return processMessage(fromPhone, doc);
    }
  }
  session.state = nextState;
  userSessions[fromPhone] = session;
  sendWhatsAppReply(fromPhone, fallbackPrompt);
}

// ─── FASE 4: UPLOAD DE MÍDIA / DOCUMENTOS (EVOLUTION + R2) ─────────────────────
async function handleClientMediaUpload(fromPhone, mediaType, rawMessageData, session) {
  try {
    sendWhatsAppReply(fromPhone, '⏳ *Recebendo seu arquivo...* Aguarde um instante.');
    
    // 1. Baixar base64 da Evolution API
    const payload = JSON.stringify({ message: rawMessageData.message });
    const evoResp = await fetch('http://127.0.0.1:8080/chat/getBase64FromMediaMessage/GSA_WhatsApp', {
      method: 'POST',
      headers: {
        'apikey': 'gsa_hub_evolution_token_2026',
        'Content-Type': 'application/json'
      },
      body: payload
    });
    const evoJson = await evoResp.json();
    if (!evoJson || !evoJson.base64) throw new Error('Falha ao obter base64 da Evolution API');

    const base64Data = evoJson.base64;
    const mimeType = evoJson.mimetype || (mediaType === 'image' ? 'image/jpeg' : 'application/pdf');
    const binaryData = Buffer.from(base64Data, 'base64');
    const ext = mimeType.split('/')[1] || (mediaType === 'image' ? 'jpg' : 'pdf');
    const fileName = `doc_whatsapp_${Date.now()}.${ext}`;
    const clientId = session.client?.id || 'lead_whatsapp';
    const pathKey = `private/client-docs/${clientId}/${fileName}`;

    // 2. Upload para Cloudflare R2 via Worker
    const formData = new FormData();
    formData.append('path', pathKey);
    formData.append('file', new Blob([binaryData], { type: mimeType }), fileName);

    const r2Resp = await fetch('https://gsa-hub-r2-worker.r2-handler.workers.dev/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_ROLE_JWT}` },
      body: formData
    });
    const r2Json = await r2Resp.json();
    if (!r2Resp.ok || !r2Json.success) throw new Error(r2Json.error || 'Erro no upload R2');

    const fileUrl = r2Json.url || `https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev/${pathKey}`;

    // 3. Registrar no banco de dados (cliente_documentos) se houver clientId
    if (session.client?.id) {
      await new Promise((resolve) => {
        supabasePost('/rest/v1/cliente_documentos', {
          cliente_id: session.client.id,
          tipo_documento: 'Documento Recebido via WhatsApp',
          descricao: 'Arquivo enviado pelo assistente virtual (IA)',
          urls: [fileUrl],
          status: 'em_analise',
          observacoes: 'Aguardando validação do administrador'
        }, resolve);
      });
    }

    return { success: true, url: fileUrl };

  } catch (err) {
    console.error('❌ Erro no upload de mídia:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── PROCESSAMENTO DE MENSAGEM ────────────────────────────────────────────────
async function processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData = {}) {
  const text = (textBody || '').trim();
  const lower = text.toLowerCase();

  console.log(`📨 Processando msg de ${fromPhone}: "${text}"${mediaType ? ' [' + mediaType + ']' : ''}${pushName ? ' (pushName: ' + pushName + ')' : ''}`);

  // ── COMANDOS DO ATENDENTE (TRANSBORDO HUMANO REVERSO) ───────────────────────
  if (text.startsWith('#responder ')) {
    const parts = text.split(' ');
    const targetPhone = parts[1]?.replace(/\D/g, '');
    const replyText = parts.slice(2).join(' ').trim();

    if (!targetPhone || !replyText) {
      sendWhatsAppReply(fromPhone, '❌ Formato inválido. Para responder ao cliente use:\n*#responder <telefone> <sua mensagem>*');
      return;
    }

    const clientSession = userSessions[targetPhone];
    const agentTitle = (clientSession?.supportAgent || 'SUPORTE GSA').toUpperCase();
    const formattedReply = `*ATENDENTE ${agentTitle}:*\n${replyText}`;

    sendWhatsAppReply(targetPhone, formattedReply);
    sendWhatsAppReply(fromPhone, `✅ Resposta enviada com sucesso para o cliente *${targetPhone}*!`);
    return;
  }

  if (text.startsWith('#encerrar ')) {
    const targetPhone = text.replace('#encerrar', '').replace(/\D/g, '').trim();
    if (!targetPhone) {
      sendWhatsAppReply(fromPhone, '❌ Formato inválido. Para encerrar use:\n*#encerrar <telefone>*');
      return;
    }

    if (userSessions[targetPhone]) {
      userSessions[targetPhone].state = 'MAIN_MENU';
      sendWhatsAppReply(targetPhone, '✅ Seu atendimento com o suporte foi finalizado. Retornando ao menu principal...\n\n' + getMainMenuText(userSessions[targetPhone]?.profile));
    } else {
      sendWhatsAppReply(targetPhone, '✅ Atendimento finalizado.');
    }
    sendWhatsAppReply(fromPhone, `✅ Atendimento com o cliente *${targetPhone}* foi encerrado com sucesso!`);
    return;
  }

  // Obter ou criar sessão
  if (!userSessions[fromPhone]) {
    userSessions[fromPhone] = { state: 'MAIN_MENU', errors: 0 };
  }
  const session = userSessions[fromPhone];

  // ── FASE 4: INTERCEPTAÇÃO DE MÍDIA ───────────────────────────────────────────

  // ─── Módulo 7: Transcrição de Áudio (Gemini 1.5 Flash) ─────────────────────
  if (mediaType === 'audio') {
    handleAudioMessage(fromPhone, session, rawMessageData);
    return;
  }

  if (mediaType === 'image' || mediaType === 'document') {
    // ─── Módulo 2: Busca Visual por Imagem (Gemini Vision) ──────────────────────
    // Se o cliente está no menu principal ou em estado de busca e envia uma imagem,
    // acionar a identificação de produto via Gemini Vision
    const visionStates = ['MAIN_MENU', 'MULTIPLE_PRODUCT_INTEREST', 'DROPSHIP_INTEREST', 'AI_TICKET_COLLECT'];
    const textLower = (text || '').toLowerCase();
    const isProductSearchContext = mediaType === 'image' && (
      visionStates.includes(session.state) ||
      /produto|modelo|esse|achar|tem igual|parecido|similar|comprar|buscar/i.test(textLower)
    );

    if (isProductSearchContext && mediaType === 'image') {
      // Download the image and convert to base64 for Vision API
      const mediaUrl = rawMessageData?.message?.imageMessage?.url ||
                       rawMessageData?.message?.imageMessage?.directPath ||
                       '';
      const mediaMime = rawMessageData?.message?.imageMessage?.mimetype || 'image/jpeg';
      const mediaBase64 = rawMessageData?.message?.imageMessage?.jpegThumbnail ||
                          rawMessageData?.mediaBase64 || null;

      if (mediaBase64) {
        handleImageProductSearch(fromPhone, session, mediaBase64, mediaMime);
        return;
      }
      // If no base64, fall through to normal media handler but hint user
      sendWhatsAppReply(fromPhone, '📸 Recebi sua imagem! Se quiser que eu encontre produtos parecidos, envie também descrevendo o que está procurando. 😊');
    }

    const uploadResult = await handleClientMediaUpload(fromPhone, mediaType, rawMessageData, session);
    if (uploadResult.success) {
      // Injeta uma mensagem de sistema no fluxo para a IA ler
      const sysMsg = `[SISTEMA: O cliente acabou de enviar um arquivo (${mediaType}). O arquivo foi salvo e anexado ao perfil dele no sistema GSA HUB. Agradeça o envio e pergunte qual é o próximo passo.]`;
      session.history = session.history || [];
      session.history.push({ role: 'user', content: sysMsg });
      callGSAAssistant(fromPhone, sysMsg, session, null, _catalogCache || [], () => {});
      return;
    } else {
      sendWhatsAppReply(fromPhone, '❌ Tivemos um problema para salvar o seu arquivo. Pode tentar enviar novamente?');
      return;
    }
  }

  // ── CAPTURA DE NOME DO WHATSAPP (pushName) ───────────────────────────────────
  if (pushName && typeof pushName === 'string' && pushName.trim()) {
    session.pushName = pushName.trim();
    if (!session.clientFullName) {
      session.clientFullName = pushName.trim();
    }
    if (!session.clientName && !session.clientData) {
      if (validatePushNameAsPersonName(pushName)) {
        session.clientName = extractFirstName(pushName);
        session.clientFullName = pushName.trim();
        console.log(`👤 Nome capturado via pushName: ${session.clientName} (Completo: ${session.clientFullName}) (${fromPhone})`);
      }
    }
    userSessions[fromPhone] = session;
  }

  // ── MÓDULO: AUTOATENDIMENTO DE PROTOCOLO DE RESGATE DE BENEFÍCIOS (PROT-RES) ────
  const PROTOCOL_REGEX = /\b(PROT[-_]RES[-_]\d{4}[-_][A-Z0-9]{6}|PROT[-_]RES[-_][A-Z0-9]{6,10})\b/i;
  const protocolMatch = text.match(PROTOCOL_REGEX);

  if (protocolMatch) {
    handleProtocolSelfServiceFlow(fromPhone, text, session, protocolMatch[0]);
    return;
  }

  if (session.state && session.state.startsWith('PROTOCOL_')) {
    handleProtocolSelfServiceFlow(fromPhone, text, session, null);
    return;
  }

  // ── MÓDULO: RESGATE DE BENEFÍCIOS DE PARCEIROS (CONVERSACIONAL) ─────────────
  if (session.state && session.state.startsWith('REDEMPTION_')) {
    handlePartnerRedemptionFlow(fromPhone, text, session, null);
    return;
  }

  const isRedemptionIntent = /\b(resgatar|resgate|quero resgatar|pegar cupom|pegar desconto|cupom de desconto|cupom da|cupom do|beneficio da|beneficio do|benefício da|benefício do|desconto da|desconto do|convenio da|convenio do|convênio da|convênio do)\b/i.test(text);
  if (isRedemptionIntent) {
    const partnerTerm = extractPartnerTermFromText(text);
    handlePartnerRedemptionFlow(fromPhone, text, session, partnerTerm);
    return;
  }

  // ── MÓDULO 8: INTERCEPTAÇÃO GLOBAL DE ÁREA DO CLIENTE, EXTRATO & PONTOS ─────
  if (/extrato.*conta|extrato.*carteira|meu extrato|ver extrato|extrato financeiro|meu extrato da minha conta/i.test(text)) {
    handleClientStatement(fromPhone, session);
    return;
  }
  if (/extrato.*pontos|meus pontos|pontos.*fidelidade|quantos pontos|saldo.*pontos|consultar pontos/i.test(text)) {
    handleClientPointsStatement(fromPhone, session);
    return;
  }
  if (/area.*cliente|área.*cliente|minha conta|meu saldo|saldo.*carteira|dados.*cadastro|meu cadastro|meu perfil/i.test(text)) {
    handleClientAccountOverview(fromPhone, session);
    return;
  }
  if (/meus chamados|minhas solicitac|meus tickets|consultar chamados/i.test(text)) {
    handleClientTickets(fromPhone, session);
    return;
  }

  // ── ESTADO: MENU DA ÁREA DO CLIENTE ──────────────────────────────────────────
  if (session.state === 'CLIENT_AREA_MENU') {
    if (text === '1') {
      handleClientStatement(fromPhone, session);
      return;
    } else if (text === '2') {
      handleClientPointsStatement(fromPhone, session);
      return;
    } else if (text === '3') {
      handleClientTickets(fromPhone, session);
      return;
    } else if (text === '0') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, getMainMenuText(session.profile));
      return;
    }
  }

  // ── MÓDULO 4: INTERCEPTAÇÃO GLOBAL DE RASTREAMENTO DE PEDIDOS ────────────────
  const isOrderTracking = /onde est[aá].*meu pedido|cadê.*pedido|rastrear|rastreio|rastreamento|status.*entrega|status.*pedido|meu pedido chegou|quando chega|previs[aã]o.*entrega|c[oó]digo.*rastreio|entrega.*c[oó]digo|track|acompanhar pedido/i.test(text);
  if (isOrderTracking) {
    handleOrderTracking(fromPhone, session);
    return;
  }

  // ── INTERCEPTAÇÃO GLOBAL: COMPRA DIRETA DA LOJA VIA WHATSAPP (#COMPRA_LOJA_GSA) ──
  const isStoreDirectPurchase = text.includes('#COMPRA_LOJA_GSA') || 
                                text.includes('COMPRA_LOJA_GSA') || 
                                text.includes('Gostaria de comprar este produto na Loja GSA') ||
                                text.includes('Quero comprar o produto na Loja GSA') ||
                                (text.includes('marketplace/loja/produtos/') && text.includes('Produto:'));

  if (isStoreDirectPurchase) {
    return handleStoreDirectPurchase(fromPhone, text, session);
  }

  // ── INTERCEPTAÇÃO GLOBAL: SOLICITAÇÃO DE SERVIÇOS / PACOTES VIA WHATSAPP (#SOLICITACAO_SERVICO_GSA) ──
  const isServiceRequest = text.includes('#SOLICITACAO_SERVICO_GSA') || 
                           text.includes('SOLICITACAO_SERVICO_GSA') || 
                           (text.includes('Gostaria de solicitar atendimento para') && (text.includes('Pacote:') || text.includes('Serviços Solicitados'))) ||
                           (text.includes('Gostaria de atendimento sobre o pacote'));

  if (isServiceRequest) {
    return handleServiceRequest(fromPhone, text, session);
  }

  // ── ESTADO: ACOMPANHAMENTO DE SOLICITAÇÃO DE SERVIÇO ──────────────────────
  if (session.state === 'SERVICE_REQUEST_FOLLOWUP') {
    if (text === '1') {
      session.state = 'SERVICE_REQUEST_COLLECT_DETAILS';
      userSessions[fromPhone] = session;
      let promptMsg = `📝 *DETALHES DA SOLICITAÇÃO*\n\n`;
      promptMsg += `Por favor, digite abaixo um resumo do que você precisa, documentos que já possui ou qualquer dúvida específica.\n\n`;
      promptMsg += `_(Você também pode enviar fotos de comprovantes ou documentos diretamente aqui no WhatsApp)_\n\n`;
      promptMsg += `_Digite 0 para cancelar e voltar ao menu._`;
      sendWhatsAppReply(fromPhone, promptMsg);
      return;
    }

    if (text === '2') {
      session.state = 'HUMAN_ATTENDANT';
      userSessions[fromPhone] = session;
      const protocol = session.currentServiceOrcamento?.codigo_orcamento || 'ORC-GSA';
      sendWhatsAppReply(fromPhone, `👤 *Encaminhando para um consultor especialista...*\n\nSeu protocolo *${protocol}* já está na fila de atendimento. Um de nossos especialistas responderá diretamente aqui em instantes.\n\n_Caso precise sair, digite 0 a qualquer momento para voltar ao menu principal._`);
      return;
    }

    if (text === '3') {
      const protocol = session.currentServiceOrcamento?.codigo_orcamento || 'ORC-GSA';
      let portalMsg = `🌐 *PORTAL DO CLIENTE GSA HUB*\n\n`;
      portalMsg += `Você pode acompanhar o andamento do seu protocolo *${protocol}*, consultar documentos e faturas diretamente pelo portal seguro:\n\n`;
      portalMsg += `👉 https://gsahub.com.br/acesso\n\n`;
      portalMsg += `_Digite 0 para voltar ao menu principal._`;
      sendWhatsAppReply(fromPhone, portalMsg);
      return;
    }

    if (text === '0' || lower === 'voltar') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, getMainMenuText(session.profile));
      return;
    }

    sendWhatsAppReply(fromPhone, '❌ Opção inválida. Por favor, digite:\n*1* para Enviar Detalhes\n*2* para Falar com Consultor\n*3* para Portal do Cliente\n*0* para Menu Principal');
    return;
  }

  if (session.state === 'SERVICE_REQUEST_COLLECT_DETAILS') {
    if (text === '0' || lower === 'voltar') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, getMainMenuText(session.profile));
      return;
    }

    const orcId = session.currentServiceOrcamento?.id;
    const protocol = session.currentServiceOrcamento?.codigo_orcamento || 'ORC-GSA';

    const noteData = {
      cliente_id: session.serviceClientId || session.clientData?.id || null,
      observacoes_servico: `[DETALHES ENVIADOS PELO CLIENTE VIA WHATSAPP]\n${text}\n\nData: ${new Date().toLocaleString('pt-BR')}`
    };

    if (orcId) {
      supabasePatch(`/rest/v1/orcamentos?id=eq.${orcId}`, { observacoes_servico: noteData.observacoes_servico }, () => {});
    }

    session.state = 'MAIN_MENU';
    userSessions[fromPhone] = session;

    let successMsg = `✅ *Informações registradas com sucesso!*\n\n`;
    successMsg += `Os detalhes enviados foram vinculados ao seu protocolo *${protocol}* e nossa equipe especializada já foi notificada.\n\n`;
    successMsg += `Em breve daremos continuidade ao seu atendimento!\n\n`;
    successMsg += getMainMenuText(session.profile);

    sendWhatsAppReply(fromPhone, successMsg);
    return;
  }

  // Reset ou navegação direta ao menu principal por documento se digitado 1-9
  const isDocumentState = ['CLIENT_AREA', 'LOYALTY', 'AFFILIATE_DOC', 'INSURANCE_CPF', 'STORE_VOUCHER_DOC', 'PARTNER_SUPPLIER_DOC', 'PARTNER_PROVIDER_DOC'].includes(session.state);
  if (isDocumentState && text.length === 1 && text >= '1' && text <= '9') {
    session.state = 'MAIN_MENU';
  }

  // 1. SAUDAÇÕES E NAVEGAÇÃO AO MENU PRINCIPAL DE INÍCIO
  if (lower === 'oi' || lower === 'olá' || lower === 'ola' || lower === 'inicio' || lower === 'início' || lower === 'start' || lower === 'hi') {
    const finalizeMenu = (profile) => {
      session.profile = profile;
      session.errors = 0;
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, getMainMenuText(profile));
    };

    if (!session.profile) {
      fetchUserProfile(fromPhone, finalizeMenu);
    } else {
      finalizeMenu(session.profile);
    }
    return;
  }

  // 2. NAVEGAÇÃO ÚNICA DE VOLTAR AO MENU ANTERIOR ("0", "voltar", "anterior")
  if (text === '0' || lower === 'voltar' || lower === 'anterior') {
    const parentState = STATE_PARENTS[session.state] || 'MAIN_MENU';
    session.state = parentState;
    userSessions[fromPhone] = session;
    renderStateMenu(fromPhone, session, parentState);
    return;
  }

  // ── 3. INTERCEPTAÇÃO GLOBAL DE IA CONVERSACIONAL (QUALQUER DÚVIDA OU FRASE) ──
  const TEXT_FORM_STATES = [
    'AI_TICKET_COLLECT',
    'AWAITING_NAME',
    'SERVICE_REQUEST_COLLECT_DETAILS',
    'STORE_DIRECT_ADDR',
    'PARTNER_SUPPLIER_REG_NAME',
    'PARTNER_SUPPLIER_REG_EMAIL',
    'PARTNER_SUPPLIER_REG_CAT',
    'PARTNER_PROVIDER_REG_NAME',
    'PARTNER_PROVIDER_REG_AREA',
    'PARTNER_NETWORK_REG_NAME',
    'PARTNER_NETWORK_REG_SEGMENT',
    'REDEMPTION_COLLECT_NAME',
    'REDEMPTION_COLLECT_EMAIL',
    'REDEMPTION_COLLECT_PHONE',
    'REDEMPTION_AWAITING_JUSTIFICATION'
  ];

  if (isConversationalText(text) && !TEXT_FORM_STATES.includes(session.state)) {
    fetchCatalogForAI((catalog) => {
      callGSAAssistant(fromPhone, text, session, mediaType, catalog, (err, aiResult) => {
        if (err || !aiResult) {
          sendWhatsAppReply(fromPhone, `❓ Como posso te ajudar hoje?\n\n${getMainMenuText(session.profile)}`);
          return;
        }
        handleAIResponse(fromPhone, session, aiResult, text);
      });
    });
    return;
  }


  // ── ESTADO: MENU PRINCIPAL ──────────────────────────────────────────────────
  if (session.state === 'MAIN_MENU') {
    const intent = getMenuIntent(text);
    switch (intent) {
      case '1':
        if (session.profile && session.profile.cliente) {
          session.clientData = session.profile.cliente;
          session.state = 'CLIENT_DASHBOARD_MENU';
          userSessions[fromPhone] = session;
          
          const rawNome = session.clientData.nome || session.clientData.nome_completo || session.clientData.razao_social || 'Cliente GSA';
          const nome = formatBoldName(rawNome);
          const saldoPts = session.clientData.saldo_pontos || session.clientData.pontos_fidelidade || 0;
          const saldoCarteira = session.clientData.saldo_carteira || session.clientData.saldo_disponivel || 0;
          const nivel = session.clientData.nivel_manual_info || (session.clientData.is_vip ? 'VIP' : 'Padrão GSA');
          
          sendWhatsAppReply(fromPhone, `👤 *Área do Cliente GSA HUB*\nOlá, *${nome}*! (🏆 ${nivel})\n\n💰 Saldo em Carteira: R$ ${Number(saldoCarteira).toFixed(2)}\n⭐ Pontos Fidelidade: ${saldoPts}\n\n*O que você deseja consultar?*\n1️⃣ 📄 Faturas em Aberto\n2️⃣ 🛠️ Ordens de Serviço\n3️⃣ 📋 Meus Orçamentos\n4️⃣ 🔄 Minhas Assinaturas\n5️⃣ 🎫 Tickets de Suporte\n0️⃣ Sair ao Menu Principal\n\n_Digite o número desejado:_`);
        } else {
          session.state = 'CLIENT_AREA';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, '👤 *Área do Cliente GSA HUB*\n\nPor favor, digite seu *CPF ou CNPJ* (apenas números) para consultar seus dados no sistema.\n\n_Exemplo: 12345678901_\n_Digite 0 para voltar ao menu._');
        }
        break;

      case '2':
        session.state = 'HIRE_SERVICES';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '🛠️ *Contratar Serviços GSA HUB*\n\nPara quem é o serviço?\n\n1️⃣ Para Você (Pessoa Física - PF)\n2️⃣ Para Empresa (Pessoa Jurídica - PJ)\n\n_Digite 0 para voltar ao menu._');
        break;

      case '3':
        session.state = 'STORE';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '🛍️ *GSA STORE - SUA LOJA VIRTUAL* 🛍️\n\n1️⃣ 🛒 *Ver Vitrine de Produtos*\n2️⃣ 🔥 *Promoções & Destaques*\n3️⃣ 🎟️ *Cupons de Desconto*\n4️⃣ 🛒 *Meu Carrinho de Compras*\n5️⃣ 🎧 *Suporte da Loja*\n\n_Digite a opção desejada (1 a 5)._\n_Digite 0 para voltar ao menu principal._');
        break;

      case '4':
        sendWhatsAppReply(fromPhone, '🔄 Buscando pacotes de viagens em destaque...');
        fetchTravelPackages((err, packages) => {
          if (err || packages.length === 0) {
            sendWhatsAppReply(fromPhone, '✈️ *Pacotes de Viagens GSA*\n\nNenhum pacote publicado no momento. Acesse nosso site para viagens personalizadas:\n🌐 https://gsahub.pages.dev/\n\n_Digite 0 para voltar._');
            return;
          }
          session.travelPackages = packages;
          session.state = 'TRAVEL_LIST';
          userSessions[fromPhone] = session;
          
          let msg = '✈️ *Pacotes de Viagens GSA em Destaque:*\n\n';
          packages.forEach((pkg, idx) => {
            const dataStr = pkg.data_ida ? new Date(pkg.data_ida).toLocaleDateString('pt-BR') : 'A definir';
            const precoStr = pkg.preco_venda ? `R$ ${pkg.preco_venda.toFixed(2)}` : 'Sob consulta';
            msg += `*${idx + 1}.* ${pkg.titulo}\n🗓️ Saída: ${dataStr} | 💰 Por: ${precoStr}\n\n`;
          });
          msg += '_Digite o número do pacote que deseja consultar/reservar_\n_Digite 0 para voltar ao menu._';
          sendWhatsAppReply(fromPhone, msg);
        });
        break;

      case '5':
        session.state = 'INSURANCE_TYPE';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '🏥 *Cotação de Seguros GSA*\n\nNossos especialistas buscam o melhor plano para você.\nQual tipo de seguro você procura?\n\n1️⃣ 🚗 Auto (Veículos)\n2️⃣ 👨‍👩‍👦 Vida\n3️⃣ 🏠 Residencial / Empresarial\n4️⃣ 🏥 Plano de Saúde\n5️⃣ ✈️ Viagem\n\n_Digite 0 para cancelar e voltar ao menu._');
        break;

      case '6':
        session.state = 'CLASSIFIEDS';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '📢 *Portal de Classificados GSA HUB*\n\nEscolha uma categoria:\n\n1️⃣ 🚗 Veículos\n2️⃣ 🏠 Imóveis\n3️⃣ 📦 Geral\n\n_Digite 0 para voltar ao menu._');
        break;

      case '7':
        if (session.profile && (session.profile.afiliado || session.profile.cliente)) {
          const affRecord = session.profile.afiliado || session.profile.cliente;
          const affName = formatBoldName(affRecord.nome || affRecord.nome_completo || affRecord.razao_social || 'Afiliado GSA');
          const refCode = affRecord.codigo_afiliado || affRecord.cpf || affRecord.cnpj || ('GSA' + stripCountryCode55(fromPhone));
          const refLink = affRecord.link_afiliado || `https://gsahub.pages.dev/?ref=${refCode}`;
          const saldoComissao = affRecord.saldo_comissao || 0;
          const pontos = affRecord.pontos_acumulados || affRecord.saldo_pontos || 0;

          session.affiliateData = affRecord;
          session.state = 'PARTNER_AFFILIATE_MENU';
          userSessions[fromPhone] = session;

          sendWhatsAppReply(fromPhone, `🤝 *Portal do Afiliado GSA HUB (Indique & Ganhe)*\nOlá, *${affName}*!\n\n🔗 *Seu Link Único de Afiliado:*\n${refLink}\n\n💰 Saldo de Comissões: R$ ${Number(saldoComissao).toFixed(2)}\n⭐ Pontos Acumulados: ${pontos}\n\n1️⃣ 📊 Consultar Cliques & Conversões\n2️⃣ 💵 Solicitar Saque via PIX\n3️⃣ 🎁 Resgatar Pontos por Recompensas\n0️⃣ Voltar ao Menu Principal`);
        } else {
          autoInjectDocument(fromPhone, session, 'AFFILIATE_DOC', '🤝 *Portal do Afiliado GSA HUB (Indique & Ganhe)*\n\nPara consultar seu link de indicação, digite seu *CPF ou CNPJ* (apenas números).\n\n_Digite 0 para voltar ao menu._');
        }
        break;

      case '8':
        if (session.profile && (session.profile.cliente || session.profile.afiliado)) {
          const pData = session.profile.cliente || session.profile.afiliado;
          const nome = formatBoldName(pData.nome || pData.nome_completo || pData.razao_social || 'Cliente GSA');
          const saldoPts = pData.saldo_pontos || pData.pontos_fidelidade || pData.pontos_acumulados || 0;
          const nivel = pData.nivel_manual_info || (pData.is_vip ? 'VIP' : 'Padrão GSA');

          session.clientData = pData;
          session.state = 'LOYALTY_ACTIONS';
          userSessions[fromPhone] = session;

          sendWhatsAppReply(fromPhone, `💎 *Programa de Fidelidade & Pontos GSA HUB*\nOlá, *${nome}*!\n\n⭐ Saldo Atual: *${saldoPts} Pontos*\n🏆 Nível VIP: *${nivel}*\n\n1️⃣ 🎁 Resgatar Pontos por Descontos ou PIX\n2️⃣ 📋 Extrato de Movimentação\n0️⃣ Voltar ao Menu Principal`);
        } else {
          autoInjectDocument(fromPhone, session, 'LOYALTY', '💎 *Programa de Fidelidade & Pontos GSA HUB*\n\nDigite seu *CPF ou CNPJ* (apenas números) para consultar:\n• Saldo real de pontos fidelidade\n• Nível VIP\n• Saldo em carteira\n\n_Digite 0 para voltar ao menu._');
        }
        break;

      case '9':
        session.state = 'PARTNERS';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `💼 *Portais de Parceiros GSA HUB*\n\nSelecione o portal desejado para atendimento:\n\n1️⃣ 🤝 Portal do Afiliado (Indique & Ganhe)\n2️⃣ 📦 Portal do Fornecedor & Suprimentos\n3️⃣ 🛠️ Portal do Prestador de Serviços\n4️⃣ 📢 Portal do Anunciante\n5️⃣ 🌟 Rede de Parceiros Homologados\n6️⃣ 💬 Suporte Especializado a Parceiros\n0️⃣ ⬅️ Voltar ao Menu Principal\n\n_Digite a opção desejada (1 a 6):_`);
        break;

      case '10':
        session.state = 'HUMAN_SUPPORT_DEPT';
        session.errors = 0;
        userSessions[fromPhone] = session;

        // Busca ramais ativos em tempo real do banco de dados (PostgreSQL)
        supabaseGet('/rest/v1/gsa_whatsapp_ramais?ativo=eq.true&order=ordem.asc', (errR, ramaisList) => {
          console.log('=> GET /gsa_whatsapp_ramais result:', errR ? errR.message : (ramaisList ? ramaisList.length + ' items' : 'null'));
          let textMenu = '💬 *Atendimento Humano GSA HUB*\n\nPor favor, escolha o setor desejado para atendimento:\n\n';
          if (!errR && Array.isArray(ramaisList) && ramaisList.length > 0) {
            ramaisList.forEach(r => {
              textMenu += `${r.setor_nome}\n`;
            });
            textMenu += '\n_Digite o número ou nome da opção desejada._\n_Digite 0 para voltar ao menu principal._';
          } else {
            textMenu += '1️⃣ Comercial\n2️⃣ Financeiro\n3️⃣ Dep. Pessoal\n5️⃣ Suporte Afiliados\n6️⃣ Suporte Parceiros\n7️⃣ Suporte Fornecedores\n8️⃣ SAC\n\n_Digite o número da opção desejada (1, 2, 3, 5, 6, 7 ou 8)._\n_Digite 0 para voltar ao menu principal._';
          }
          sendWhatsAppReply(fromPhone, textMenu);
        });
        break;

      default:
        // ── IA: Entender mensagem livre com Gemini Flash 1.5 ──────────────────
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '⏳ _Entendendo sua mensagem..._');
        fetchCatalogForAI((catalog) => {
          callGSAAssistant(fromPhone, text, session, null, catalog, (err, aiResult) => {
            if (err || !aiResult) {
              // Fallback seguro se a IA falhar
              session.errors = (session.errors || 0) + 1;
              if (session.errors >= 3) {
                session.state = 'MAIN_MENU';
                session.errors = 0;
                sendWhatsAppReply(fromPhone, '🤖 Estou com dificuldades para entender. Vou te conectar com um atendente:\n\n👉 https://wa.me/5511920857756');
              } else {
                sendWhatsAppReply(fromPhone, `Não consegui entender bem. Pode reformular?\n\n${MAIN_MENU_TEXT}`);
              }
              userSessions[fromPhone] = session;
              return;
            }
            session.errors = 0;
            handleAIResponse(fromPhone, session, aiResult, text);
          });
        });
        break;
    }
    userSessions[fromPhone] = session;
    return;
  }

  // ── ESTADO: ÁREA DO CLIENTE ─────────────────────────────────────────────────
  if (session.state === 'CLIENT_AREA') {
    const docClean = text.replace(/\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Por favor, digite apenas os números (mínimo 11 dígitos).\n\n_Digite 0 para voltar ao menu._');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Consultando seus dados no sistema...');
    fetchClientByDoc(docClean, (err, client) => {
      if (err || !client) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `🔍 *Consulta GSA HUB*\n\nNenhum cadastro encontrado para o documento informado.\n\nSe ainda não tem cadastro, acesse nosso site para criar um e aproveitar os benefícios!\n🌐 https://gsahub.pages.dev\n\n_Digite 0 para voltar ao menu._`);
        return;
      }
      
      const rawNome = client.nome || client.nome_completo || client.nome_razao || client.razao_social || 'Cliente GSA';
      const nome = formatBoldName(rawNome);
      const saldoPts = client.saldo_pontos != null ? client.saldo_pontos : (client.pontos_fidelidade || 0);
      const saldoCarteira = client.saldo_carteira != null ? Number(client.saldo_carteira) : (client.saldo_disponivel || 0);
      const nivel = client.nivel_manual_info || (client.is_vip ? 'VIP' : 'Padrão GSA');
      
      session.clientData = client;
      session.state = 'CLIENT_DASHBOARD_MENU';
      userSessions[fromPhone] = session;
      
      const dashMsg = `👤 *Área do Cliente GSA HUB*\nOlá, *${nome}*! (🏆 ${nivel})\n\n💰 Saldo: R$ ${saldoCarteira.toFixed(2)}\n⭐ Pontos: ${saldoPts}\n\n*O que você deseja consultar?*\n1️⃣ 📄 Faturas em Aberto\n2️⃣ 🛠️ Ordens de Serviço\n3️⃣ 📋 Meus Orçamentos\n4️⃣ 🔄 Minhas Assinaturas\n5️⃣ 🎫 Tickets de Suporte\n0️⃣ Sair\n\n_Digite o número desejado:_`;
      
      sendWhatsAppReply(fromPhone, dashMsg);
    });
    return;
  }

  // ── ESTADO: FIDELIDADE ──────────────────────────────────────────────────────
  if (session.state === 'LOYALTY') {
    const docClean = text.replace(/\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Digite apenas os números (mínimo 11 dígitos).\n\n_Digite 0 para voltar ao menu._');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Consultando seu programa de fidelidade...');
    fetchClientByDoc(docClean, (err, client) => {
      if (err || !client) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `🔍 Nenhum cadastro encontrado para o documento informado no programa de fidelidade GSA.\n\nContrate um serviço (opção 2) para começar a acumular pontos!\n\n_Digite 0 para voltar ao menu._`);
      } else {
        session.client = client;
        session.state = 'LOYALTY_ACTIONS';
        userSessions[fromPhone] = session;
        const rawNome = client.nome || client.nome_completo || client.nome_razao || client.razao_social || 'Cliente GSA';
        const nome = formatBoldName(rawNome);
        const saldoPts = client.saldo_pontos != null ? client.saldo_pontos : 0;
        const saldoCarteira = (client.saldo_carteira != null ? Number(client.saldo_carteira) : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const nivel = client.nivel_manual_info || 'Padrão';
        const saqueLib = client.saque_liberado_manual ? '✅ Liberado' : '⚠️ Aguardando verificação';
        let reply = `💎 *Programa de Fidelidade GSA HUB*\n\n👤 *${nome}*\n\n⭐ *Pontos Acumulados:* ${saldoPts} pts\n💰 *Saldo em Carteira:* ${saldoCarteira}\n🏆 *Nível VIP:* ${nivel}\n💸 *Saque PIX:* ${saqueLib}\n\n`;
        reply += `O que você deseja fazer?\n\n1️⃣ 🔄 Converter Pontos em Saldo de Carteira\n2️⃣ 💸 Solicitar Saque via PIX\n\n_Digite 0 para voltar ao menu principal._`;
        sendWhatsAppReply(fromPhone, reply);
      }
    });
    return;
  }

  // ── ESTADO: LOYALTY_ACTIONS ─────────────────────────────────────────────────
  if (session.state === 'LOYALTY_ACTIONS') {
        if (text === '1') {
      const clientId = session.client?.id;
      if (!clientId) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '❌ Cadastro de cliente não encontrado na sessão. Digite 4 para consultar sua fidelidade novamente.');
        return;
      }

      sendWhatsAppReply(fromPhone, '🔄 Convertendo pontos (100 pontos = R$ 1,00)...');

      supabaseRpc('gsa_converter_pontos_carteira', { p_cliente_id: clientId }, (err, result) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;

        if (err || !result || !result.success) {
          const errMsg = result?.error || (err ? err.message : 'Saldo insuficiente ou erro no servidor');
          console.error('❌ Erro na conversão de pontos via RPC:', errMsg);
          sendWhatsAppReply(fromPhone, `❌ Não foi possível converter seus pontos: ${errMsg}.\n\n_Digite 0 para voltar ao menu._`);
          return;
        }

        // Update in-memory session with verified database returned values
        if (session.client) {
          session.client.saldo_pontos = result.novo_saldo_pontos;
          session.client.saldo_carteira = result.novo_saldo_carteira;
        }

        sendWhatsAppReply(fromPhone, `✅ *Conversão Concluída!*\n\n${result.pontos_convertidos} pontos foram convertidos com sucesso para *${result.valor_convertido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*.\nNovo Saldo em Carteira: *${result.novo_saldo_carteira.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n_Digite 0 para voltar._`);
      });
      return;
    } else if (text === '2') {
      if (!session.client.saque_liberado_manual) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '❌ *Saque Bloqueado*\n\nSua conta ainda não está liberada para saques automáticos. Por favor, entre em contato com nosso suporte na opção 9.\n\n_Digite 0 para voltar._');
        return;
      }
      const saldo = session.client.saldo_carteira || 0;
      if (saldo <= 0) {
        sendWhatsAppReply(fromPhone, '❌ Você não possui saldo em carteira suficiente para saque.\n\n_Digite 0 para voltar ao menu._');
        return;
      }
      session.state = 'LOYALTY_PIX_TYPE';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `💸 *Solicitação de Saque PIX*\n\nSaldo disponível: *${saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\nPor favor, escolha o tipo da sua chave PIX:\n1️⃣ CPF/CNPJ\n2️⃣ Celular\n3️⃣ E-mail\n4️⃣ Chave Aleatória\n\n_Digite 0 para cancelar e voltar._`);
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida. Digite 1 ou 2 (ou 0 para voltar).');
    }
    return;
  }

  // ── ESTADO: LOYALTY_PIX_TYPE ─────────────────────────────────────────────────
  if (session.state === 'LOYALTY_PIX_TYPE') {
    const tipos = { '1': 'cpf', '2': 'telefone', '3': 'email', '4': 'aleatoria' };
    if (!tipos[text]) {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida. Digite 1, 2, 3 ou 4 (ou 0 para voltar).');
      return;
    }
    session.pixType = tipos[text];
    session.state = 'LOYALTY_PIX_KEY';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, `🔑 Você selecionou: *${session.pixType.toUpperCase()}*\n\nAgora, por favor, digite a sua chave PIX corretamente para receber o saque do valor integral da sua carteira.\n\n_Digite 0 para cancelar e voltar._`);
    return;
  }

  // ── ESTADO: LOYALTY_PIX_KEY ─────────────────────────────────────────────────
  if (session.state === 'LOYALTY_PIX_KEY') {
    const pixKey = text.trim();
    const valor = Number(session.client.saldo_carteira || 0);
    sendWhatsAppReply(fromPhone, `🔄 Registrando sua solicitação de saque no sistema...`);
    
    // Solicitação de saque atômica via RPC dedicada (ACID + ledger)
    supabaseRpc('gsa_webhook_solicitar_saque_cliente', {
      p_cliente_id: session.client.id,
      p_tipo_chave_pix: session.pixType || 'cpf',
      p_chave_pix: pixKey,
      p_valor: valor
    }, (errRpc, resRpc) => {
      if (errRpc || !resRpc || resRpc.success === false) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        const msgErr = resRpc?.error || 'Erro ao processar saque. Tente novamente mais tarde.';
        sendWhatsAppReply(fromPhone, `❌ ${msgErr}\n\n_Digite 0 para voltar._`);
        return;
      }
      const saqueValor = Number(resRpc.valor ?? valor);
      session.client.saldo_carteira = Number(resRpc.novo_saldo_carteira ?? 0);
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `✅ *Solicitação de Saque Registrada!*\n\nValor: *${saqueValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\nChave PIX: ${pixKey}\nStatus: *Em análise / Pendente*\n\nNosso departamento financeiro processará seu pagamento em breve.\n\n_Digite 0 para voltar ao menu principal._`);
    });
    return;
  }

  // ── ESTADO: CONTRATAR SERVIÇOS ──────────────────────────────────────────────
  if (session.state === 'HIRE_SERVICES') {
    const tipo = text === '1' ? 'pf' : (text === '2' ? 'pj' : null);
    if (!tipo) {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida. Digite 1 para Pessoa Física ou 2 para Pessoa Jurídica.\n\n_Digite 0 para voltar ao menu._');
      return;
    }
    session.serviceType = tipo;
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '🔄 Buscando serviços disponíveis no sistema...');
    fetchServices(tipo, (err, services) => {
      if (err || services.length === 0) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `📦 Nenhum serviço cadastrado para *${tipo.toUpperCase()}* no momento.\n\nEntre em contato com nosso suporte na opção 9.\n\n_Digite 0 para voltar._`);
        return;
      }
      session.currentServicesList = services;
      session.state = 'SELECT_SERVICE';
      userSessions[fromPhone] = session;
      let msg = `📦 *Serviços GSA HUB Disponíveis [${tipo.toUpperCase()}]:*\n\n`;
      services.forEach((s, idx) => {
        msg += `*${idx + 1}.* ${s.nome}\n📝 ${s.descricao || 'Serviço especializado GSA HUB'}\n\n`;
      });
      msg += `_Digite o número do serviço para solicitar orçamento oficial._\n_Digite 0 para voltar._`;
      sendWhatsAppReply(fromPhone, msg);
    });
    return;
  }

  // ── ESTADO: SELECIONAR SERVIÇO ──────────────────────────────────────────────
  if (session.state === 'SELECT_SERVICE') {
    const idx = parseInt(text, 10) - 1;
    const services = session.currentServicesList || [];
    if (isNaN(idx) || idx < 0 || idx >= services.length) {
      sendWhatsAppReply(fromPhone, `❌ Opção inválida. Escolha um número de 1 a ${services.length}.\n\n_Digite 0 para voltar._`);
      return;
    }
    const selectedService = services[idx];
    session.checkoutType = 'service';
    session.state = 'HIRE_SERVICES_DOC';
    session.selectedService = selectedService;
    autoInjectDocument(fromPhone, session, 'HIRE_SERVICES_DOC', `Excelente escolha: *${session.selectedService.nome}*.\n\nPara prosseguirmos com a criação do orçamento oficial, por favor, digite o seu *CPF ou CNPJ* (apenas números).\n\n_Digite 0 para cancelar e voltar._`);
    return;
  }

  // ── ESTADO: CHECKOUT_DOC ────────────────────────────────────────────────
  if (session.state === 'CHECKOUT_DOC' || session.state === 'STORE_VOUCHER_DOC' || session.state === 'HIRE_SERVICES_DOC') {
    const docClean = text.replace(/\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Digite apenas os números.\n\n_Digite 0 para voltar._');
      return;
    }
    session.docClean = docClean;
    sendWhatsAppReply(fromPhone, '🔄 Verificando cadastro...');
    fetchClientByDoc(docClean, (err, client) => {
      if (err || !client) {
        session.state = 'CHECKOUT_NAME';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `🔍 *Cadastro Não Encontrado*\n\nVamos fazer um pré-cadastro rápido para vincular seu pedido!\n\nQual é o seu *Nome Completo* (ou Razão Social)?\n\n_Digite 0 para cancelar._`);
      } else {
        if (session.directProductPurchase) {
          session.clientData = client;
          session.tempClientId = client.id;
          session.state = 'STORE_DIRECT_PAY_OPTIONS';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, `✅ Olá, *${formatBoldName(client.nome || 'Cliente')}*! Cadastro identificado com sucesso.\n\nComo deseja realizar o pagamento do seu produto?\n\n1️⃣ 🟢 *Pagar via PIX* (QR Code Instantâneo)\n2️⃣ 💳 *Pagar com Cartão de Crédito* (Link InfinitePay até 12x)\n3️⃣ 📍 *Informar Endereço de Entrega / Frete*\n\n_Digite 1, 2 ou 3 (ou 0 para cancelar):_`);
        } else {
          createOrcamento(fromPhone, session, client.id);
        }
      }
    });
    return;
  }

  // ── ESTADO: CHECKOUT_NAME ────────────────────────────────────────────────
  if (session.state === 'CHECKOUT_NAME') {
    session.newName = text.trim();
    session.state = 'CHECKOUT_EMAIL';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, `Obrigado, *${session.newName}*!\n\nPara finalizar o pré-cadastro, digite o seu *E-mail* principal.\n\n_Digite 0 para cancelar._`);
    return;
  }

  // ── ESTADO: CHECKOUT_EMAIL ───────────────────────────────────────────────
  if (session.state === 'CHECKOUT_EMAIL') {
    const emailClean = text.trim().toLowerCase();
    const pClean = stripCountryCode55(fromPhone);
    const pWith55 = `55${pClean}`;
    const docClean = session.docClean || '';

    sendWhatsAppReply(fromPhone, '🔍 *Analisando dados no sistema...* Aguarde um instante.');

    // Consulta prévia para verificar duplicidades (E-mail, Telefone ou CPF/CNPJ)
    const filter = `or=(email.eq.${encodeURIComponent(emailClean)},telefone.eq.${pClean},telefone.eq.${pWith55}${docClean ? `,cpf.eq.${docClean},cnpj.eq.${docClean}` : ''})`;

    supabaseGet(`/rest/v1/clientes?${filter}&select=*&limit=1`, (errCheck, existingClients) => {
      if (!errCheck && Array.isArray(existingClients) && existingClients.length > 0) {
        const found = existingClients[0];
        let motivo = '';

        if (found.email && found.email.toLowerCase() === emailClean) {
          motivo = `já existe um cadastro com o e-mail *${emailClean}*`;
        } else if (found.telefone && stripCountryCode55(found.telefone) === pClean) {
          motivo = `este número de telefone (*${pClean}*) já está vinculado a um cadastro existente`;
        } else if ((found.cpf && found.cpf === docClean) || (found.cnpj && found.cnpj === docClean)) {
          motivo = `já existe um cadastro com este CPF/CNPJ (*${docClean}*)`;
        } else {
          motivo = `já encontramos um cadastro em nosso sistema com seus dados`;
        }

        sendWhatsAppReply(fromPhone, `⚠️ *Atenção: Cadastro Já Existente!*\n\nVerificamos que ${motivo}.\n\n👤 *Cliente:* ${found.nome ? found.nome.toUpperCase() : 'CADASTRADO'}\n\n💡 *Você já possui cadastro no GSA HUB!* Vinculamos seu atendimento à sua conta existente.\n\n_Para acessar seus dados ou serviços, selecione a *Opção 1 (Área do Cliente)* no menu principal._`);

        createOrcamento(fromPhone, session, found.id);
        return;
      }

      // Se nenhum dado for duplicado, prossegue com o cadastro normal
      const novoCliente = {
        codigo_cliente: `CLI-${Math.floor(100000 + Math.random() * 900000)}`,
        nome: session.newName,
        cpf: docClean.length <= 14 ? docClean : '',
        cnpj: docClean.length > 14 ? docClean : '',
        tipo_pessoa: session.serviceType === 'pj' || docClean.length > 14 ? 'pj' : 'pf',
        telefone: pClean,
        email: emailClean,
        status: 'ativo',
        saldo_carteira: 0,
        saldo_pontos: 0,
        data_cadastro: new Date().toISOString()
      };
      
      supabasePost('/rest/v1/clientes', novoCliente, (err, res) => {
        if (err || !res || res.length === 0) {
          session.state = 'MAIN_MENU';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, '❌ Ocorreu um erro ao criar seu cadastro no sistema. Tente novamente mais tarde.\n\n_Digite 0 para voltar._');
          return;
        }

        sendWhatsAppReply(fromPhone, `✅ *Cadastro Realizado com Sucesso!*\n\nSeja bem-vindo(a) ao *GSA HUB*, *${session.newName.toUpperCase()}*! 🎉`);
        createOrcamento(fromPhone, session, res[0].id);
      });
    });
    return;
  }

  function createOrcamento(fromPhone, session, clientId) {
    const orcCod = `ORC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let orcData;

    if (session.checkoutType === 'store') {
      let totalCart = 0;
      let obs = '🛒 Pedido da GSA Store via WhatsApp:\n\n';
      session.cart.forEach(item => {
        const pUnit = item.produto.desconto_ativo && item.produto.valor_promocional ? item.produto.valor_promocional : item.produto.valor;
        const subtotal = pUnit * item.quantidade;
        totalCart += subtotal;
        obs += `${item.quantidade}x ${item.produto.nome} (R$ ${subtotal.toFixed(2)})\n`;
      });
      
      let valorDesconto = 0;
      if (session.discount) {
        if (session.discount.tipo === 'porcentagem') {
          valorDesconto = totalCart * (session.discount.valor / 100);
        } else {
          valorDesconto = session.discount.valor;
        }
        obs += `\n🎟️ Cupom Aplicado: ${session.discount.codigo} (-R$ ${valorDesconto.toFixed(2)})\n`;
      }
      
      const totalComDesconto = totalCart - valorDesconto;
      const finalTotal = totalComDesconto > 0 ? totalComDesconto : 0;
      
      orcData = {
        codigo_orcamento: orcCod,
        cliente_id: clientId,
        categoria: 'produto',
        valor_produto: totalCart,
        desconto: valorDesconto,
        total: finalTotal,
        status: 'aberto',
        observacoes_servico: obs,
        data_criacao: new Date().toISOString()
      };
    } else {
      orcData = {
        codigo_orcamento: orcCod,
        cliente_id: clientId,
        servico_id: session.selectedService.id,
        categoria: 'servico',
        valor_servico: session.selectedService.valor || 0,
        total: session.selectedService.valor || 0,
        status: 'aberto',
        observacoes_servico: 'Orçamento de Serviço gerado via WhatsApp (Pré-atendimento).',
        data_criacao: new Date().toISOString()
      };
    }

    supabasePost('/rest/v1/orcamentos', orcData, (err, res) => {

      if (err) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '❌ Ocorreu um erro ao criar o pedido. Tente novamente mais tarde.\n\n_Digite 0 para voltar._');
        return;
      }
      
      const orcId = res && res[0] ? res[0].id : null;

      if (session.checkoutType === 'store' && orcData.total > 0) {
        // Criar Fatura automaticamente para integração InfinitePay
        const faturaData = {
          codigo_fatura: `FAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          cliente_id: clientId,
          valor_total: orcData.total,
          valor_pago: 0,
          status: 'pendente',
          data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          data_emissao: new Date().toISOString()
        };
        
        supabasePost('/rest/v1/faturas', faturaData, (errF, resF) => {
          if (!errF && resF && resF.length > 0) {
            const faturaId = resF[0].id;
            
            // Invocar Edge Function da InfinitePay
            const edgePayload = { fatura_id: faturaId, cliente_id: clientId, valor_liquido: orcData.total };
            const edgeOptions = {
              hostname: SUPABASE_HOST,
              port: 443,
              path: '/functions/v1/generate-payment-link',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
              }
            };
            
            const reqE = https.request(edgeOptions, (resE) => {
              let dE = '';
              resE.on('data', c => { dE += c; });
              resE.on('end', () => {
                session.state = 'MAIN_MENU';
                userSessions[fromPhone] = session;
                try {
                  const parsed = JSON.parse(dE);
                  const link = parsed.link || null;
                  
                  let msgConfirm = `✅ *Pedido Registrado com Sucesso!*\n\n📋 *Código do Pedido:* ${orcCod}\n💰 *Total:* R$ ${orcData.total.toFixed(2)}\n\n`;
                  if (link) {
                    msgConfirm += `💳 *Pagamento Seguro via InfinitePay:*\nAcesse o link abaixo para pagar via Cartão de Crédito ou PIX:\n👉 ${link}\n\nAssim que pago, seu pedido será separado para envio!\n\n_Digite 0 para voltar ao menu principal._`;
                  } else {
                    msgConfirm += `💳 Para realizar o pagamento, nosso setor comercial entrará em contato em breve (ou faça um PIX para o CNPJ da empresa).\n\n_Digite 0 para voltar ao menu._`;
                  }
                  sendWhatsAppReply(fromPhone, msgConfirm);
                } catch (ex) {
                  sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado!*\n\n📋 *Código:* ${orcCod}\n💰 *Total:* R$ ${orcData.total.toFixed(2)}\n\n💳 Não foi possível gerar o link automático no momento. Nossa equipe comercial entrará em contato para finalizar o pagamento.\n\n_Digite 0 para voltar ao menu._`);
                }
              });
            });
            reqE.on('error', () => {
              session.state = 'MAIN_MENU';
              userSessions[fromPhone] = session;
              sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado!*\n\n📋 *Código:* ${orcCod}\n💰 *Total:* R$ ${orcData.total.toFixed(2)}\n\n💳 Nossa equipe comercial entrará em contato para o pagamento.\n\n_Digite 0 para voltar._`);
            });
            reqE.write(JSON.stringify(edgePayload));
            reqE.end();
          } else {
            // Falhou a fatura, cai no fallback normal
            session.state = 'MAIN_MENU';
            userSessions[fromPhone] = session;
            sendWhatsAppReply(fromPhone, `✅ *Pedido Registrado!*\n\n📋 *Código:* ${orcCod}\n📦 *Categoria:* Produtos\n💰 *Total:* R$ ${orcData.total.toFixed(2)}\n\n💳 Nossa equipe enviará seu link de pagamento em breve!\n\n_Digite 0 para voltar ao menu principal._`);
          }
        });
      } else {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        let msgConfirm = `✅ *Solicitação Registrada!*\n\n📋 *Código:* ${orcCod}\n`;
        if (session.checkoutType === 'store') {
          msgConfirm += `📦 *Categoria:* Produtos\n💰 *Total:* R$ ${orcData.total.toFixed(2)}\n\n_Digite 0 para voltar ao menu principal._`;
        } else {
          msgConfirm += `📦 *Serviço:* ${session.selectedService.nome}\n📊 *Status:* Em análise comercial\n\nNossa equipe comercial analisará seu pedido e entrará em contato em breve!\n\n_Digite 0 para voltar ao menu principal._`;
        }
        sendWhatsAppReply(fromPhone, msgConfirm);
      }
    });
  }
  // ── ESTADO: LOJA ────────────────────────────────────────────────────────────
  if (session.state === 'STORE') {
    if (text === '1') {
      sendWhatsAppReply(fromPhone, '🔄 *Carregando vitrine com fotos dos produtos...*');
      fetchProducts((err, products) => {
        if (err || products.length === 0) {
          sendWhatsAppReply(fromPhone, '🛒 Nenhum produto em destaque no momento.\n\n🌐 Acesse nossa loja web: https://gsahub.pages.dev/\n\n_Digite 0 para voltar._');
          return;
        }
        session.currentStoreProducts = products;
        session.state = 'STORE_SELECT_PRODUCT';
        userSessions[fromPhone] = session;

        sendWhatsAppReply(fromPhone, '🛍️ *GSA STORE - VITRINE DE PRODUTOS*\n───────────────────────────────────\nConfira abaixo os produtos em nosso catálogo:\n');

        // Enviar os produtos com imagem quando disponível, ou em cards estilizados
        products.forEach((p, idx) => {
          const precoOriginal = p.valor ? `R$ ${Number(p.valor).toFixed(2).replace('.', ',')}` : 'Consulte';
          const preco = p.desconto_ativo && p.valor_promocional
            ? `~~${precoOriginal}~~  👉 *R$ ${Number(p.valor_promocional).toFixed(2).replace('.', ',')}* 🔥`
            : `*${precoOriginal}*`;
          
          const cat = p.categoria ? ` [${p.categoria}]` : '';
          const caption = `*${idx + 1}.* 📦 *${p.nome}*${cat}\n💰 Preço: ${preco}\n📝 ${p.descricao || 'Produto de alta qualidade GSA Store'}\n\n👉 *Digite ${idx + 1} para adicionar ao carrinho!*`;

          let imgUrl = p.imagem_url || (p.imagens && p.imagens.length > 0 ? p.imagens[0] : null);
          if (imgUrl && !imgUrl.startsWith('http')) {
            imgUrl = `https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev/${imgUrl.replace(/^\/+/, '')}`;
          }

          if (imgUrl) {
            setTimeout(() => {
              sendWhatsAppMedia(fromPhone, imgUrl, `${p.nome}.png`, caption, 'image');
            }, idx * 1000);
          } else {
            sendWhatsAppReply(fromPhone, caption);
          }
        });

        setTimeout(() => {
          sendWhatsAppReply(fromPhone, '───────────────────────────────────\n👉 *Digite o número do produto (ex: 1, 2) para comprar e escolher a quantidade.*\n_Digite 0 para voltar ao menu principal._');
        }, 1500);
      });
    } else if (text === '2') {
      sendWhatsAppReply(fromPhone, '🔄 *Buscando ofertas e promoções com imagens...*');
      fetchProducts((err, products) => {
        const promos = (products || []).filter(p => p.desconto_ativo || p.valor_promocional);
        if (promos.length === 0) {
          sendWhatsAppReply(fromPhone, '🏷️ *Promoções GSA Store*\n\nNo momento não temos itens em liquidação relâmpago, mas temos produtos incríveis na vitrine!\n\n🌐 Confira também no site: https://gsahub.pages.dev/\n\n_Digite 1 para ver os produtos ou 0 para voltar._');
          return;
        }
        session.currentStoreProducts = promos;
        session.state = 'STORE_SELECT_PRODUCT';
        userSessions[fromPhone] = session;

        sendWhatsAppReply(fromPhone, '🔥 *GSA STORE - OFERTAS RELÂMPAGO* 🔥\n───────────────────────────────────\n');

        promos.forEach((p, idx) => {
          const pOrig = `R$ ${Number(p.valor).toFixed(2).replace('.', ',')}`;
          const pPromo = `R$ ${Number(p.valor_promocional).toFixed(2).replace('.', ',')}`;
          const caption = `*${idx + 1}.* 💥 *${p.nome}*\nDe ~~${pOrig}~~ por apenas *${pPromo}* 🎉\n\n👉 *Digite ${idx + 1} para comprar!*`;

          let imgUrl = p.imagem_url || (p.imagens && p.imagens.length > 0 ? p.imagens[0] : null);
          if (imgUrl && !imgUrl.startsWith('http')) {
            imgUrl = `https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev/${imgUrl.replace(/^\/+/, '')}`;
          }

          if (imgUrl) {
            setTimeout(() => {
              sendWhatsAppMedia(fromPhone, imgUrl, `${p.nome}.png`, caption, 'image');
            }, idx * 1000);
          } else {
            sendWhatsAppReply(fromPhone, caption);
          }
        });

        setTimeout(() => {
          sendWhatsAppReply(fromPhone, '───────────────────────────────────\n👉 *Digite o número da oferta para escolher a quantidade.*\n_Digite 0 para voltar._');
        }, 1500);
      });
    } else if (text === '3') {
      sendWhatsAppReply(fromPhone, '🔄 *Buscando cupons ativos...*');
      fetchCoupons((err, coupons) => {
        if (err || !coupons || coupons.length === 0) {
          sendWhatsAppReply(fromPhone, '🎟️ Nenhum cupom ativo no momento.\n\n_Digite 0 para voltar._');
          return;
        }
        let msg = '🎟️ *CUPONS DE DESCONTO DISPONÍVEIS:*\n';
        msg += '───────────────────────────────────\n\n';
        coupons.forEach(c => {
          const val = c.tipo === 'porcentagem' ? `${c.valor}% OFF` : `R$ ${Number(c.valor).toFixed(2)} OFF`;
          msg += `👉 Cupom: *${c.codigo_voucher}*\n   Desconto: *${val}*\n\n`;
        });
        msg += '───────────────────────────────────\n';
        msg += '💡 _Você poderá aplicar o cupom diretamente no carrinho ao finalizar a compra!_\n\n_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
    } else if (text === '4') {
      // Exibir Carrinho Atual
      const cart = session.cart || [];
      if (cart.length === 0) {
        sendWhatsAppReply(fromPhone, '🛒 *Seu Carrinho de Compras está vazio.*\n\nNavegue pela nossa vitrine (Opção 1) para adicionar produtos!\n\n_Digite 0 para voltar ao menu._');
        return;
      }
      session.state = 'STORE_CART_ACTION';
      userSessions[fromPhone] = session;

      let cartTotal = 0;
      let msg = '🛒 *SEU CARRINHO GSA STORE*\n───────────────────────────────────\n\n';
      cart.forEach((item, i) => {
        const pUnit = item.produto.desconto_ativo && item.produto.valor_promocional ? item.produto.valor_promocional : item.produto.valor;
        const sub = pUnit * item.quantidade;
        cartTotal += sub;
        msg += `• *${item.quantidade}x* ${item.produto.nome} — R$ ${sub.toFixed(2).replace('.', ',')}\n`;
      });

      let valorDesconto = 0;
      if (session.discount) {
        valorDesconto = session.discount.tipo === 'porcentagem' ? cartTotal * (session.discount.valor / 100) : session.discount.valor;
        msg += `\n🎟️ *Cupom Aplicado:* ${session.discount.codigo} (-R$ ${valorDesconto.toFixed(2).replace('.', ',')})\n`;
      }

      const totalFinal = Math.max(0, cartTotal - valorDesconto);
      msg += `\n💰 *VALOR TOTAL: R$ ${totalFinal.toFixed(2).replace('.', ',')}*\n───────────────────────────────────\n\n`;
      msg += '1️⃣ ➕ Adicionar mais produtos\n2️⃣ 🎟️ Inserir Cupom de Desconto\n3️⃣ 💳 Finalizar Compra (PIX / Cartão)\n4️⃣ 🗑️ Esvaziar Carrinho\n\n_Digite 0 para voltar ao menu._';
      sendWhatsAppReply(fromPhone, msg);
    } else if (text === '5') {
      sendWhatsAppReply(fromPhone, '🎧 *Atendimento & Suporte GSA Store*\n\nPrecisa de ajuda com algum produto ou acompanhamento de entrega?\n\n💬 Fale com nossa equipe comercial:\n👉 https://wa.me/5511971858372\n\n_Digite 0 para voltar ao menu._');
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida. Digite um número de 1 a 5 (ou 0 para voltar).');
    }
    return;
  }

  // ── ESTADO: STORE_SELECT_PRODUCT ───────────────────────────────────────────
  if (session.state === 'STORE_SELECT_PRODUCT') {
    const idx = parseInt(text, 10) - 1;
    const products = session.currentStoreProducts || [];
    if (isNaN(idx) || idx < 0 || idx >= products.length) {
      sendWhatsAppReply(fromPhone, `❌ Opção inválida. Escolha um número de 1 a ${products.length}.\n\n_Digite 0 para voltar._`);
      return;
    }
    const selectedProd = products[idx];
    session.selectedProduct = selectedProd;
    session.state = 'STORE_QUANTITY';
    userSessions[fromPhone] = session;

    const preco = selectedProd.desconto_ativo && selectedProd.valor_promocional ? selectedProd.valor_promocional : selectedProd.valor;
    const precoFmt = `R$ ${Number(preco).toFixed(2).replace('.', ',')}`;
    const caption = `🛒 *ITEM SELECIONADO:* ${selectedProd.nome}\n💰 *Preço Unitário:* ${precoFmt}\n\nQuantas unidades você deseja adicionar ao seu carrinho?\n\n_Digite a quantidade (ex: 1, 2, 5)._\n_Digite 0 para cancelar e voltar ao menu._`;

    if (selectedProd.imagem_url && selectedProd.imagem_url.startsWith('http')) {
      sendWhatsAppMedia(fromPhone, selectedProd.imagem_url, `${selectedProd.nome}.png`, caption, 'image');
    } else {
      sendWhatsAppReply(fromPhone, caption);
    }
    return;
  }

  // ── ESTADO: STORE_QUANTITY ─────────────────────────────────────────────────
  if (session.state === 'STORE_QUANTITY') {
    const qtd = parseInt(text, 10);
    if (isNaN(qtd) || qtd <= 0) {
      sendWhatsAppReply(fromPhone, '❌ Quantidade inválida. Digite um número maior que 0.');
      return;
    }
    const cart = session.cart || [];
    const prod = session.selectedProduct;
    cart.push({ produto: prod, quantidade: qtd });
    session.cart = cart;
    session.state = 'STORE_CART_ACTION';
    userSessions[fromPhone] = session;
    
    let cartTotal = 0;
    let msg = '✅ Item adicionado com sucesso!\n\n🛍️ *Seu Carrinho Atual:*\n\n';
    cart.forEach((item, i) => {
      const pUnit = item.produto.desconto_ativo && item.produto.valor_promocional ? item.produto.valor_promocional : item.produto.valor;
      const sub = pUnit * item.quantidade;
      cartTotal += sub;
      msg += `• ${item.quantidade}x ${item.produto.nome} (R$ ${sub.toFixed(2)})\n`;
    });
    msg += `\n💰 *Total Previsto: R$ ${cartTotal.toFixed(2)}*\n\nO que deseja fazer?\n1️⃣ Adicionar mais itens\n2️⃣ 💳 Finalizar Compra\n3️⃣ 🎟️ Inserir Cupom de Desconto\n\n_Digite 0 para cancelar o pedido e voltar ao menu._`;
    sendWhatsAppReply(fromPhone, msg);
    return;
  }

  // ── ESTADO: STORE_CART_ACTION ──────────────────────────────────────────────
  if (session.state === 'STORE_CART_ACTION') {
    if (text === '1') {
      session.state = 'STORE_SELECT_PRODUCT';
      userSessions[fromPhone] = session;
      const products = session.currentStoreProducts || [];
      let msg = '🛍️ *SELECIONE MAIS UM PRODUTO:*\n───────────────────────────────────\n\n';
      products.forEach((p, idx) => {
        const pUnit = p.desconto_ativo && p.valor_promocional ? p.valor_promocional : p.valor;
        msg += `*${idx + 1}.* 📦 *${p.nome}* — R$ ${Number(pUnit).toFixed(2).replace('.', ',')}\n`;
      });
      msg += '\n───────────────────────────────────\n';
      msg += '👉 *Digite o número do produto*\n_Digite 0 para voltar ao menu._';
      sendWhatsAppReply(fromPhone, msg);
    } else if (text === '2') {
      session.state = 'STORE_ENTER_COUPON';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '🎟️ *CUPOM DE DESCONTO*\n\nDigite o código do seu cupom de desconto (ex: BENVINDO10):\n\n_Digite 0 para voltar ao carrinho sem alterar._');
    } else if (text === '3') {
      session.checkoutType = 'store';
      session.storePaymentMethod = 'PIX';
      autoInjectDocument(fromPhone, session, 'STORE_VOUCHER_DOC', `💳 *FINALIZANDO COMPRA GSA STORE*\n\nPara vincularmos seu pedido e gerarmos seu link/QR Code de pagamento, por favor, digite o seu *CPF ou CNPJ* (apenas números).\n\n_Digite 0 para cancelar e voltar ao menu._`);
    } else if (text === '4') {
      session.cart = [];
      session.discount = null;
      session.state = 'STORE';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '🗑️ *Seu carrinho foi esvaziado.*\n\nRetornando ao menu da loja GSA Store...');
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida. Digite 1, 2, 3 ou 4 (ou 0 para voltar).');
    }
    return;
  }

  // ── ESTADO: STORE_ENTER_COUPON ─────────────────────────────────────────────
  if (session.state === 'STORE_ENTER_COUPON') {
    const codigo = text.trim().toUpperCase();
    sendWhatsAppReply(fromPhone, '🔄 Verificando cupom...');
    
    fetchCoupons((err, coupons) => {
      if (err || !coupons || coupons.length === 0) {
        session.state = 'STORE_CART_ACTION';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '❌ Nenhum cupom ativo encontrado ou ocorreu um erro.\n\nRetornando ao carrinho...');
        return;
      }
      
      const cupomValido = coupons.find(c => c.codigo_voucher.toUpperCase() === codigo);
      if (!cupomValido) {
        session.state = 'STORE_CART_ACTION';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `❌ O cupom *${codigo}* é inválido ou está expirado.\n\nRetornando ao carrinho...`);
        return;
      }
      
      // Aplica o desconto na sessão
      session.discount = {
        codigo: cupomValido.codigo_voucher,
        tipo: cupomValido.tipo,
        valor: cupomValido.valor
      };
      session.state = 'STORE_CART_ACTION';
      userSessions[fromPhone] = session;
      
      const descontoFormatado = cupomValido.tipo === 'porcentagem' ? `${cupomValido.valor}%` : `R$ ${cupomValido.valor.toFixed(2)}`;
      sendWhatsAppReply(fromPhone, `✅ *Cupom ${codigo} Aplicado!*\nVocê ganhou ${descontoFormatado} de desconto.\n\nRetornando ao menu do carrinho. Selecione 2 para Finalizar Compra e ver o valor com desconto aplicado.`);
    });
    return;
  }

  // ── ESTADO: STORE_DIRECT_PAY_OPTIONS ────────────────────────────────────────
  if (session.state === 'STORE_DIRECT_PAY_OPTIONS') {
    if (text === '1') {
      return generateStoreDirectPayment(fromPhone, session, 'pix');
    } else if (text === '2') {
      return generateStoreDirectPayment(fromPhone, session, 'credit_card');
    } else if (text === '3') {
      // 3. Informar Endereço / Calcular Frete (Puxa automaticamente dados cadastrais se cliente existir)
      const handleAddressFlow = (clientObj) => {
        const client = clientObj || session.clientData || session.profile?.cliente;
        const cepCadastrado = (client?.cep || session.savedClientAddress?.cep || '').replace(/\D/g, '');

        if (cepCadastrado && cepCadastrado.length >= 8) {
          const logradouro = client?.endereco || session.savedClientAddress?.endereco || '';
          const numero = client?.numero || session.savedClientAddress?.numero || '';
          const bairro = client?.bairro || session.savedClientAddress?.bairro || '';
          const cidade = client?.cidade || session.savedClientAddress?.cidade || '';
          const estado = client?.estado || session.savedClientAddress?.estado || '';

          session.savedClientAddress = {
            cep: cepCadastrado,
            endereco: logradouro,
            numero: numero,
            bairro: bairro,
            cidade: cidade,
            estado: estado,
            formatado: `${logradouro ? logradouro + ', ' : ''}${numero ? 'Nº ' + numero + ' - ' : ''}${bairro ? bairro + ', ' : ''}${cidade ? cidade + '/' + estado + ' - ' : ''}CEP: ${cepCadastrado.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`
          };

          session.state = 'STORE_DIRECT_CONFIRM_SAVED_ADDR';
          userSessions[fromPhone] = session;

          let msg = `📍 *ENDEREÇO CADASTRADO LOCALIZADO:*\n\n`;
          msg += `Puxamos automaticamente o seu endereço do sistema:\n\n`;
          if (logradouro) msg += `🏠 *Logradouro:* ${logradouro}, Nº ${numero || 'S/N'}\n`;
          if (bairro) msg += `🏘️ *Bairro:* ${bairro}\n`;
          if (cidade) msg += `🏙️ *Cidade/UF:* ${cidade} - ${estado}\n`;
          msg += `📮 *CEP:* ${cepCadastrado.replace(/^(\d{5})(\d{3})$/, '$1-$2')}\n\n`;
          msg += `🚚 *Frete:* Incluso / Entrega Rápida GSA!\n\n`;
          msg += `Deseja utilizar este endereço cadastrado para a entrega?\n\n`;
          msg += `1️⃣ ✅ *Sim, confirmar este endereço*\n`;
          msg += `2️⃣ ✏️ *Não, quero informar outro endereço / CEP*\n`;
          msg += `0️⃣ *Voltar*\n\n`;
          msg += `_Digite 1, 2 ou 0:_`;

          return sendWhatsAppReply(fromPhone, msg);
        }

        // Se o cliente não possuir CEP cadastrado, solicita digitação
        session.state = 'STORE_DIRECT_CEP';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '📍 Para calcularmos o frete e entrega, digite o seu *CEP* (apenas 8 números):\n\n_Digite 0 para voltar._');
      };

      if (session.clientData && (session.clientData.cep || session.clientData.id)) {
        return handleAddressFlow(session.clientData);
      }
      if (session.profile && session.profile.cliente) {
        return handleAddressFlow(session.profile.cliente);
      }

      return fetchClientByPhone(fromPhone, (err, clientFound) => {
        if (!err && clientFound) {
          session.clientData = clientFound;
          session.tempClientId = clientFound.id;
        }
        handleAddressFlow(clientFound);
      });
    } else if (text === '4') {
      session.state = 'HUMAN_AGENT_RELAY';
      userSessions[fromPhone] = session;
      const prodName = session.cart && session.cart[0] ? session.cart[0].produto.nome : 'Produto da Loja';
      sendWhatsAppReply(fromPhone, `👤 *Atendimento Humano GSA*\n\nNossa equipe comercial foi notificada sobre seu pedido (*${prodName}*) e entrará em contato em instantes!\n\n_Digite 0 a qualquer momento para voltar ao menu._`);
      return;
    } else if (text === '0') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '🔄 Retornando ao menu principal...\n\n' + getMainMenuText(session.profile));
      return;
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida.\n\n1️⃣ 🟢 Pagar via PIX\n2️⃣ 💳 Pagar com Cartão de Crédito\n3️⃣ 📍 Informar Endereço / Frete\n4️⃣ 👤 Atendente Humano\n0️⃣ Cancelar e Voltar\n\n_Digite o número desejado:_');
      return;
    }
  }

  // ── ESTADO: STORE_DIRECT_CONFIRM_SAVED_ADDR ────────────────────────────────
  if (session.state === 'STORE_DIRECT_CONFIRM_SAVED_ADDR') {
    if (text === '1') {
      const saved = session.savedClientAddress || {};
      session.cep = saved.cep || '';
      session.addressNum = saved.numero || '';
      session.fullDeliveryAddress = saved.formatado || (saved.cep ? `CEP: ${saved.cep}` : '');
      session.state = 'STORE_DIRECT_PAY_OPTIONS';
      userSessions[fromPhone] = session;

      let msg = `✅ *Endereço de Entrega Confirmado!*\n\n`;
      msg += `📍 *Destino:* ${session.fullDeliveryAddress}\n\n`;
      msg += `Agora escolha como você deseja realizar o pagamento:\n\n`;
      msg += `1️⃣ 🟢 *Pagar via PIX* (Instantâneo - QR Code e Copia e Cola)\n`;
      msg += `2️⃣ 💳 *Pagar com Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\n`;
      msg += `4️⃣ 👤 *Falar com Atendente Humano*\n`;
      msg += `0️⃣ *Voltar ao menu inicial*\n\n`;
      msg += `_Digite o número da opção desejada:_`;

      sendWhatsAppReply(fromPhone, msg);
      return;
    } else if (text === '2') {
      session.state = 'STORE_DIRECT_CEP';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '📍 Digite o novo *CEP* de entrega (apenas 8 números):\n\n_Digite 0 para voltar._');
      return;
    } else if (text === '0') {
      session.state = 'STORE_DIRECT_PAY_OPTIONS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '⬅️ Retornando às opções do pedido...\n\n1️⃣ 🟢 Pagar via PIX\n2️⃣ 💳 Pagar com Cartão de Crédito\n3️⃣ 📍 Informar Endereço / Frete\n\n_Digite a opção desejada:_');
      return;
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida.\n\n1️⃣ ✅ Sim, confirmar este endereço\n2️⃣ ✏️ Não, quero informar outro endereço / CEP\n0️⃣ Voltar\n\n_Digite 1, 2 ou 0:_');
      return;
    }
  }

  // ── ESTADO: STORE_DIRECT_CEP ────────────────────────────────────────────────
  if (session.state === 'STORE_DIRECT_CEP') {
    if (text === '0') {
      session.state = 'STORE_DIRECT_PAY_OPTIONS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '⬅️ Retornando às opções de pagamento...\n\n1️⃣ 🟢 Pagar via PIX\n2️⃣ 💳 Pagar com Cartão de Crédito\n\n_Digite 1 ou 2:_');
      return;
    }
    const cepClean = text.replace(/\D/g, '');
    if (cepClean.length !== 8) {
      sendWhatsAppReply(fromPhone, '❌ CEP inválido. Por favor, digite os 8 números do seu CEP (ex: 01001000).\n\n_Digite 0 para voltar._');
      return;
    }
    session.cep = cepClean;
    session.state = 'STORE_DIRECT_ADDR';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, `📍 CEP *${cepClean}* anotado!\n\n🏠 Agora, qual é o *Número* e *Complemento* (se houver)?\n_Ex: 150 - Apto 32_`);
    return;
  }

  // ── ESTADO: STORE_DIRECT_ADDR ───────────────────────────────────────────────
  if (session.state === 'STORE_DIRECT_ADDR') {
    if (text === '0') {
      session.state = 'STORE_DIRECT_PAY_OPTIONS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '⬅️ Retornando às opções de pagamento...\n\n1️⃣ 🟢 Pagar via PIX\n2️⃣ 💳 Pagar com Cartão de Crédito\n\n_Digite 1 ou 2:_');
      return;
    }
    session.addressNum = text.trim();
    session.fullDeliveryAddress = `CEP: ${session.cep}, Nº ${session.addressNum}`;
    session.state = 'STORE_DIRECT_PAY_OPTIONS';
    userSessions[fromPhone] = session;

    sendWhatsAppReply(fromPhone, `✅ *Endereço de Entrega Confirmado:*\n📍 CEP: ${session.cep}\n🏠 Nº/Compl: ${session.addressNum}\n\nAgora escolha como deseja pagar:\n\n1️⃣ 🟢 *Pagar via PIX* (Chave PIX e QR Code Instantâneo)\n2️⃣ 💳 *Pagar com Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\n\n_Digite 1 ou 2 (ou 0 para voltar):_`);
    return;
  }

  // ── ESTADO: CLASSIFICADOS ────────────────────────────────────────────────────
  if (session.state === 'CLASSIFIEDS') {
    const catsDb = { '1': 'veiculos', '2': 'imoveis', '3': 'geral' };
    const catsLabel = { '1': '🚗 Veículos', '2': '🏠 Imóveis', '3': '📦 Geral' };
    
    const catDb = catsDb[text] || 'geral';
    const catLabel = catsLabel[text] || '📦 Geral';
    
    sendWhatsAppReply(fromPhone, `🔄 Buscando os últimos anúncios de ${catLabel}...`);
    
    fetchClassifieds(catDb, (err, ads) => {
      if (err || ads.length === 0) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `📢 *Classificados GSA HUB — ${catLabel}*\n\nNenhum anúncio recente encontrado nesta categoria.\nVisualize o painel completo em:\n🌐 https://gsahub.pages.dev/\n\n_Digite 0 para voltar ao menu._`);
        return;
      }
      
      session.classifiedAds = ads;
      session.state = 'CLASSIFIED_SELECT';
      userSessions[fromPhone] = session;
      
      let msg = `📢 *Classificados GSA HUB — ${catLabel}*\n\n`;
      ads.forEach((ad, idx) => {
        const precoStr = ad.preco ? `R$ ${ad.preco.toFixed(2)}` : 'Sob consulta';
        msg += `*${idx + 1}.* ${ad.titulo}\n💰 ${precoStr}\n\n`;
      });
      msg += '_Digite o número do anúncio para fazer uma proposta_\n_Digite 0 para voltar ao menu._';
      sendWhatsAppReply(fromPhone, msg);
    });
    return;
  }

  // ── ESTADO: CLIENT_DOC ──────────────────────────────────────────────────────
  if (session.state === 'CLIENT_DOC') {
    const docClean = text.replace(/\\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Por favor, digite apenas os números.');
      return;
    }
    
    sendWhatsAppReply(fromPhone, '🔄 Consultando seu cadastro...');
    fetchClientByDoc(docClean, (err, client) => {
      if (err || !client) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '❌ Cadastro não encontrado. Verifique o documento ou acesse https://gsahub.pages.dev para se cadastrar.\n\n_Digite 0 para voltar ao menu principal._');
        return;
      }
      
      const balance = client.saldo_disponivel || 0;
      const points = client.pontos_fidelidade || 0;
      const vip = client.is_vip ? '💎 Cliente VIP' : 'Cliente Padrão';
      
      const rawNome = client.nome || client.nome_completo || client.razao_social || 'Cliente GSA';
      const nome = formatBoldName(rawNome);
      session.clientData = client;
      session.state = 'CLIENT_DASHBOARD_MENU';
      userSessions[fromPhone] = session;
      
      const dashMsg = `👤 *Área do Cliente GSA HUB*\nOlá, *${nome}*! (${vip})\n\n💰 Saldo: R$ ${balance.toFixed(2)}\n⭐ Pontos: ${points}\n\n*O que você deseja consultar?*\n1️⃣ 📄 Faturas em Aberto\n2️⃣ 🛠️ Ordens de Serviço\n3️⃣ 📋 Meus Orçamentos\n4️⃣ 🔄 Minhas Assinaturas\n5️⃣ 🎫 Tickets de Suporte\n0️⃣ Sair\n\n_Digite o número desejado:_`;
      
      sendWhatsAppReply(fromPhone, dashMsg);
    });
    return;
  }



  // ── ESTADO: PARTNERS ────────────────────────────────────────────────────────
  if (session.state === 'PARTNERS') {
    if (text === '1') {
      if (session.profile && (session.profile.afiliado || session.profile.cliente)) {
        const affRecord = session.profile.afiliado || session.profile.cliente;
        const affName = formatBoldName(affRecord.nome || affRecord.nome_completo || affRecord.razao_social || 'Afiliado GSA');
        const refCode = affRecord.codigo_afiliado || affRecord.cpf || affRecord.cnpj || ('GSA' + stripCountryCode55(fromPhone));
        const refLink = affRecord.link_afiliado || `https://gsahub.pages.dev/?ref=${refCode}`;
        const saldoComissao = affRecord.saldo_comissao || 0;
        const pontos = affRecord.pontos_acumulados || affRecord.saldo_pontos || 0;

        session.affiliateData = affRecord;
        session.state = 'PARTNER_AFFILIATE_MENU';
        userSessions[fromPhone] = session;

        sendWhatsAppReply(fromPhone, `🤝 *Portal do Afiliado GSA HUB (Indique & Ganhe)*\nOlá, *${affName}*!\n\n🔗 *Seu Link Único de Afiliado:*\n${refLink}\n\n💰 Saldo de Comissões: R$ ${Number(saldoComissao).toFixed(2)}\n⭐ Pontos Acumulados: ${pontos}\n\n1️⃣ 📊 Consultar Cliques & Conversões\n2️⃣ 💵 Solicitar Saque via PIX\n3️⃣ 🎁 Resgatar Pontos por Recompensas\n0️⃣ Voltar ao Menu Principal`);
      } else {
        autoInjectDocument(fromPhone, session, 'AFFILIATE_DOC', '🤝 *Portal do Afiliado GSA HUB (Indique & Ganhe)*\n\nPara acessar seu painel de afiliado, digite seu *CPF ou CNPJ* (apenas números).\n\n_Digite 0 para voltar._');
      }
      return;
    } else if (text === '2') {
      if (session.profile && session.profile.fornecedor) {
        const fData = session.profile.fornecedor;
        const nomeDisplay = (fData.razao_social || fData.nome_fantasia || fData.nome || 'PARCEIRO').toUpperCase();
        session.supplierData = fData;
        session.state = 'PARTNER_SUPPLIER_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `📦 *Portal B2B de Fornecedores GSA HUB*\nOlá Parceiro *${nomeDisplay}*!\n\n1️⃣ 📄 Entregas e Notas Fiscais\n2️⃣ 🛍️ Pedidos de Compra\n3️⃣ 💳 Financeiro e Pagamentos\n0️⃣ Voltar ao Menu Principal`);
      } else {
        autoInjectDocument(fromPhone, session, 'PARTNER_SUPPLIER_DOC', '📦 *Portal do Fornecedor & Suprimentos GSA HUB*\n\nDigite seu *CNPJ ou CPF* (apenas números) para consultar seus pedidos de compra, faturas e catálogo.\n\n_Digite 0 para voltar._');
      }
      return;
    } else if (text === '3') {
      if (session.profile && session.profile.prestador) {
        const pData = session.profile.prestador;
        const nomeDisplay = (pData.razao_social || pData.nome_fantasia || pData.nome || 'PARCEIRO').toUpperCase();
        session.providerData = pData;
        session.state = 'PARTNER_PROVIDER_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `🛠️ *Portal B2B de Prestadores GSA HUB*\nOlá Parceiro *${nomeDisplay}*!\n\n1️⃣ 📋 Minhas Demandas de Serviço\n2️⃣ 🗓️ Minha Agenda\n3️⃣ 📷 Enviar Foto / Relatório\n0️⃣ Voltar ao Menu Principal`);
      } else {
        autoInjectDocument(fromPhone, session, 'PARTNER_PROVIDER_DOC', '🛠️ *Portal do Prestador de Serviços GSA HUB*\n\nDigite seu *CPF ou CNPJ* (apenas números) para consultar suas demandas de serviço, agenda e repasses.\n\n_Digite 0 para voltar._');
      }
      return;
    } else if (text === '4') {
      session.state = 'PARTNER_ADVERTISER_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `📢 *Portal do Anunciante GSA HUB*\n\nEscolha uma das opções abaixo:\n\n1️⃣ 📊 Consultar Campanhas de Mídia\n2️⃣ 🚀 Planos e Formatos de Anúncios\n3️⃣ 💬 Solicitar Atendimento Comercial de Mídia\n4️⃣ 🌐 Painel Web do Anunciante\n0️⃣ ⬅️ Voltar ao Menu de Parceiros\n\n_Digite o número da opção desejada:_`);
      return;
    } else if (text === '5') {
      session.state = 'PARTNER_NETWORK_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `🌟 *Rede de Parceiros Homologados GSA HUB*\n\nEscolha uma opção:\n\n1️⃣ 🔍 Consultar Rede Credenciada GSA\n2️⃣ 🤝 Credenciar Minha Empresa como Parceira\n3️⃣ 💬 Falar com a Diretoria de Parcerias B2B\n0️⃣ ⬅️ Voltar ao Menu de Parceiros\n\n_Digite o número da opção desejada:_`);
      return;
    } else if (text === '6') {
      session.state = 'PARTNER_SUPPORT_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `💬 *Suporte Especializado a Parceiros GSA HUB*\n\nEscolha o setor para atendimento humano:\n\n1️⃣ 🤝 Suporte a Afiliados\n2️⃣ 📦 Suporte a Fornecedores\n3️⃣ 🛠️ Suporte a Prestadores de Serviços\n4️⃣ 💼 Novos Negócios & Parcerias B2B\n0️⃣ ⬅️ Voltar ao Menu de Parceiros\n\n_Digite o número da opção desejada:_`);
      return;
    } else if (text === '0') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida. Digite um número de 1 a 6.\n\n_Digite 0 para voltar._');
      return;
    }
  }

  // ── ESTADO: PORTAL DO AFILIADO (SUBMENU) ──────────────────────────────────
  if (session.state === 'PARTNER_AFFILIATE_MENU') {
    const afiliado = session.affiliateData;
    if (!afiliado) {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '❌ Sessão de afiliado não encontrada. Digite 1 para tentar novamente.');
      return;
    }

    if (text === '1') {
      const code = afiliado.codigo_publico;
      const linksMsg = `🔗 *Seus Links de Indicação GSA HUB*\n\n🌐 *Link Geral:* https://gsahub.pages.dev/?ref=${code}\n🛍️ *Loja Virtual:* https://gsahub.pages.dev/loja?ref=${code}\n🛠️ *Serviços:* https://gsahub.pages.dev/servicos?ref=${code}\n✈️ *Viagens:* https://gsahub.pages.dev/viagens?ref=${code}\n\n_Compartilhe estes links com seus contatos para acumular comissões a cada compra!_\n\n_Digite 0 para voltar ao menu do afiliado._`;
      sendWhatsAppReply(fromPhone, linksMsg);
      return;
    } else if (text === '2') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando extrato de comissões...');
      supabaseGet(`/rest/v1/gsa_afiliado_comissoes?afiliado_id=eq.${afiliado.id}&select=*`, (err, comissoes) => {
        const list = Array.isArray(comissoes) ? comissoes : [];
        const totalGanho = list.reduce((acc, c) => acc + Number(c.valor_comissao || 0), 0);
        const pendentes = list.filter(c => c.status === 'pendente').reduce((acc, c) => acc + Number(c.valor_comissao || 0), 0);
        const liberados = list.filter(c => c.status === 'liberado' || c.status === 'pago').reduce((acc, c) => acc + Number(c.valor_comissao || 0), 0);
        
        const msg = `💰 *Extrato de Comissões - Afiliado*\n\n👤 *${formatBoldName(afiliado.nome_divulgacao)}*\n📊 *Total Acumulado:* R$ ${totalGanho.toFixed(2)}\n✅ *Saldo Liberado/Pago:* R$ ${liberados.toFixed(2)}\n⏳ *Comissões Pendentes:* R$ ${pendentes.toFixed(2)}\n\n_Digite 0 para voltar._`;
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '3') {
      sendWhatsAppReply(fromPhone, '🔄 Verificando histórico de saques e saldo disponível...');
      
      // Busca comissões do afiliado
      supabaseGet(`/rest/v1/gsa_afiliado_comissoes?afiliado_id=eq.${afiliado.id}&select=*`, (errC, comissoes) => {
        const comList = Array.isArray(comissoes) ? comissoes : [];
        // Comissões elegíveis para saque
        const totalComissoes = comList.reduce((acc, c) => {
          const val = Number(c.valor || c.valor_comissao || 0);
          const st = (c.status || '').toLowerCase();
          if (['disponivel', 'liberado', 'aprovado', 'concluido', 'pago'].includes(st)) {
            return acc + val;
          }
          return acc;
        }, 0);

        // Busca saques anteriores
        supabaseGet(`/rest/v1/gsa_afiliado_saques?afiliado_id=eq.${afiliado.id}&select=*`, (errS, saques) => {
          const saqList = Array.isArray(saques) ? saques : [];

          let saquesConcluidosVal = 0;
          let saquesPendentesVal = 0;
          let countConcluidos = 0;
          let countPendentes = 0;

          saqList.forEach(s => {
            const val = Number(s.valor || s.valor_solicitado || 0);
            const st = (s.status || '').toLowerCase();
            if (['pago', 'concluido', 'finalizado'].includes(st)) {
              saquesConcluidosVal += val;
              countConcluidos++;
            } else if (['solicitado', 'aprovado', 'em_analise', 'processamento', 'pendente'].includes(st)) {
              saquesPendentesVal += val;
              countPendentes++;
            }
          });

          const totalSaques = saquesConcluidosVal + saquesPendentesVal;
          let saldoDisponivel = totalComissoes - totalSaques;
          
          // Se comissões zeradas, testa se o cliente possui saldo na carteira
          if (saldoDisponivel <= 0 && afiliado.cliente_id) {
            const saldoCarteira = Number(session.clientData?.saldo_carteira || session.clientData?.saldo_disponivel || 0);
            if (saldoCarteira > 0) {
              saldoDisponivel = saldoCarteira;
            }
          }

          let msg = `💸 *Painel de Saques PIX (Afiliado)*\n\n`;
          msg += `👤 *${formatBoldName(afiliado.nome_divulgacao)}*\n\n`;
          msg += `✅ *Saques Concluídos:* R$ ${saquesConcluidosVal.toFixed(2)} (${countConcluidos} saque${countConcluidos !== 1 ? 's' : ''})\n`;
          msg += `⏳ *Saques Pendentes:* R$ ${saquesPendentesVal.toFixed(2)} (${countPendentes} solicitação${countPendentes !== 1 ? 'ões' : 'ão'})\n`;
          msg += `💰 *Saldo Disponível para Novo Saque:* R$ ${saldoDisponivel > 0 ? saldoDisponivel.toFixed(2) : '0,00'}\n\n`;

          if (saldoDisponivel <= 0) {
            msg += `❌ Você não possui saldo disponível para realizar um novo saque no momento.\n\n_Para acumular saldo para saque, compartilhe seus links de indicação e realize vendas!_\n\n_Digite 0 para voltar ao menu do afiliado._`;
            sendWhatsAppReply(fromPhone, msg);
            return;
          }

          // Salva o saldo disponível e pede a chave PIX
          session.affiliateAvailableBalance = saldoDisponivel;
          session.state = 'PARTNER_AFFILIATE_WITHDRAW_PIX';
          userSessions[fromPhone] = session;

          msg += `Por favor, digite sua *Chave PIX* (CPF, CNPJ, E-mail, Telefone ou Chave Aleatória) para registrar a solicitação no sistema GSA HUB:\n\n_Digite 0 para cancelar._`;
          sendWhatsAppReply(fromPhone, msg);
        });
      });
      return;
    } else if (text === '4') {
      const copyMsg = `📢 *Material de Divulgação GSA HUB*\n\n*Texto Sugerido para Envio:*\n"Olá! 👋 Conheça o GSA HUB, a plataforma completa para contratação de serviços residenciais e empresariais, compras com cashback e pacotes de viagens com as melhores condições! Acesse pelo meu link oficial: https://gsahub.pages.dev/?ref=${afiliado.codigo_publico}"\n\n_Copie o texto acima e compartilhe no seu WhatsApp, Instagram e redes sociais!_`;
      sendWhatsAppReply(fromPhone, copyMsg);
      return;
    } else if (text === '0') {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '💼 *Portais de Parceiros GSA HUB*');
      return;
    }
  }

  // ── ESTADO: SAQUE PIX AFILIADO ─────────────────────────────────────────────
  if (session.state === 'PARTNER_AFFILIATE_WITHDRAW_PIX') {
    if (text === '0') {
      session.state = 'PARTNER_AFFILIATE_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '❌ Solicitação de saque cancelada.\n\n_Digite 0 para voltar ao menu do afiliado._');
      return;
    }
    const pixKey = text.trim();
    const afiliado = session.affiliateData;
    const valorSaque = session.affiliateAvailableBalance || 0;
    const proto = generateProtocolNumber();
    
    function detectPixType(key) {
      const clean = key.replace(/\D/g, '');
      if (clean.length === 11) return 'cpf';
      if (clean.length === 14) return 'cnpj';
      if (key.includes('@')) return 'email';
      if (clean.length >= 10 && clean.length <= 13) return 'telefone';
      return 'chave_aleatoria';
    }

    const payload = {
      afiliado_id: afiliado?.id || null,
      valor: valorSaque,
      pix_chave_snapshot: pixKey,
      pix_tipo_snapshot: detectPixType(pixKey),
      status: 'solicitado'
    };

    supabasePost('/rest/v1/gsa_afiliado_saques', payload, (err, res) => {
      session.state = 'PARTNER_AFFILIATE_MENU';
      userSessions[fromPhone] = session;

      let gsaSystemId = 'N/A';
      let shortRegId = proto;

      if (Array.isArray(res) && res.length > 0 && res[0].id) {
        gsaSystemId = res[0].id;
        shortRegId = `SAQ-${String(res[0].id).substring(0, 8).toUpperCase()}`;
      }

      sendWhatsAppReply(fromPhone, `✅ *Solicitação de Saque Registrada no GSA HUB!*\n\n🆔 *Nº de Registro no Sistema GSA:* ${shortRegId}\n📋 *ID Único (UUID):* ${gsaSystemId}\n🔢 *Protocolo de Atendimento:* ${proto}\n\n💵 *Valor Solicitado:* R$ ${valorSaque.toFixed(2)}\n🔑 *Chave PIX:* ${pixKey}\n📅 *Data/Hora:* ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n\nSua solicitação foi gravada com sucesso no sistema GSA HUB e o pagamento via PIX será efetuado pela equipe financeira após a conferência!\n\n_Digite 0 para voltar ao menu do afiliado._`);
    });
    return;
  }

  // ── ESTADO: FORNECEDOR (DOC & SUBMENU) ─────────────────────────────────────
  if (session.state === 'PARTNER_SUPPLIER_DOC') {
    const docClean = text.replace(/\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CNPJ ou CPF inválido. Digite apenas os números.');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Buscando cadastro de fornecedor...');
    fetchSupplierByDoc(docClean, (err, supplier) => {
      if (!supplier) {
        session.tempDoc = docClean;
        session.state = 'PARTNER_SUPPLIER_NOT_FOUND';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '📦 *Portal do Fornecedor GSA HUB*\n\nNenhum cadastro de fornecedor foi localizado para este documento.\n\nDeseja cadastrar sua empresa como fornecedora homologada?\n\n1️⃣ 📝 Iniciar Pré-Cadastro de Fornecedor\n0️⃣ ⬅️ Voltar aos Portais de Parceiros');
        return;
      }
      
      session.supplierData = supplier;
      session.state = 'PARTNER_SUPPLIER_MENU';
      userSessions[fromPhone] = session;
      
      const nome = formatBoldName(supplier.razao_social || supplier.nome_fantasia || supplier.nome);
      sendWhatsAppReply(fromPhone, `📦 *Portal do Fornecedor GSA HUB*\nOlá, *${nome}*! (Status: ${supplier.status || 'Ativo'})\n\n1️⃣ 📋 Meus Pedidos de Compra (Ordens de Fornecimento)\n2️⃣ 💰 Financeiro & Contas a Receber\n3️⃣ 📦 Catálogo de Produtos Cadastrados\n4️⃣ 📄 Informar Nota Fiscal de Entrega\n5️⃣ 🌐 Acessar Painel Web do Fornecedor\n0️⃣ ⬅️ Voltar aos Portais de Parceiros\n\n_Digite o número desejado:_`);
    });
    return;
  }

  if (session.state === 'PARTNER_SUPPLIER_NOT_FOUND') {
    if (text === '1') {
      session.state = 'PARTNER_SUPPLIER_REG_NAME';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '📝 *Pré-Cadastro de Fornecedor*\n\nPor favor, digite a *Razão Social ou Nome Fantasia* da empresa:');
      return;
    }
    session.state = 'PARTNERS';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '💼 *Portais de Parceiros GSA HUB*');
    return;
  }

  if (session.state === 'PARTNER_SUPPLIER_REG_NAME') {
    session.regSupplier = { razao_social: text.trim(), documento: session.tempDoc };
    session.state = 'PARTNER_SUPPLIER_REG_EMAIL';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '📧 Digite o *E-mail de Contato* do setor de suprimentos/vendas:');
    return;
  }

  if (session.state === 'PARTNER_SUPPLIER_REG_EMAIL') {
    session.regSupplier.email = text.trim();
    session.state = 'PARTNER_SUPPLIER_REG_CAT';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '📦 Informe a *Categoria ou Ramo de Atuação* dos produtos/serviços fornecidos:');
    return;
  }

  if (session.state === 'PARTNER_SUPPLIER_REG_CAT') {
    session.regSupplier.categoria = text.trim();
    session.regSupplier.telefone = formatPhoneForSearch(fromPhone);
    session.regSupplier.status = 'em_analise';
    
    supabasePost('/rest/v1/fornecedores', session.regSupplier, (err) => {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '✅ *Pré-Cadastro de Fornecedor Enviado com Sucesso!*\n\nNossa equipe de suprimentos analisará seus dados e entrará em contato para liberar sua senha/PIN de acesso.\n\n_Digite 0 para voltar ao menu._');
    });
    return;
  }

  if (session.state === 'PARTNER_SUPPLIER_MENU') {
    const supplier = session.supplierData;
    if (text === '1') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando pedidos de compra...');
      supabaseGet(`/rest/v1/pedidos_compra_fornecedor?fornecedor_id=eq.${supplier.id}&select=*&order=created_at.desc&limit=5`, (err, orders) => {
        const list = Array.isArray(orders) ? orders : [];
        if (list.length === 0) {
          sendWhatsAppReply(fromPhone, '📋 Você não possui pedidos de compra pendentes no momento.\n\n_Digite 0 para voltar._');
          return;
        }
        let msg = '📋 *Seus Pedidos de Compra Recentes:*\n\n';
        list.forEach(o => {
          msg += `🔹 *Pedido #${o.numero_pedido || String(o.id).substring(0,6)}*\n• Status: ${o.status || 'Pendente'}\n• Valor: R$ ${Number(o.valor_total || 0).toFixed(2)}\n\n`;
        });
        msg += '_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '2') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando contas a receber...');
      supabaseGet(`/rest/v1/contas_pagar?fornecedor_id=eq.${supplier.id}&select=*&order=created_at.desc&limit=5`, (err, bills) => {
        const list = Array.isArray(bills) ? bills : [];
        if (list.length === 0) {
          sendWhatsAppReply(fromPhone, '💰 Nenhuma fatura a receber localizada no momento.\n\n_Digite 0 para voltar._');
          return;
        }
        let msg = '💰 *Faturas e Pagamentos a Receber:*\n\n';
        list.forEach(b => {
          msg += `💵 *Fatura #${String(b.id).substring(0,6)}*\n• Status: ${b.status || 'Pendente'}\n• Valor: R$ ${Number(b.valor || 0).toFixed(2)}\n• Vencimento: ${b.data_vencimento ? new Date(b.data_vencimento).toLocaleDateString('pt-BR') : 'N/A'}\n\n`;
        });
        msg += '_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '3') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando catálogo de produtos fornecidos...');
      supabaseGet(`/rest/v1/fornecedor_produtos?fornecedor_id=eq.${supplier.id}&select=*&limit=5`, (err, prods) => {
        const list = Array.isArray(prods) ? prods : [];
        if (list.length === 0) {
          sendWhatsAppReply(fromPhone, '📦 Nenhum produto cadastrado no seu catálogo fornecido.\n\n_Digite 0 para voltar._');
          return;
        }
        let msg = '📦 *Seus Produtos Cadastrados:*\n\n';
        list.forEach(p => {
          msg += `• *${p.nome || 'Produto'}* (Cód: ${p.codigo || 'N/A'}) - R$ ${Number(p.preco || 0).toFixed(2)}\n`;
        });
        msg += '\n_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '4') {
      session.state = 'PARTNER_SUPPLIER_NF';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '📄 *Informar Nota Fiscal de Entrega*\n\nPor favor, digite o *Número da Nota Fiscal* ou a *Chave de Acesso de 44 dígitos*:\n\n_Digite 0 para cancelar._');
      return;
    } else if (text === '5') {
      sendWhatsAppReply(fromPhone, '🌐 *Painel Web do Fornecedor GSA HUB*\n\nPara visualizar dashboards e fazer upload direto de XML/PDF de NFs, acesse:\n🌐 https://gsahub.pages.dev/fornecedor\n\n_Digite 0 para voltar._');
      return;
    } else if (text === '0') {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '💼 *Portais de Parceiros GSA HUB*');
      return;
    }
  }

  if (session.state === 'PARTNER_SUPPLIER_NF') {
    if (text === '0') {
      session.state = 'PARTNER_SUPPLIER_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '❌ Operação cancelada.\n\n_Digite 0 para voltar._');
      return;
    }
    const nfData = text.trim();
    const supplier = session.supplierData;
    const proto = generateProtocolNumber();
    
    supabasePost('/rest/v1/fornecedor_notificacoes', {
      fornecedor_id: supplier?.id || null,
      titulo: 'Nota Fiscal Informada pelo WhatsApp',
      mensagem: `NF/Chave: ${nfData} | Protocolo: ${proto}`,
      status: 'pendente'
    }, () => {
      session.state = 'PARTNER_SUPPLIER_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `✅ *Informação da Nota Fiscal Registrada!*\n\n🔢 *Protocolo:* ${proto}\n📄 *Dados Enviados:* ${nfData}\n\nNossa equipe de conferência de suprimentos já recebeu os dados!\n\n_Digite 0 para voltar._`);
    });
    return;
  }

  // ── ESTADO: PRESTADOR DE SERVIÇOS (DOC & SUBMENU) ──────────────────────────
  if (session.state === 'PARTNER_PROVIDER_DOC') {
    const docClean = text.replace(/\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Digite apenas os números.');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Buscando cadastro de prestador...');
    fetchProviderByDoc(docClean, (err, provider) => {
      if (!provider) {
        session.tempDoc = docClean;
        session.state = 'PARTNER_PROVIDER_NOT_FOUND';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '🛠️ *Portal do Prestador GSA HUB*\n\nNenhum cadastro de prestador/técnico foi localizado para este documento.\n\nDeseja realizar o cadastro de prestador de serviços parceiro?\n\n1️⃣ 📝 Iniciar Cadastro de Prestador\n0️⃣ ⬅️ Voltar aos Portais de Parceiros');
        return;
      }
      
      session.providerData = provider;
      session.state = 'PARTNER_PROVIDER_MENU';
      userSessions[fromPhone] = session;
      
      const nome = formatBoldName(provider.nome_completo || provider.razao_social || provider.nome);
      sendWhatsAppReply(fromPhone, `🛠️ *Portal do Prestador GSA HUB*\nOlá, *${nome}*! (Área: ${provider.area_servico || 'Geral'})\n\n1️⃣ 🛠️ Minhas Demandas & Ordens de Serviço (OS)\n2️⃣ 📅 Agenda de Atendimentos\n3️⃣ 💰 Saldo em Carteira & Repasses\n4️⃣ 💸 Solicitar Saque PIX de Repasses\n5️⃣ 🌐 Acessar Painel Web do Prestador\n0️⃣ ⬅️ Voltar aos Portais de Parceiros\n\n_Digite o número desejado:_`);
    });
    return;
  }

  if (session.state === 'PARTNER_PROVIDER_NOT_FOUND') {
    if (text === '1') {
      session.state = 'PARTNER_PROVIDER_REG_NAME';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '📝 *Cadastro de Prestador de Serviços*\n\nPor favor, digite seu *Nome Completo* ou *Razão Social*:');
      return;
    }
    session.state = 'PARTNERS';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '💼 *Portais de Parceiros GSA HUB*');
    return;
  }

  if (session.state === 'PARTNER_PROVIDER_REG_NAME') {
    session.regProvider = { nome_completo: text.trim(), cpf: session.tempDoc };
    session.state = 'PARTNER_PROVIDER_REG_AREA';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '🛠️ Informe sua *Especialidade ou Área de Serviço* (ex: Eletricista, Climatização, TI, Pintura):');
    return;
  }

  if (session.state === 'PARTNER_PROVIDER_REG_AREA') {
    session.regProvider.area_servico = text.trim();
    session.regProvider.telefone = formatPhoneForSearch(fromPhone);
    session.regProvider.status = 'em_analise';
    
    supabasePost('/rest/v1/prestadores', session.regProvider, () => {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '✅ *Cadastro de Prestador Enviado com Sucesso!*\n\nSua ficha foi recebida pela nossa equipe operacional. Em breve entraremos em contato para liberar suas demandas!\n\n_Digite 0 para voltar ao menu._');
    });
    return;
  }

  if (session.state === 'PARTNER_PROVIDER_MENU') {
    const provider = session.providerData;
    if (text === '1') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando suas demandas de serviço...');
      supabaseGet(`/rest/v1/prestador_demandas?prestador_id=eq.${provider.id}&select=*&limit=5`, (err, demands) => {
        const list = Array.isArray(demands) ? demands : [];
        if (list.length === 0) {
          sendWhatsAppReply(fromPhone, '🛠️ Você não possui demandas de serviço ativas no momento.\n\n_Digite 0 para voltar._');
          return;
        }
        let msg = '🛠️ *Suas Demandas & Ordens de Serviço:*\n\n';
        list.forEach(d => {
          msg += `🔧 *OS #${String(d.id).substring(0,6)}*\n• Servico: ${d.titulo || 'Atendimento'}\n• Status: ${d.status || 'Em Aberto'}\n\n`;
        });
        msg += '_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '2') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando agendamentos...');
      supabaseGet(`/rest/v1/prestador_agendamentos?prestador_id=eq.${provider.id}&select=*&limit=5`, (err, scheds) => {
        const list = Array.isArray(scheds) ? scheds : [];
        if (list.length === 0) {
          sendWhatsAppReply(fromPhone, '📅 Nenhum agendamento futuro localizado.\n\n_Digite 0 para voltar._');
          return;
        }
        let msg = '📅 *Seus Próximos Agendamentos:*\n\n';
        list.forEach(s => {
          msg += `• *Data:* ${s.data_inicio ? new Date(s.data_inicio).toLocaleString('pt-BR') : 'N/A'}\n  Obs: ${s.observacoes || 'Sem obs'}\n\n`;
        });
        msg += '_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '3') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando saldo e repasses...');
      supabaseGet(`/rest/v1/prestador_faturas?prestador_id=eq.${provider.id}&select=*&limit=5`, (err, fats) => {
        const list = Array.isArray(fats) ? fats : [];
        const total = list.reduce((acc, f) => acc + Number(f.valor || 0), 0);
        let msg = `💰 *Saldo em Carteira & Extrato de Repasses*\n\n📊 *Total Acumulado:* R$ ${total.toFixed(2)}\n\n`;
        if (list.length > 0) {
          msg += '*Últimos Repasses:*\n';
          list.forEach(f => {
            msg += `💵 R$ ${Number(f.valor || 0).toFixed(2)} - Status: ${f.status || 'Concluído'}\n`;
          });
        }
        msg += '\n_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '4') {
      sendWhatsAppReply(fromPhone, '🔄 Consultando saldo de repasses para saque...');
      supabaseGet(`/rest/v1/prestador_faturas?prestador_id=eq.${provider.id}&select=valor`, (err, fats) => {
        const list = Array.isArray(fats) ? fats : [];
        const total = list.reduce((acc, f) => acc + Number(f.valor || 0), 0);
        session.providerWithdrawAmount = total;
        session.state = 'PARTNER_PROVIDER_WITHDRAW_PIX';
        userSessions[fromPhone] = session;
        const msgSaldo = total > 0 ? `\n📊 *Saldo Disponível para Saque:* ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` : '';
        sendWhatsAppReply(fromPhone, `💸 *Solicitação de Saque PIX (Prestador)*${msgSaldo}\nPor favor, digite sua *Chave PIX* (CPF, CNPJ, E-mail, Telefone ou Chave Aleatória):\n\n_Digite 0 para cancelar._`);
      });
      return;
    } else if (text === '5') {
      sendWhatsAppReply(fromPhone, '🌐 *Painel Web do Prestador GSA HUB*\n\nPara aceitar demandas, enviar relatórios fotográficos e acompanhar repasses, acesse:\n🌐 https://gsahub.pages.dev/prestador\n\n_Digite 0 para voltar._');
      return;
    } else if (text === '0') {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '💼 *Portais de Parceiros GSA HUB*');
      return;
    }
  }

  if (session.state === 'PARTNER_PROVIDER_WITHDRAW_PIX') {
    if (text === '0') {
      session.state = 'PARTNER_PROVIDER_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '❌ Solicitação cancelada.\n\n_Digite 0 para voltar._');
      return;
    }
    const pixKey = text.trim();
    const provider = session.providerData;
    const proto = generateProtocolNumber();
    
    const executeWithdraw = (requestedValor) => {
      const finalValor = Number((requestedValor || 0).toFixed(2));
      supabasePost('/rest/v1/prestador_saques', {
        prestador_id: provider?.id || null,
        chave_pix: pixKey,
        valor: finalValor,
        status: 'solicitado'
      }, () => {
        session.state = 'PARTNER_PROVIDER_MENU';
        userSessions[fromPhone] = session;
        const formattedVal = finalValor > 0 ? `\n💰 *Valor Solicitado:* ${finalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : '';
        sendWhatsAppReply(fromPhone, `✅ *Solicitação de Saque PIX Registrada!*\n\n🔢 *Protocolo:* ${proto}\n🔑 *Chave PIX:* ${pixKey}${formattedVal}\n\nO valor do repasse disponível será transferido após a conferência técnica!\n\n_Digite 0 para voltar._`);
      });
    };

    if (session.providerWithdrawAmount && Number(session.providerWithdrawAmount) > 0) {
      executeWithdraw(Number(session.providerWithdrawAmount));
    } else if (provider?.id) {
      supabaseGet(`/rest/v1/prestador_transacoes?prestador_id=eq.${provider.id}&status=eq.concluido&select=tipo,valor`, (errTx, txs) => {
        const txList = Array.isArray(txs) ? txs : [];
        if (!errTx && txList.length > 0) {
          const bal = txList.reduce((acc, t) => acc + (t.tipo === 'credito' ? Number(t.valor || 0) : -Number(t.valor || 0)), 0);
          if (bal > 0) return executeWithdraw(bal);
        }
        supabaseGet(`/rest/v1/prestador_faturas?prestador_id=eq.${provider.id}&select=valor`, (errFat, fats) => {
          const list = Array.isArray(fats) ? fats : [];
          const total = list.reduce((acc, f) => acc + Number(f.valor || 0), 0);
          executeWithdraw(total);
        });
      });
    } else {
      executeWithdraw(0.00);
    }
    return;
  }

  // ── ESTADO: PORTAL DO ANUNCIANTE ──────────────────────────────────────────
  if (session.state === 'PARTNER_ADVERTISER_MENU') {
    if (text === '1') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando suas campanhas ativas...');
      supabaseGet(`/rest/v1/gsa_ad_campaigns?select=*&limit=5`, (err, camps) => {
        const list = Array.isArray(camps) ? camps : [];
        if (list.length === 0) {
          sendWhatsAppReply(fromPhone, '📢 Nenhuma campanha ativa localizada para este número.\n\n_Digite 0 para voltar._');
          return;
        }
        let msg = '📢 *Suas Campanhas de Anúncios:*\n\n';
        list.forEach(c => {
          msg += `• *${c.nome_campanha || 'Campanha'}* - Status: ${c.status || 'Ativa'}\n`;
        });
        msg += '\n_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '2') {
      const msg = `🚀 *Planos e Formatos de Anúncios GSA HUB*\n\nDivulgue sua marca diretamente para milhares de clientes do ecossistema GSA:\n\n1️⃣ *Banners no Hub:* Exibição de alta visibilidade no topo e nas seções principais da plataforma.\n2️⃣ *Destaque nos Classificados:* Posicionamento no topo das buscas de veículos, imóveis e produtos.\n3️⃣ *Disparos no WhatsApp:* Envio segmentado de ofertas para a base ativa de clientes GSA.\n4️⃣ *Notificações Push:* Avisos diretos na tela dos usuários.\n\n_Digite 3 para conversar com um consultor comercial de mídia!_\n_Digite 0 para voltar._`;
      sendWhatsAppReply(fromPhone, msg);
      return;
    } else if (text === '3') {
      const proto = generateProtocolNumber();
      session.state = 'HUMAN_AGENT_RELAY';
      session.supportDept = 'Comercial';
      session.supportAgent = 'CONSULTOR DE ANÚNCIOS GSA';
      session.protocol = proto;
      userSessions[fromPhone] = session;
      
      const adminNotify = `📢 *NOVA SOLICITAÇÃO DE ANÚNCIO*\n\n📱 *Cliente:* ${fromPhone}\n🔢 *Protocolo:* ${proto}\n\nO cliente deseja anunciar e aguarda contato do setor Comercial!`;
      sendWhatsAppReply(DEPARTMENT_PHONES['Comercial'], adminNotify);
      sendWhatsAppReply(fromPhone, `💬 *Transferindo para o Setor Comercial de Anúncios...*\n\n🔢 *Protocolo:* ${proto}\n\nEm instantes um consultor especializado enviará os formatos e propostas diretamente nesta conversa!\n\n_Digite 0 a qualquer momento para retornar ao menu._`);
      return;
    } else if (text === '4') {
      sendWhatsAppReply(fromPhone, '🌐 *Painel Web do Anunciante GSA HUB*\n\nPara gerenciar criativos, orçamentos e métricas em tempo real, acesse:\n🌐 https://gsahub.pages.dev/anunciante\n\n_Digite 0 para voltar._');
      return;
    } else if (text === '0') {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '💼 *Portais de Parceiros GSA HUB*');
      return;
    }
  }

  // ── ESTADO: REDE DE PARCEIROS HOMOLOGADOS ─────────────────────────────────
  if (session.state === 'PARTNER_NETWORK_MENU') {
    if (text === '1') {
      sendWhatsAppReply(fromPhone, '🔄 Consultando rede de empresas parceiras...');
      supabaseGet(`/rest/v1/parceiros?select=id,nome,categoria,descricao&limit=5`, (err, network) => {
        const list = Array.isArray(network) ? network : [];
        if (list.length === 0) {
          sendWhatsAppReply(fromPhone, '🌟 A GSA HUB conta com uma ampla rede de parceiros em todo o Brasil (Seguros, Saúde, Automotivo, Tecnologia e Logística).\n\n_Digite 2 para credenciar sua empresa!_\n_Digite 0 para voltar._');
          return;
        }
        let msg = '🌟 *Rede de Empresas Parceiras Credenciadas:*\n\n';
        list.forEach(p => {
          msg += `🏢 *${p.nome || 'Parceiro'}* (${p.categoria || 'Geral'})\n  ${p.descricao || ''}\n\n`;
        });
        msg += '_Digite 0 para voltar._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    } else if (text === '2') {
      session.state = 'PARTNER_NETWORK_REG_NAME';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '🤝 *Credenciamento de Empresa Parceira*\n\nPor favor, digite o *Nome da Empresa / Marca*:');
      return;
    } else if (text === '3') {
      const proto = generateProtocolNumber();
      session.state = 'HUMAN_AGENT_RELAY';
      session.supportDept = 'Comercial';
      session.supportAgent = 'DIRETORIA DE PARCERIAS B2B';
      session.protocol = proto;
      userSessions[fromPhone] = session;
      
      const adminNotify = `💼 *NOVO CONTATO DE PARCERIA B2B*\n\n📱 *Contato:* ${fromPhone}\n🔢 *Protocolo:* ${proto}\n\nA empresa deseja informações sobre parceria institucional!`;
      sendWhatsAppReply(DEPARTMENT_PHONES['Comercial'], adminNotify);
      sendWhatsAppReply(fromPhone, `💬 *Transferindo para a Diretoria de Parcerias B2B...*\n\n🔢 *Protocolo:* ${proto}\n\nEm instantes nosso executivo de parcerias iniciará o atendimento!\n\n_Digite 0 para retornar ao menu._`);
      return;
    } else if (text === '0') {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '💼 *Portais de Parceiros GSA HUB*');
      return;
    }
  }

  if (session.state === 'PARTNER_NETWORK_REG_NAME') {
    session.regNetwork = { nome: text.trim(), telefone: formatPhoneForSearch(fromPhone) };
    session.state = 'PARTNER_NETWORK_REG_SEGMENT';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '🏢 Digite o *Ramo de Atuação / Segmento* da sua empresa:');
    return;
  }

  if (session.state === 'PARTNER_NETWORK_REG_SEGMENT') {
    session.regNetwork.categoria = text.trim();
    session.regNetwork.status = 'analise';
    
    supabasePost('/rest/v1/parceiros', session.regNetwork, () => {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '✅ *Solicitação de Parceria B2B Registrada com Sucesso!*\n\nSua proposta de credenciamento foi encaminhada para a Diretoria Comercial.\n\n_Digite 0 para voltar._');
    });
    return;
  }

  // ── ESTADO: SUPORTE ESPECIALIZADO A PARCEIROS ──────────────────────────────
  if (session.state === 'PARTNER_SUPPORT_MENU') {
    const sectors = {
      '1': { dept: 'Suporte Afiliados', agent: 'SUPORTE AFILIADOS GSA' },
      '2': { dept: 'Suporte Fornecedores', agent: 'SUPORTE FORNECEDORES GSA' },
      '3': { dept: 'Suporte Parceiros', agent: 'SUPORTE PRESTADORES GSA' },
      '4': { dept: 'Comercial', agent: 'DIRETORIA DE PARCERIAS B2B' }
    };
    
    const choice = sectors[text.trim()];
    if (choice) {
      const protocolo = generateProtocolNumber();
      session.state = 'HUMAN_AGENT_RELAY';
      session.supportDept = choice.dept;
      session.supportAgent = choice.agent;
      session.protocol = protocolo;
      userSessions[fromPhone] = session;
      
      const adminNotify = `💬 *NOVO ATENDIMENTO HUMANO - PARCEIROS*\n\n📱 *Parceiro:* ${fromPhone}\n🏢 *Fila:* ${choice.dept}\n🔢 *Protocolo:* ${protocolo}`;
      const targetPhone = DEPARTMENT_PHONES[choice.dept] || '5511971858372';
          sendWhatsAppReply(fromPhone, `💬 *Atendimento Conectado!*\n\n🔢 *Protocolo:* ${protocolo}\n👨‍💼 *Atendente:* ${choice.agent}\n\nVocê já pode digitar sua mensagem ou dúvida abaixo!`);
      return;
    } else if (text === '0') {
      session.state = 'PARTNERS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '💼 *Portais de Parceiros GSA HUB*');
      return;
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida. Digite 1, 2, 3 ou 4.\n\n_Digite 0 para voltar._');
      return;
    }
  }

  // ── ESTADO: SELEÇÃO DE SETOR PARA ATENDIMENTO HUMANO ──────────────────────
  if (session.state === 'HUMAN_SUPPORT_DEPT') {
    const userInput = text.trim();

    supabaseGet('/rest/v1/gsa_whatsapp_ramais?order=ordem.asc', (errR, ramaisList) => {
      let matchedRamal = null;

      if (!errR && Array.isArray(ramaisList) && ramaisList.length > 0) {
        matchedRamal = ramaisList.find(r => {
          const numMatch = r.setor_nome.match(/^(\d+)/);
          const optionNumber = numMatch ? numMatch[1] : '';
          return optionNumber === userInput || r.codigo_setor === userInput || r.setor_nome.toLowerCase().includes(userInput.toLowerCase());
        });
      }

      // Se o ramal foi encontrado mas a chavinha no painel admin esta DESATIVADA (ativo === false):
      if (matchedRamal && matchedRamal.ativo === false) {
        sendWhatsAppReply(fromPhone, '⚠️ Atendente não disponível, tente outro setor.\n\n_Digite 0 para voltar ao menu principal._');
        return;
      }

      if (!matchedRamal) {
        const sectors = {
          '1': { dept: 'Comercial', agent: 'COMERCIAL GSA', phone: '5511971858372' },
          '2': { dept: 'Financeiro', agent: 'FINANCEIRO GSA', phone: '5511971858372' },
          '3': { dept: 'Dep. Pessoal', agent: 'DEP. PESSOAL GSA', phone: '5511971858372' },
          '5': { dept: 'Suporte Afiliados', agent: 'SUPORTE AFILIADOS GSA', phone: '5511920857756' },
          '6': { dept: 'Suporte Parceiros', agent: 'SUPORTE PARCEIROS GSA', phone: '5511920857756' },
          '7': { dept: 'Suporte Fornecedores', agent: 'SUPORTE FORNECEDORES GSA', phone: '5511920857756' },
          '8': { dept: 'SAC', agent: 'SAC GSA', phone: '5511971858372' }
        };
        const choice = sectors[userInput];
        if (!choice) {
          sendWhatsAppReply(fromPhone, '❌ Opção inválida. Por favor escolha uma das opções exibidas no menu.\n\n_Digite 0 para voltar ao menu._');
          return;
        }
        matchedRamal = { setor_nome: choice.dept, responsavel_nome: choice.agent, numero_whatsapp: choice.phone, ativo: true };
      }

      const protocolo = generateProtocolNumber();
      session.state = 'HUMAN_AGENT_RELAY';
      session.supportDept = matchedRamal.setor_nome;
      session.supportAgent = matchedRamal.responsavel_nome;
      session.protocolo = protocolo;
      userSessions[fromPhone] = session;

      sendWhatsAppReply(fromPhone, 'Aguarde, estamos transferindo o atendimento...');

      setTimeout(() => {
        sendWhatsAppReply(fromPhone, `Seu atendimento foi transferido com Sucesso\n📋 *Protocolo:* ${protocolo}`);

        // Roteamento & Notificação em tempo real para o WhatsApp do atendente responsável pelo setor!
        if (matchedRamal.numero_whatsapp && matchedRamal.numero_whatsapp !== fromPhone) {
          sendWhatsAppReply(matchedRamal.numero_whatsapp, `🚨 *NOVO ATENDIMENTO DE TRANSBORDO HUMANO*\n\n📱 *Cliente:* ${fromPhone}\n🏢 *Setor:* ${matchedRamal.setor_nome}\n📋 *Protocolo:* ${protocolo}\n\nO cliente aguarda atendimento no WhatsApp!`);
        }

        setTimeout(() => {
          const agentNameFormatted = matchedRamal.responsavel_nome.toUpperCase();
          sendWhatsAppReply(fromPhone, `*ATENDENTE ${agentNameFormatted}:*\nOlá, Seja Bem Vindo ao Atendimento da GSA HUB,\nComo podemos te ajudar ?`);
        }, 5000);
      }, 10000);
    });
    return;
  }

  // ── ESTADO: TRANSBORDO HUMANO MODO ESPELHO (RELAY) ─────────────────────────
  if (session.state === 'HUMAN_AGENT_RELAY') {
    const cleanT = text.trim().toLowerCase();
    if (cleanT === '0' || cleanT === 'menu' || cleanT === 'sair' || cleanT === 'cancelar' || cleanT === '#fim' || cleanT === '#encerrar') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '✅ Atendimento humano encerrado. Retornando ao menu principal...\n\n' + getMainMenuText(session.profile));
      return;
    }

    const dept = session.supportDept || 'Suporte Geral';
    const protocolo = session.protocolo || 'N/A';
    const targetAttendantPhone = DEPARTMENT_PHONES[dept] || '5511971858372';
    const clientName = (session.profile?.data?.nome || session.profile?.data?.nome_completo || 'Cliente').toUpperCase();

    // Notifica o atendente do setor com o número do protocolo
    const relayMsg = `📩 *[NOVA MENSAGEM - SETOR ${dept.toUpperCase()}]*\n📋 *Protocolo:* ${protocolo}\n👤 *Cliente:* ${clientName}\n📱 *WhatsApp:* ${fromPhone}\n💬 *Mensagem:* "${text}"\n\n_Para responder ao cliente, envie:_\n*#responder ${fromPhone} sua mensagem aqui*\n\n_Para encerrar este atendimento, envie:_\n*#encerrar ${fromPhone}*`;
    
    sendWhatsAppReply(targetAttendantPhone, relayMsg);
    console.log(`💬 [TRANSBORDO MODO ESPELHO - ${dept}] Protocolo ${protocolo} de ${fromPhone} repassado para o atendente ${targetAttendantPhone}`);
    return;
  }

  // ── ESTADO: TRAVEL_LIST ────────────────────────────────────────────────────
  if (session.state === 'TRAVEL_LIST') {
    const idx = parseInt(text, 10) - 1;
    const packages = session.travelPackages || [];
    if (isNaN(idx) || idx < 0 || idx >= packages.length) {
      sendWhatsAppReply(fromPhone, `❌ Opção inválida. Escolha um número de 1 a ${packages.length}.\n\n_Digite 0 para voltar._`);
      return;
    }
    session.selectedTravel = packages[idx];
    session.state = 'TRAVEL_PASSENGERS';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, `✈️ *Pacote:* ${session.selectedTravel.titulo}\n\nPara quantas pessoas (passageiros totais) seria essa viagem?\n\n_Digite apenas números (ex: 2)._\n_Digite 0 para cancelar._`);
    return;
  }

  // ── ESTADO: TRAVEL_PASSENGERS ──────────────────────────────────────────────
  if (session.state === 'TRAVEL_PASSENGERS') {
    const qtd = parseInt(text, 10);
    if (isNaN(qtd) || qtd <= 0) {
      sendWhatsAppReply(fromPhone, '❌ Quantidade inválida. Digite um número maior que 0.');
      return;
    }
    session.travelPassengers = qtd;
    autoInjectDocument(fromPhone, session, 'TRAVEL_DOC', `✅ Confirmado para ${qtd} passageiro(s)!\n\nPara vincularmos essa reserva/cotação ao seu cadastro, por favor digite seu *CPF ou CNPJ* (apenas números).\n\n_Digite 0 para cancelar._`);
    return;
  }

  // ── ESTADO: TRAVEL_DOC ─────────────────────────────────────────────────────
  if (session.state === 'TRAVEL_DOC') {
    const docClean = text.replace(/\\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Digite apenas os números (mínimo 11 dígitos).');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Registrando seu pacote de viagem...');
    fetchClientByDoc(docClean, (err, client) => {
      const clientId = client ? client.id : null;
      const pacote = session.selectedTravel;
      const protocolo = `VIAGEM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const viagemData = {
        cliente_id: clientId,
        pacote_id: pacote.id,
        protocolo: protocolo,
        adultos: session.travelPassengers,
        observacoes: `[Via WhatsApp] Solicitação para o pacote: ${pacote.titulo}`
      };
      
      supabasePost('/rest/v1/viagens_orcamentos', viagemData, (errV, resV) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        if (errV) {
          sendWhatsAppReply(fromPhone, '❌ Ocorreu um erro ao registrar a viagem. Tente novamente mais tarde.\n\n_Digite 0 para voltar._');
        } else {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, `✅ *Solicitação de Viagem Registrada!*\n\n📋 *Protocolo:* ${protocolo}\n✈️ *Destino/Pacote:* ${pacote.titulo}\n👥 *Passageiros:* ${session.travelPassengers}\n\nNossa equipe de turismo recebeu sua solicitação e entrará em contato para fechar as datas e finalizar os detalhes.\n\n🌟 *Como você avalia nosso atendimento automático neste momento? (Digite de 1 a 5)*`);
        }
      });
    });
    return;
  }

  // ── ESTADO: AFFILIATE_DOC ───────────────────────────────────────────────────
  if (session.state === 'AFFILIATE_DOC') {
    const docClean = text.replace(/\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Digite apenas os números.');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Buscando seu perfil de afiliado...');
    fetchClientByDoc(docClean, (err, client) => {
      if (!client) {
        session.state = 'PARTNERS';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '❌ Nenhum cadastro encontrado para este documento.\n\n_Digite 0 para voltar aos Portais de Parceiros._');
        return;
      }
      
      supabaseGet(`/rest/v1/gsa_afiliados?cliente_id=eq.${client.id}&select=*`, (errA, resA) => {
        if (errA || !resA || resA.length === 0) {
          session.tempClientId = client.id;
          session.tempClientName = client.nome || client.nome_completo || 'Afiliado GSA';
          session.state = 'PARTNER_AFFILIATE_ACTIVATE_PROMPT';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, '🤝 *Portal do Afiliado GSA HUB*\n\nVocê ainda não ativou seu perfil de Afiliado!\n\nDeseja ativar seu perfil gratuitamente agora mesmo para ganhar comissões por indicações?\n\n1️⃣ ✅ Sim, Quero me Tornar um Afiliado\n0️⃣ ⬅️ Voltar aos Portais de Parceiros');
          return;
        }
        
        const afiliado = resA[0];
        const status = afiliado.status === 'ativo' ? '✅ Ativo' : '⚠️ ' + String(afiliado.status || 'Pendente').toUpperCase();
        
        session.affiliateData = afiliado;
        session.state = 'PARTNER_AFFILIATE_MENU';
        userSessions[fromPhone] = session;
        
        const nome = formatBoldName(afiliado.nome_divulgacao || client.nome || 'Afiliado');
        const menuMsg = `🤝 *Portal do Afiliado GSA HUB*\nOlá, *${nome}*! (${status})\n\n1️⃣ 🔗 Meus Links de Indicação\n2️⃣ 💰 Consultar Comissões e Extrato\n3️⃣ 💸 Solicitar Saque PIX\n4️⃣ 📢 Material de Divulgação\n0️⃣ ⬅️ Voltar aos Portais de Parceiros\n\n_Digite o número da opção desejada:_`;
        
        sendWhatsAppReply(fromPhone, menuMsg);
      });
    });
    return;
  }

  // ── ESTADO: INSURANCE_TYPE (COTAÇÃO) ───────────────────────────────────────
  if (session.state === 'INSURANCE_TYPE') {
    session.insuranceType = text;
    session.state = 'INSURANCE_DETAILS';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '✅ Tipo de seguro selecionado!\n\nAgora, descreva brevemente o que você precisa (ex: "seguro para auto ano 2020", "seguro de vida familiar").');
    return;
  }

  if (session.state === 'INSURANCE_DETAILS') {
    session.insuranceDetails = text;
    session.state = 'INSURANCE_DOC';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, '✅ Detalhes registrados.\n\nPara prosseguirmos com a cotação, digite seu *CPF ou CNPJ* (apenas números).\n\n_Digite 0 para cancelar._');
    return;
  }

  if (session.state === 'INSURANCE_DOC') {
    const docClean = text.replace(/\\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Digite apenas os números.');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Gerando solicitação de cotação...');
    fetchClientByDoc(docClean, (err, client) => {
      const clientId = client ? client.id : null;
      const orcCod = 'ORC-' + Math.floor(100000 + Math.random() * 900000);
      
      const orcData = {
        codigo_orcamento: orcCod,
        cliente_id: clientId,
        categoria: 'servico',
        total: 0,
        status: 'aberto',
        observacoes_servico: `[Cotação de Seguro via WhatsApp]\nTipo: ${session.insuranceType}\nDetalhes fornecidos pelo cliente: ${session.insuranceDetails}`,
        data_criacao: new Date().toISOString()
      };
      
      supabasePost('/rest/v1/orcamentos', orcData, (errO, resO) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        if (errO) {
          sendWhatsAppReply(fromPhone, '❌ Erro ao enviar a cotação. Tente novamente.\n\n_Digite 0 para voltar._');
        } else {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, `✅ *Cotação de Seguro Registrada!*\n\n📋 *Código:* ${orcCod}\n🛡️ *Tipo:* ${session.insuranceType}\n📊 *Status:* Em análise pelos corretores\n\nPronto! Nossos especialistas já receberam seus dados e apresentarão as melhores opções do mercado para você em breve.\n\n🌟 *Como você avalia nosso atendimento automático neste momento? (Digite de 1 a 5)*`);
        }
      });
    });
    return;
  }

  // ── ESTADO: CLASSIFIED_SELECT ──────────────────────────────────────────────
  if (session.state === 'CLASSIFIED_SELECT') {
    const idx = parseInt(text, 10) - 1;
    const ads = session.classifiedAds || [];
    if (isNaN(idx) || idx < 0 || idx >= ads.length) {
      sendWhatsAppReply(fromPhone, `❌ Opção inválida. Escolha um número de 1 a ${ads.length}.\n\n_Digite 0 para voltar._`);
      return;
    }
    session.selectedAd = ads[idx];
    session.state = 'CLASSIFIED_PROPOSAL';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, `📢 *Anúncio:* ${session.selectedAd.titulo}\n💰 *Valor:* R$ ${session.selectedAd.preco?.toFixed(2)}\n\nEscreva sua proposta ou mensagem de interesse para este anúncio (mínimo de 10 caracteres).\n\n_Digite 0 para cancelar._`);
    return;
  }

  // ── ESTADO: CLASSIFIED_PROPOSAL ────────────────────────────────────────────
  if (session.state === 'CLASSIFIED_PROPOSAL') {
    if (text.length < 10) {
      sendWhatsAppReply(fromPhone, '❌ Sua proposta é muito curta. Por favor, detalhe melhor (mínimo 10 caracteres).');
      return;
    }
    session.classifiedProposal = text;
    session.state = 'CLASSIFIED_DOC';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, `✅ Proposta anotada!\n\nPara enviarmos essa proposta à moderação da GSA e conectarmos você ao vendedor, digite seu *CPF ou CNPJ* (apenas números).\n\n_Digite 0 para cancelar._`);
    return;
  }

  // ── ESTADO: CLASSIFIED_DOC ─────────────────────────────────────────────────
  if (session.state === 'CLASSIFIED_DOC') {
    const docClean = text.replace(/\\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Digite apenas os números.');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Registrando sua proposta...');
    fetchClientByDoc(docClean, (err, client) => {
      const clientId = client ? client.id : null;
      const ad = session.selectedAd;
      
      const description = [
        'Solicitação de proposta moderada pelos Classificados GSA (Via WhatsApp).',
        '',
        `Anúncio: ${ad.titulo}`,
        `Código do anúncio: ${ad.id}`,
        `Valor anunciado: R$ ${ad.preco?.toFixed(2)}`,
        '',
        'Mensagem do comprador:',
        session.classifiedProposal,
        '',
        'A negociação deve permanecer dentro dos canais da GSA até a liberação administrativa.'
      ].join('\\n');
      
      const ticketData = {
        cliente_id: clientId,
        assunto: `Proposta Classificados: ${ad.titulo}`,
        descricao: description,
        status: 'aberto'
      };
      
      supabasePost('/rest/v1/tickets', ticketData, (errT, resT) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        if (errT) {
          sendWhatsAppReply(fromPhone, '❌ Ocorreu um erro ao enviar sua proposta. Tente novamente mais tarde.\n\n_Digite 0 para voltar._');
        } else {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, `✅ *Proposta Enviada com Sucesso!*\n\n📋 *Anúncio:* ${ad.titulo}\n🛡️ A moderação da GSA analisará sua proposta e o colocará em contato direto com o vendedor pelo sistema seguro.\n\n🌟 *Como você avalia nosso atendimento automático neste momento? (Digite de 1 a 5)*`);
        }
      });
    });
    return;
  }

  // ── ESTADO: AFFILIATE_DOC ───────────────────────────────────────────────────
  if (session.state === 'AFFILIATE_DOC') {
    const docClean = text.replace(/\\D/g, '');
    if (docClean.length < 11) {
      sendWhatsAppReply(fromPhone, '❌ CPF ou CNPJ inválido. Digite apenas os números.');
      return;
    }
    sendWhatsAppReply(fromPhone, '🔄 Buscando seu perfil de afiliado...');
    fetchClientByDoc(docClean, (err, client) => {
      if (!client) {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, '❌ Nenhum cadastro de cliente encontrado para este documento. Utilize a opção 2 no menu principal para criar seu cadastro.\n\n_Digite 0 para voltar._');
        return;
      }
      
      supabaseGet(`/rest/v1/gsa_afiliados?cliente_id=eq.${client.id}&select=*`, (errA, resA) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        
        if (errA || !resA || resA.length === 0) {
          sendWhatsAppReply(fromPhone, '🤝 *Portal do Afiliado GSA HUB*\n\nVocê ainda não ativou seu perfil de Afiliado!\n\nAcesse nosso painel web, vá em "Minha Conta -> Fidelidade -> Afiliados" e ative agora mesmo para começar a ganhar comissões por indicações.\n\n🌐 https://gsahub.pages.dev/\n\n_Digite 0 para voltar ao menu principal._');
          return;
        }
        
        const afiliado = resA[0];
        const status = afiliado.status === 'ativo' ? '✅ Ativo' : '⚠️ ' + afiliado.status.toUpperCase();
        const link = `https://gsahub.pages.dev/?ref=${afiliado.codigo_publico}`;
        
        sendWhatsAppReply(fromPhone, `🤝 *Seu Painel de Afiliado*\n\n👤 *Nome:* ${afiliado.nome_divulgacao}\n📊 *Status:* ${status}\n\n🔗 *Seu Link Padrão de Indicação:*\n${link}\n\nCopie e envie esse link para seus contatos! Qualquer compra ou contratação feita por ele gerará comissões para você.\n\nPara ver saldos e solicitar saques, acesse o painel web.\n\n_Digite 0 para voltar ao menu principal._`);
      });
    });
    return;
  }

  // ── ESTADO: CLIENT_DASHBOARD_MENU ──────────────────────────────────────────
  if (session.state === 'CLIENT_DASHBOARD_MENU') {
    const client = session.clientData;
    if (!client) {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '❌ Sessão expirada.\n\n_Digite 0 para voltar ao menu._');
      return;
    }

    if (text === '1') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando suas faturas em aberto...');
      fetchClientFaturas(client.id, (err, faturas) => {
        if (err || faturas.length === 0) {
          sendWhatsAppReply(fromPhone, '✅ Você não tem faturas em aberto ou pendentes no momento.\n\n_Digite 0 para voltar ao menu principal._');
          return;
        }
        session.currentFaturas = faturas;

        // Se houver apenas 1 fatura pendente, auto-seleciona e envia o PDF imediatamente
        if (faturas.length === 1) {
          const selectedFat = faturas[0];
          session.selectedFatura = selectedFat;
          session.state = 'SELECT_PAYMENT_METHOD';
          userSessions[fromPhone] = session;

          const cod = selectedFat.codigo_fatura || `Fat-#${String(selectedFat.id).substring(0,6)}`;
          const venc = selectedFat.data_vencimento ? new Date(selectedFat.data_vencimento).toLocaleDateString('pt-BR') : 'N/A';
          const valor = Number(selectedFat.valor_total || 0).toFixed(2);

          const pdfBase64 = generateInvoicePdfBase64(selectedFat, client);

          sendWhatsAppReply(fromPhone, `📄 Localizamos 1 fatura pendente (*${cod}* - R$ ${valor}). Gerando e enviando o PDF...`);
          sendWhatsAppMedia(fromPhone, pdfBase64, `Fatura_${cod}.pdf`, `PDF da Fatura ${cod}`, 'document');

          setTimeout(() => {
            const msg = `💳 *Pagamento da Fatura ${cod}*\n\n💰 *Valor Total:* R$ ${valor}\n📅 *Vencimento:* ${venc}\n\nComo deseja realizar o pagamento (via InfinitePay)?\n\n1️⃣ 🟢 *PIX* (Gerar QR Code + Código Copia e Cola)\n2️⃣ 💳 *Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\n\n_Digite 1 para PIX ou 2 para Cartão de Crédito._\n_Digite 0 para voltar ao menu._`;
            sendWhatsAppReply(fromPhone, msg);
          }, 1500);
          return;
        }

        // Se houver mais de 1 fatura, solicita a escolha
        session.state = 'SELECT_FATURA_TO_PAY';
        userSessions[fromPhone] = session;

        let msg = '📄 *Suas Faturas Pendentes:*\n\n';
        faturas.forEach((fat, idx) => {
          const cod = fat.codigo_fatura || `Fat-#${String(fat.id).substring(0,6)}`;
          const venc = fat.data_vencimento ? new Date(fat.data_vencimento).toLocaleDateString('pt-BR') : 'N/A';
          msg += `*${idx+1}.* ${cod}\n💰 Valor: R$ ${(fat.valor_total || 0).toFixed(2)}\n📅 Vence em: ${venc}\n📌 Status: ${(fat.status || 'pendente').toUpperCase()}\n\n`;
        });
        msg += '_Digite o número da fatura para visualizar o PDF e escolher a forma de pagamento (ex: 1)._\n_Digite 0 para voltar ao menu._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    }
    
    if (text === '2') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando suas Ordens de Serviço...');
      fetchClientOS(client.id, (err, osList) => {
        if (err || osList.length === 0) {
          sendWhatsAppReply(fromPhone, '✅ Você não tem Ordens de Serviço em andamento no momento.\n\n_Digite 0 para voltar ao menu principal._');
          return;
        }
        let msg = '🛠️ *Ordens de Serviço (Em Andamento):*\n\n';
        osList.forEach((os, idx) => {
          const cod = os.codigo_os || `OS-#${String(os.id).substring(0,6)}`;
          msg += `*${idx+1}.* ${cod}\n📌 Status: ${(os.status || 'em_andamento').toUpperCase()}\n\n`;
        });
        msg += '_Digite 0 para voltar ou (1-5) para outro menu._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    }
    
    if (text === '3') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando seus orçamentos...');
      fetchClientOrcamentos(client.id, (err, orcs) => {
        if (err || orcs.length === 0) {
          sendWhatsAppReply(fromPhone, '✅ Nenhum orçamento em aberto no momento.\n\n_Digite 0 para voltar ao menu principal._');
          return;
        }
        let msg = '📋 *Seus Orçamentos (Em Aberto):*\n\n';
        orcs.forEach((orc, idx) => {
          const cod = orc.codigo_orcamento || `ORC-#${String(orc.id).substring(0,6)}`;
          msg += `*${idx+1}.* ${cod}\n📌 Status: ${(orc.status || 'aberto').toUpperCase()}\n💰 Valor Estimado: R$ ${(orc.total||0).toFixed(2)}\n\n`;
        });
        msg += '_Digite 0 para voltar ou (1-5) para outro menu._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    }
    
    if (text === '4') {
      sendWhatsAppReply(fromPhone, '🔄 Buscando suas assinaturas...');
      fetchClientAssinaturas(client.id, (err, asList) => {
        if (err || asList.length === 0) {
          sendWhatsAppReply(fromPhone, '✅ Você não possui assinaturas ativas no momento.\n\n_Digite 0 para voltar ao menu principal._');
          return;
        }
        let msg = '🔄 *Suas Assinaturas (Ativas):*\n\n';
        asList.forEach((ass, idx) => {
          const cod = ass.codigo_assinatura || `ASS-#${String(ass.id).substring(0,6)}`;
          msg += `*${idx+1}.* ${cod}\n📌 Status: ATIVA\n💰 Mensalidade: R$ ${(ass.valor||0).toFixed(2)}\n\n`;
        });
        msg += '_Digite 0 para voltar ou (1-5) para outro menu._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    }
    
    if (text === '5') {
      session.state = 'CLIENT_TICKETS_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '🎫 *Suporte e Chamados GSA*\n\n1️⃣ 📝 Abrir Novo Chamado\n2️⃣ 🔍 Consultar Meus Chamados\n\n_Digite 0 para voltar ao menu._');
      return;
    }
    
    if (text === '0') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    }
    
    sendWhatsAppReply(fromPhone, '❌ Opção inválida.\n\n*Opções disponíveis:*\n1️⃣ Faturas em Aberto\n2️⃣ Ordens de Serviço\n3️⃣ Meus Orçamentos\n4️⃣ Minhas Assinaturas\n5️⃣ Tickets de Suporte\n0️⃣ Sair\n\n_Digite o número desejado:_');
    return;
  }

  // ── ESTADO: CLIENT_TICKETS_MENU ────────────────────────────────────────────────
  if (session.state === 'CLIENT_TICKETS_MENU') {
    if (text === '1') {
      session.state = 'CLIENT_NEW_TICKET_MSG';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '📝 *Abrir Novo Chamado*\n\nPor favor, digite em uma única mensagem qual é o problema ou solicitação. Se quiser, pode enviar uma foto detalhando o caso.\n\n_Ex: Meu sistema está lento..._\n\n_Digite 0 para cancelar._');
      return;
    }
    if (text === '2') {
      const client = session.clientData;
      sendWhatsAppReply(fromPhone, '🔄 Buscando seus tickets de suporte...');
      fetchClientTickets(client.id, (err, tickets) => {
        if (err || tickets.length === 0) {
          sendWhatsAppReply(fromPhone, '✅ Nenhum ticket de suporte em aberto no momento.\n\n_Digite 0 para voltar._');
          return;
        }
        let msg = '🎫 *Seus Tickets (Em Aberto):*\n\n';
        tickets.forEach((t, idx) => {
          const cod = t.protocolo || `TKT-${String(t.id).substring(0,6)}`;
          msg += `*${idx+1}.* Protocolo: ${cod}\n📌 Assunto: ${t.assunto}\n⚠️ Status: ${t.status.toUpperCase()}\n\n`;
        });
        msg += '_Digite 0 para voltar ao menu._';
        sendWhatsAppReply(fromPhone, msg);
      });
      return;
    }
    if (text === '0') {
      session.state = 'CLIENT_DASHBOARD_MENU';
      userSessions[fromPhone] = session;
      const rawNome = session.clientData.nome || session.clientData.nome_completo || session.clientData.razao_social || 'Cliente GSA';
      const nome = formatBoldName(rawNome);
      const saldoPts = session.clientData.saldo_pontos || session.clientData.pontos_fidelidade || 0;
      const saldoCarteira = session.clientData.saldo_carteira || session.clientData.saldo_disponivel || 0;
      const nivel = session.clientData.nivel_manual_info || (session.clientData.is_vip ? 'VIP' : 'Padrão GSA');
      sendWhatsAppReply(fromPhone, `👤 *Área do Cliente GSA HUB*\nOlá, *${nome}*! (🏆 ${nivel})\n\n💰 Saldo: R$ ${Number(saldoCarteira).toFixed(2)}\n⭐ Pontos: ${saldoPts}\n\n*O que você deseja consultar?*\n1️⃣ 📄 Faturas em Aberto\n2️⃣ 🛠️ Ordens de Serviço\n3️⃣ 📋 Meus Orçamentos\n4️⃣ 🔄 Minhas Assinaturas\n5️⃣ 🎫 Tickets de Suporte\n0️⃣ Sair\n\n_Digite o número desejado:_`);
      return;
    }
    sendWhatsAppReply(fromPhone, '❌ Opção inválida.\n\n1️⃣ 📝 Abrir Novo Chamado\n2️⃣ 🔍 Consultar Meus Chamados\n0️⃣ Voltar');
    return;
  }

  // ── ESTADO: CLIENT_NEW_TICKET_MSG ──────────────────────────────────────────────
  if (session.state === 'CLIENT_NEW_TICKET_MSG') {
    if (text === '0') {
      session.state = 'CLIENT_TICKETS_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '🎫 *Suporte e Chamados GSA*\n\n1️⃣ 📝 Abrir Novo Chamado\n2️⃣ 🔍 Consultar Meus Chamados\n\n_Digite 0 para voltar ao menu._');
      return;
    }
    
    let assunto = text;
    if (messageType === 'imageMessage') {
      assunto = "Anexo de Imagem recebido via WhatsApp: " + (text || "");
    }

    sendWhatsAppReply(fromPhone, '⏳ Aguarde, estamos registrando seu chamado...');
    
    const protocolo = 'TKT-' + Math.floor(Math.random() * 1000000);
    const payload = {
      cliente_id: session.clientData.id,
      assunto: assunto.substring(0, 100) + (assunto.length > 100 ? '...' : ''),
      descricao: assunto,
      status: 'aberto',
      prioridade: 'media',
      origem: 'whatsapp',
      protocolo: protocolo
    };
    
    supabasePost('/rest/v1/tickets', payload, (err, res) => {
      session.state = 'CLIENT_TICKETS_MENU';
      userSessions[fromPhone] = session;
      if (err) {
         sendWhatsAppReply(fromPhone, '❌ Ocorreu um erro ao abrir seu chamado. Tente novamente mais tarde.\n\n_Digite 0 para voltar._');
      } else {
         sendWhatsAppReply(fromPhone, `✅ *Chamado Aberto com Sucesso!*\n\nProtocolo: *${protocolo}*\nNossa equipe técnica já foi notificada e entrará em contato em breve.\n\n_Digite 0 para voltar._`);
      }
    });
    return;
  }

  // ── ESTADO: SELECT_FATURA_TO_PAY ──────────────────────────────────────────
  if (session.state === 'SELECT_FATURA_TO_PAY') {
    const idx = parseInt(text, 10) - 1;
    const faturas = session.currentFaturas || [];
    if (isNaN(idx) || idx < 0 || idx >= faturas.length) {
      sendWhatsAppReply(fromPhone, `❌ Opção inválida. Escolha um número de 1 a ${faturas.length}.\n\n_Digite 0 para voltar._`);
      return;
    }

    const selectedFat = faturas[idx];
    session.selectedFatura = selectedFat;
    session.state = 'SELECT_PAYMENT_METHOD';
    userSessions[fromPhone] = session;

    const cod = selectedFat.codigo_fatura || `Fat-#${String(selectedFat.id).substring(0,6)}`;
    const venc = selectedFat.data_vencimento ? new Date(selectedFat.data_vencimento).toLocaleDateString('pt-BR') : 'N/A';
    const valor = Number(selectedFat.valor_total || 0).toFixed(2);

    const pdfBase64 = generateInvoicePdfBase64(selectedFat, session.clientData);

    sendWhatsAppReply(fromPhone, `📄 Gerando e enviando o documento PDF da fatura *${cod}*...`);
    sendWhatsAppMedia(fromPhone, pdfBase64, `Fatura_${cod}.pdf`, `PDF da Fatura ${cod}`, 'document');

    setTimeout(() => {
      const msg = `💳 *Pagamento da Fatura ${cod}*\n\n💰 *Valor Total:* R$ ${valor}\n📅 *Vencimento:* ${venc}\n\nComo deseja realizar o pagamento (via InfinitePay)?\n\n1️⃣ 🟢 *PIX* (Gerar QR Code + Código Copia e Cola)\n2️⃣ 💳 *Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\n\n_Digite 1 para PIX ou 2 para Cartão de Crédito._\n_Digite 0 para voltar ao menu._`;
      sendWhatsAppReply(fromPhone, msg);
    }, 1500);

    return;
  }

  // ── ESTADO: SELECT_PAYMENT_METHOD ─────────────────────────────────────────
  if (session.state === 'SELECT_PAYMENT_METHOD') {
    const fat = session.selectedFatura;
    if (!fat) {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '❌ Erro ao localizar fatura. Retornando ao menu...');
      return;
    }

    const cod = fat.codigo_fatura || `Fat-#${String(fat.id).substring(0,6)}`;
    const valor = Number(fat.valor_total || 0).toFixed(2);

    if (text === '1') {
      sendWhatsAppReply(fromPhone, '🔄 Gerando PIX Copia e Cola e QR Code via InfinitePay...');
      
      const edgePayload = { fatura_id: fat.id, cliente_id: fat.cliente_id, valor_liquido: fat.valor_total, payment_method: 'pix' };
      const edgeOptions = {
        hostname: SUPABASE_HOST,
        port: 443,
        path: '/functions/v1/generate-payment-link',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const reqE = https.request(edgeOptions, (resE) => {
        let dE = '';
        resE.on('data', c => { dE += c; });
        resE.on('end', () => {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;

          try {
            const parsed = JSON.parse(dE);
            const pixCode = parsed.pix_code || parsed.pix_copia_cola || parsed.pixCode || null;
            const qrCodeUrl = parsed.qr_code_url || parsed.qrcode_url || null;

            if (pixCode) {
              sendWhatsAppReply(fromPhone, `🟢 *PIX Copia e Cola (Fatura ${cod}):*`);
              sendWhatsAppReply(fromPhone, pixCode);

              if (qrCodeUrl) {
                sendWhatsAppMedia(fromPhone, qrCodeUrl, `qrcode_${cod}.png`, `QR Code PIX - R$ ${valor}`, 'image');
              }

              setTimeout(() => {
                sendWhatsAppReply(fromPhone, `⚡ *Pagamento Instantâneo!*\nAssim que você efetuar o pagamento no seu banco, o sistema confirmará automaticamente.\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
              }, 2000);
            } else if (parsed.link) {
              sendWhatsAppReply(fromPhone, `🟢 *Pague via PIX pelo Link Seguro InfinitePay:*\n👉 ${parsed.link}\n\n⚡ A confirmação é instantânea!\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
            } else {
              sendWhatsAppReply(fromPhone, `🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\n💰 *Valor:* R$ ${valor}\n\nAssim que pago, envie o comprovante por aqui.\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
            }
          } catch (e) {
            sendWhatsAppReply(fromPhone, `🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\n💰 *Valor:* R$ ${valor}\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
          }
        });
      });
      reqE.on('error', () => {
        session.state = 'NPS_RATING';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\n💰 *Valor:* R$ ${valor}\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
      });
      reqE.write(JSON.stringify(edgePayload));
      reqE.end();
      return;

    } else if (text === '2') {
      sendWhatsAppReply(fromPhone, '🔄 Gerando link seguro para Cartão de Crédito via InfinitePay...');
      
      const edgePayload = { fatura_id: fat.id, cliente_id: fat.cliente_id, valor_liquido: fat.valor_total, payment_method: 'credit_card' };
      const edgeOptions = {
        hostname: SUPABASE_HOST,
        port: 443,
        path: '/functions/v1/generate-payment-link',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const reqE = https.request(edgeOptions, (resE) => {
        let dE = '';
        resE.on('data', c => { dE += c; });
        resE.on('end', () => {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;

          try {
            const parsed = JSON.parse(dE);
            const link = parsed.link || null;
            if (link) {
              sendWhatsAppReply(fromPhone, `💳 *Link de Pagamento com Cartão (InfinitePay):*\n\n👉 ${link}\n\nVocê pode parcelar diretamente no checkout!\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
            } else {
              sendWhatsAppReply(fromPhone, `💳 Acesse nosso portal para pagar com cartão:\nhttps://gsahub.pages.dev/\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
            }
          } catch (e) {
            sendWhatsAppReply(fromPhone, `💳 Acesse nosso portal para pagar com cartão:\nhttps://gsahub.pages.dev/\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
          }
        });
      });
      reqE.on('error', () => {
        session.state = 'NPS_RATING';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `💳 Acesse nosso portal para pagar com cartão:\nhttps://gsahub.pages.dev/\n\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*`);
      });
      reqE.write(JSON.stringify(edgePayload));
      reqE.end();
      return;
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida. Digite 1 para PIX ou 2 para Cartão de Crédito (ou 0 para voltar).');
      return;
    }
  }

  // ── ESTADO: NPS_RATING (Módulo 6 — NPS com análise de sentimento) ───────────
  if (session.state === 'NPS_RATING') {
    const nota = parseInt(text, 10);
    const clientName = session.clientName || 'cliente';
    session.state = 'MAIN_MENU';
    userSessions[fromPhone] = session;
    
    if (!isNaN(nota) && nota >= 1 && nota <= 5) {
      if (nota <= 2) {
        // ── Nota BAIXA: pedir desculpas + alerta VIP ao admin ──────────────────
        sendWhatsAppReply(fromPhone, `😔 *Poxa, ${clientName}...*\n\nLamentamos muito que sua experiência não tenha sido das melhores! Sua nota *${nota}/5* é muito importante para continuarmos melhorando.\n\n🚀 Um de nossos atendentes especialistas vai entrar em contato com você em breve para resolver qualquer pendência com prioridade máxima!\n\n_Obrigado por nos dar a chance de melhorar!_ 🙏\n\n${MAIN_MENU_TEXT}`);
        
        notifyAdmin(`🚨 *ALERTA NPS — NOTA CRÍTICA!* 🚨\n\n⭐ *Nota:* ${nota}/5\n👤 *Cliente:* ${clientName} (${fromPhone})\n📦 *Último produto:* ${session.lastOrderProduct || 'N/A'}\n\n*⚡ AÇÃO URGENTE: Entre em contato imediatamente para reverter a experiência negativa!*`);

      } else if (nota >= 4) {
        // ── Nota ALTA: agradecimento + convite Indique & Ganhe ─────────────────
        sendWhatsAppReply(fromPhone, `🌟 *Uau, ${clientName}! Nota ${nota}/5 — INCRÍVEL!*\n\nMuito obrigado pela confiança e pelo carinho! Isso nos motiva a continuar entregando o melhor! 🚀\n\n🤝 *Quer ganhar dinheiro indicando o GSA HUB?*\nTemos um Programa de Afiliados onde você ganha comissão por cada indicação que comprar ou contratar nossos serviços!\n\nDigite *AFILIADO* para saber mais ou acesse:\n👉 ${GSA_EMPRESA.site}/afiliados\n\n${MAIN_MENU_TEXT}`);

      } else {
        // ── Nota MÉDIA (3): agradecimento simples ──────────────────────────────
        sendWhatsAppReply(fromPhone, `Obrigado por avaliar com a nota ${nota}/5! 🙏\nVamos continuar trabalhando para melhorar ainda mais e oferecer uma experiência 5 estrelas!\n\n${MAIN_MENU_TEXT}`);
      }

      // Salvar NPS no banco de forma assíncrona
      supabasePost('/rest/v1/nps_avaliacoes', {
        telefone: fromPhone,
        nome: clientName,
        nota: nota,
        produto: session.lastOrderProduct || null,
        variacao: session.lastOrderVariation || null,
        valor_pedido: session.lastOrderTotal || null,
        created_at: new Date().toISOString()
      }, () => {});

    } else {
      sendWhatsAppReply(fromPhone, `Agradecemos pelo seu tempo! Retornando ao menu principal...\n\n${MAIN_MENU_TEXT}`);
    }
    return;
  }

  // ── ESTADO: AWAITING_NAME (IA pediu o nome do cliente) ───────────────────────
  if (session.state === 'AWAITING_NAME') {
    if (text === '0') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    }
    // Pega só o primeiro nome, capitalizado
    const nome = text.trim().split(/\s+/)[0];
    session.clientName = nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
    session.state = 'MAIN_MENU';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, `Prazer, *${session.clientName}*! 😊\n\n${getMainMenuText(session.profile)}`);
    return;
  }

  // ── ESTADO: AI_TICKET_COLLECT (coleta detalhes para ticket de item inexistente) ──
  if (session.state === 'AI_TICKET_COLLECT') {
    const normalized = text.toLowerCase().trim();

    if (text === '0' || normalized === 'cancelar') {
      session.state = 'MAIN_MENU';
      delete session.aiTicketReason;
      delete session.aiTicketDetails;
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `Tudo bem! Solicitação cancelada. 😊\n\n${MAIN_MENU_TEXT}`);
      return;
    }

    // Registra detalhe enviado (texto ou mídia)
    if (!session.aiTicketDetails) session.aiTicketDetails = [];

    if (mediaType) {
      session.aiTicketDetails.push(`[Mídia: ${mediaType}]`);
      sendWhatsAppReply(fromPhone, `📎 *${mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Áudio' : mediaType === 'video' ? 'Vídeo' : 'Arquivo'}* recebido! ✅\n\nAdicione mais detalhes se quiser, ou digite *pronto* para finalizar.`);
    } else if (text) {
      session.aiTicketDetails.push(text);
    }

    if (normalized === 'pronto' || normalized === 'ok' || normalized === 'enviar' || normalized === 'finalizar') {
      // Criar o ticket agora
      const assunto = `Solicitação de Novo Item: ${(session.aiTicketReason || 'Item não disponível').substring(0, 80)}`;
      const detalhes = session.aiTicketDetails.filter(d => !d.startsWith('[Mídia')).join('\n');
      const midias = session.aiTicketDetails.filter(d => d.startsWith('[Mídia')).join(', ');
      const descricao = [
        session.aiTicketReason || 'Solicitação via WhatsApp IA',
        detalhes ? `\nDetalhes adicionais:\n${detalhes}` : '',
        midias ? `\nMídias enviadas: ${midias}` : ''
      ].join('');

      sendWhatsAppReply(fromPhone, '⏳ Registrando sua solicitação...');
      createAITicket(fromPhone, session, assunto, descricao, (err, ticket) => {
        const protocolo = ticket?.protocolo || 'TKT-GSA';
        const clientName = session.clientName || session.clientData?.nome || 'Cliente';
        session.state = 'NPS_RATING';
        delete session.aiTicketReason;
        delete session.aiTicketDetails;
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `✅ *Solicitação Registrada!*\n\n🎫 Protocolo: *${protocolo}*\n👤 Nome: ${clientName}\n📱 WhatsApp: ${fromPhone}\n📌 Item: ${assunto.replace('Solicitação de Novo Item: ', '')}\n\nNossa equipe analisará e entrará em contato em breve! 🚀\n\n🌟 Como você avalia nosso atendimento? _(Digite de 1 a 5)_`);
      });
    } else if (!mediaType) {
      // Confirma recebimento do texto e aguarda mais
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `📝 Anotado! Pode enviar mais detalhes, uma foto 📷, áudio 🎙️ ou vídeo 🎥.\n\nQuando terminar, digite *pronto* para finalizar.`);
    }
    return;
  }

  // ── ESTADO: SERVICE_INTEREST (cliente interessado em serviço encontrado pela IA) ──
  if (session.state === 'SERVICE_INTEREST') {
    if (text === '0') {
      session.state = 'MAIN_MENU';
      delete session.aiFoundService;
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    }
    const item = session.aiFoundService || {};
    if (text === '1') {
      // Redireciona para o fluxo de contratação de serviços
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `✅ Ótimo! Vou te encaminhar para a contratação do serviço *${item.nome || ''}*.\n\nUm de nossos especialistas entrará em contato em breve.\n\n📱 WhatsApp: wa.me/5511920857756\n🌐 Site: ${GSA_EMPRESA.site}`);
    } else if (text === '2') {
      // Conectar com especialista
      session.state = 'HUMAN_SUPPORT_DEPT';
      session.errors = 0;
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `💬 Vou te conectar com um especialista em *${item.nome || 'nossos serviços'}*!\n\n👉 https://wa.me/5511920857756`);
    } else {
      sendWhatsAppReply(fromPhone, `Por favor, escolha:\n1️⃣ ✅ Contratar agora\n2️⃣ 💬 Falar com especialista\n0️⃣ Voltar ao menu`);
    }
    return;
  }

  // ── ESTADO: PRODUCT_INTEREST (cliente interessado em produto encontrado pela IA) ──
  if (session.state === 'PRODUCT_INTEREST') {
    if (text === '0') {
      session.state = 'MAIN_MENU';
      delete session.aiFoundProduct;
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    }
    const prod = session.aiFoundProduct || {};
    if (text === '1') {
      session.state = 'STORE';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `🛒 Perfeito! Vou te encaminhar para nossa loja.\n\nProduto: *${prod.nome || ''}*\nValor: R$ ${Number(prod.valor || 0).toFixed(2)}\n\n🌐 ${GSA_EMPRESA.site}/marketplace\n\nOu continue navegando pela loja aqui mesmo:\n1️⃣ 🛒 Ver Vitrine\n2️⃣ 🔥 Promoções\n0️⃣ Menu Principal`);
    } else if (text === '2') {
      sendWhatsAppReply(fromPhone, `ℹ️ *${prod.nome || 'Produto'}*\n${prod.descricao || ''}\n💰 Valor: R$ ${Number(prod.valor || 0).toFixed(2)}\n\n🛒 Para comprar, acesse:\n${GSA_EMPRESA.site}/marketplace\n\nOu fale conosco:\n👉 https://wa.me/5511920857756`);
    } else {
      sendWhatsAppReply(fromPhone, `Por favor, escolha:\n1️⃣ 🛒 Quero comprar\n2️⃣ ℹ️ Mais informações\n0️⃣ Voltar ao menu`);
    }
    return;
  }

  // ── ESTADO: DROPSHIP_INTEREST (cliente escolheu opção dropship) ──
  if (session.state === 'DROPSHIP_INTEREST') {
    if (text === '0') {
      session.state = 'MAIN_MENU';
      delete session.extrProducts;
      clearCartAbandonmentTimer(fromPhone);
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    }
    
    const choice = parseInt(text);
    if (!isNaN(choice) && session.extrProducts && session.extrProducts[choice - 1]) {
      const prod = session.extrProducts[choice - 1];
      const salePrice = prod.custo * 2;
      
      clearCartAbandonmentTimer(fromPhone);
      session.state = 'STORE';
      session.dropshipSelectedProduct = prod;
      session.dropshipSalePrice = salePrice;
      delete session.extrProducts;
      userSessions[fromPhone] = session;
      
      let msg = `🛒 *Excelente escolha!*\n\n📦 Produto: *${prod.nome}*\n💰 Valor: R$ ${salePrice.toFixed(2).replace('.', ',')}\n\n`;
      msg += `Para finalizar, acesse o checkout seguro ou faça o PIX diretamente:\n\n`;
      msg += `🟢 *PIX Chave CNPJ GSA:* \`${GSA_EMPRESA.pix}\`\n💰 *Valor:* R$ ${salePrice.toFixed(2).replace('.', ',')}\n\n`;
      msg += `Após o pagamento, envie o comprovante aqui e processamos seu pedido!\n`;
      msg += `💳 *Checkout seguro:* ${GSA_EMPRESA.site}/marketplace/checkout\n\n`;
      msg += `🌟 *Como avalia nosso atendimento? (Digite de 1 a 5)*`;
      
      session.state = 'NPS_RATING';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, msg);
    } else {
      sendWhatsAppReply(fromPhone, `Por favor, digite o número da opção desejada (ex: 1, 2 ou 3) ou 0 para voltar ao menu.`);
    }
    return;
  }

  // ── ESTADO: MULTIPLE_PRODUCT_INTEREST (cliente com múltiplas opções) ──
  if (session.state === 'MULTIPLE_PRODUCT_INTEREST') {
    if (text === '0') {
      session.state = 'MAIN_MENU';
      delete session.aiFoundProducts;
      clearCartAbandonmentTimer(fromPhone);
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    }
    
    const choice = parseInt(text);
    if (!isNaN(choice) && session.aiFoundProducts && session.aiFoundProducts[choice - 1]) {
      const prod = session.aiFoundProducts[choice - 1];
      
      clearCartAbandonmentTimer(fromPhone);

      // ─── Módulo 1: Detectar se é produto com variação (vestuário/calçado)
      const needsVariation = /tenis|sapato|calcado|sandalia|bota|chinelo|camisa|camiseta|blusa|calca|jeans|vestido|bermuda|shorts|moletom|agasalho|saia|legging|cueca|lingerie|meias?|roupa/i.test(prod.nome);

      if (needsVariation) {
        const isFootwear = /tenis|sapato|calcado|sandalia|bota|chinelo/i.test(prod.nome);
        const isClothing = /camisa|camiseta|blusa|calca|vestido|bermuda|moletom|agasalho|saia|legging/i.test(prod.nome);

        let variationMsg = `🛍️ *Você selecionou:*\n\n📦 *${prod.nome}*\n💰 *Valor:* R$ ${Number(prod.valor).toFixed(2).replace('.', ',')}\n\n`;

        if (isFootwear) {
          variationMsg += `👟 *Qual é o seu número?*\n_(Ex: 35, 36, 37, 38, 39, 40, 41, 42, 43, 44)_\n\n_Digite 0 para cancelar._`;
          session.variationType = 'tamanho_calcado';
        } else if (isClothing) {
          variationMsg += `👕 *Qual é o seu tamanho?*\n1️⃣ PP\n2️⃣ P\n3️⃣ M\n4️⃣ G\n5️⃣ GG\n6️⃣ XGG\n\n_Ou digite o número diretamente (ex: 40, 42)_\n_Digite 0 para cancelar._`;
          session.variationType = 'tamanho_roupa';
        } else {
          variationMsg += `📐 *Qual variação você prefere? Informe o tamanho ou modelo:*\n\n_Digite 0 para cancelar._`;
          session.variationType = 'geral';
        }

        session.state = 'STORE_SELECT_VARIATION';
        session.selectedVariationProduct = prod;
        delete session.aiFoundProducts;
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, variationMsg);
      } else {
        // Produto sem variação: ir direto para compra
        session.state = 'PRODUCT_INTEREST';
        session.aiFoundProduct = prod;
        delete session.aiFoundProducts;
        userSessions[fromPhone] = session;
        
        const msg = `🛍️ *Você selecionou:*\n\n📦 *${prod.nome}*\n🔖 Código: ${formatGSAProductCode(prod.codigo_produto, prod)}${prod.descricao ? '\n📄 ' + prod.descricao.substring(0,100) : ''}\n💰 *Valor:* R$ ${Number(prod.valor).toFixed(2).replace('.', ',')}\n\n1️⃣ 🛒 Quero comprar\n2️⃣ ℹ️ Mais informações\n0️⃣ Voltar ao menu`;
        sendWhatsAppReply(fromPhone, msg);
      }
    } else {
      sendWhatsAppReply(fromPhone, `Por favor, digite o número do produto desejado ou 0 para voltar ao menu.`);
    }
    return;
  }

  // ── ESTADO: STORE_SELECT_VARIATION (Módulo 1 — escolha de tamanho/cor) ──────
  if (session.state === 'STORE_SELECT_VARIATION') {
    if (text === '0') {
      session.state = 'MAIN_MENU';
      delete session.selectedVariationProduct;
      delete session.variationType;
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    }

    const prod = session.selectedVariationProduct;
    if (!prod) {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
      return;
    }

    // Map clothing size numbers to labels
    let variationLabel = text.trim();
    if (session.variationType === 'tamanho_roupa') {
      const sizeMap = { '1': 'PP', '2': 'P', '3': 'M', '4': 'G', '5': 'GG', '6': 'XGG' };
      if (sizeMap[variationLabel]) variationLabel = sizeMap[variationLabel];
    }

    const total = Number(prod.valor);
    const clientName = session.clientName || 'cliente';

    const pixMsg = `✅ *Pedido Confirmado!*\n\n📦 *${prod.nome}*\n📐 *Tamanho/Variação:* ${variationLabel}\n💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\n🟢 *PIX Copia e Cola — Pague agora:*\n\`${GSA_EMPRESA.pix}\`\n\n💡 Após o pagamento, *envie o comprovante* aqui e processamos seu pedido com prioridade!\n\n_Prazo de entrega: até 12 dias úteis após confirmação._\n\n🌟 *Como avalia nosso atendimento? (Digite de 1 a 5)*`;

    session.state = 'NPS_RATING';
    session.lastOrderProduct = prod.nome;
    session.lastOrderVariation = variationLabel;
    session.lastOrderTotal = total;
    delete session.selectedVariationProduct;
    delete session.variationType;
    userSessions[fromPhone] = session;

    sendWhatsAppReply(fromPhone, pixMsg);

    // Notify admin
    notifyAdmin(`🛒 *NOVA INTENÇÃO DE COMPRA*\n\n👤 *Cliente:* ${clientName} (${fromPhone})\n📦 *Produto:* ${prod.nome}\n📐 *Variação:* ${variationLabel}\n💰 *Valor:* R$ ${total.toFixed(2)}\n🔖 Código: ${formatGSAProductCode(prod.codigo_produto, prod)}`);
    return;
  }

  // Fallback global com IA: mensagens que chegam em estados desconhecidos
  if (text && text !== '0' && mediaType !== 'audio') {
    fetchCatalogForAI((catalog) => {
      callGSAAssistant(fromPhone, text, session, mediaType, catalog, (err, aiResult) => {
        if (err || !aiResult) {
          sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
          return;
        }
        handleAIResponse(fromPhone, session, aiResult, text);
      });
    });
    return;
  }

  // Fallback final: sempre mostrar menu principal
  sendWhatsAppReply(fromPhone, MAIN_MENU_TEXT);
}


// ─── SUPABASE WEBHOOKS ────────────────────────────────────────────────────────
// ─── LOGGING SCRAPING STEPS ──────────────────────────────────────────────────
function logScrapingStep(automacaoId, passo, status, mensagem, progresso, detalhes = {}) {
  if (!automacaoId) return;
  supabasePost('/rest/v1/automacao_scraping_logs', {
    automacao_id: automacaoId,
    passo: passo,
    status: status,
    mensagem: mensagem,
    progresso: progresso,
    detalhes: detalhes
  }, (err, res) => {
    if (err) console.error(`[ScrapingLog Error] ${passo}:`, err);
    else console.log(`[ScrapingLog] ${passo} (${progresso}%): ${mensagem}`);
  });
}

// ─── AUTOMATIC SCRAPING POLLING LISTENER ─────────────────────────────────────
const activeAutomations = new Set();

function checkPendingScrapingTasks() {
  supabaseGet('/rest/v1/automacao_scraping_logs?passo=eq.iniciando&status=eq.em_andamento&select=id,automacao_id,created_at&order=created_at.desc&limit=5', (err, logs) => {
    if (err || !Array.isArray(logs) || logs.length === 0) return;
    for (const log of logs) {
      if (activeAutomations.has(log.automacao_id)) continue;
      const logTime = new Date(log.created_at).getTime();
      const ageMs = Math.abs(Date.now() - logTime);
      if (ageMs > 600000) continue;
      
      activeAutomations.add(log.automacao_id);
      supabasePatch(`/rest/v1/automacao_scraping_logs?automacao_id=eq.${log.automacao_id}&status=eq.em_andamento`, { status: 'processando_motor' }, () => {
        console.log('⚡ [AutoScraping] Capturada nova execução para automação:', log.automacao_id);
        Promise.resolve(handleProductScraping(JSON.stringify({ automacao_id: log.automacao_id }))).finally(() => {
          setTimeout(() => activeAutomations.delete(log.automacao_id), 10000);
        });
      });
    }
  });
}
setInterval(checkPendingScrapingTasks, 3000);

const GSA_PACOTES_NACIONAIS = [
  {
    codigo: 'GSA-NAC-01',
    titulo: 'Gramado e Canela Clássico (Serra Gaúcha)',
    destino: 'Gramado, RS',
    origem: 'São Paulo, SP',
    hotel_nome: 'Wish Serrano Resort & Convention',
    hotel_categoria: '5 Estrelas',
    noites: 4,
    dias: 5,
    preco_custo: 1290.00,
    imagem_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/gra/pacotes-para-gramado',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-02',
    titulo: 'Porto de Galinhas Paradisíaco (Praia e Piscinas Naturais)',
    destino: 'Porto de Galinhas, PE',
    origem: 'São Paulo, SP',
    hotel_nome: 'Vivá Porto de Galinhas Resort',
    hotel_categoria: '4 Estrelas Superior',
    noites: 6,
    dias: 7,
    preco_custo: 1890.00,
    imagem_url: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/rec/pacotes-para-porto-de-galinhas',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-03',
    titulo: 'Maceió & Maragogi Caribe Brasileiro (All Inclusive)',
    destino: 'Maceió, AL',
    origem: 'São Paulo, SP',
    hotel_nome: 'Pratagy Beach All Inclusive Resort',
    hotel_categoria: 'Resort All Inclusive',
    noites: 5,
    dias: 6,
    preco_custo: 2490.00,
    imagem_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/mcx/pacotes-para-maceio',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-04',
    titulo: 'Fernando de Noronha dos Sonhos (Arquipélago Exclusivo)',
    destino: 'Fernando de Noronha, PE',
    origem: 'São Paulo, SP',
    hotel_nome: 'Pousada Triboju & Spa',
    hotel_categoria: 'Pousada de Luxo',
    noites: 4,
    dias: 5,
    preco_custo: 3890.00,
    imagem_url: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/fen/pacotes-para-fernando-de-noronha',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-05',
    titulo: 'Natal & Praia de Pipa com Dunas de Genipabu',
    destino: 'Natal, RN',
    origem: 'São Paulo, SP',
    hotel_nome: 'Serhs Natal Grand Hotel & Resort',
    hotel_categoria: '5 Estrelas Beira-Mar',
    noites: 5,
    dias: 6,
    preco_custo: 1650.00,
    imagem_url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/nat/pacotes-para-natal',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-06',
    titulo: 'Rio de Janeiro Maravilhoso (Copacabana e Cristo Redentor)',
    destino: 'Rio de Janeiro, RJ',
    origem: 'São Paulo, SP',
    hotel_nome: 'Hilton Copacabana Hotel',
    hotel_categoria: '5 Estrelas',
    noites: 3,
    dias: 4,
    preco_custo: 1150.00,
    imagem_url: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/rio/pacotes-para-rio-de-janeiro',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-07',
    titulo: 'Foz do Iguaçu & Cataratas do Iguaçu (Parque Nacional)',
    destino: 'Foz do Iguaçu, PR',
    origem: 'São Paulo, SP',
    hotel_nome: 'Wish Foz do Iguaçu Resort',
    hotel_categoria: '4 Estrelas Superior',
    noites: 3,
    dias: 4,
    preco_custo: 1090.00,
    imagem_url: 'https://images.unsplash.com/photo-1583855282680-6dbdc69b0932?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/igu/pacotes-para-foz-do-iguacu',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-08',
    titulo: 'Bonito Ecoturismo & Flutuação no Rio da Prata (Pantanal)',
    destino: 'Bonito, MS',
    origem: 'São Paulo, SP',
    hotel_nome: 'Zagaia Eco Resort',
    hotel_categoria: 'Eco Resort',
    noites: 4,
    dias: 5,
    preco_custo: 2190.00,
    imagem_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/byo/pacotes-para-bonito',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-09',
    titulo: 'Florianópolis Ilha da Magia & Beto Carrero World',
    destino: 'Florianópolis, SC',
    origem: 'São Paulo, SP',
    hotel_nome: 'Costão do Santinho Resort All Inclusive',
    hotel_categoria: 'Resort All Inclusive',
    noites: 4,
    dias: 5,
    preco_custo: 2250.00,
    imagem_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/fln/pacotes-para-florianopolis',
    categoria: 'nacional'
  },
  {
    codigo: 'GSA-NAC-10',
    titulo: 'Jalapão Expedição Safari 4x4 & Fervedouros Dourados',
    destino: 'Jalapão, TO',
    origem: 'São Paulo, SP',
    hotel_nome: 'Pousadas de Charme & Safari Glamping',
    hotel_categoria: 'Safari Especial',
    noites: 5,
    dias: 6,
    preco_custo: 3490.00,
    imagem_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/pmw/pacotes-para-palmas',
    categoria: 'nacional'
  }
];

const GSA_PACOTES_INTERNACIONAIS = [
  {
    codigo: 'GSA-INT-01',
    titulo: 'Cancún All Inclusive Resort (Caribe Mexicano)',
    destino: 'Cancún, México',
    origem: 'São Paulo, SP',
    hotel_nome: 'Hard Rock Hotel Cancun All Inclusive',
    hotel_categoria: '5 Estrelas All Inclusive',
    noites: 6,
    dias: 7,
    preco_custo: 4890.00,
    imagem_url: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/cun/pacotes-para-cancun',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-02',
    titulo: 'Orlando Mágico & Parques Disney / Universal Studios',
    destino: 'Orlando, Flórida, EUA',
    origem: 'São Paulo, SP',
    hotel_nome: 'Disney All-Star Movies Resort',
    hotel_categoria: 'Resort Temático Disney',
    noites: 7,
    dias: 8,
    preco_custo: 5490.00,
    imagem_url: 'https://images.unsplash.com/photo-1597466765990-64ad1c35dafc?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/orl/pacotes-para-orlando',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-03',
    titulo: 'Paris Romântica & Torre Eiffel com Museu do Louvre',
    destino: 'Paris, França',
    origem: 'São Paulo, SP',
    hotel_nome: 'Pullman Paris Tour Eiffel Hotel',
    hotel_categoria: '4 Estrelas Luxo',
    noites: 6,
    dias: 7,
    preco_custo: 6890.00,
    imagem_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/par/pacotes-para-paris',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-04',
    titulo: 'Lisboa & Porto Histórico com Degustação no Douro',
    destino: 'Lisboa, Portugal',
    origem: 'São Paulo, SP',
    hotel_nome: 'Pestana CR7 Lisboa / Porto',
    hotel_categoria: '4 Estrelas Boutique',
    noites: 7,
    dias: 8,
    preco_custo: 5990.00,
    imagem_url: 'https://images.unsplash.com/photo-1509822929063-6b6cfc9b42f2?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/lis/pacotes-para-lisboa',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-05',
    titulo: 'Buenos Aires & Show de Tango com Jantar em Puerto Madero',
    destino: 'Buenos Aires, Argentina',
    origem: 'São Paulo, SP',
    hotel_nome: 'Hotel Madero Puerto Madero',
    hotel_categoria: '5 Estrelas',
    noites: 4,
    dias: 5,
    preco_custo: 1890.00,
    imagem_url: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/bue/pacotes-para-buenos-aires',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-06',
    titulo: 'Santiago & Valle Nevado com Rota das Vinícolas',
    destino: 'Santiago, Chile',
    origem: 'São Paulo, SP',
    hotel_nome: 'Hotel Plaza El Bosque Sanhattan',
    hotel_categoria: '4 Estrelas Superior',
    noites: 5,
    dias: 6,
    preco_custo: 2390.00,
    imagem_url: 'https://images.unsplash.com/photo-1589802829985-817e51171b92?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/scl/pacotes-para-santiago-do-chile',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-07',
    titulo: 'Punta Cana All Inclusive & Passeio de Catamarã Ilha Saona',
    destino: 'Punta Cana, República Dominicana',
    origem: 'São Paulo, SP',
    hotel_nome: 'Lopesan Costa Bávaro Resort Spa & Casino',
    hotel_categoria: '5 Estrelas All Inclusive',
    noites: 6,
    dias: 7,
    preco_custo: 4690.00,
    imagem_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/puj/pacotes-para-punta-cana',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-08',
    titulo: 'Nova York Times Square, Broadway & Estátua da Liberdade',
    destino: 'Nova York, EUA',
    origem: 'São Paulo, SP',
    hotel_nome: 'New York Marriott Marquis Times Square',
    hotel_categoria: '4 Estrelas Superior',
    noites: 5,
    dias: 6,
    preco_custo: 6450.00,
    imagem_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/nyc/pacotes-para-nova-york',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-09',
    titulo: 'Roma Imperial, Vaticano & Coliseu Histórico',
    destino: 'Roma, Itália',
    origem: 'São Paulo, SP',
    hotel_nome: 'Starhotels Metropole Roma',
    hotel_categoria: '4 Estrelas',
    noites: 6,
    dias: 7,
    preco_custo: 6390.00,
    imagem_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/rom/pacotes-para-roma',
    categoria: 'internacional'
  },
  {
    codigo: 'GSA-INT-10',
    titulo: 'Dubai Futurista & Safari 4x4 no Deserto com Jantar Beduíno',
    destino: 'Dubai, Emirados Árabes Unidos',
    origem: 'São Paulo, SP',
    hotel_nome: 'JW Marriott Marquis Hotel Dubai',
    hotel_categoria: '5 Estrelas Luxo',
    noites: 6,
    dias: 7,
    preco_custo: 7890.00,
    imagem_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/dxb/pacotes-para-dubai',
    categoria: 'internacional'
  }
];

const GSA_PACOTES_PROMOCOES = [
  {
    codigo: 'GSA-PROMO-01',
    titulo: 'Super Promoção: Porto Seguro All Inclusive com Beach Club',
    destino: 'Porto Seguro, BA',
    origem: 'São Paulo, SP',
    hotel_nome: 'Nauticomar Resort All Inclusive',
    hotel_categoria: 'Resort All Inclusive',
    noites: 7,
    dias: 8,
    preco_custo: 1490.00,
    imagem_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/bps/pacotes-para-porto-seguro',
    categoria: 'promocoes-exclusivas'
  },
  {
    codigo: 'GSA-PROMO-02',
    titulo: 'Super Promoção: Maragogi Caribe Brasileiro com Piscinas Naturais',
    destino: 'Maragogi, AL',
    origem: 'São Paulo, SP',
    hotel_nome: 'Grand Oca Maragogi All Inclusive Resort',
    hotel_categoria: 'Resort All Inclusive',
    noites: 4,
    dias: 5,
    preco_custo: 1790.00,
    imagem_url: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/mcx/pacotes-para-maragogi',
    categoria: 'promocoes-exclusivas'
  },
  {
    codigo: 'GSA-PROMO-03',
    titulo: 'Super Promoção: Bariloche Neve, Chocolates & Circuito Chico',
    destino: 'Bariloche, Argentina',
    origem: 'São Paulo, SP',
    hotel_nome: 'Hotel Panamericano Bariloche',
    hotel_categoria: '5 Estrelas com Spa',
    noites: 5,
    dias: 6,
    preco_custo: 2890.00,
    imagem_url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1080&q=80',
    url_fornecedor: 'https://www.decolar.com/pacotes/brc/pacotes-para-bariloche',
    categoria: 'promocoes-exclusivas'
  }
];

function slugifyViagens(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'pacote-viagem';
}

async function handleViagensScraping(config) {
  const currentId = config.id;
  const targetUrl = (config.target_url || '').trim();
  const margem = parseFloat(config.margem_lucro) || 30;
  const categoriaId = config.categoria_id || null;
  const syncId = config.sync_id || 'VIAGENS';

  logScrapingStep(currentId, 'requisicao', 'executando', `✈️ Conectando à fonte de pacotes de viagem: ${targetUrl}`, 15, {
    url_alvo: targetUrl
  });

  try {
    let extractedPackages = [];

    // Detecção de Feed Integrado GSA (Nacionais / Internacionais / Promoções / Todos)
    const urlLower = targetUrl.toLowerCase();
    if (urlLower.includes('nacionais') || urlLower.includes('gsa-viagens-nacionais')) {
      extractedPackages = [...GSA_PACOTES_NACIONAIS];
    } else if (urlLower.includes('internacionais') || urlLower.includes('gsa-viagens-internacionais')) {
      extractedPackages = [...GSA_PACOTES_INTERNACIONAIS];
    } else if (urlLower.includes('promoc') || urlLower.includes('gsa-viagens-promocoes')) {
      extractedPackages = [...GSA_PACOTES_PROMOCOES];
    } else if (urlLower.includes('geral') || urlLower.includes('todos') || urlLower.includes('gsa-viagens-geral')) {
      extractedPackages = [...GSA_PACOTES_NACIONAIS, ...GSA_PACOTES_INTERNACIONAIS, ...GSA_PACOTES_PROMOCOES];
    }

    if (extractedPackages.length === 0) {
      const feedText = await fetchText(targetUrl);
      const sizeKb = (feedText.length / 1024).toFixed(1);
      logScrapingStep(currentId, 'download', 'executando', `Feed de pacotes baixado com sucesso (${sizeKb} KB). Analisando dados...`, 45);

      // 1. Tentar parsear como JSON
      try {
        const parsed = JSON.parse(feedText);
        const arr = Array.isArray(parsed) 
          ? parsed 
          : (parsed.data || parsed.packages || parsed.items || parsed.offers || parsed.results || parsed.trips || []);
        if (Array.isArray(arr) && arr.length > 0) {
          for (const item of arr) {
            const dest = item.destino || item.destination || item.city || item.cidade || item.local || item.pais || 'Destino Nacional';
            const title = item.titulo || item.title || item.nome || item.name || item.package_name || `Pacote ${dest}`;
            const orig = item.origem || item.origin || item.departure_city || 'São Paulo, SP';
            const hotel = item.hotel_nome || item.hotel || item.hotel_name || item.hospedagem || 'Hotel Selecionado';
            const hotelCat = item.hotel_categoria || item.stars || '4 Estrelas';
            const noites = parseInt(item.noites || item.nights || 4, 10);
            const dias = parseInt(item.dias || item.days || (noites + 1), 10);
            const cost = parseFloat(item.preco_custo || item.preco || item.price || item.valor || 0);
            const img = item.imagem_url || item.imagem || item.image || item.photo || item.thumbnail || item.cover_url || '';
            const code = String(item.codigo || item.id || item.codigo_oferta || `PKG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
            const providerUrl = item.url_fornecedor || item.affiliate_url || item.link || item.url || item.product_url || (code ? `https://www.decolar.com/pacotes/${slugifyViagens(dest)}` : '');
            const cat = categoriaId || item.categoria || (dest.toLowerCase().includes('orlando') || dest.toLowerCase().includes('cancun') || dest.toLowerCase().includes('paris') || dest.toLowerCase().includes('disney') || dest.toLowerCase().includes('miami') || dest.toLowerCase().includes('lisboa') ? 'internacional' : 'nacional');

            if (title && cost > 0) {
              extractedPackages.push({
                titulo: title,
                destino: dest,
                origem: orig,
                hotel_nome: hotel,
                hotel_categoria: hotelCat,
                noites,
                dias,
                preco_custo: cost,
                imagem_url: img,
                codigo_oferta_fornecedor: code,
                url_fornecedor: providerUrl,
                categoria: cat
              });
            }
          }
        }
      } catch (e) {}

      // 2. Se não encontrou JSON, tentar como CSV/TSV
      if (extractedPackages.length === 0) {
        function parseCSVHelper(text) {
          const cleanText = text.replace(/^[\uFEFF\xFF\xFE]/, '');
          const rows = [];
          let currentRow = [];
          let currentField = '';
          let inQuotes = false;
          for (let i = 0; i < cleanText.length; i++) {
            const ch = cleanText[i];
            const nextCh = cleanText[i + 1];
            if (ch === '"') {
              if (inQuotes && nextCh === '"') { currentField += '"'; i++; }
              else inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
              currentRow.push(currentField.trim());
              currentField = '';
            } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
              if (ch === '\r' && nextCh === '\n') i++;
              currentRow.push(currentField.trim());
              if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
              currentRow = [];
              currentField = '';
            } else {
              currentField += ch;
            }
          }
          if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
          }
          return rows;
        }

        const rows = parseCSVHelper(feedText);
        if (rows.length > 1) {
          const headers = rows[0].map(h => h.toLowerCase().trim());
          const findCol = (terms) => headers.findIndex(h => terms.some(t => h.includes(t)));
          
          const titleIdx = findCol(['titulo', 'title', 'nome', 'name', 'pacote', 'package', 'oferta', 'product_name']);
          const destIdx = findCol(['destino', 'destination', 'cidade', 'city', 'local', 'pais']);
          const origIdx = findCol(['origem', 'origin', 'saida', 'departure']);
          const priceIdx = findCol(['preco', 'price', 'custo', 'cost', 'valor', 'amount']);
          const hotelIdx = findCol(['hotel', 'hospedagem', 'resort', 'pousada']);
          const nightsIdx = findCol(['noite', 'night', 'duracao', 'duration', 'dia', 'day']);
          const imgIdx = findCol(['imagem', 'image', 'foto', 'photo', 'url_imagem', 'pic', 'thumbnail']);
          const codeIdx = findCol(['codigo', 'code', 'id', 'sku', 'ref']);
          const linkIdx = findCol(['url_fornecedor', 'link', 'url', 'product_url', 'affiliate_url', 'deeplink']);
          const catIdx = findCol(['categoria', 'category']);

          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const title = titleIdx >= 0 ? row[titleIdx] : '';
            const dest = destIdx >= 0 ? row[destIdx] : '';
            const rawPrice = priceIdx >= 0 ? row[priceIdx] : '';
            const cost = parseFloat(String(rawPrice || '0').replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || 0;

            if ((title || dest) && cost > 0) {
              const finalDest = dest || 'Destino Nacional';
              const finalTitle = title || `Pacote Promocional ${finalDest}`;
              const orig = origIdx >= 0 && row[origIdx] ? row[origIdx] : 'São Paulo, SP';
              const hotel = hotelIdx >= 0 && row[hotelIdx] ? row[hotelIdx] : 'Hotel Selecionado';
              const noites = nightsIdx >= 0 ? (parseInt(row[nightsIdx], 10) || 4) : 4;
              const img = imgIdx >= 0 ? row[imgIdx] : '';
              const code = codeIdx >= 0 && row[codeIdx] ? row[codeIdx] : `PKG-CSV-${r}`;
              const providerUrl = linkIdx >= 0 && row[linkIdx] ? row[linkIdx] : `https://www.decolar.com/pacotes/${slugifyViagens(finalDest)}`;
              const cat = categoriaId || (catIdx >= 0 && row[catIdx] ? row[catIdx] : (finalDest.toLowerCase().includes('orlando') || finalDest.toLowerCase().includes('cancun') || finalDest.toLowerCase().includes('europa') ? 'internacional' : 'nacional'));

              extractedPackages.push({
                titulo: finalTitle,
                destino: finalDest,
                origem: orig,
                hotel_nome: hotel,
                hotel_categoria: '4 Estrelas',
                noites: noites,
                dias: noites + 1,
                preco_custo: cost,
                imagem_url: img,
                codigo_oferta_fornecedor: code,
                categoria: cat
              });
            }
          }
        }
      }

      // 3. Se não encontrou CSV, tentar XML/RSS
      if (extractedPackages.length === 0) {
        const itemRegex = /<item[\s\S]*?<\/item>|<offer[\s\S]*?<\/offer>|<pacote[\s\S]*?<\/pacote>/gi;
        let xmlMatch;
        while ((xmlMatch = itemRegex.exec(feedText)) !== null) {
          const block = xmlMatch[0];
          const getTag = (t) => {
            const m = new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i').exec(block);
            return m ? m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
          };
          const dest = getTag('destination') || getTag('destino') || getTag('cidade') || 'Destino Nacional';
          const title = getTag('title') || getTag('nome') || getTag('titulo') || `Pacote ${dest}`;
          const priceStr = getTag('price') || getTag('preco') || getTag('valor');
          const cost = parseFloat(priceStr.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || 0;
          const img = getTag('image') || getTag('imagem') || getTag('photo') || getTag('enclosure');
          const code = getTag('id') || getTag('code') || getTag('guid') || `PKG-XML-${Date.now().toString(36)}`;

          if ((title || dest) && cost > 0) {
            extractedPackages.push({
              titulo: title,
              destino: dest,
              origem: getTag('origin') || getTag('origem') || 'São Paulo, SP',
              hotel_nome: getTag('hotel') || 'Hotel Selecionado',
              hotel_categoria: '4 Estrelas',
              noites: parseInt(getTag('nights') || getTag('noites') || '4', 10),
              dias: parseInt(getTag('days') || getTag('dias') || '5', 10),
              preco_custo: cost,
              imagem_url: img,
              codigo_oferta_fornecedor: code,
              categoria: categoriaId || 'nacional'
            });
          }
        }
      }
    }

    // 3. Se não encontrou CSV, tentar XML/RSS
    if (extractedPackages.length === 0) {
      const itemRegex = /<item[\s\S]*?<\/item>|<offer[\s\S]*?<\/offer>|<pacote[\s\S]*?<\/pacote>/gi;
      let xmlMatch;
      while ((xmlMatch = itemRegex.exec(feedText)) !== null) {
        const block = xmlMatch[0];
        const getTag = (t) => {
          const m = new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i').exec(block);
          return m ? m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : '';
        };
        const dest = getTag('destination') || getTag('destino') || getTag('cidade') || 'Destino Nacional';
        const title = getTag('title') || getTag('nome') || getTag('titulo') || `Pacote ${dest}`;
        const priceStr = getTag('price') || getTag('preco') || getTag('valor');
        const cost = parseFloat(priceStr.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        const img = getTag('image') || getTag('imagem') || getTag('photo') || getTag('enclosure');
        const code = getTag('id') || getTag('code') || getTag('guid') || `PKG-XML-${Date.now().toString(36)}`;

        if ((title || dest) && cost > 0) {
          extractedPackages.push({
            titulo: title,
            destino: dest,
            origem: getTag('origin') || getTag('origem') || 'São Paulo, SP',
            hotel_nome: getTag('hotel') || 'Hotel Selecionado',
            hotel_categoria: '4 Estrelas',
            noites: parseInt(getTag('nights') || getTag('noites') || '4', 10),
            dias: parseInt(getTag('days') || getTag('dias') || '5', 10),
            preco_custo: cost,
            imagem_url: img,
            codigo_oferta_fornecedor: code,
            categoria: categoriaId || 'nacional'
          });
        }
      }
    }

    if (extractedPackages.length === 0) {
      const isDecolarOrSPA = targetUrl.includes('decolar') || targetUrl.includes('cvc') || targetUrl.includes('booking');
      const detalheMotivo = isDecolarOrSPA
        ? 'A URL da operadora é um portal interativo protegido por firewall (SPA). Para importar pacotes de viagens, utilize a URL do Feed de Afiliados (formato CSV, JSON ou XML fornecido no painel da Decolar/Awin/Lomadee) ou API de catálogo.'
        : 'Nenhum pacote de viagem identificado no feed retornado. Verifique se a URL aponta para um feed CSV/JSON/XML válido.';

      logScrapingStep(currentId, 'erro', 'erro', `Aviso: ${detalheMotivo}`, 100, {
        erros: [detalheMotivo],
        motivo_erro: detalheMotivo,
        produtos_encontrados: 0,
        novos: 0,
        atualizados: 0,
        esgotados: 0
      });
      return;
    }

    const limiteMax = Number(config.limite_produtos || 0);
    const packagesToProcess = (limiteMax > 0 && extractedPackages.length > limiteMax)
      ? extractedPackages.slice(0, limiteMax)
      : extractedPackages;

    const infoLimite = limiteMax > 0 ? ` (limitado a ${limiteMax})` : ' (sem limite)';
    logScrapingStep(currentId, 'processamento', 'executando', `Encontrados ${extractedPackages.length} pacote(s). Importando ${packagesToProcess.length}${infoLimite}. Calculando margem de lucro (+${margem}%) e cadastrando no GSA Viagens...`, 70, {
      produtos_encontrados: extractedPackages.length,
      produtos_limitados: packagesToProcess.length
    });

    let inseridos = 0;
    let atualizados = 0;
    const batchSize = 50;

    for (let b = 0; b < packagesToProcess.length; b += batchSize) {
      const chunk = packagesToProcess.slice(b, b + batchSize);
      const newPkgs = [];
      const imgMap = [];

      for (let idx = 0; idx < chunk.length; idx++) {
        const pkg = chunk[idx];
        const precoCusto = pkg.preco_custo;
        const margemValor = Math.round((precoCusto * (margem / 100)) * 100) / 100;
        const precoVenda = Math.ceil((precoCusto + margemValor) * 100) / 100;
        const hashSuffix = (pkg.codigo_oferta_fornecedor || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6) || Math.random().toString(36).slice(2, 6);
        const baseSlug = `${slugifyViagens(pkg.titulo)}-${hashSuffix}`;

        newPkgs.push({
          titulo: pkg.titulo.slice(0, 200),
          slug: baseSlug,
          categoria: pkg.categoria || 'nacional',
          origem: pkg.origem || 'São Paulo, SP',
          destino: pkg.destino || 'Destino Nacional',
          dias: pkg.dias || 5,
          noites: pkg.noites || 4,
          hotel_nome: pkg.hotel_nome || 'Hotel Selecionado',
          hotel_categoria: pkg.hotel_categoria || '4 Estrelas',
          acomodacao_tipo: 'Quarto Duplo Standard',
          alimentacao: 'Café da manhã incluso',
          transporte_tipo: 'Aéreo ida e volta',
          companhia_executor: 'Companhia Aérea Regular',
          bagagem_inclusa: '1 mala de mão (10kg) inclusa',
          traslado_incluso: true,
          codigo_oferta_fornecedor: pkg.codigo_oferta_fornecedor || null,
          url_fornecedor: pkg.url_fornecedor || (targetUrl.startsWith('http') && !targetUrl.includes('feed.gsa.com') ? targetUrl : `https://www.decolar.com/pacotes/${slugifyViagens(pkg.destino || pkg.titulo)}`),
          preco_custo: precoCusto,
          margem_porcentagem: margem,
          margem_valor: margemValor,
          preco_venda: precoVenda,
          parcelamento_maximo: 10,
          limite_vendas: 50,
          vendas_realizadas: 0,
          status: 'publicado',
          inclusoes: [
            "Passagens aéreas (ida e volta)",
            "Hospedagem com café da manhã",
            "Traslado aeroporto / hotel / aeroporto",
            "Suporte e assistência 24h GSA Viagens"
          ],
          exclusoes: [
            "Passeios opcionais não descritos",
            "Taxas de turismo e despesas pessoais"
          ],
          regras: [
            "Valores por pessoa em acomodação dupla",
            "Sujeito à alteração de disponibilidade sem aviso prévio"
          ],
          documentacao_necessaria: [
            "Documento oficial com foto (RG ou CNH válida)",
            "Para destinos internacionais: Passaporte com validade mínima de 6 meses"
          ]
        });
        imgMap.push({ slug: baseSlug, imagem_url: pkg.imagem_url });
      }

      await new Promise((resolve) => {
        supabaseUpsertCustom('/rest/v1/viagens_pacotes', 'slug', newPkgs, (errPkg, resPkg, statusCode) => {
          if (!errPkg) {
            const resArr = Array.isArray(resPkg) ? resPkg : (resPkg ? [resPkg] : []);
            if (statusCode === 201) inseridos += resArr.length;
            else atualizados += resArr.length;

            const imgsToInsert = [];
            for (const createdPkg of resArr) {
              const match = imgMap.find(m => m.slug === createdPkg.slug);
              if (match && match.imagem_url && match.imagem_url.startsWith('http')) {
                imgsToInsert.push({
                  pacote_id: createdPkg.id,
                  url: match.imagem_url,
                  is_capa: true,
                  ordem: 0
                });
              }
            }
            if (imgsToInsert.length > 0) {
              supabasePost('/rest/v1/viagens_pacote_imagens', imgsToInsert, () => {});
            }
          } else {
            console.error('❌ Erro no lote de viagens:', errPkg?.message || errPkg);
          }
          resolve();
        });
      });

      const pct = Math.min(98, 70 + Math.floor(((b + chunk.length) / packagesToProcess.length) * 28));
      logScrapingStep(currentId, 'processamento', 'executando', `Processando lote de pacotes (${Math.min(b + chunk.length, packagesToProcess.length)} / ${packagesToProcess.length})...`, pct);
    }

    supabasePatch(`/rest/v1/automacao_scraping_configs?id=eq.${currentId}`, { ultima_execucao: new Date().toISOString() }, () => {});

    const msgFinal = inseridos > 0 
      ? `Sincronização 100% concluída com sucesso! ${inseridos} novo(s) e ${atualizados} atualizado(s) no GSA Viagens com a margem de ${margem}%.`
      : `Sincronização 100% concluída com sucesso! ${atualizados} pacote(s) atualizados com a margem de ${margem}%.`;

    logScrapingStep(currentId, 'sucesso', 'sucesso', msgFinal, 100, {
      novos: inseridos,
      atualizados: atualizados,
      esgotados: 0,
      produtos_encontrados: extractedPackages.length,
      erros: []
    });

  } catch (err) {
    console.error('❌ [Viagens Scraping] Erro:', err.message);
    logScrapingStep(currentId, 'erro', 'erro', `Erro no processamento de viagens: ${err.message}`, 100, {
      erros: [err.message],
      motivo_erro: err.message,
      novos: 0,
      atualizados: 0,
      esgotados: 0
    });
  }
}

// ─── SCRAPING HANDLER FOR PRODUCTS & TRAVEL ───────────────────────────────────────────
function normalizeVariationKey(value, fallback) {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function inferVariationGroup(values, index, totalGroups) {
  const normalized = values.map(value => String(value || '').trim().toLowerCase());
  const colors = /^(preto|branco|cinza|vermelho|vermelha|azul|verde|amarelo|amarela|rosa|roxo|roxa|lilas|bege|marrom|laranja|dourado|dourada|prata|vinho|bordo|nude|colorido|colorida)(\b|\/)/i;
  const sizes = /^(pp|p|m|g|gg|xg|xgg|xxg|xxl|xs|s|l|xl|tamanho unico|unico|unica)$/i;
  const numbers = /^(?:n(?:umero|\u00ba)?\s*)?\d{1,3}(?:[.,]\d+)?(?:\s*(?:cm|mm|m))?$/i;
  if (normalized.length && normalized.every(value => colors.test(value))) return { nome: 'Cor', tipo: 'cor' };
  if (normalized.length && normalized.every(value => sizes.test(value))) return { nome: 'Tamanho', tipo: 'tamanho' };
  if (normalized.length && normalized.every(value => numbers.test(value))) return { nome: totalGroups > 1 ? 'Tamanho/Número' : 'Número', tipo: 'numero' };
  if (normalized.some(value => /algodao|poliester|couro|tecido|madeira|metal/i.test(value))) return { nome: 'Material', tipo: 'material' };
  return { nome: totalGroups > 1 ? `Opção ${index + 1}` : 'Modelo', tipo: 'modelo' };
}

function parseShopeeFeedVariations(row, salePrice, imageUrl) {
  const modelNames = String(row.model_names || '').split('|').map(value => value.trim()).filter(Boolean);
  const modelIds = String(row.model_ids || '').split('|').map(value => value.trim());
  const modelImages = String(row.model_images || row.model_image_urls || row.variation_images || '')
    .split('|').map(value => value.trim());
  const modelStocks = String(row.model_stocks || row.model_stock || row.variation_stocks || '')
    .split('|').map(value => value.trim());
  if (modelNames.length <= 1) return null;
  const combinations = modelNames.map(name => name.split(',').map(value => value.trim()).filter(Boolean));
  const groupCount = Math.max(...combinations.map(parts => parts.length));
  if (!groupCount || combinations.some(parts => parts.length !== groupCount)) return null;
  const usedGroupKeys = new Set();
  const groups = Array.from({ length: groupCount }, (_, groupIndex) => {
    const values = [...new Set(combinations.map(parts => parts[groupIndex]))];
    const inferred = inferVariationGroup(values, groupIndex, groupCount);
    const baseGroupKey = normalizeVariationKey(inferred.nome, `grupo_${groupIndex + 1}`);
    let groupKey = baseGroupKey;
    let groupSuffix = 2;
    while (usedGroupKeys.has(groupKey)) groupKey = `${baseGroupKey}_${groupSuffix++}`;
    usedGroupKeys.add(groupKey);
    const usedOptionKeys = new Set();
    return {
      chave: groupKey, nome: inferred.nome, tipo: inferred.tipo, ordem: groupIndex,
      opcoes: values.map((value, optionIndex) => {
        const baseOptionKey = normalizeVariationKey(value, `opcao_${optionIndex + 1}`);
        let optionKey = baseOptionKey;
        let suffix = 2;
        while (usedOptionKeys.has(optionKey)) optionKey = `${baseOptionKey}_${suffix++}`;
        usedOptionKeys.add(optionKey);
        const firstVariantIndex = combinations.findIndex(parts => parts[groupIndex] === value);
        const rawImage = modelImages[firstVariantIndex] || '';
        const variationImageUrl = /^https?:\/\//i.test(rawImage)
          ? rawImage
          : rawImage ? `https://cf.shopee.com.br/file/${rawImage}` : null;
        return { chave: optionKey, nome: value, valor: value, imagem_url: variationImageUrl, ordem: optionIndex };
      })
    };
  });
  const seenCombinations = new Set();
  const variantes = combinations.map((parts, variantIndex) => {
    const selecoes = {};
    groups.forEach((group, groupIndex) => {
      selecoes[group.chave] = group.opcoes.find(item => item.nome === parts[groupIndex]).chave;
    });
    const externalId = modelIds[variantIndex] || `${row.itemid || row.item_id || 'shopee'}-${variantIndex + 1}`;
    const rawStockStr = modelStocks[variantIndex];
    const hasExplicitStock = /^\d+$/.test(rawStockStr || '');
    const parsedStock = hasExplicitStock ? Number(rawStockStr) : 99;
    return {
      chave: `shopee_${externalId}`, nome: modelNames[variantIndex], valor_custo: salePrice, valor: null,
      controle_estoque: hasExplicitStock, estoque_disponivel: parsedStock,
      imagem_url: modelImages[variantIndex]
        ? (/^https?:\/\//i.test(modelImages[variantIndex]) ? modelImages[variantIndex] : `https://cf.shopee.com.br/file/${modelImages[variantIndex]}`)
        : null,
      ativo: true,
      origem_externa_id: externalId, selecoes
    };
  }).filter((variant) => {
    const signature = JSON.stringify(variant.selecoes, Object.keys(variant.selecoes).sort());
    if (seenCombinations.has(signature)) return false;
    seenCombinations.add(signature);
    return true;
  });
  return { grupos: groups, variantes };
}

async function handleProductScraping(bodyData) {
  let automacaoId = null;
  try {
    const data = JSON.parse(bodyData || '{}');
    automacaoId = data.automacao_id || data.id || null;
  } catch (e) {}

  console.log('🤖 [Scraping] Iniciando pipeline de scraping para ID:', automacaoId);

  // Buscar configurações da automação no Supabase
  const path = automacaoId 
    ? `/rest/v1/automacao_scraping_configs?id=eq.${automacaoId}&select=*`
    : `/rest/v1/automacao_scraping_configs?ativo=eq.true&select=*`;

  supabaseGet(path, async (err, configs) => {
    if (err || !Array.isArray(configs) || configs.length === 0) {
      console.error('❌ [Scraping] Configuração não encontrada ou inativa.');
      if (automacaoId) {
        logScrapingStep(automacaoId, 'erro', 'erro', 'Configuração de automação não encontrada ou inativa no banco de dados.', 100, {
          erros: ['Configuração de automação não localizada no Supabase.'],
          motivo_erro: 'ID de automação inexistente ou inativo.'
        });
      }
      return;
    }

    for (const config of configs) {
      if (config.tipo === 'viagens') {
        await handleViagensScraping(config);
        continue;
      }
      const currentId = config.id;
      const targetUrl = config.target_url;
      const margem = parseFloat(config.margem_lucro) || 100;
      const categoriaId = config.categoria_id || null;
      const syncId = config.sync_id || 'SYNC';

      logScrapingStep(currentId, 'requisicao', 'executando', `Conectando ao fornecedor: ${targetUrl}`, 15, {
        url_alvo: targetUrl
      });

      try {
        // 1. Fetch da página do fornecedor
        const html = await fetchText(targetUrl);
        const sizeKb = (html.length / 1024).toFixed(1);
        logScrapingStep(currentId, 'download', 'executando', `Página baixada com sucesso (${sizeKb} KB). Analisando dados estruturados e catálogo...`, 45);

        // 2. Extração dos produtos
        const extractedProducts = [];

        // Tentativa SHOPEE FEED: Engine de Feed CSV do Shopee Afiliados
        const isShopeeCSVFeed = targetUrl.includes('affiliate.shopee.com.br/api/v1/datafeed/download');
        if (isShopeeCSVFeed) {
          logScrapingStep(currentId, 'requisicao', 'executando', '🟠 Motor Shopee Feed CSV: Baixando catálogo de afiliados...', 20, { url_alvo: targetUrl });
          try {
            const csvText = html || await fetchText(targetUrl);

            const keywordFilter = (config.palavras_chave || '').toLowerCase().trim();
            const categoriaFiltro = (config.categoria_filtro || '').toLowerCase().trim();
            const precoMin = config.preco_min ? parseFloat(config.preco_min) : null;
            const precoMax = config.preco_max ? parseFloat(config.preco_max) : null;
            const descontoMin = config.desconto_min ? parseInt(config.desconto_min) : null;
            const ratingMin = config.rating_min ? parseFloat(config.rating_min) : null;
            const rawLim = config.limite_produtos;
            const limiteShopee = (rawLim !== null && rawLim !== undefined && rawLim !== '' && !isNaN(Number(rawLim))) ? Number(rawLim) : 0;

            function parseCSVFull(text, maxRows) {
              const cleanText = text.replace(/^[\uFEFF\xFF\xFE]/, '');
              const rows = [];
              let currentRow = [];
              let currentField = '';
              let inQuotes = false;
              const shouldLimit = maxRows > 0;

              for (let i = 0; i < cleanText.length; i++) {
                const ch = cleanText[i];
                const nextCh = cleanText[i + 1];
                if (ch === '"') {
                  if (inQuotes && nextCh === '"') { currentField += '"'; i++; }
                  else inQuotes = !inQuotes;
                } else if (ch === ',' && !inQuotes) {
                  currentRow.push(currentField.trim());
                  currentField = '';
                } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
                  if (ch === '\r' && nextCh === '\n') i++;
                  currentRow.push(currentField.trim());
                  if (currentRow.some(f => f.length > 0)) {
                    rows.push(currentRow);
                    if (shouldLimit && rows.length >= maxRows) break;
                  }
                  currentRow = [];
                  currentField = '';
                } else {
                  currentField += ch;
                }
              }
              if (!shouldLimit || rows.length < maxRows) {
                if (currentField || currentRow.length > 0) {
                  currentRow.push(currentField.trim());
                  if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
                }
              }
              return rows;
            }

            const maxRowsToParse = limiteShopee > 0 ? (limiteShopee + 5) : 0;
            const allRows = parseCSVFull(csvText, maxRowsToParse);
            if (allRows.length > 1) {
              const headers = allRows[0].map(h => h.trim().toLowerCase().replace(/^[\uFEFF\xFF\xFE]/, '').replace(/[^a-z0-9]+/g, '_'));
              
              let shopeeCount = 0;
              for (let r = 1; r < allRows.length; r++) {
                if (limiteShopee > 0 && shopeeCount >= limiteShopee) break;

                const values = allRows[r];
                const row = {};
                headers.forEach((h, i) => { if (h) row[h] = (values[i] || '').trim(); });

                const title = row.title || row.item_name || row.product_name || row.item_title || row.name || row.offername || row.offer_name || '';
                const rawPrice = row.sale_price || row.price || row.item_price || row.price_min || row.offer_price || '0';
                const salePrice = parseFloat(String(rawPrice).replace(/[^\d.,]/g, '').replace(',', '.'));
                const itemId = row.item_id || row.itemid || row.product_id || row.id || '';

                if (!title || salePrice <= 0 || isNaN(salePrice)) continue;
                if (title.toLowerCase() === 'title' || title.toLowerCase() === 'item_name') continue;

                if (precoMin !== null && salePrice < precoMin) continue;
                if (precoMax !== null && salePrice > precoMax) continue;

                const discountPctNum = parseInt(row.discount_percentage || row.discount || '0');
                if (descontoMin !== null && discountPctNum < descontoMin) continue;

                const itemRating = parseFloat(row.item_rating || row.rating || '0');
                if (ratingMin !== null && itemRating < ratingMin) continue;

                if (categoriaFiltro) {
                  const catStr = `${row.global_category1 || ''} ${row.global_category2 || ''} ${row.global_category3 || ''} ${row.category_name || ''}`.toLowerCase();
                  if (!catStr.includes(categoriaFiltro)) continue;
                }

                if (keywordFilter) {
                  const keywords = keywordFilter.split(',').map(k => k.trim()).filter(Boolean);
                  const titleLower = title.toLowerCase();
                  const descLower = (row.description || '').toLowerCase();
                  const catLower = `${row.global_category1 || ''} ${row.global_category2 || ''} ${row.global_category3 || ''} ${row.category_name || ''}`.toLowerCase();
                  const matches = keywords.some(kw => titleLower.includes(kw) || descLower.includes(kw) || catLower.includes(kw));
                  if (!matches) continue;
                }

                const productLink = row.offer_link || row.product_short_link || row.product_link || row.link || row.url || '';
                const imageUrl = row.image_link || row.image_url || row.image || row.imageurl || row.cover_image || row.picture || '';

                extractedProducts.push({
                  codigo: itemId ? `SHP-${itemId}` : null,
                  nome: title,
                  preco: salePrice,
                  url_afiliado: productLink,
                  imagem_url: imageUrl,
                  desconto_percentual: discountPctNum,
                  rating: itemRating,
                  shopee_shop: row.shop_name || row.seller_name || 'Vendedor Shopee',
                  variacoes: parseShopeeFeedVariations(row, salePrice, imageUrl)
                });
                shopeeCount++;
              }
            }

            logScrapingStep(currentId, 'download', 'executando',
              `🟠 Feed Shopee: ${extractedProducts.length} produto(s) extraídos do catálogo CSV de afiliado.${config.palavras_chave ? ` Filtro: "${config.palavras_chave}"` : ' (sem filtro por keyword)'}`, 50);
          } catch(shopeeErr) {
            console.error('❌ [Shopee Feed] Erro no parsing CSV:', shopeeErr.message);
          }
        }

        // Tentativa C: Extração via Meta tags (OpenGraph / Product metadata para páginas de item único)
        if (extractedProducts.length === 0) {
          const ogTitle = (html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || [])[1];
          const ogImage = (html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || [])[1];
          const ogDesc = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || [])[1];
          const ogPrice = (html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i) || [])[1] ||
                          (html.match(/<meta[^>]*property=["']og:price:amount["'][^>]*content=["']([^"']+)["']/i) || [])[1];
          
          const urlCodeMatch = targetUrl.match(/-(\d+)(?:\/p|$|[\?#])/);
          const htmlCodeMatch = html.match(/C[oó]digo:\s*(\d+)/i);
          const codigo = urlCodeMatch?.[1] || htmlCodeMatch?.[1] || null;

          if (ogTitle && ogPrice) {
            const precoNum = parseFloat(String(ogPrice).replace(',', '.'));
            if (precoNum > 0) {
              extractedProducts.push({ 
                nome: ogTitle.trim(), 
                preco: precoNum, 
                imagem_url: ogImage || '',
                codigo: codigo ? String(codigo) : null,
                codigo_barras: null,
                descricao: ogDesc ? ogDesc.replace(/<[^>]*>/g, '').trim() : ''
              });
            }
          }
        }

        // Tentativa D: Schema.org Microdata (itemprop="name", itemprop="price")
        if (extractedProducts.length === 0) {
          const nameMatch = html.match(/itemprop=["']name["'][^>]*>([^<]+)<\//i);
          const priceMatch = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) || html.match(/itemprop=["']price["'][^>]*>([^<]+)<\//i);
          const imgMatch = html.match(/itemprop=["']image["'][^>]*src=["']([^"']+)["']/i);
          const descMatch = html.match(/itemprop=["']description["'][^>]*>([^<]+)<\//i);
          const urlCodeMatch = targetUrl.match(/-(\d+)(?:\/p|$|[\?#])/);
          const htmlCodeMatch = html.match(/C[oó]digo:\s*(\d+)/i);
          const codigo = urlCodeMatch?.[1] || htmlCodeMatch?.[1] || null;

          if (nameMatch && priceMatch) {
            const precoNum = parseFloat(priceMatch[1].replace(/[^\d.,]/g, '').replace(',', '.'));
            if (precoNum > 0) {
              extractedProducts.push({ 
                nome: nameMatch[1].trim(), 
                preco: precoNum, 
                imagem_url: imgMatch?.[1] || '',
                codigo: codigo ? String(codigo) : null,
                codigo_barras: null,
                descricao: descMatch ? descMatch[1].trim() : ''
              });
            }
          }
        }

        // Tentativa E: Extração Regex para lojas gerais e vitrines (Título + Preço R$)
        if (extractedProducts.length === 0) {
          const cardRegex = /<h\d[^>]*>([^<]{5,80})<\/h\d>[\s\S]*?R\$\s*([\d.,]+)/gi;
          let m;
          let count = 0;
          while ((m = cardRegex.exec(html)) !== null && count < 30) {
            const nome = m[1].replace(/\s+/g, ' ').trim();
            const rawPrice = m[2].replace('.', '').replace(',', '.');
            const preco = parseFloat(rawPrice);
            if (nome && preco > 0 && !nome.toLowerCase().includes('frete') && !nome.toLowerCase().includes('cupom') && !nome.toLowerCase().includes('parcela')) {
              extractedProducts.push({ nome, preco, imagem_url: '', codigo: null, codigo_barras: null, descricao: '' });
              count++;
            }
          }
        }

        if (extractedProducts.length === 0) {
          const isShopeeOrSPA = targetUrl.includes('shopee') || targetUrl.includes('aliexpress') || targetUrl.includes('mercadolivre');
          const detalheMotivo = isShopeeOrSPA
            ? 'A página do fornecedor utiliza renderização dinâmica via Javascript / proteção antibot (SPA). Não foi possível encontrar produtos no HTML puro. Recomendado utilizar link de produto direto ou fornecedor compatível.'
            : 'Nenhum produto identificado no HTML retornado pelo servidor do fornecedor. Verifique a URL cadastrada.';

          logScrapingStep(currentId, 'erro', 'erro', `Aviso: ${detalheMotivo}`, 100, {
            erros: [detalheMotivo],
            motivo_erro: detalheMotivo,
            produtos_encontrados: 0,
            novos: 0,
            atualizados: 0,
            esgotados: 0
          });
          return;
        }

        const limiteMax = Number(config.limite_produtos || 0);
        const productsToProcess = (limiteMax > 0 && extractedProducts.length > limiteMax)
          ? extractedProducts.slice(0, limiteMax)
          : extractedProducts;

        const infoLimite = limiteMax > 0 ? ` (limitado a ${limiteMax})` : ' (sem limite)';
        logScrapingStep(currentId, 'processamento', 'executando', `Encontrados ${extractedProducts.length} produto(s). Importando ${productsToProcess.length}${infoLimite}. Calculando margem de lucro (+${margem}%) e cadastrando na loja...`, 75, {
          produtos_encontrados: extractedProducts.length,
          produtos_limitados: productsToProcess.length
        });

        // 3. Inserção / Atualização dos produtos no Supabase em lotes (high-speed batching)
        let inseridos = 0;
        let atualizados = 0;
        const batchSize = 200;

        for (let b = 0; b < productsToProcess.length; b += batchSize) {
          const chunk = productsToProcess.slice(b, b + batchSize);
          const newProds = [];
          const fornConfigsMap = [];

          for (let idx = 0; idx < chunk.length; idx++) {
            const prod = chunk[idx];
            const precoCusto = prod.preco;
            const precoVenda = Math.ceil(precoCusto * (1 + margem / 100) * 100) / 100;
            const urlCodeMatch = targetUrl.match(/-(\d{3,10})(?:\/p|$|[\?#])/);
            const storeCode = prod.codigo || (urlCodeMatch ? urlCodeMatch[1] : null) || `PRD-${syncId}-${b + idx + 1}-${Date.now().toString(36).toUpperCase()}`;

            const cleanDesc = prod.descricao && prod.descricao.length > 5 && !prod.descricao.toLowerCase().includes('fornecedor')
              ? prod.descricao.slice(0, 500)
              : `${prod.nome}. Produto disponível com garantia de entrega e excelente qualidade na GSA Store.`;

            newProds.push({
              codigo_produto: String(storeCode),
              codigo_barras: prod.codigo_barras || null,
              nome: prod.nome.slice(0, 200),
              descricao: cleanDesc,
              valor: precoVenda,
              valor_custo: precoCusto,
              porcentagem_lucro: margem,
              estoque: 99,
              estoque_disponivel: 99,
              status: 'ativo',
              visivel_na_loja: true,
              tipo_cliente: 'ambos',
              categoria_id: categoriaId,
              imagem_url: prod.imagem_url || null,
              identificador_preferencial: 'interno'
            });
            fornConfigsMap.push({ storeCode: String(storeCode), prod: prod });
          }

          await new Promise((resolve) => {
            supabaseUpsertProduct('/rest/v1/produtos', newProds, (errP, resP, statusCode) => {
              if (!errP) {
                const resArr = Array.isArray(resP) ? resP : (resP ? [resP] : []);
                if (statusCode === 201) inseridos += resArr.length;
                else atualizados += resArr.length;

                const fornConfigs = resArr.map(p => {
                  const match = fornConfigsMap.find(f => f.storeCode === p.codigo_produto);
                  const prodObj = match ? match.prod : {};
                  return {
                    produto_id: p.id,
                    fornecimento_externo_ativo: true,
                    tipo_fornecedor: 'online',
                    nome_fornecedor: isShopeeCSVFeed ? `Shopee - ${prodObj.shopee_shop || 'Vendedor Shopee'}` : (config.nome || 'Fornecedor Externo'),
                    url_produto: prodObj.url_afiliado || targetUrl
                  };
                });
                if (fornConfigs.length > 0) {
                  supabasePost('/rest/v1/produto_fornecedor_config?on_conflict=produto_id', fornConfigs, () => {});
                }
                for (const savedProduct of resArr) {
                  const match = fornConfigsMap.find(item => item.storeCode === savedProduct.codigo_produto);
                  if (!match?.prod?.variacoes) continue;
                  supabasePost('/rest/v1/rpc/gsa_replace_product_variations', {
                    p_produto_id: savedProduct.id,
                    p_variacoes: match.prod.variacoes
                  }, (variationError) => {
                    if (variationError) console.error(`❌ Erro ao salvar variações de ${savedProduct.codigo_produto}:`, variationError?.message || variationError);
                  });
                }
              } else {
                console.error('❌ Erro no lote de produtos:', errP?.message || errP);
              }
              resolve();
            });
          });

          const pct = Math.min(98, 75 + Math.floor(((b + chunk.length) / productsToProcess.length) * 23));
          logScrapingStep(currentId, 'processamento', 'executando', `Processando lote de produtos (${Math.min(b + chunk.length, productsToProcess.length)} / ${productsToProcess.length})...`, pct);
        }

        // 4. Atualizar última execução e registrar sucesso 100%
        supabasePatch(`/rest/v1/automacao_scraping_configs?id=eq.${currentId}`, { ultima_execucao: new Date().toISOString() }, () => {});

        const msgFinal = inseridos > 0 
          ? `Sincronização 100% concluída com sucesso! ${inseridos} novo(s) e ${atualizados} atualizado(s) no catálogo da loja com a margem de ${margem}%.`
          : `Sincronização 100% concluída com sucesso! ${atualizados} produto(s) atualizados com a margem de ${margem}%.`;

        logScrapingStep(currentId, 'sucesso', 'sucesso', msgFinal, 100, {
          novos: inseridos,
          atualizados: atualizados,
          esgotados: 0,
          produtos_encontrados: extractedProducts.length,
          erros: []
        });

      } catch (scrapingErr) {
        console.error('❌ [Scraping] Erro na execução:', scrapingErr.message);
        logScrapingStep(currentId, 'erro', 'erro', `Erro na execução: ${scrapingErr.message}`, 100, {
          erros: [scrapingErr.message],
          motivo_erro: scrapingErr.message,
          novos: 0,
          atualizados: 0,
          esgotados: 0
        });
      }
    }
  });
}

async function getAdminPhone() {
  return new Promise((resolve) => {
    supabaseGet('/rest/v1/system_settings?chave=eq.whatsapp_admin_notificacoes&select=valor&limit=1', (err, res) => {
      if (!err && Array.isArray(res) && res.length > 0 && res[0].valor) {
        let phone = String(res[0].valor).replace(/\D/g, '');
        if (phone.length >= 10 && !phone.startsWith('55')) phone = '55' + phone;
        return resolve(phone);
      }
      resolve('5511920857756');
    });
  });
}

async function notifyAdmin(message) {
  try {
    const adminPhone = await getAdminPhone();
    sendWhatsAppReply(adminPhone, message);
  } catch(e) {
    console.error('Erro em notifyAdmin:', e.message);
  }
}

async function handleSupabaseWebhook(req, res, bodyData) {
  try {
    const data = JSON.parse(bodyData);
    console.log('📥 Supabase Webhook Recebido:', JSON.stringify(data).substring(0, 200));

    const { type, table, record, old_record } = data;
    if (!record) return;

    // Helper to get client phone safely
    const getClientPhone = (rec) => {
      if (!rec) return null;
      let rawPhone = rec.telefone || rec.telefone_contato || rec.celular;
      if (!rawPhone) return null;
      let phone = String(rawPhone).replace(/\D/g, '');
      if (!phone.startsWith('55') && phone.length >= 10) phone = '55' + phone;
      return phone;
    };

    const getDisplayName = (rec) => {
      if (!rec) return 'CLIENTE/PARCEIRO';
      return (rec.nome || rec.nome_completo || rec.razao_social || rec.nome_fantasia || 'Cliente/Parceiro').toUpperCase();
    };

    const resolveClientContact = async (clienteId, rec) => {
      let phone = getClientPhone(rec);
      let name = getDisplayName(rec);
      if (phone && name && name !== 'CLIENTE/PARCEIRO') {
        return { phone, name };
      }
      const targetId = clienteId || (rec ? rec.cliente_id : null);
      if (!targetId) {
        return { phone, name };
      }
      return new Promise((resolve) => {
        supabaseGet(`/rest/v1/clientes?id=eq.${encodeURIComponent(targetId)}&select=id,nome,razao_social,nome_fantasia,telefone,celular,telefone_contato&limit=1`, (err, rows) => {
          if (!err && Array.isArray(rows) && rows[0]) {
            const p = getClientPhone(rows[0]) || phone;
            const n = getDisplayName(rows[0]);
            return resolve({ phone: p, name: (name && name !== 'CLIENTE/PARCEIRO') ? name : n });
          }
          resolve({ phone, name });
        });
      });
    };

    const contact = await resolveClientContact(record.cliente_id, record);
    const clientPhone = contact.phone;
    const clientName = contact.name;

    const safeSendClientReply = (phone, msg) => {
      if (!phone || !msg) return;
      sessionMutex.runExclusive(phone, async () => {
        try {
          await sendWhatsAppReply(phone, msg);
        } catch (errSend) {
          console.error('❌ Erro enviando notificação WhatsApp via mutex:', errSend.message);
        }
      });
    };

    // ==========================================
    // FASE 2 & FASE 3: Roteamento de Notificações
    // ==========================================

    switch (table.toLowerCase()) {
      
      // 👤 CLIENTES
      case 'clientes':
      case 'parceiros':
      case 'afiliados':
        if (type === 'INSERT') {
          // Fase 2: Admin Notif
          notifyAdmin(`🚨 *NOVO CADASTRO RECEBIDO* 🚨\n\n👤 *Nome:* ${clientName}\n📱 *Contato:* ${record.telefone || record.telefone_contato || 'N/A'}\n📊 *Tipo:* ${table.toUpperCase()}`);
          
          // Fase 3: Client Notif
          if (clientPhone) {
            safeSendClientReply(clientPhone, `🎉 *Boas-vindas ao GSA HUB, ${clientName}!* 🎉\n\nSeu cadastro foi concluído com sucesso.\nVocê já tem acesso a todos os nossos serviços, loja e clube de benefícios!\n\n_Para falar com um atendente humano a qualquer momento, digite HUMANO._`);
          }
        }
        break;

      // 🛒 PEDIDOS DA LOJA
      case 'loja_pedidos':
        if (type === 'INSERT') {
          // Fase 2: Admin
          notifyAdmin(`💰 *NOVA VENDA (LOJA) V2* 💰\n\n🛍️ *Pedido:* #${record.id || 'N/A'}\n👤 *Cliente ID:* ${record.cliente_id || 'N/A'}\n💵 *Valor Total:* R$ ${Number(record.total || 0).toFixed(2)}\n💳 *Método:* ${record.metodo_pagamento || 'N/A'}`);
        } else if (type === 'UPDATE' && old_record) {
          const oldStatus = String(old_record.status).toLowerCase();
          const newStatus = String(record.status).toLowerCase();
          
          if (oldStatus !== newStatus) {
            // Fase 2: Admin
            notifyAdmin(`🔄 *ATUALIZAÇÃO DE PEDIDO #${record.id}*\nStatus alterado de *${oldStatus}* para *${newStatus}*.\nCliente ID: ${record.cliente_id}`);
            
            // Fase 3: Client
            if (clientPhone) {
              let msgStatus = '';
              if (newStatus === 'pago' || newStatus === 'aprovado') msgStatus = '✅ *Pagamento Aprovado!* Seu pedido já está sendo preparado.';
              else if (newStatus === 'em_expedicao' || newStatus === 'em_preparacao') msgStatus = '📦 *Em Preparação!* Seu pedido está sendo embalado com todo cuidado.';
              else if (newStatus === 'em_transporte' || newStatus === 'enviado') msgStatus = '🚚 *Saiu para Entrega!* Seu pedido já está a caminho.';
              else if (newStatus === 'concluido' || newStatus === 'entregue') msgStatus = '🎉 *Pedido Entregue!* Esperamos que aproveite muito seu produto.\nSe puder, nos avalie!';
              else if (newStatus === 'cancelado') msgStatus = '❌ *Pedido Cancelado.* Se você teve algum problema com o pagamento, fale com nosso suporte!';
              
              if (msgStatus) {
                safeSendClientReply(clientPhone, `Olá, ${clientName}!\n\n${msgStatus}\n\n*Pedido:* #${record.id}`);
              }
            }
          }
        }
        break;

      // 📄 DOCUMENTOS
      case 'cliente_documentos':
        if (type === 'INSERT') {
          // Fase 2
          notifyAdmin(`📄 *NOVO DOCUMENTO RECEBIDO*\n\n👤 *Cliente ID:* ${record.cliente_id}\n📝 *Tipo:* ${record.tipo_documento}\n📋 *Descrição:* ${record.descricao || '-'}`);
        } else if (type === 'UPDATE' && old_record) {
          const oldStatus = String(old_record.status).toLowerCase();
          const newStatus = String(record.status).toLowerCase();
          if (oldStatus !== newStatus && clientPhone) {
            if (newStatus === 'aprovado') {
              safeSendClientReply(clientPhone, `✅ *Documento Aprovado!*\n\nOlá, ${clientName}. Seu documento (${record.tipo_documento}) foi analisado e aprovado com sucesso!`);
            } else if (newStatus === 'recusado' || newStatus === 'reprovado') {
              safeSendClientReply(clientPhone, `⚠️ *Atenção com seu Documento*\n\nOlá, ${clientName}. Seu documento (${record.tipo_documento}) foi *recusado* pela nossa equipe.\n\nMotivo/Obs: ${record.observacoes || 'Verifique se a imagem está nítida.'}\n\nPor favor, envie novamente aqui pelo WhatsApp mesmo!`);
            }
          }
        }
        break;

      // ✈️ VIAGENS E ORÇAMENTOS
      case 'viagens_orcamentos':
        if (type === 'INSERT') {
          // Fase 2: Admin alert for complex lead
          notifyAdmin(`✈️ *NOVA SOLICITAÇÃO DE COTAÇÃO DE VIAGEM* ✈️\n\n🎫 *Protocolo:* ${record.protocolo}\n👤 *Cliente ID:* ${record.cliente_id}\n📍 *Origem:* ${record.origem}\n🗺️ *Destino:* ${record.destino}\n🗓️ *Ida:* ${record.data_ida} | *Volta:* ${record.data_volta || 'N/A'}\n👥 *Adultos:* ${record.adultos} | *Crianças:* ${record.criancas || 0}\n🛎️ *Hospedagem:* ${record.preferencia_hospedagem || 'Padrão'}\n📝 *Obs:* ${record.observacoes || '-'}\n\n⚠️ *Ação Necessária:* Acesse o painel para montar o pacote e enviar o link de pagamento!`);
        }
        break;

      // 🛠️ SERVIÇOS & OS & ORÇAMENTOS
      case 'orcamentos':
      case 'os_servicos':
      case 'servicos_contratados':
        if (type === 'INSERT') {
          notifyAdmin(`🛠️ *NOVA SOLICITAÇÃO (ORÇAMENTO/OS/SERVIÇO)*\n\n📋 *ID:* #${record.id}\n👤 *Cliente ID:* ${record.cliente_id || 'N/A'}\n💸 *Valor:* R$ ${Number(record.total || record.valor_total || 0).toFixed(2)}\n📝 *Tipo:* ${table.toUpperCase()}`);
        } else if (type === 'UPDATE' && old_record) {
          const oldStatus = String(old_record.status).toLowerCase();
          const newStatus = String(record.status).toLowerCase();
          
          if (oldStatus !== newStatus && clientPhone) {
            // Fase 3
            safeSendClientReply(clientPhone, `🛠️ *Atualização de Serviço*\n\nOlá, ${clientName}!\nO status do seu serviço (#${record.codigo_orcamento || record.id}) foi alterado para: *${newStatus.toUpperCase()}*.\n\nAcompanhe os detalhes diretamente com a IA!`);
          }
        }
        break;

      default:
        // Ignoring other tables for direct notifications to prevent spam
        break;
    }

  } catch (err) {
    console.error('❌ Erro processando webhook Supabase:', err.message);
  }
}

// ─── SERVIDOR HTTP ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  let urlPath = '/';
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    urlPath = urlObj.pathname;

    // Health check
    if (urlPath === '/' || urlPath === '/health' || urlPath === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'UP',
        service: 'GSA HUB WhatsApp Chatbot & Scraping Webhook',
        timestamp: new Date().toISOString(),
        activeSessions: Object.keys(userSessions).length
      }));
    }

    // Public Travel Package Feeds
    if (req.method === 'GET' && urlPath.startsWith('/feeds/viagens')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Cache-Control', 'no-cache');

      if (urlPath.includes('nacionais')) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(GSA_PACOTES_NACIONAIS, null, 2));
      }
      if (urlPath.includes('internacionais')) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(GSA_PACOTES_INTERNACIONAIS, null, 2));
      }
      if (urlPath.includes('promoc')) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(GSA_PACOTES_PROMOCOES, null, 2));
      }
      if (urlPath.includes('.csv')) {
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
        const all = [...GSA_PACOTES_NACIONAIS, ...GSA_PACOTES_INTERNACIONAIS, ...GSA_PACOTES_PROMOCOES];
        const headers = 'codigo,titulo,destino,origem,hotel_nome,hotel_categoria,noites,dias,preco_custo,imagem_url,categoria\n';
        const rows = all.map(p => `"${p.codigo}","${p.titulo}","${p.destino}","${p.origem}","${p.hotel_nome}","${p.hotel_categoria}",${p.noites},${p.dias},${p.preco_custo},"${p.imagem_url}","${p.categoria}"`).join('\n');
        return res.end(headers + rows);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify([...GSA_PACOTES_NACIONAIS, ...GSA_PACOTES_INTERNACIONAIS, ...GSA_PACOTES_PROMOCOES], null, 2));
    }

    // ── FASE 7: API DE BUSCA WEB DROPSHIPPING ──
    if (urlPath.startsWith('/api/dropship-search') && req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Content-Type', 'application/json');
      
      const q = urlObj.searchParams.get('q') || 'Produto';
      const baseCost = 40 + Math.random() * 100;
      const imgKeyword = encodeURIComponent(q.split(' ')[0] || 'produto');
      
      const products = [
        {
          id: `ext_${Math.floor(Math.random()*1000)}`,
          codigo_produto: 'DROP-001',
          nome: `${q} - Modelo Alpha`,
          descricao: 'Produto importado exclusivo GSA.',
          valor: baseCost * 2,
          imagem_url: `https://loremflickr.com/300/300/${imgKeyword}`,
          status: 'ativo'
        },
        {
          id: `ext_${Math.floor(Math.random()*1000)}`,
          codigo_produto: 'DROP-002',
          nome: `${q} - Modelo Beta`,
          descricao: 'Produto importado exclusivo GSA.',
          valor: (baseCost * 0.85) * 2,
          imagem_url: `https://loremflickr.com/300/300/${imgKeyword}`,
          status: 'ativo'
        },
        {
          id: `ext_${Math.floor(Math.random()*1000)}`,
          codigo_produto: 'DROP-003',
          nome: `${q} - Modelo Gamma`,
          descricao: 'Produto importado exclusivo GSA.',
          valor: (baseCost * 0.7) * 2,
          imagem_url: `https://loremflickr.com/300/300/${imgKeyword}`,
          status: 'ativo'
        }
      ];
      
      notifyAdmin(`🚨 *NOVA BUSCA DROPSHIP NO SITE* 🚨\n\n🔍 Termo: *${q}*\nO site acabou de exibir os 3 produtos com 100% de margem para o cliente.\nSe ele fechar pedido, aparecerá como pedido DROP.`);

      return res.end(JSON.stringify(products));
    }

    // Verificação do webhook (GET)
    if (req.method === 'GET' && urlPath.includes('/webhook')) {
      const mode = urlObj.searchParams.get('hub.mode');
      const token = urlObj.searchParams.get('hub.verify_token');
      const challenge = urlObj.searchParams.get('hub.challenge');
      console.log(`🔐 Verificação recebida: mode=${mode} token=${token}`);
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verificado com sucesso!');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(challenge);
      }
      console.warn('⚠️ Token inválido na verificação do webhook');
      res.writeHead(403);
      return res.end('Forbidden');
    }

    // Recebimento de mensagens e webhooks (POST)
    if (req.method === 'POST' && urlPath.includes('/webhook')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        // Responder 200 imediatamente para não bloquear o chamador
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));

        // Roteamento interno
        if (urlPath.includes('/webhook/supabase-update')) {
          return handleSupabaseWebhook(req, res, body);
        }

        if (urlPath.includes('/webhook/gsa-produtos-scraping') || urlPath.includes('/webhook/gsa-viagens-scraping') || urlPath.includes('/webhook/scraping')) {
          return handleProductScraping(body);
        }

        // Processar assincronamente Evolution API
        try {
          const data = JSON.parse(body);
          console.log('📥 POST recebido:', JSON.stringify(data).substring(0, 300));

          let fromPhone = '';
          let textBody = '';
          let pushName = '';
          let mediaType = null;


          // 1. Formato Evolution API
          if (data.data && data.data.key) {
            if (data.data.key.fromMe) {
              // Ignorar mensagens enviadas pelo próprio bot/atendente
              return;
            }
            if (data.event && data.event !== 'messages.upsert') {
              // Ignorar atualizações de status (delivery, read, etc)
              return;
            }

            let rawJid = data.data.key.remoteJid || '';
            const altJid = data.data.key.remoteJidAlt || '';
            const addressingMode = data.data.key.addressingMode || '';
            const participant = data.data.key.participant || '';

            let actualTargetJid = rawJid;
            if (rawJid.includes('@lid')) {
              actualTargetJid = rawJid;
              fromPhone = (altJid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
            } else if (altJid.includes('@lid')) {
              actualTargetJid = altJid;
              fromPhone = rawJid.split('@')[0].split(':')[0].replace(/\D/g, '');
            } else {
              fromPhone = (rawJid || altJid).split('@')[0].split(':')[0].replace(/\D/g, '');
              actualTargetJid = rawJid || altJid;
            }

            // If fromPhone is still empty, try extracting from participant or rawJid
            if (!fromPhone) {
              fromPhone = (participant || rawJid).split('@')[0].split(':')[0].replace(/\D/g, '');
            }

            // Register contact context with antiBanEngine so outgoing responses route to valid WhatsApp JID / LID
            if (fromPhone && actualTargetJid) {
              antiBanEngine.registerContactContext(fromPhone, actualTargetJid, data.data.key);
            }

            // ── Captura pushName e tipo de mídia ──────────────────────────────
            pushName = data.data.pushName || data.data.key?.pushName || '';
            const msgData = data.data.message || {};

            if (msgData.imageMessage) {
              mediaType = 'image';
              textBody = msgData.imageMessage.caption || '';
            } else if (msgData.audioMessage || msgData.pttMessage) {
              mediaType = 'audio';
              textBody = '';
            } else if (msgData.videoMessage) {
              mediaType = 'video';
              textBody = msgData.videoMessage.caption || '';
            } else if (msgData.documentMessage) {
              mediaType = 'document';
              textBody = msgData.documentMessage.fileName || '';
            } else {
              textBody = msgData.conversation || msgData.extendedTextMessage?.text || '';
            }

          }
          // 2. Formato Meta API
          else if (data.entry && data.entry[0]) {
            const change = data.entry[0].changes && data.entry[0].changes[0];
            const value = change && change.value;
            const msg = value && value.messages && value.messages[0];
            if (msg) {
              fromPhone = (msg.from || '').split('@')[0].split(':')[0].replace(/\D/g, '');
              textBody = msg.type === 'text' && msg.text ? msg.text.body : '';
            }
          }

          if (!fromPhone) {
            console.warn('⚠️ Mensagem sem fromPhone, ignorando');
            return;
          }

          sessionMutex.runExclusive(fromPhone, async () => {
            try {
              const rawMessageData = data.data || {};
              await processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData);
            } catch (errProcess) {
              console.error(`❌ Exceção ao processar mensagem para ${fromPhone}:`, errProcess);
              sendWhatsAppReply(fromPhone, '❌ Desculpe, ocorreu uma falha ao processar sua mensagem. Digite 0 para voltar ao menu principal.');
            }
          });

        } catch (e) {
          console.error('❌ Erro ao processar POST:', e.message, '| body:', body.substring(0, 200));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: urlPath }));

  } catch (e) {
    console.error('❌ Erro no servidor HTTP:', e.message);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
});

server.on('error', (err) => {
  console.error('❌ Erro crítico no servidor:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso! Encerrando...`);
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Exceção não capturada:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promise rejeitada:', reason);
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 ════════════════════════════════════════════════');
    console.log(`🚀  GSA HUB WhatsApp Chatbot — Porta ${PORT} ATIVA`);
    console.log('🚀 ════════════════════════════════════════════════');
    console.log(`📡  Supabase: ${SUPABASE_HOST}`);
    console.log(`📱  Phone ID: ${PHONE_NUMBER_ID}`);
    console.log(`🔐  Token: ${VERIFY_TOKEN}`);
    console.log('');
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SessionMutex,
    sessionMutex,
    callGeminiProtocolNLU,
    parseProtocolIntentFallback,
    validateAndSanitizeField,
    dispatchAdminProtocolAlert,
    handleProtocolSelfServiceFlow,
    handlePartnerRedemptionFlow,
    searchPartnersFuzzy,
    fetchPartnersForAI,
    checkDuplicateRedemptionDb,
    dispatchAdminRedemptionAlert,
    executeBenefitRedemptionRpc,
    selectRedemptionPartner,
    extractPartnerTermFromText,
    supabaseRpc,
    supabaseGet,
    supabasePost,
    supabasePatch,
    userSessions,
    processMessage,
    sendWhatsAppReply,
    ADMIN_MASTER_PHONE,
    SUPPORT_COMPANY_PHONE,
    server
  };
}
