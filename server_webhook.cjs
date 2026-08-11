'use strict';
const http = require('http');
const https = require('https');

const PORT = 5680;
const VERIFY_TOKEN = 'gsa_hub_whatsapp_token_2026';
const META_TOKEN = 'EAATzMfBrFUUBSKUGYDkioeRHENS7hcliAdztOVnfpGTZCxA9H58yU32BxtaZCrve2HrEvC3wRsSgXsfvPp2df38Qu6KxpPBI2UeRhQWdY7ZADeFoEs6rOE8CZC4B8bv6KNZCNQZAKhZABLIQNMk98S6RcoQxdoy2MQ2r5xLKDDjJ7wISHL6n21US9QT993NzswJfQZDZD';
const PHONE_NUMBER_ID = '1208358025697171'; // Número de teste +1 555-677-0092

const SUPABASE_HOST = 'ocgajvagxagutfvgxwsy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZ2FqdmFneGFndXRmdmd4d3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTY0MDksImV4cCI6MjA4OTUzMjQwOX0.1OXsjDAsGl82u6ytGQ5iX2vroXjhmqUoFkbOLKbO6XI';

const userSessions = {};

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

// ─── SUPABASE HELPER ────────────────────────────────────────────────────────
const SERVICE_ROLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODYwNjMzNzcsImV4cCI6MjEwMTQyMzM3N30.AuVtgQf7nnOrXKoElM_y9pVGW12xledsLpZGg0qOjME';

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
  supabaseGet(`/rest/v1/produtos?status=eq.ativo&select=id,codigo_produto,nome,descricao,valor,desconto_ativo,valor_promocional&limit=10`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
  });
}

