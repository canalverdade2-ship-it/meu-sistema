'use strict';
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'server_webhook_vps.cjs');
const dstPath = path.join(__dirname, 'server_webhook_final.cjs');

let code = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Add fetch helpers and Store Direct functions before fetchCoupons
const helperSnippet = `
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

  const lines = (text || '').split(/\\r?\\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[^\\w\\*a-zA-Z0-9#]+/g, '').trim();

    if (!prodName && /^\\*?(?:produto|item)\\*?:\\s*/i.test(line)) {
      prodName = line.replace(/^\\*?(?:produto|item)\\*?:\\s*/i, '').replace(/[\\*\\_]/g, '').trim();
    }

    if (!prodCode && /^\\*?(?:código|codigo|ref|cod)\\*?:\\s*/i.test(line)) {
      prodCode = line.replace(/^\\*?(?:código|codigo|ref|cod)\\*?:\\s*/i, '').replace(/[\\*\\_]/g, '').trim();
    }

    if (/^\\*?(?:quantidade|qtd)\\*?:\\s*/i.test(line)) {
      const qMatch = line.match(/\\b(\\d+)\\b/);
      if (qMatch) {
        prodQty = parseInt(qMatch[1], 10) || 1;
      }
    }

    if (prodPrice === 0 && /^\\*?(?:valor|preço|preco)\\*?:\\s*/i.test(line)) {
      const vMatch = line.match(/R\\$\\s*([\\d\\.,]+)/i);
      if (vMatch && vMatch[1]) {
        const cleanP = vMatch[1].replace(/\\./g, '').replace(',', '.');
        prodPrice = parseFloat(cleanP) || 0;
      }
    }

    if (!prodUuid) {
      const uMatch = rawLine.match(/produtos\\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uMatch && uMatch[1]) {
        prodUuid = uMatch[1];
      }
    }
  }

  if (!prodCode) {
    const rawCodeMatch = (text || '').match(/(SHP-[\\w-]+|PROD-[\\w-]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (rawCodeMatch) prodCode = rawCodeMatch[1].trim();
  }

  return {
    prodName: prodName || 'Produto da Loja GSA',
    prodCode: prodCode || (prodUuid ? \`PROD-\${prodUuid.substring(0,8).toUpperCase()}\` : 'PROD-LOJA'),
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
    filter = \`id=eq.\${uuid}\`;
  } else if (code && code !== 'PROD-LOJA' && code !== 'N/A') {
    filter = \`codigo_produto=eq.\${encodeURIComponent(code)}\`;
  } else if (name) {
    const cleanName = name.replace(/[^a-zA-Z0-9\\s]/g, '').substring(0, 30);
    filter = \`nome=ilike.*\${encodeURIComponent(cleanName)}*\`;
  }

  if (!filter) {
    return callback(null, null);
  }

  supabaseGet(\`/rest/v1/produtos?\${filter}&select=id,codigo_produto,nome,descricao,valor,desconto_ativo,valor_promocional,imagem_url&limit=1\`, (err, res) => {
    if (!err && Array.isArray(res) && res.length > 0) {
      return callback(null, res[0]);
    }
    if (name && (code || uuid)) {
      const cleanName = name.replace(/[^a-zA-Z0-9\\s]/g, '').substring(0, 30);
      supabaseGet(\`/rest/v1/produtos?nome=ilike.*\${encodeURIComponent(cleanName)}*&select=id,codigo_produto,nome,descricao,valor,desconto_ativo,valor_promocional,imagem_url&limit=1\`, (err2, res2) => {
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

function handleStoreDirectPurchase(fromPhone, text, session) {
  const parsed = parseStorePurchaseMessage(text);
  console.log(\`🛒 Processando Compra Direta Loja para \${fromPhone}:\`, JSON.stringify(parsed));

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
      userSessions[fromPhone] = session;

      const rawNome = clientRecord.nome || clientRecord.nome_completo || clientRecord.razao_social || 'Cliente';
      const nome = formatBoldName(rawNome);

      let msg = \`🛒 *PEDIDO LOJA GSA HUB* 🛒\\n\\n\`;
      msg += \`Olá, *\${nome}*! Recebemos sua solicitação de compra:\\n\\n\`;
      msg += \`📦 *Produto:* \${prodName}\\n\`;
      msg += \`🔖 *Código:* \${prodCode}\\n\`;
      msg += \`🔢 *Quantidade:* \${parsed.prodQty} unidade(s)\\n\`;
      msg += \`💰 *Valor Unitário:* R$ \${finalUnitPrice.toFixed(2).replace('.', ',')}\\n\`;
      msg += \`💵 *Total a Pagar:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n\`;
      msg += \`Como você deseja prosseguir para finalizar?\\n\\n\`;
      msg += \`1️⃣ 🟢 *Pagar via PIX* (Instantâneo - QR Code e Copia e Cola)\\n\`;
      msg += \`2️⃣ 💳 *Pagar com Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\\n\`;
      msg += \`3️⃣ 📍 *Calcular Frete / Informar Endereço de Entrega*\\n\`;
      msg += \`4️⃣ 👤 *Falar com Atendente Humano*\\n\`;
      msg += \`0️⃣ *Cancelar e Voltar ao Menu Principal*\\n\\n\`;
      msg += \`_Digite o número da opção desejada:_\`;

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

      let msg = \`🛒 *PEDIDO LOJA GSA HUB* 🛒\\n\\n\`;
      msg += \`Olá! Que excelente escolha! 👏\\n\\n\`;
      msg += \`📦 *Produto:* \${prodName}\\n\`;
      msg += \`🔖 *Código:* \${prodCode}\\n\`;
      msg += \`🔢 *Quantidade:* \${parsed.prodQty} unidade(s)\\n\`;
      msg += \`💰 *Valor Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n\`;
      msg += \`Para vincularmos seu pedido e gerarmos sua cobrança segura (PIX ou Cartão), por favor, digite seu *CPF ou CNPJ* (apenas números):\\n\\n\`;
      msg += \`_Digite 0 para cancelar e voltar ao menu._\`;

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

    const orcCod = \`ORC-\${new Date().getFullYear()}-\${Math.floor(1000 + Math.random() * 9000)}\`;
    let obs = \`🛒 Pedido de Compra Direta via WhatsApp (#COMPRA_LOJA_GSA):\\n\`;
    obs += \`• \${qtd}x \${prodName} (\${prodCode}) — R$ \${total.toFixed(2)}\\n\`;
    if (session.cep) {
      obs += \`📍 Entrega: CEP \${session.cep} - Nº/Compl: \${session.addressNum || 'S/N'}\\n\`;
    }
    obs += \`💳 Forma de Pagamento: \${paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito'}\`;

    const orcData = {
      codigo_orcamento: orcCod,
      cliente_id: clientId,
      categoria: 'produto',
      valor_produto: total,
      desconto: 0,
      total: total,
      status: 'aberto',
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
        codigo_fatura: \`FAT-\${new Date().getFullYear()}-\${Math.floor(1000 + Math.random() * 9000)}\`,
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
            'Authorization': \`Bearer \${SUPABASE_KEY}\`,
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
                  sendWhatsAppReply(fromPhone, \`✅ *Pedido Registrado:* \${orcCod}\\n💰 *Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n🟢 *Chave PIX Copia e Cola:*\`);
                  sendWhatsAppReply(fromPhone, \`\`\`\${pixCode}\`\`\`);

                  if (qrCodeUrl) {
                    sendWhatsAppMedia(fromPhone, qrCodeUrl, \`pix_\${orcCod}.png\`, \`QR Code PIX - R$ \${total.toFixed(2).replace('.', ',')}\`, 'image');
                  }

                  setTimeout(() => {
                    sendWhatsAppReply(fromPhone, \`⚡ *Pagamento Instantâneo!*\\nAssim que o pagamento for realizado, nosso sistema processará seu pedido automaticamente.\\n\\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*\`);
                  }, 2000);
                } else if (link) {
                  sendWhatsAppReply(fromPhone, \`✅ *Pedido Registrado:* \${orcCod}\\n💰 *Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n🟢 *Pague via PIX pelo Link Seguro InfinitePay:*\\n👉 \${link}\\n\\n⚡ A confirmação é instantânea!\\n\\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*\`);
                } else {
                  sendWhatsAppReply(fromPhone, \`✅ *Pedido Registrado:* \${orcCod}\\n💰 *Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\\n\\nAssim que pago, envie o comprovante por aqui.\\n\\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*\`);
                }
              } else {
                // Cartão de Crédito
                if (link) {
                  sendWhatsAppReply(fromPhone, \`✅ *Pedido Registrado:* \${orcCod}\\n💰 *Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n💳 *Link de Pagamento com Cartão (InfinitePay):*\\n👉 \${link}\\n\\nVocê pode parcelar em até 12x no checkout!\\n\\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*\`);
                } else {
                  sendWhatsAppReply(fromPhone, \`✅ *Pedido Registrado:* \${orcCod}\\n💰 *Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n💳 Acesse nosso portal para pagar com cartão:\\nhttps://gsahub.pages.dev/\\n\\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*\`);
                }
              }
            } catch (ex) {
              sendWhatsAppReply(fromPhone, \`✅ *Pedido Registrado:* \${orcCod}\\n💰 *Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n💳 Nossa equipe comercial entrará em contato para o envio do comprovante/pagamento.\\n\\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*\`);
            }
          });
        });

        reqE.on('error', (errReq) => {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, \`✅ *Pedido Registrado:* \${orcCod}\\n💰 *Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\\n\\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*\`);
        });

        reqE.setTimeout(8000, () => {
          session.state = 'NPS_RATING';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, \`✅ *Pedido Registrado:* \${orcCod}\\n💰 *Total:* R$ \${total.toFixed(2).replace('.', ',')}\\n\\n🟢 *PIX Chave CNPJ GSA:* financeiro@gsa.com\\n\\n🌟 *Como avalia nosso atendimento automático de 1 a 5?*\`);
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
`;

