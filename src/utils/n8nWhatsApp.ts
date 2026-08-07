/**
 * Serviço de Notificações WhatsApp Administrativas via n8n / Meta Cloud API
 * GSA HUB - Sistema de Gestão de Serviços
 */

import { supabase } from '../lib/supabase';
import { callAdminRpc } from '../lib/adminRpc';

export interface AdminNotificationPayload {
  title: string;
  message: string;
  category?: 'VENDAS' | 'SUPORTE' | 'CADASTRO' | 'FINANCEIRO' | 'SISTEMA' | 'DEMANDAS' | 'FORNECEDORES' | 'PRESTADORES';
  recipientPhone?: string;
}

const DEFAULT_N8N_WEBHOOK_URL = 'http://147.15.43.141:5678/webhook/send-whatsapp';
const DEFAULT_ADMIN_PHONE = '5511920857756';

// Meta API Direct Fallback
const META_PHONE_NUMBER_ID = '1208358025697171';
const META_TOKEN = 'EAATzMfBrFUUBSKUGYDkioeRHENS7hcliAdztOVnfpGTZCxA9H58yU32BxtaZCrve2HrEvC3wRsSgXsfvPp2df38Qu6KxpPBI2UeRhQWdY7ZADeFoEs6rOE8CZC4B8bv6KNZCNQZAKhZABLIQNMk98S6RcoQxdoy2MQ2r5xLKDDjJ7wISHL6n21US9QT993NzswJfQZDZD';

/**
 * Busca as configurações ativas do WhatsApp Master para notificações administrativas
 */
export async function getAdminWhatsAppConfig(): Promise<{ phone: string; webhookUrl: string }> {
  try {
    const data = await callAdminRpc<any>('gsa_admin_settings_snapshot');
    const settings = data?.settings || {};
    
    const rawPhone = settings['whatsapp_admin_notificacoes'] || DEFAULT_ADMIN_PHONE;
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phone = cleanPhone ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : DEFAULT_ADMIN_PHONE;
    const webhookUrl = settings['whatsapp_n8n_webhook_url'] || DEFAULT_N8N_WEBHOOK_URL;
    
    return { phone, webhookUrl };
  } catch {
    // Fallback via consulta direta pública a system_settings se RPC não estiver na sessão
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['whatsapp_admin_notificacoes', 'whatsapp_n8n_webhook_url']);

      let phone = DEFAULT_ADMIN_PHONE;
      let webhookUrl = DEFAULT_N8N_WEBHOOK_URL;

      if (Array.isArray(data)) {
        for (const row of data) {
          if (row.key === 'whatsapp_admin_notificacoes' && row.value) {
            const clean = row.value.replace(/\D/g, '');
            if (clean) phone = clean.startsWith('55') ? clean : `55${clean}`;
          }
          if (row.key === 'whatsapp_n8n_webhook_url' && row.value) {
            webhookUrl = row.value;
          }
        }
      }
      return { phone, webhookUrl };
    } catch (e) {
      console.warn('⚠️ Falha ao carregar configuracao do WhatsApp Admin:', e);
      return { phone: DEFAULT_ADMIN_PHONE, webhookUrl: DEFAULT_N8N_WEBHOOK_URL };
    }
  }
}

/**
 * Envia notificação administrativa para o WhatsApp Master do Administrador
 */
export async function sendAdminWhatsAppNotification(payload: AdminNotificationPayload): Promise<boolean> {
  const config = await getAdminWhatsAppConfig();
  
  let targetPhone = payload.recipientPhone ? payload.recipientPhone.replace(/\D/g, '') : config.phone;
  if (targetPhone && !targetPhone.startsWith('55') && targetPhone.length <= 11) {
    targetPhone = `55${targetPhone}`;
  }
  const phone = targetPhone || DEFAULT_ADMIN_PHONE;
  const webhookUrl = config.webhookUrl || DEFAULT_N8N_WEBHOOK_URL;

  const categoryFormatted = payload.category ? `[${payload.category}]` : '[AVISO ADMIN]';
  const textBody = `🚨 *GSA HUB - Notificação Administrativa*\n\n${categoryFormatted} *${payload.title}*\n\n${payload.message}\n\n📅 ${new Date().toLocaleString('pt-BR')}\n\n_Mensagem enviada via GSA HUB._`;

  try {
    const { data, error } = await supabase.functions.invoke('vps-api', {
      body: {
        action: 'send-whatsapp',
        phone,
        message: textBody,
        title: payload.title,
        category: payload.category || 'ADMIN',
        targetIp: '147.15.43.141'
      }
    });

    if (!error && data?.success) {
      console.log(`✅ Notificação de WhatsApp enviada via Edge Function para ${phone} com sucesso!`);
      return true;
    }
  } catch (err) {
    console.warn('⚠️ Falha via vps-api, tentando envio direto na Evolution API...', err);
  }

  // 2. Fallback direto Evolution API na VPS Nova (147.15.43.141)
  try {
    const evoResp = await fetch('http://147.15.43.141:8080/message/sendText/GSA_WhatsApp', {
      method: 'POST',
      headers: {
        'apikey': 'gsa_hub_evolution_token_2026',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: phone,
        text: textBody,
        delay: 1200,
        linkPreview: true
      })
    });
    if (evoResp.ok) {
      console.log(`✅ Notificação enviada para ${phone} via Evolution API direta!`);
      return true;
    }
  } catch (evoErr) {
    console.warn('⚠️ Falha via Evolution API direta:', evoErr);
  }

  // 3. Fallback direto via Meta WhatsApp Cloud API
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
      console.log(`✅ Notificação enviada para ${phone} com sucesso via Meta API Direct!`);
      return true;
    } else {
      console.error('❌ Erro no envio Meta API:', metaData);
    }
  } catch (error) {
    console.error('❌ Falha ao enviar aviso de WhatsApp:', error);
  }

  return false;
}