function fetchTravelPackages(callback) {
  supabaseGet(`/rest/v1/viagens_pacotes?status=eq.publicado&select=id,titulo,preco_venda,data_ida&limit=5`, (err, res) => {
    callback(err, Array.isArray(res) ? res : []);
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

function sendWhatsAppReply(to, messageText, retryCount = 0) {
  if (!messageText || !to) {
    console.error('❌ sendWhatsAppReply: parâmetros inválidos', { to, messageText: messageText ? 'ok' : 'vazio' });
    return;
  }

  const cleanPhone = to.replace(/\D/g, '');
  const payload = JSON.stringify({
    number: cleanPhone,
    text: messageText
  });

  const options = {
    hostname: '127.0.0.1',
    port: 8080,
    path: '/message/sendText/GSA_WhatsApp',
    method: 'POST',
    headers: {
      'apikey': 'gsa_hub_evolution_token_2026',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  console.log(`📤 Enviando resposta via Evolution API para ${cleanPhone} (${messageText.length} chars, tentativa ${retryCount + 1})...`);

  try {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Mensagem entregue via Evolution API para ${cleanPhone}`);
        } else {
          console.error(`❌ Erro na Evolution API [${res.statusCode}]:`, data);
          if (retryCount < 2) {
            console.log('🔄 Reiniciando socket da Evolution API e tentando reenviar mensagem em 2s...');
            triggerInstanceRestart();
            setTimeout(() => sendWhatsAppReply(to, messageText, retryCount + 1), 2000);
          }
        }
      });
    });
    req.setTimeout(10000, () => {
      console.error('⏰ Timeout ao enviar mensagem para Evolution API');
      req.destroy();
    });
    req.on('error', (err) => {
      console.error('❌ Erro ao enviar mensagem:', err.message);
    });
    req.write(payload);
    req.end();
  } catch (e) {
    console.error('❌ Exceção ao enviar mensagem WhatsApp:', e.message);
  }
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
  const filter = `or=(telefone.eq.${pClean},telefone.eq.${pWith55})`;
  
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
  const reqC = https.request({
    hostname: SUPABASE_HOST,
    port: 443,
    path: `/rest/v1/clientes?${filter}&select=*&limit=1`,
    method: 'GET',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  }, res => {
    let d = '';
    res.on('data', chunk => d += chunk);
    res.on('end', () => {
      try {
        const rows = JSON.parse(d);
        if (rows.length > 0) multiRole.cliente = rows[0];
      } catch (e) {}
      checkDone();
    });
  });
  reqC.on('error', checkDone);
  reqC.end();

  // 2. Afiliados
  const reqA = https.request({
    hostname: SUPABASE_HOST,
    port: 443,
    path: `/rest/v1/gsa_afiliados?${filter}&select=*&limit=1`,
    method: 'GET',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  }, res => {
    let d = '';
    res.on('data', chunk => d += chunk);
    res.on('end', () => {
      try {
        const rows = JSON.parse(d);
        if (rows.length > 0) multiRole.afiliado = rows[0];
      } catch (e) {}
      checkDone();
    });
  });
  reqA.on('error', checkDone);
  reqA.end();

  // 3. Fornecedores
  const reqF = https.request({
    hostname: SUPABASE_HOST,
    port: 443,
    path: `/rest/v1/fornecedores?${filter}&select=*&limit=1`,
    method: 'GET',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  }, res => {
    let d = '';
    res.on('data', chunk => d += chunk);
    res.on('end', () => {
      try {
        const rows = JSON.parse(d);
        if (rows.length > 0) multiRole.fornecedor = rows[0];
      } catch (e) {}
      checkDone();
    });
  });
  reqF.on('error', checkDone);
  reqF.end();

  // 4. Prestadores
  const reqP = https.request({
    hostname: SUPABASE_HOST,
    port: 443,
    path: `/rest/v1/prestadores?${filter}&select=*&limit=1`,
    method: 'GET',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  }, res => {
    let d = '';
    res.on('data', chunk => d += chunk);
    res.on('end', () => {
      try {
        const rows = JSON.parse(d);
        if (rows.length > 0) multiRole.prestador = rows[0];
      } catch (e) {}
      checkDone();
    });
  });
  reqP.on('error', checkDone);
  reqP.end();
}

function generateInvoicePdfBase64(fatura, client) {
  const cod = fatura?.codigo_fatura || `FAT-${String(fatura?.id || '0000').substring(0,6)}`;
  const valor = Number(fatura?.valor_total || 0).toFixed(2);
  const venc = fatura?.data_vencimento ? new Date(fatura.data_vencimento).toLocaleDateString('pt-BR') : 'N/A';
  const emissao = fatura?.data_emissao ? new Date(fatura.data_emissao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const nomeCliente = ((client?.nome || client?.nome_completo || 'Cliente GSA HUB')).replace(/[()\\\\]/g, '');
  const cpfCliente = (client?.cpf || client?.cnpj || 'N/A').replace(/[()\\\\]/g, '');
  const status = (fatura?.status || 'PENDENTE').toUpperCase();

  const streamLines = [
    "0.06 0.09 0.16 rg 0 770 595 72 re f",
    "0.31 0.27 0.90 rg 0 765 595 5 re f",
    "1 1 1 rg BT /F2 18 Tf 30 812 Td (GSA SERVICOS & TECNOLOGIA) Tj ET",
    "0.7 0.75 0.85 rg BT /F1 9 Tf 30 795 Td (CNPJ: 45.123.890/0001-99  |  suporte@gsa.com.br) Tj ET",
    "1 1 1 rg BT /F2 16 Tf 420 812 Td (FATURA DE COBRANCA) Tj ET",
    "0.8 0.85 0.95 rg BT /F1 9 Tf 420 795 Td (No: " + cod + ") Tj ET",
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

function sendWhatsAppMedia(to, mediaUrl, fileName, caption, mediaType = 'document') {
  if (!mediaUrl || !to) return;
  const cleanPhone = to.replace(/\D/g, '');
  let cleanMedia = mediaUrl;
  if (cleanMedia.includes(';base64,')) {
    cleanMedia = cleanMedia.split(';base64,')[1];
  }

  const payload = JSON.stringify({
    number: cleanPhone,
    mediatype: mediaType,
    mimetype: mediaType === 'document' ? 'application/pdf' : 'image/png',
    media: cleanMedia,
    fileName: fileName || 'documento.pdf',
    caption: caption || ''
  });

  const options = {
    hostname: 'evolution-api',
    port: 8080,
    path: '/message/sendMedia/GSA_WhatsApp',
    method: 'POST',
    headers: {
      'apikey': 'gsa_hub_evolution_token_2026',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  console.log(`📤 Enviando mídia (${mediaType}) via Evolution API para ${cleanPhone}...`);

  try {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Mídia entregue via Evolution API para ${cleanPhone}`);
        } else {
          console.error(`❌ Erro mídia Evolution API [${res.statusCode}]:`, data);
        }
      });
    });
    req.setTimeout(15000, () => req.destroy());
    req.on('error', err => console.error('❌ Erro sendWhatsAppMedia:', err.message));
    req.write(payload);
    req.end();
  } catch (e) {
    console.error('❌ Exceção ao enviar mídia:', e.message);
  }
}


