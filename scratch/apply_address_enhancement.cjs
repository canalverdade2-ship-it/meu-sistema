'use strict';
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'server_webhook_final.cjs');
const dstPath = path.join(__dirname, 'server_webhook.cjs');

const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);
console.log(`Loaded ${lines.length} lines from server_webhook_final.cjs.`);

// 1. Update presentOrderMenu (lines ~381 to ~405)
let pStart = -1;
let pEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const presentOrderMenu = (clientRecord) => {')) {
    pStart = i;
  }
  if (pStart !== -1 && lines[i].includes('if (prodImage && prodImage.startsWith')) {
    pEnd = i;
    break;
  }
}

if (pStart !== -1 && pEnd !== -1) {
  const replacementLines = [
    '    const presentOrderMenu = (clientRecord) => {',
    '      session.clientData = clientRecord;',
    '      session.tempClientId = clientRecord.id;',
    "      session.state = 'STORE_DIRECT_PAY_OPTIONS';",
    '',
    "      const cepClean = (clientRecord.cep || '').replace(/\\D/g, '');",
    '      if (cepClean && cepClean.length >= 8) {',
    "        const logr = clientRecord.endereco || '';",
    "        const num = clientRecord.numero || '';",
    "        const bai = clientRecord.bairro || '';",
    "        const cid = clientRecord.cidade || '';",
    "        const uf = clientRecord.estado || '';",
    '        session.savedClientAddress = {',
    '          cep: cepClean,',
    '          endereco: logr,',
    '          numero: num,',
    '          bairro: bai,',
    '          cidade: cid,',
    '          estado: uf,',
    "          formatado: `${logr ? logr + ', ' : ''}${num ? 'Nº ' + num + ' - ' : ''}${bai ? bai + ', ' : ''}${cid ? cid + '/' + uf + ' - ' : ''}CEP: ${cepClean.replace(/^(\\d{5})(\\d{3})$/, '$1-$2')}`",
    '        };',
    '        session.cep = cepClean;',
    '        session.addressNum = num;',
    '        session.fullDeliveryAddress = session.savedClientAddress.formatado;',
    '      }',
    '',
    '      userSessions[fromPhone] = session;',
    '',
    "      const rawNome = clientRecord.nome || clientRecord.nome_completo || clientRecord.razao_social || 'Cliente';",
    '      const nome = formatBoldName(rawNome);',
    '',
    '      let msg = `🛒 *PEDIDO LOJA GSA HUB* 🛒\\n\\n`;',
    '      msg += `Olá, *${nome}*! Recebemos sua solicitação de compra:\\n\\n`;',
    '      msg += `📦 *Produto:* ${prodName}\\n`;',
    '      msg += `🔖 *Código:* ${prodCode}\\n`;',
    '      msg += `🔢 *Quantidade:* ${parsed.prodQty} unidade(s)\\n`;',
    "      msg += `💰 *Valor Unitário:* R$ ${finalUnitPrice.toFixed(2).replace('.', ',')}\\n`;",
    "      msg += `💵 *Total a Pagar:* R$ ${total.toFixed(2).replace('.', ',')}\\n`;",
    '      if (session.fullDeliveryAddress) {',
    '        msg += `📍 *Endereço Cadastrado:* ${session.fullDeliveryAddress}\\n`;',
    '      }',
    '      msg += `\\n`;',
    '      msg += `Como você deseja prosseguir para finalizar?\\n\\n`;',
    '      msg += `1️⃣ 🟢 *Pagar via PIX* (Instantâneo - QR Code e Copia e Cola)\\n`;',
    '      msg += `2️⃣ 💳 *Pagar com Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\\n`;',
    '      msg += `3️⃣ 📍 *Confirmar Endereço / Calcular Frete*\\n`;',
    '      msg += `4️⃣ 👤 *Falar com Atendente Humano*\\n`;',
    '      msg += `0️⃣ *Cancelar e Voltar ao Menu Principal*\\n\\n`;',
    '      msg += `_Digite o número da opção desejada:_\`;',
    ''
  ];
  lines.splice(pStart, pEnd - pStart, ...replacementLines);
  console.log(`✅ presentOrderMenu replaced from line ${pStart + 1} to ${pEnd + 1}`);
} else {
  console.error('❌ Could not find presentOrderMenu boundaries', { pStart, pEnd });
}