// Insert helperSnippet before fetchCoupons
const fetchCouponsTarget = 'function fetchCoupons(callback) {';
if (code.includes(fetchCouponsTarget)) {
  code = code.replace(fetchCouponsTarget, helperSnippet + '\n' + fetchCouponsTarget);
  console.log('✅ Injected helper functions before fetchCoupons');
} else {
  console.error('❌ Could not find fetchCoupons');
}

// 2. Add STATE_PARENTS entries
const stateParentsTarget = `'STORE_CHECKOUT': 'STORE_PRODUCTS',`;
const stateParentsAddition = `\n  'STORE_DIRECT_PAY_OPTIONS': 'MAIN_MENU',\n  'STORE_DIRECT_CEP': 'STORE_DIRECT_PAY_OPTIONS',\n  'STORE_DIRECT_ADDR': 'STORE_DIRECT_CEP',`;
if (code.includes(stateParentsTarget)) {
  code = code.replace(stateParentsTarget, stateParentsTarget + stateParentsAddition);
  console.log('✅ Added STATE_PARENTS entries');
} else {
  console.error('❌ Could not find STATE_PARENTS target');
}

// 3. Add Global Interception for #COMPRA_LOJA_GSA in processMessage
const processMsgTarget = `  if (!userSessions[fromPhone]) {\n    userSessions[fromPhone] = { state: 'MAIN_MENU', errors: 0 };\n  }\n  const session = userSessions[fromPhone];`;

