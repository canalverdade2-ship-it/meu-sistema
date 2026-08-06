/**
 * Serviço de Notificações WhatsApp Administrativas via n8n / Meta Cloud API
 * GSA HUB - Sistema de Gestão de Serviços
 */

export interface AdminNotificationPayload {
  title: string;
  message: string;
  category?: 'VENDAS' | 'SUPORTE' | 'CADASTRO' | 'FINANCEIRO' | 'SISTEMA';
  recipientPhone?: string;
}

const N8N_WEBHOOK_URL = 'http://163.176.97.152:5678/webhook/send-whatsapp';
const DEFAULT_ADMIN_PHONE = '5511920857756';

// Meta API Direct Fallback
const META_PHONE_NUMBER_ID = '1208358025697171';
const META_TOKEN = 'EAATzMfBrFUUBSKUGYDkioeRHENS7hcliAdztOVnfpGTZCxA9H58yU32BxtaZCrve2HrEvC3wRsSgXsfvPp2df38Qu6KxpPBI2UeRhQWdY7ZADeFoEs6rOE8CZC4B8bv6KNZCNQZAKhZABLIQNMk98S6RcoQxdoy2MQ2r5xLKDDjJ7wISHL6n21US9QT993NzswJfQZDZD';

/**
 * Envia notificação administrativa para o WhatsApp do Administrador
 */
export async function sendAdminWhatsAppNotification(payload: AdminNotificationPayload): Promise<boolean> {
  const phone = payload.recipientPhone || DEFAULT_ADMIN_PHONE;
  const categoryFormatted = payload.category ? `[${payload.category}]` : '[AVISO ADMIN]';
  const textBody = `🚨 *GSA HUB - Notificação Administrativa*\n\n${categoryFormatted} *${payload.title}*\n\n${payload.message}\n\n📅 ${new Date().toLocaleString('pt-BR')}\n\n_Mensagem enviada via GSA HUB._`;

  try {
    // 1. Tentar via n8n Webhook
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        title: payload.title,
        message: textBody,
        category: payload.category || 'ADMIN',
        timestamp: new Date().toISOString()
      })
    });

    if (response.ok) {
      console.log('✅ Notificação de WhatsApp enviada via n8n com sucesso!');
      return true;
    }
  } catch (err) {
    console.warn('⚠️ Webhook n8n indisponível, acionando rota direta Meta WhatsApp API...', err);
  }

  // 2. Fallback direto via Meta WhatsApp Cloud API
  try {
    const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' }
        }
      })
    });

    const metaData = await metaResponse.json();
    if (metaResponse.ok && !metaData.error) {
      console.log('✅ Notificação enviada com sucesso via Meta API Direct!');
      return true;
    } else {
      console.error('❌ Erro no envio Meta API:', metaData);
    }
  } catch (error) {
    console.error('❌ Falha ao enviar aviso de WhatsApp:', error);
  }

  return false;
}