// 2. Update orcData in generateStoreDirectPayment
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('observacoes_servico: obs,') && lines[i-1].includes("status: 'aberto',")) {
    lines.splice(i, 0, "      endereco_entrega: session.fullDeliveryAddress || (session.cep ? `CEP: ${session.cep}, Nº ${session.addressNum || 'S/N'}` : null),");
    console.log(`✅ Added endereco_entrega to orcData at line ${i + 1}`);
    break;
  }
}

// 3. Update STATE_PARENTS
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("'STORE_DIRECT_PAY_OPTIONS': 'MAIN_MENU',")) {
    lines.splice(i + 1, 0, "  'STORE_DIRECT_CONFIRM_SAVED_ADDR': 'STORE_DIRECT_PAY_OPTIONS',");
    console.log(`✅ Added STORE_DIRECT_CONFIRM_SAVED_ADDR to STATE_PARENTS at line ${i + 2}`);
    break;
  }
}

// 4. Replace STORE_DIRECT_PAY_OPTIONS states
let sStart = -1;
let sEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("session.state === 'STORE_DIRECT_PAY_OPTIONS'")) {
    sStart = i - 1; // include comment line
  }
  if (sStart !== -1 && lines[i].includes("session.state === 'CLASSIFIEDS'")) {
    sEnd = i - 1; // up to comment line
    break;
  }
}