const directPurchaseInterceptor = `\n\n  // ── INTERCEPTAÇÃO GLOBAL: COMPRA DIRETA DA LOJA VIA WHATSAPP (#COMPRA_LOJA_GSA) ──\n  const isStoreDirectPurchase = text.includes('#COMPRA_LOJA_GSA') || \n                                text.includes('COMPRA_LOJA_GSA') || \n                                text.includes('Gostaria de comprar este produto na Loja GSA') ||\n                                text.includes('Quero comprar o produto na Loja GSA') ||\n                                (text.includes('marketplace/loja/produtos/') && text.includes('Produto:'));\n\n  if (isStoreDirectPurchase) {\n    return handleStoreDirectPurchase(fromPhone, text, session);\n  }`;

if (code.includes(processMsgTarget)) {
  code = code.replace(processMsgTarget, processMsgTarget + directPurchaseInterceptor);
  console.log('✅ Added direct purchase interceptor to processMessage');
} else {
  console.error('❌ Could not find processMsgTarget');
}

// 4. Add state handlers for STORE_DIRECT_PAY_OPTIONS, STORE_DIRECT_CEP, STORE_DIRECT_ADDR
const storeStatesTarget = `  // ── ESTADO: CLASSIFICADOS ────────────────────────────────────────────────────`;
const storeStatesHandlers = `  // ── ESTADO: STORE_DIRECT_PAY_OPTIONS ────────────────────────────────────────
  if (session.state === 'STORE_DIRECT_PAY_OPTIONS') {
    if (text === '1') {
      return generateStoreDirectPayment(fromPhone, session, 'pix');
    } else if (text === '2') {
      return generateStoreDirectPayment(fromPhone, session, 'credit_card');
    } else if (text === '3') {
      session.state = 'STORE_DIRECT_CEP';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '📍 Para calcularmos o frete e entrega, digite o seu *CEP* (apenas 8 números):\\n\\n_Digite 0 para voltar._');
      return;
    } else if (text === '4') {
      session.state = 'HUMAN_AGENT_RELAY';
      userSessions[fromPhone] = session;
      const prodName = session.cart && session.cart[0] ? session.cart[0].produto.nome : 'Produto da Loja';
      sendWhatsAppReply(fromPhone, \`👤 *Atendimento Humano GSA*\\n\\nNossa equipe comercial foi notificada sobre seu pedido (*\${prodName}*) e entrará em contato em instantes!\\n\\n_Digite 0 a qualquer momento para voltar ao menu._\`);
      return;
    } else if (text === '0') {
      session.state = 'MAIN_MENU';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '🔄 Retornando ao menu principal...\\n\\n' + getMainMenuText(session.profile));
      return;
    } else {
      sendWhatsAppReply(fromPhone, '❌ Opção inválida.\\n\\n1️⃣ 🟢 Pagar via PIX\\n2️⃣ 💳 Pagar com Cartão de Crédito\\n3️⃣ 📍 Informar Endereço/Frete\\n4️⃣ 👤 Atendente Humano\\n0️⃣ Cancelar e Voltar\\n\\n_Digite o número desejado:_');
      return;
    }
  }

  // ── ESTADO: STORE_DIRECT_CEP ────────────────────────────────────────────────
  if (session.state === 'STORE_DIRECT_CEP') {
    if (text === '0') {
      session.state = 'STORE_DIRECT_PAY_OPTIONS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '⬅️ Retornando às opções de pagamento...\\n\\n1️⃣ 🟢 Pagar via PIX\\n2️⃣ 💳 Pagar com Cartão de Crédito\\n\\n_Digite 1 ou 2:_');
      return;
    }
    const cepClean = text.replace(/\\D/g, '');
    if (cepClean.length !== 8) {
      sendWhatsAppReply(fromPhone, '❌ CEP inválido. Por favor, digite os 8 números do seu CEP (ex: 01001000).\\n\\n_Digite 0 para voltar._');
      return;
    }
    session.cep = cepClean;
    session.state = 'STORE_DIRECT_ADDR';
    userSessions[fromPhone] = session;
    sendWhatsAppReply(fromPhone, \`📍 CEP *\${cepClean}* anotado!\\n\\n🏠 Agora, qual é o *Número* e *Complemento* (se houver)?\\n_Ex: 150 - Apto 32_\`);
    return;
  }

  // ── ESTADO: STORE_DIRECT_ADDR ───────────────────────────────────────────────
  if (session.state === 'STORE_DIRECT_ADDR') {
    if (text === '0') {
      session.state = 'STORE_DIRECT_PAY_OPTIONS';
      userSessions[fromPhone] = session;
      sendWhatsAppReply(fromPhone, '⬅️ Retornando às opções de pagamento...\\n\\n1️⃣ 🟢 Pagar via PIX\\n2️⃣ 💳 Pagar com Cartão de Crédito\\n\\n_Digite 1 ou 2:_');
      return;
    }
    session.addressNum = text.trim();
    session.state = 'STORE_DIRECT_PAY_OPTIONS';
    userSessions[fromPhone] = session;

    sendWhatsAppReply(fromPhone, \`✅ *Endereço de Entrega Confirmado:*\\n📍 CEP: \${session.cep}\\n🏠 Nº/Compl: \${session.addressNum}\\n\\nAgora escolha como deseja pagar:\\n\\n1️⃣ 🟢 *Pagar via PIX* (Chave PIX e QR Code Instantâneo)\\n2️⃣ 💳 *Pagar com Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\\n\\n_Digite 1 ou 2 (ou 0 para voltar):_\`);
    return;
  }

`;

