const { formatToWhatsAppMarkdown } = require('./lib/antiBanEngine.cjs');
const t = `🎉 *PROTOCOLO LOCALIZADO COM SUCESSO!*

🔖 *Código:* 123
💡 *Como posso te ajudar com este resgate?*
1️⃣ *Alterar dados* (Nome, E-mail ou Telefone)
2️⃣ *Cancelar resgate*
3️⃣ *Consultar status*`;
console.log(JSON.stringify(formatToWhatsAppMarkdown(t)));