if (sStart !== -1 && sEnd !== -1) {
  const newStates = [
    '  // ── ESTADO: STORE_DIRECT_PAY_OPTIONS ────────────────────────────────────────',
    "  if (session.state === 'STORE_DIRECT_PAY_OPTIONS') {",
    "    if (text === '1') {",
    "      return generateStoreDirectPayment(fromPhone, session, 'pix');",
    "    } else if (text === '2') {",
    "      return generateStoreDirectPayment(fromPhone, session, 'credit_card');",
    "    } else if (text === '3') {",
    '      // 3. Informar Endereço / Calcular Frete (Puxa automaticamente dados cadastrais se cliente existir)',
    '      const handleAddressFlow = (clientObj) => {',
    '        const client = clientObj || session.clientData || session.profile?.cliente;',
    "        const cepCadastrado = (client?.cep || session.savedClientAddress?.cep || '').replace(/\\D/g, '');",
    '',
    '        if (cepCadastrado && cepCadastrado.length >= 8) {',
    "          const logradouro = client?.endereco || session.savedClientAddress?.endereco || '';",
    "          const numero = client?.numero || session.savedClientAddress?.numero || '';",
    "          const bairro = client?.bairro || session.savedClientAddress?.bairro || '';",
    "          const cidade = client?.cidade || session.savedClientAddress?.cidade || '';",
    "          const estado = client?.estado || session.savedClientAddress?.estado || '';",
    '',
    '          session.savedClientAddress = {',
    '            cep: cepCadastrado,',
    '            endereco: logradouro,',
    '            numero: numero,',
    '            bairro: bairro,',
    '            cidade: cidade,',
    '            estado: estado,',
    "            formatado: `${logradouro ? logradouro + ', ' : ''}${numero ? 'Nº ' + numero + ' - ' : ''}${bairro ? bairro + ', ' : ''}${cidade ? cidade + '/' + estado + ' - ' : ''}CEP: ${cepCadastrado.replace(/^(\\d{5})(\\d{3})$/, '$1-$2')}`",
    '          };',
    '',
    "          session.state = 'STORE_DIRECT_CONFIRM_SAVED_ADDR';",
    '          userSessions[fromPhone] = session;',
    '',
    '          let msg = `📍 *ENDEREÇO CADASTRADO LOCALIZADO:*\\n\\n`;',
    '          msg += `Puxamos automaticamente o seu endereço do sistema:\\n\\n`;',
    "          if (logradouro) msg += `🏠 *Logradouro:* ${logradouro}, Nº ${numero || 'S/N'}\\n`;",
    '          if (bairro) msg += `🏘️ *Bairro:* ${bairro}\\n`;',
    '          if (cidade) msg += `🏙️ *Cidade/UF:* ${cidade} - ${estado}\\n`;',
    "          msg += `📮 *CEP:* ${cepCadastrado.replace(/^(\\d{5})(\\d{3})$/, '$1-$2')}\\n\\n`;",
    '          msg += `🚚 *Frete:* Incluso / Entrega Rápida GSA!\\n\\n`;',
    '          msg += `Deseja utilizar este endereço cadastrado para a entrega?\\n\\n`;',
    '          msg += `1️⃣ ✅ *Sim, confirmar este endereço*\\n`;',
    '          msg += `2️⃣ ✏️ *Não, quero informar outro endereço / CEP*\\n`;',
    '          msg += `0️⃣ *Voltar*\\n\\n`;',
    '          msg += `_Digite 1, 2 ou 0:_`;',
    '',
    '          return sendWhatsAppReply(fromPhone, msg);',
    '        }',
    '',
    '        // Se o cliente não possuir CEP cadastrado, solicita digitação',
    "        session.state = 'STORE_DIRECT_CEP';",
    '        userSessions[fromPhone] = session;',
    "        sendWhatsAppReply(fromPhone, '📍 Para calcularmos o frete e entrega, digite o seu *CEP* (apenas 8 números):\\n\\n_Digite 0 para voltar._');",
    '      };',
    '',
    '      if (session.clientData && (session.clientData.cep || session.clientData.id)) {',
    '        return handleAddressFlow(session.clientData);',
    '      }',
    '      if (session.profile && session.profile.cliente) {',
    '        return handleAddressFlow(session.profile.cliente);',
    '      }',
    '',
    '      return fetchClientByPhone(fromPhone, (err, clientFound) => {',
    '        if (!err && clientFound) {',
    '          session.clientData = clientFound;',
    '          session.tempClientId = clientFound.id;',
    '        }',
    '        handleAddressFlow(clientFound);',
    '      });',
    "    } else if (text === '4') {",
    "      session.state = 'HUMAN_AGENT_RELAY';",
    '      userSessions[fromPhone] = session;',
    "      const prodName = session.cart && session.cart[0] ? session.cart[0].produto.nome : 'Produto da Loja';",
    '      sendWhatsAppReply(fromPhone, `👤 *Atendimento Humano GSA*\\n\\nNossa equipe comercial foi notificada sobre seu pedido (*${prodName}*) e entrará em contato em instantes!\\n\\n_Digite 0 a qualquer momento para voltar ao menu._`);',
    '      return;',
    "    } else if (text === '0') {",
    "      session.state = 'MAIN_MENU';",
    '      userSessions[fromPhone] = session;',
    "      sendWhatsAppReply(fromPhone, '🔄 Retornando ao menu principal...\\n\\n' + getMainMenuText(session.profile));",
    '      return;',
    '    } else {',
    "      sendWhatsAppReply(fromPhone, '❌ Opção inválida.\\n\\n1️⃣ 🟢 Pagar via PIX\\n2️⃣ 💳 Pagar com Cartão de Crédito\\n3️⃣ 📍 Informar Endereço / Frete\\n4️⃣ 👤 Atendente Humano\\n0️⃣ Cancelar e Voltar\\n\\n_Digite o número desejado:_');",
    '      return;',
    '    }',
    '  }',
    '',
    '  // ── ESTADO: STORE_DIRECT_CONFIRM_SAVED_ADDR ────────────────────────────────',
    "  if (session.state === 'STORE_DIRECT_CONFIRM_SAVED_ADDR') {",
    "    if (text === '1') {",
    '      const saved = session.savedClientAddress || {};',
    "      session.cep = saved.cep || '';",
    "      session.addressNum = saved.numero || '';",
    "      session.fullDeliveryAddress = saved.formatado || (saved.cep ? `CEP: ${saved.cep}` : '');",
    "      session.state = 'STORE_DIRECT_PAY_OPTIONS';",
    '      userSessions[fromPhone] = session;',
    '',
    '      let msg = `✅ *Endereço de Entrega Confirmado!*\\n\\n`;',
    '      msg += `📍 *Destino:* ${session.fullDeliveryAddress}\\n\\n`;',
    '      msg += `Agora escolha como você deseja realizar o pagamento:\\n\\n`;',
    '      msg += `1️⃣ 🟢 *Pagar via PIX* (Instantâneo - QR Code e Copia e Cola)\\n`;',
    '      msg += `2️⃣ 💳 *Pagar com Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\\n`;',
    '      msg += `4️⃣ 👤 *Falar com Atendente Humano*\\n`;',
    '      msg += `0️⃣ *Voltar ao menu inicial*\\n\\n`;',
    '      msg += `_Digite o número da opção desejada:_\`;',
    '',
    '      sendWhatsAppReply(fromPhone, msg);',
    '      return;',
    "    } else if (text === '2') {",
    "      session.state = 'STORE_DIRECT_CEP';",
    '      userSessions[fromPhone] = session; ',
    "      sendWhatsAppReply(fromPhone, '📍 Digite o novo *CEP* de entrega (apenas 8 números):\\n\\n_Digite 0 para voltar._');",
    '      return;',
    "    } else if (text === '0') {",
    "      session.state = 'STORE_DIRECT_PAY_OPTIONS';",
    '      userSessions[fromPhone] = session;',
    "      sendWhatsAppReply(fromPhone, '⬅️ Retornando às opções do pedido...\\n\\n1️⃣ 🟢 Pagar via PIX\\n2️⃣ 💳 Pagar com Cartão de Crédito\\n3️⃣ 📍 Informar Endereço / Frete\\n\\n_Digite a opção desejada:_');",
    '      return;',
    '    }',
    '  }',
    '',
    '  // ── ESTADO: STORE_DIRECT_CEP ────────────────────────────────────────────────',
    "  if (session.state === 'STORE_DIRECT_CEP') {",
    "    if (text === '0') {",
    "      session.state = 'STORE_DIRECT_PAY_OPTIONS';",
    '      userSessions[fromPhone] = session;',
    "      sendWhatsAppReply(fromPhone, '⬅️ Retornando às opções de pagamento...\\n\\n1️⃣ 🟢 Pagar via PIX\\n2️⃣ 💳 Pagar com Cartão de Crédito\\n\\n_Digite 1 ou 2:_');",
    '      return;',
    '    }',
    "    const cepClean = text.replace(/\\D/g, '');",
    '    if (cepClean.length !== 8) {',
    "      sendWhatsAppReply(fromPhone, '❌ CEP inválido. Por favor, digite os 8 números do seu CEP (ex: 01001000).\\n\\n_Digite 0 para voltar._');",
    '      return;',
    '    }',
    '    session.cep = cepClean;',
    "    session.state = 'STORE_DIRECT_ADDR';",
    '    userSessions[fromPhone] = session;',
    '    sendWhatsAppReply(fromPhone, `📍 CEP *${cepClean}* anotado!\\n\\n🏠 Agora, qual é o *Número* e *Complemento* (se houver)?\\n_Ex: 150 - Apto 32_`);',
    '    return;',
    '  }',
    '',
    '  // ── ESTADO: STORE_DIRECT_ADDR ───────────────────────────────────────────────',
    "  if (session.state === 'STORE_DIRECT_ADDR') {",
    "    if (text === '0') {",
    "      session.state = 'STORE_DIRECT_PAY_OPTIONS';",
    '      userSessions[fromPhone] = session;',
    "      sendWhatsAppReply(fromPhone, '⬅️ Retornando às opções de pagamento...\\n\\n1️⃣ 🟢 Pagar via PIX\\n2️⃣ 💳 Pagar com Cartão de Crédito\\n\\n_Digite 1 ou 2:_');",
    '      return;',
    '    }',
    '    session.addressNum = text.trim();',
    '    session.fullDeliveryAddress = `CEP: ${session.cep}, Nº ${session.addressNum}`;',
    "    session.state = 'STORE_DIRECT_PAY_OPTIONS';",
    '    userSessions[fromPhone] = session;',
    '',
    '    sendWhatsAppReply(fromPhone, `✅ *Endereço de Entrega Confirmado:*\\n📍 CEP: ${session.cep}\\n🏠 Nº/Compl: ${session.addressNum}\\n\\nAgora escolha como deseja pagar:\\n\\n1️⃣ 🟢 *Pagar via PIX* (Chave PIX e QR Code Instantâneo)\\n2️⃣ 💳 *Pagar com Cartão de Crédito* (Link Seguro InfinitePay em até 12x)\\n\\n_Digite 1 ou 2 (ou 0 para voltar):_`);',
    '    return;',
    '  }'
  ];
  lines.splice(sStart, sEnd - sStart, ...newStates);
  console.log(`✅ States replaced from line ${sStart + 1} to ${sEnd + 1}`);
} else {
  console.error('❌ Could not find States boundaries', { sStart, sEnd });
}

fs.writeFileSync(dstPath, lines.join('\n'), 'utf8');
console.log('🎉 server_webhook.cjs successfully generated and written!');