if (code.includes(storeStatesTarget)) {
  code = code.replace(storeStatesTarget, storeStatesHandlers + storeStatesTarget);
  console.log('✅ Added store direct states handlers');
} else {
  console.error('❌ Could not find storeStatesTarget');
}

// 5. Update CHECKOUT_DOC and CHECKOUT_EMAIL to support directProductPurchase
const checkoutDocMatch = `      if (err || !client) {
        session.state = 'CHECKOUT_NAME';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, \`🔍 *Cadastro Não Encontrado*\\n\\nVamos fazer um pré-cadastro rápido para vincular seu pedido!\\n\\nQual é o seu *Nome Completo* (ou Razão Social)?\\n\\n_Digite 0 para cancelar._\`);
      } else {
        createOrcamento(fromPhone, session, client.id);
      }`;

const checkoutDocReplacement = `      if (err || !client) {
        session.state = 'CHECKOUT_NAME';
        userSessions[fromPhone] = session;
        sendWhatsAppReply(fromPhone, \`🔍 *Cadastro Não Encontrado*\\n\\nVamos fazer um pré-cadastro rápido para vincular seu pedido!\\n\\nQual é o seu *Nome Completo* (ou Razão Social)?\\n\\n_Digite 0 para cancelar._\`);
      } else {
        if (session.directProductPurchase) {
          session.clientData = client;
          session.tempClientId = client.id;
          session.state = 'STORE_DIRECT_PAY_OPTIONS';
          userSessions[fromPhone] = session;
          sendWhatsAppReply(fromPhone, \`✅ Olá, *\${formatBoldName(client.nome || 'Cliente')}*! Cadastro identificado com sucesso.\\n\\nComo deseja realizar o pagamento do seu produto?\\n\\n1️⃣ 🟢 *Pagar via PIX* (QR Code Instantâneo)\\n2️⃣ 💳 *Pagar com Cartão de Crédito* (Link InfinitePay até 12x)\\n3️⃣ 📍 *Informar Endereço de Entrega / Frete*\\n\\n_Digite 1, 2 ou 3 (ou 0 para cancelar):_\`);
        } else {
          createOrcamento(fromPhone, session, client.id);
        }
      }`;

if (code.includes(checkoutDocMatch)) {
  code = code.replace(checkoutDocMatch, checkoutDocReplacement);
  console.log('✅ Updated CHECKOUT_DOC with directProductPurchase support');
} else {
  console.error('❌ Could not find checkoutDocMatch');
}

// Also ensure CHECKOUT_DOC catches STORE_VOUCHER_DOC and HIRE_SERVICES_DOC aliases
code = code.replace(`if (session.state === 'CHECKOUT_DOC') {`, `if (session.state === 'CHECKOUT_DOC' || session.state === 'STORE_VOUCHER_DOC' || session.state === 'HIRE_SERVICES_DOC') {`);

// Ensure sendWhatsAppMedia uses 127.0.0.1 on the host
code = code.replace(/hostname:\s*'evolution-api'/g, "hostname: '127.0.0.1'");

fs.writeFileSync(dstPath, code, 'utf8');
console.log('🎉 server_webhook_final.cjs generated successfully!');
