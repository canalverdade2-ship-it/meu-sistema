const { formatToWhatsAppMarkdown, parseSpintax } = require('./lib/antiBanEngine.cjs');
const arr = [
  `🎉 *PROTOCOLO LOCALIZADO COM SUCESSO!*`,
  ``,
  `🔖 *Código:* 12345`,
  `💡 *Como posso te ajudar com este resgate?*`,
  `1️⃣ *Alterar dados* (Nome, E-mail ou Telefone)`
];
const text = arr.join('\n');
console.log('Formatted:\n' + JSON.stringify(formatToWhatsAppMarkdown(parseSpintax(text))));