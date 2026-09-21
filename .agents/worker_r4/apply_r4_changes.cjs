const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

function normalizeNewlines(str) {
  return str.replace(/\r\n/g, '\n');
}

function updateFile(fileName) {
  const filePath = path.join(rootDir, fileName);
  console.log(`Processing ${fileName}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  const isCrlf = content.includes('\r\n');
  let normalized = normalizeNewlines(content);

  // 1. SessionMutex
  if (!normalized.includes('class SessionMutex')) {
    const targetSession = 'const userSessions = {};';
    const replacementSession = `const userSessions = {};\n\n// ─── CONCURRENCY CONTROL: SESSION MUTEX (PER-PHONE FIFO QUEUE) ──────────────\nclass SessionMutex {\n  constructor() {\n    this.queues = new Map();\n  }\n\n  /**\n   * Serializes execution of async tasks per key (e.g., fromPhone).\n   * Runs tasks for the same phone number sequentially in FIFO order.\n   * Runs tasks for different phone numbers concurrently without blocking.\n   * @param {string} key - Unique identifier (e.g., phone number)\n   * @param {() => Promise<any>} task - Async function to execute\n   * @returns {Promise<any>}\n   */\n  runExclusive(key, task) {\n    const safeKey = String(key || 'global');\n    const prevPromise = this.queues.get(safeKey) || Promise.resolve();\n\n    const nextPromise = (async () => {\n      try {\n        await prevPromise;\n      } catch (ignored) {\n        // Prevent previous errors from deadlocking subsequent queued messages\n      }\n      return await task();\n    })();\n\n    this.queues.set(safeKey, nextPromise);\n\n    // Clean up memory when queue is empty\n    nextPromise.finally(() => {\n      if (this.queues.get(safeKey) === nextPromise) {\n        this.queues.delete(safeKey);\n      }\n    });\n\n    return nextPromise;\n  }\n}\n\nconst sessionMutex = new SessionMutex();\n`;
    if (!normalized.includes(targetSession)) {
      throw new Error(`Target not found for userSessions in ${fileName}`);
    }
    normalized = normalized.replace(targetSession, replacementSession);
    console.log(`✓ Added SessionMutex to ${fileName}`);
  } else {
    console.log(`- SessionMutex already present in ${fileName}`);
  }

  // 2. SERVICE_ROLE_JWT fallback
  const oldJwt = "const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || '';";
  const newJwt = "const SERVICE_ROLE_JWT = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY || '';";
  if (normalized.includes(oldJwt)) {
    normalized = normalized.replace(oldJwt, newJwt);
    console.log(`✓ Fixed SERVICE_ROLE_JWT fallback in ${fileName}`);
  } else if (normalized.includes(newJwt)) {
    console.log(`- SERVICE_ROLE_JWT fallback already present in ${fileName}`);
  } else {
    console.warn(`! Could not find standard SERVICE_ROLE_JWT declaration in ${fileName}`);
  }

  // 3. LOYALTY_ACTIONS points conversion RPC
  if (!normalized.includes('gsa_converter_pontos_carteira')) {
    const oldLoyaltyRegex = /if\s*\(text\s*===\s*'1'\)\s*\{\s*const\s+pts\s*=\s*session\.client\.saldo_pontos\s*\|\|\s*0;[\s\S]*?supabasePatch\(`\/rest\/v1\/clientes\?id=eq\.\$\{session\.client\.id\}`[\s\S]*?\}\s*\);\s*\}/;
    const newLoyaltyCode = `    if (text === '1') {
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
          sendWhatsAppReply(fromPhone, \`❌ Não foi possível converter seus pontos: \${errMsg}.\\n\\n_Digite 0 para voltar ao menu._\`);
          return;
        }

        // Update in-memory session with verified database returned values
        if (session.client) {
          session.client.saldo_pontos = result.novo_saldo_pontos;
          session.client.saldo_carteira = result.novo_saldo_carteira;
        }

        sendWhatsAppReply(fromPhone, \`✅ *Conversão Concluída!*\\n\\n\${result.pontos_convertidos} pontos foram convertidos com sucesso para *\${result.valor_convertido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*.\\nNovo Saldo em Carteira: *\${result.novo_saldo_carteira.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\\n\\n_Digite 0 para voltar._\`);
      });
      return;
    }`;

    if (oldLoyaltyRegex.test(normalized)) {
      normalized = normalized.replace(oldLoyaltyRegex, newLoyaltyCode);
      console.log(`✓ Replaced LOYALTY_ACTIONS points conversion with atomic RPC in ${fileName}`);
    } else {
      throw new Error(`Could not find old LOYALTY_ACTIONS block in ${fileName}`);
    }
  } else {
    console.log(`- LOYALTY_ACTIONS atomic RPC already present in ${fileName}`);
  }

  // 4. Webhook POST handler sessionMutex.runExclusive
  if (!normalized.includes('sessionMutex.runExclusive(fromPhone')) {
    const oldWebhookRegex = /try\s*\{\s*const\s+rawMessageData\s*=\s*data\.data\s*\|\|\s*\{\};\s*processMessage\(fromPhone,\s*textBody,\s*mediaType,\s*pushName,\s*rawMessageData\);\s*\}\s*catch\s*\(errProcess\)\s*\{\s*console\.error\('❌ Exceção ao processar mensagem:',\s*errProcess\);\s*sendWhatsAppReply\(fromPhone,\s*'❌ Desculpe, ocorreu uma falha ao processar sua mensagem\. Digite 0 para voltar ao menu principal\.'\);\s*\}/;
    const newWebhookCode = `sessionMutex.runExclusive(fromPhone, async () => {
            try {
              const rawMessageData = data.data || {};
              await processMessage(fromPhone, textBody, mediaType, pushName, rawMessageData);
            } catch (errProcess) {
              console.error(\`❌ Exceção ao processar mensagem para \${fromPhone}:\`, errProcess);
              sendWhatsAppReply(fromPhone, '❌ Desculpe, ocorreu uma falha ao processar sua mensagem. Digite 0 para voltar ao menu principal.');
            }
          });`;

    if (oldWebhookRegex.test(normalized)) {
      normalized = normalized.replace(oldWebhookRegex, newWebhookCode);
      console.log(`✓ Wrapped webhook processMessage with sessionMutex.runExclusive in ${fileName}`);
    } else {
      throw new Error(`Could not find old webhook processMessage block in ${fileName}`);
    }
  } else {
    console.log(`- Webhook processMessage already wrapped with sessionMutex.runExclusive in ${fileName}`);
  }

  // 5. module.exports sessionMutex and SessionMutex
  if (!normalized.includes('sessionMutex,')) {
    const oldExports = "if (typeof module !== 'undefined' && module.exports) {\n  module.exports = {";
    const newExports = "if (typeof module !== 'undefined' && module.exports) {\n  module.exports = {\n    SessionMutex,\n    sessionMutex,";
    if (normalized.includes(oldExports)) {
      normalized = normalized.replace(oldExports, newExports);
      console.log(`✓ Added SessionMutex and sessionMutex to module.exports in ${fileName}`);
    } else {
      throw new Error(`Could not find module.exports block in ${fileName}`);
    }
  } else {
    console.log(`- sessionMutex already in module.exports in ${fileName}`);
  }

  // Re-encode with original newline format
  const finalContent = isCrlf ? normalized.replace(/\n/g, '\r\n') : normalized;
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log(`✓ Saved ${fileName} successfully.\n`);
}

try {
  updateFile('server_webhook_vps_live.cjs');
  updateFile('server_webhook.cjs');
  console.log('All files updated successfully!');
} catch (err) {
  console.error('Error applying changes:', err);
  process.exit(1);
}