// ─── NLP BÁSICO (PALAVRAS-CHAVE) ──────────────────────────────────────────────
function getMenuIntent(text) {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  if (t === '10' || /atendente|humano|suporte|falar com alguem/i.test(t)) return '10';
  if (t === '1' || /cliente|minha conta|faturas|fatura|boletos|boleto|2 via|segunda via|pagar/i.test(t)) return '1';
  if (t === '2' || /contratar|servicos|serviço|assinar|planos/i.test(t)) return '2';
  if (t === '3' || /loja|produtos|comprar|promocoes/i.test(t)) return '3';
  if (t === '4' || /viagem|viagens|pacotes|viajar/i.test(t)) return '4';
  if (t === '5' || /seguro|saude|plano de saude|cotacao/i.test(t)) return '5';
  if (t === '6' || /classificados|anuncios/i.test(t)) return '6';
  if (t === '7' || /indique|indica|indicacao|afiliado/i.test(t)) return '7';
  if (t === '8' || /pontos|fidelidade|vip|saldo/i.test(t)) return '8';
  if (t === '9' || /parceiros|fornecedor|prestador/i.test(t)) return '9';
  
  return text.trim();
}

// ─── HIERARQUIA DE NAVEGAÇÃO DE MENUS (VOLTAR AO ANTERIOR / PRINCIPAL) ────────
const STATE_PARENTS = {
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

// ─── PROCESSAMENTO DE MENSAGEM ────────────────────────────────────────────────
function processMessage(fromPhone, textBody, messageType) {
  const text = (textBody || '').trim();
  const lower = text.toLowerCase();

  console.log(`📨 Processando msg de ${fromPhone}: "${text}"`);

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
        session.errors = (session.errors || 0) + 1;
        if (session.errors >= 3) {
          session.state = 'MAIN_MENU';
          session.errors = 0;
          sendWhatsAppReply(fromPhone, '🤖 Notei que você está com dificuldades. Vou te transferir para um de nossos atendentes humanos...');
          setTimeout(() => {
            sendWhatsAppReply(fromPhone, '👉 Clique no link abaixo para falar com um atendente:\n\nhttps://wa.me/5511971858372');
          }, 2000);
        } else {
          sendWhatsAppReply(fromPhone, `❌ Não consegui entender sua solicitação.\n\n${MAIN_MENU_TEXT}`);
        }
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
      const pts = session.client.saldo_pontos || 0;
      if (pts <= 0) {
        sendWhatsAppReply(fromPhone, '❌ Você não possui pontos suficientes para converter.\n\n_Digite 0 para voltar ao menu._');
        return;
      }
      sendWhatsAppReply(fromPhone, '🔄 Convertendo pontos (100 pontos = R$ 1,00)...');
      // PATCH cliente
      const convertedValue = pts / 100;
      const newSaldoCarteira = (session.client.saldo_carteira || 0) + convertedValue;
      supabasePatch(`/rest/v1/clientes?id=eq.${session.client.id}`, { saldo_pontos: 0, saldo_carteira: newSaldoCarteira }, (err, res) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        if (err) {
          sendWhatsAppReply(fromPhone, '❌ Erro ao converter pontos. Tente novamente mais tarde.\n\n_Digite 0 para voltar._');
        } else {
          sendWhatsAppReply(fromPhone, `✅ *Conversão Concluída!*\n\n${pts} pontos foram convertidos com sucesso para *${convertedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*.\nNovo Saldo em Carteira: *${newSaldoCarteira.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n_Digite 0 para voltar._`);
        }
      });
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
    const valor = session.client.saldo_carteira || 0;
    sendWhatsAppReply(fromPhone, `🔄 Registrando sua solicitação de saque no sistema...`);
    
    // Zera a carteira do cliente
    supabasePatch(`/rest/v1/clientes?id=eq.${session.client.id}`, { saldo_carteira: 0 }, (errPatch, resPatch) => {
      if (errPatch) {
        session.state = 'MAIN_MENU';
        sendWhatsAppReply(fromPhone, `❌ Erro ao processar saque. Tente novamente mais tarde.\n\n_Digite 0 para voltar._`);
        return;
      }
      // Insere o saque
      const saqueData = {
        cliente_id: session.client.id,
        valor: valor,
        taxa_aplicada: 0,
        valor_liquido: valor,
        tipo_chave_pix: session.pixType,
        chave_pix: pixKey,
        status: 'pendente',
        data_solicitacao: new Date().toISOString()
      };
      supabasePost('/rest/v1/saques', saqueData, (errPost, resPost) => {
        session.state = 'MAIN_MENU';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, `✅ *Solicitação de Saque Registrada!*\n\nValor: *${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\nChave PIX: ${pixKey}\nStatus: *Em análise / Pendente*\n\nNosso departamento financeiro processará seu pagamento em breve.\n\n_Digite 0 para voltar ao menu principal._`);
      });
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
  if (session.state === 'CHECKOUT_DOC') {
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
        createOrcamento(fromPhone, session, client.id);
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

          if (p.imagem_url && p.imagem_url.startsWith('http')) {
            sendWhatsAppMedia(fromPhone, p.imagem_url, `${p.nome}.png`, caption, 'image');
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

          if (p.imagem_url && p.imagem_url.startsWith('http')) {
            sendWhatsAppMedia(fromPhone, p.imagem_url, `${p.nome}.png`, caption, 'image');
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
      session.state = 'PARTNER_PROVIDER_WITHDRAW_PIX';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '💸 *Solicitação de Saque PIX (Prestador)*\n\nPor favor, digite sua *Chave PIX* (CPF, CNPJ, E-mail, Telefone ou Chave Aleatória):\n\n_Digite 0 para cancelar._');
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
    
    supabasePost('/rest/v1/prestador_saques', {
      prestador_id: provider?.id || null,
      chave_pix: pixKey,
      valor: 0.00,
      status: 'solicitado'
    }, () => {
      session.state = 'PARTNER_PROVIDER_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, `✅ *Solicitação de Saque PIX Registrada!*\n\n🔢 *Protocolo:* ${proto}\n🔑 *Chave PIX:* ${pixKey}\n\nO valor do repasse disponível será transferido após a conferência técnica!\n\n_Digite 0 para voltar._`);
    });
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

  // ── ESTADO: NPS_RATING ──────────────────────────────────────────────────────
  if (session.state === 'NPS_RATING') {
    const nota = parseInt(text, 10);
    session.state = 'MAIN_MENU';
    userSessions[fromPhone] = session;
    
    if (!isNaN(nota) && nota >= 1 && nota <= 5) {
      sendWhatsAppReply(fromPhone, `Obrigado por avaliar com a nota ${nota}! 🙏\nSua opinião nos ajuda a melhorar cada vez mais o GSA HUB.\n\n${MAIN_MENU_TEXT}`);
    } else {
      sendWhatsAppReply(fromPhone, `Agradecemos pelo seu tempo! Retornando ao menu principal...\n\n${MAIN_MENU_TEXT}`);
    }
    return;
  }

  // Fallback: sempre mostrar menu principal
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
                  shopee_shop: row.shop_name || row.seller_name || 'Vendedor Shopee'
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

function handleSupabaseWebhook(req, res, bodyData) {
  try {
    const data = JSON.parse(bodyData);
    console.log('📥 Supabase Webhook Recebido:', JSON.stringify(data).substring(0, 300));

    const { type, table, record, old_record } = data;
    if (!record || (!record.telefone && !record.telefone_contato)) {
      console.warn('⚠️ Registro sem telefone associado. Ignorando notificação.');
      return;
    }

    // Format phone
    let rawPhone = record.telefone || record.telefone_contato;
    let phone = String(rawPhone).replace(/\D/g, '');
    if (!phone.startsWith('55') && phone.length >= 10) phone = '55' + phone;

    const getDisplayName = (rec) => {
      return (rec.nome || rec.nome_completo || rec.razao_social || rec.nome_fantasia || 'Cliente/Parceiro').toUpperCase();
    };

    const nome = getDisplayName(record);
    const tabelaUpper = String(table).toUpperCase();

    if (type === 'INSERT') {
      const msg = `🎉 *Boas-vindas ao GSA HUB, ${nome}!* 🎉\n\nSeu cadastro no painel de *${tabelaUpper}* foi realizado com sucesso!\n\nAgora você pode acessar todas as funcionalidades do sistema.\nSe precisar de ajuda, digite *0* para falar com o suporte.`;
      sendWhatsAppReply(phone, msg);
    } else if (type === 'UPDATE') {
      if (!old_record) return;

      const ignoreFields = ['id', 'created_at', 'updated_at', 'senha', 'token', 'avatar_url', 'ultimo_acesso'];
      const changed = [];

      for (const key of Object.keys(record)) {
        if (ignoreFields.includes(key.toLowerCase())) continue;
        const oldVal = old_record[key];
        const newVal = record[key];
        
        // Tratar nulos e indefinidos para evitar falsos positivos
        const oldStr = (oldVal === null || oldVal === undefined) ? 'Vazio' : String(oldVal).trim();
        const newStr = (newVal === null || newVal === undefined) ? 'Vazio' : String(newVal).trim();

        if (oldStr !== newStr) {
          const friendlyKey = key.replace(/_/g, ' ').toUpperCase();
          changed.push(`🔹 *${friendlyKey}:*\nDe: _${oldStr}_\nPara: _${newStr}_`);
        }
      }

      if (changed.length > 0) {
        const msg = `🔔 *ATUALIZAÇÃO DE CADASTRO (${tabelaUpper})*\n\nOlá, *${nome}*!\nHouve uma movimentação no seu cadastro no sistema GSA HUB.\n\nVeja o que mudou:\n\n${changed.join('\n\n')}\n\n_Para dúvidas, fale com nosso suporte enviando a palavra HUMANO._`;
        sendWhatsAppReply(phone, msg);
      }
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
            if (rawJid.includes('@lid') && altJid && !altJid.includes('@lid')) {
              rawJid = altJid;
            } else if (!rawJid || rawJid.includes('@lid')) {
              rawJid = altJid || rawJid;
            }

            if (rawJid.includes('@lid')) {
              // Não processar jids de LID interno sem telefone válido
              return;
            }

            fromPhone = rawJid.split('@')[0].split(':')[0].replace(/\D/g, '');
            textBody = data.data.message?.conversation || data.data.message?.extendedTextMessage?.text || '';
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

          try {
            processMessage(fromPhone, textBody);
          } catch (errProcess) {
            console.error('❌ Exceção ao processar mensagem:', errProcess);
            sendWhatsAppReply(fromPhone, '❌ Desculpe, ocorreu uma falha ao processar sua mensagem. Digite 0 para voltar ao menu principal.');
          }
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
