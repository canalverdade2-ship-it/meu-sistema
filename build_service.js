const fs = require('fs');
const content = "import { callAdminRpc } from '../../lib/adminRpc';
import { supabase } from '../../lib/supabase';
import type {
  Partner,
  PartnerApplicationData,
  PartnerApplicationResult,
  PartnerBenefitRedemptionPayload,
  PartnerBenefitRedemptionResult,
  PartnerFormData,
  ProtocolConsultResult,
} from './types';

const PUBLIC_FIELDS = [
  'id', 'slug', 'name', 'category', 'short_description', 'description', 'logo_url', 'cover_url',
  'phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook', 'linkedin', 'street', 'number',
  'complement', 'neighborhood', 'city', 'state', 'zip_code', 'maps_url', 'business_hours',
  'service_mode', 'service_regions', 'services', 'products', 'benefits', 'featured', 'display_order',
  'status', 'redemption_has_coupon', 'redemption_coupon_code', 'redemption_has_voucher',
  'redemption_has_link', 'redemption_link', 'redemption_auto_redirect', 'redemption_instructions',
  'redemption_delay_24h', 'created_at', 'updated_at',
].join(',');

function normalizeList(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizePartner(partner: any): Partner {
  return {
    ...partner,
    service_regions: normalizeList(partner?.service_regions),
    services: normalizeList(partner?.services),
    products: normalizeList(partner?.products),
    featured: Boolean(partner?.featured),
    display_order: Number(partner?.display_order || 0),
    redemption_has_coupon: Boolean(partner?.redemption_has_coupon),
    redemption_has_voucher: Boolean(partner?.redemption_has_voucher),
    redemption_has_link: Boolean(partner?.redemption_has_link),
    redemption_auto_redirect: Boolean(partner?.redemption_auto_redirect),
    redemption_delay_24h: Boolean(partner?.redemption_delay_24h),
    application_source: partner?.application_source || 'admin',
  } as Partner;
}

export async function listPublicPartners(): Promise<Partner[]> {
  const { data, error } = await supabase
    .from('parceiros')
    .select(PUBLIC_FIELDS)
    .eq('status', 'ativo')
    .order('featured', { ascending: false })
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizePartner);
}

export async function getPublicPartner(slug: string): Promise<Partner | null> {
  const { data, error } = await supabase
    .from('parceiros')
    .select(PUBLIC_FIELDS)
    .eq('status', 'ativo')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizePartner(data) : null;
}

export async function submitPartnerApplication(
  payload: PartnerApplicationData,
  logoFile?: File | null,
  coverFile?: File | null,
): Promise<PartnerApplicationResult> {
  const body = new FormData();
  body.append('payload', JSON.stringify(payload));
  if (logoFile) body.append('logo', logoFile, logoFile.name);
  if (coverFile) body.append('cover', coverFile, coverFile.name);

  const { data, error } = await supabase.functions.invoke<PartnerApplicationResult & { error?: string }>(
    'gsa-partner-application',
    { body },
  );

  if (error) {
    throw new Error(error.message || 'Não foi possível enviar a solicitação de parceria.');
  }
  if (!data?.success || !data.protocol) {
    throw new Error(data?.message || 'Não foi possível concluir o envio da solicitação.');
  }
  return data;
}

export async function listAdminPartners(): Promise<Partner[]> {
  try {
    const snapshot = await callAdminRpc<{ partners?: Partner[] }>('gsa_admin_partners_snapshot');
    if (snapshot?.partners && snapshot.partners.length > 0) {
      return (snapshot.partners || []).map(normalizePartner);
    }
  } catch (rpcErr) {
    console.warn('gsa_admin_partners_snapshot falhou, buscando parceiros diretamente:', rpcErr);
  }

  const { data, error } = await supabase
    .from('parceiros')
    .select('*')
    .neq('status', 'excluido')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao listar parceiros:', error);
    return [];
  }

  return (data || []).map(normalizePartner);
}

export async function savePartner(payload: PartnerFormData, id?: string): Promise<Partner> {
  const shortDescription = (
    payload.short_description?.trim() ||
    payload.description?.trim() ||
    payload.benefits?.trim() ||
    payload.name?.trim() ||
    'Parceiro Comercial GSA'
  );

  const normalized = {
    ...payload,
    slug: (payload.slug || payload.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    name: payload.name.trim(),
    category: payload.category?.trim() || 'Geral',
    short_description: shortDescription,
    description: payload.description?.trim() || null,
    legal_name: payload.legal_name?.trim() || null,
    service_regions: normalizeList(payload.service_regions),
    services: normalizeList(payload.services),
    products: normalizeList(payload.products),
  };

  const partnerId = id || (payload as any)?.id || null;
  const redemptionData = {
    redemption_has_coupon: Boolean(payload.redemption_has_coupon),
    redemption_coupon_code: payload.redemption_coupon_code?.trim() || null,
    redemption_has_voucher: Boolean(payload.redemption_has_voucher),
    redemption_has_link: Boolean(payload.redemption_has_link),
    redemption_link: payload.redemption_link?.trim() || null,
    redemption_auto_redirect: Boolean(payload.redemption_auto_redirect),
    redemption_instructions: payload.redemption_instructions?.trim() || null,
    redemption_delay_24h: Boolean(payload.redemption_delay_24h),
  };

  let savedPartner: Partner | null = null;

  try {
    const result = await callAdminRpc<{ partner: Partner }>('gsa_admin_save_partner', {
      p_partner_id: partnerId,
      p_payload: {
        ...normalized,
        id: partnerId,
        ...redemptionData,
      },
    });
    if (result?.partner) {
      savedPartner = normalizePartner(result.partner);
    }
  } catch (rpcErr) {
    console.warn('callAdminRpc gsa_admin_save_partner falhou, usando persistência direta:', rpcErr);
  }

  // Garantia absoluta de persistência direta de todos os campos no banco
  if (partnerId) {
    const { data: updatedData, error: updateErr } = await supabase
      .from('parceiros')
      .update({
        ...normalized,
        ...redemptionData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partnerId)
      .select()
      .maybeSingle();

    if (!updateErr && updatedData) {
      savedPartner = normalizePartner(updatedData);
    }
  } else if (!savedPartner) {
    const { data: insertedData, error: insertErr } = await supabase
      .from('parceiros')
      .insert({
        ...normalized,
        ...redemptionData,
      })
      .select()
      .maybeSingle();

    if (!insertErr && insertedData) {
      savedPartner = normalizePartner(insertedData);
    }
  }

  if (savedPartner) {
    return savedPartner;
  }

  throw new Error('Não foi possível salvar o parceiro comercial.');
}

import { whatsappNotificationService } from '../../lib/whatsappNotificationService';
import { sendAdminWhatsAppNotification } from '../../utils/n8nWhatsApp';

export async function redeemPartnerBenefit(
  payload: PartnerBenefitRedemptionPayload,
): Promise<PartnerBenefitRedemptionResult> {
  const rpcParams: Record<string, any> = {
    p_parceiro_id: payload.parceiroId || null,
    p_parceiro_slug: payload.parceiroSlug || null,
    p_nome_completo: payload.nomeCompleto.trim(),
    p_telefone: payload.telefone.trim(),
    p_cliente_id: payload.clienteId || null,
  };

  if (payload.email) {
    rpcParams.p_email = payload.email.trim();
  }

  let { data, error } = await supabase.rpc('gsa_public_resgatar_beneficio_parceiro', rpcParams);

  // Se o backend remoto não tiver p_email na assinatura, faz fallback com os 5 parâmetros originais
  if (error && error.message && (error.message.includes('p_email') || error.code === 'PGRST202' || error.message.includes('parameters'))) {
    delete rpcParams.p_email;
    const retry = await supabase.rpc('gsa_public_resgatar_beneficio_parceiro', rpcParams);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message || 'Não foi possível resgatar o benefício no momento.');
  }

  const result = data as PartnerBenefitRedemptionResult;
  const partnerName = result?.partner_name || 'Parceiro Comercial GSA';
  const benefitDesc = result?.benefits || 'Benefício e condição especial garantidos pelo Grupo GSA.';

  // Determina se é modo 24h
  let isDelay24h = Boolean(result?.delay_24h);
  if (result?.delay_24h === undefined) {
    if (result && !result.has_coupon && !result.has_voucher && !result.has_link) {
      isDelay24h = true;
    } else if (payload.parceiroId || payload.parceiroSlug) {
      const partnerQuery = supabase.from('parceiros').select('redemption_delay_24h, redemption_has_coupon, redemption_has_voucher, redemption_has_link');
      if (payload.parceiroId) partnerQuery.eq('id', payload.parceiroId);
      else if (payload.parceiroSlug) partnerQuery.eq('slug', payload.parceiroSlug);
      const { data: pData } = await partnerQuery.maybeSingle();
      if (pData) {
        isDelay24h = Boolean(pData.redemption_delay_24h || (!pData.redemption_has_coupon && !pData.redemption_has_voucher && !pData.redemption_has_link));
      }
    }
  }

  const protocolo = result?.codigo_gerado || result?.protocolo || \PROT-RES-\-\\;

  // Garante persistência do protocolo e email do resgate
  if (result?.resgate_id) {
    void supabase.from('parceiros_resgates').update({
      codigo_gerado: protocolo,
      email: payload.email || null
    }).eq('id', result.resgate_id);
  }

  if (isDelay24h) {
    // 1. Envia notificação de WhatsApp para o cliente informando o prazo de 24h de forma limpa e agradável
    const firstName = payload.nomeCompleto.trim().split(' ')[0] || payload.nomeCompleto.trim();

    const clientWelcomeMessage = [
      \?? *SOLICITAÇÃO DE BENEFÍCIO REGISTRADA!*\,
      \\,
      \Olá, *\*! ??\,
      \\,
      \Recebemos seu pedido de resgate do benefício exclusivo da parceria *\*.\,
      \\,
      \?? *Benefício:*\,
      \\\,
      \\,
      \? *PRAZO DE ATIVAÇÃO (EM ATÉ 24 HORAS):*\,
      \Nossa equipe já está processando sua liberação junto ao parceiro. Em até *24 horas*, você receberá por aqui, no seu WhatsApp, o seu *link oficial de ativação* com carência zero.\,
      \\,
      \?? *Protocolo:* \ + "\" + protocolo + "\",
      \\,
      \_Grupo GSA • Gestão de Serviços & Benefícios_\
    ].filter(Boolean).join('\n');

    void whatsappNotificationService.enviarWhatsAppDireto(payload.telefone, clientWelcomeMessage).catch((e) => {
      console.warn('Falha no envio de WhatsApp inicial de resgate:', e);
    });

    // 2. Envia notificação ao WhatsApp do Administrador informando que há um resgate pendente com protocolo
    void sendAdminWhatsAppNotification({
      title: \Novo Resgate: \\,
      category: 'FORNECEDORES',
      message: \O cliente *\* solicitou o benefício da parceria *\*.\n\nProtocolo: *\*\nWhatsApp: \\nE-mail: \\nStatus: *Pendente de cadastro no parceiro e link de ativação*.\n\nAcesse o Painel Administrativo em Fornecedores & Parceiros > Resgates para gerar o link.\
    }).catch(() => {});
  } else {
    // Modo Imediato: Envia confirmação com cupom/link direto de forma limpa
    const firstName = payload.nomeCompleto.trim().split(' ')[0] || payload.nomeCompleto.trim();

    const clientImmediateMessage = [
      \?? *BENEFÍCIO RESGATADO COM SUCESSO!* ??\,
      \\,
      \Olá, *\*! ??\,
      \\,
      \O seu benefício na parceria *\* foi liberado com sucesso!\,
      \\,
      \?? *Benefício:*\,
      \\\,
      \\,
      result?.codigo_gerado ? \??? *Código de Acesso:* \ + "\" + result.codigo_gerado + "\" : null,
      result?.link ? \?? *Link da Parceria:*\n\\ : null,
      result?.instructions ? \?? *Instruções:* \\ : null,
      \\,
      \?? *Protocolo:* \ + "\" + protocolo + "\",
      \\,
      \_Grupo GSA • Gestão de Serviços & Benefícios_\
    ].filter(Boolean).join('\n');

    void whatsappNotificationService.enviarWhatsAppDireto(payload.telefone, clientImmediateMessage).catch((e) => {
      console.warn('Falha no envio de WhatsApp imediato de resgate:', e);
    });
  }

  return {
    ...result,
    delay_24h: isDelay24h,
    codigo_gerado: protocolo,
    protocolo
  };
}

export interface CompletePartnerRedemptionPayload {
  resgateId: string;
  linkAtivacao: string;
  partnerName: string;
  partnerCover?: string | null;
  partnerLogo?: string | null;
  benefitName?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  protocolo?: string;
  cupom?: string;
  voucher?: string;
  forceApprove?: boolean;
}

/**
 * Registra o link de ativação gerado pelo Administrador e envia a notificação bonita e elaborada por WhatsApp
 */
export async function completePartnerRedemption(payload: CompletePartnerRedemptionPayload): Promise<boolean> {
  const cleanLink = payload.linkAtivacao.trim();
  if (!cleanLink) {
    throw new Error('Informe o link de ativação gerado no site do parceiro.');
  }

  // 0. Verifica duplicidade se não for forceApprove
  if (!payload.forceApprove) {
    const { data: currentResgate } = await supabase
      .from('parceiros_resgates')
      .select('parceiro_id')
      .eq('id', payload.resgateId)
      .single();

    if (currentResgate?.parceiro_id) {
      let query = supabase
        .from('parceiros_resgates')
        .select('id')
        .eq('parceiro_id', currentResgate.parceiro_id)
        .neq('id', payload.resgateId)
        .neq('status', 'recusado');
        
      if (payload.customerEmail && payload.customerPhone) {
        query = query.or(\email.eq.\,telefone.eq.\\);
      } else if (payload.customerEmail) {
        query = query.eq('email', payload.customerEmail);
      } else if (payload.customerPhone) {
        query = query.eq('telefone', payload.customerPhone);
      }

      const { data: dups } = await query.limit(1);
      if (dups && dups.length > 0) {
        throw new Error('DUPLICATE_FOUND');
      }
    }
  }

  // 1. Atualiza no banco de dados
  const { error } = await supabase
    .from('parceiros_resgates')
    .update({
      link_ativacao: cleanLink,
      cupom: payload.cupom?.trim() || null,
      voucher: payload.voucher?.trim() || null,
      status: 'concluido',
      data_ativacao: new Date().toISOString()
    })
    .eq('id', payload.resgateId);

  if (error) {
    console.warn('Erro ao atualizar status do resgate no banco direto:', error);
  }

  // Busca foto de capa/banner do parceiro (prioridade) ou logo
  let imageToSend = payload.partnerCover || payload.partnerLogo;
  if (!imageToSend && payload.resgateId) {
    try {
      const { data: resgData } = await supabase
        .from('parceiros_resgates')
        .select('parceiro_id')
        .eq('id', payload.resgateId)
        .maybeSingle();

      if (resgData?.parceiro_id) {
        const { data: parcData } = await supabase
          .from('parceiros')
          .select('cover_url, logo_url')
          .eq('id', resgData.parceiro_id)
          .maybeSingle();
        if (parcData) {
          imageToSend = parcData.cover_url || parcData.logo_url;
        }
      }
    } catch {
      // Ignora falha de busca de imagem e segue com envio
    }
  }

  // 2. Dispara a notificação de WhatsApp limpa, moderna e elegante para o cliente
  const partnerTitle = payload.partnerName || 'Parceiro Comercial GSA';
  const benefitDesc = payload.benefitName || 'Condição exclusiva com 100% de desconto e carência zero.';
  const customerFirstName = payload.customerName.trim().split(' ')[0] || payload.customerName.trim();

  const lines = [
    \?? *SEU BENEFÍCIO JÁ ESTÁ DISPONÍVEL!* ??\,
    \\,
    \Olá, *\*! ??\,
    \\,
    \O seu link oficial de ativação para a parceria com a *\* já foi liberado com sucesso!\,
    \\,
    \?? *Benefício Exclusivo:*\,
    \\\,
    \\,
    \?? *LINK OFICIAL DE ATIVAÇÃO:*\,
    \\\,
    \\,
    payload.cupom?.trim() ? \??? *CUPOM DE DESCONTO:*\n\ + "\" + payload.cupom.trim() + "\\n" : null,
    payload.voucher?.trim() ? \?? *VOUCHER EXCLUSIVO:*\n\ + "\" + payload.voucher.trim() + "\\n" : null,
    \?? *Como ativar:*\,
    \\,
    \1?? Clique no link oficial acima\,
    \\,
    \2?? Conclua o seu cadastro no site\,
    \\,
    \3?? Aproveite o benefício com carência zero!\,
    \\,
    payload.protocolo ? \?? *Protocolo:* \ + "\" + payload.protocolo + "\" : null,
    payload.protocolo ? \\ : null,
    \_Grupo GSA • Gestão de Serviços & Benefícios_\
  ];

  const activationMessage = lines.filter(item => item !== null).join('\n');

  const sent = await whatsappNotificationService.enviarWhatsAppDireto(
    payload.customerPhone,
    activationMessage,
    {
      mediaUrl: imageToSend || undefined,
      fileName: 'banner-beneficio.png'
    }
  );
  return sent;
}

export async function setPartnerStatus(id: string, status: Partner['status']): Promise<void> {
  await callAdminRpc('gsa_admin_set_partner_status', {
    p_partner_id: id,
    p_status: status,
  });
}

export async function listPartnerRedemptions(partnerId?: string): Promise<import('./types').PartnerRedemption[]> {
  try {
    const result = await callAdminRpc<{ redemptions?: import('./types').PartnerRedemption[] }>('gsa_admin_list_partner_redemptions', {
      p_partner_id: partnerId || null,
    });
    if (result?.redemptions && result.redemptions.length > 0) {
      return result.redemptions;
    }
  } catch {
    // Fallback: consulta direta
  }

  try {
    let query = supabase
      .from('parceiros_resgates')
      .select('*')
      .order('created_at', { ascending: false });
    if (partnerId) {
      query = query.eq('parceiro_id', partnerId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Fallback de resgates falhou:', error);
      return [];
    }

    const redemptions = (data || []) as import('./types').PartnerRedemption[];

    // Enriquecer dados dos clientes (e-mail, CPF, endereço) caso não estejam no registro de resgate
    try {
      const phones = redemptions.map(r => r.telefone ? r.telefone.replace(/\D/g, '') : '').filter(Boolean);
      const clientIds = redemptions.map(r => r.cliente_id).filter(Boolean) as string[];

      if (phones.length > 0 || clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clientes')
          .select('id, nome, email, telefone, cpf, endereco, cidade, estado, cep');

        if (clientsData && clientsData.length > 0) {
          return redemptions.map(r => {
            const cleanPhone = r.telefone ? r.telefone.replace(/\D/g, '') : '';
            const matched = clientsData.find(c => 
              (r.cliente_id && c.id === r.cliente_id) ||
              (cleanPhone && c.telefone && c.telefone.replace(/\D/g, '').includes(cleanPhone.slice(-8))) ||
              (r.nome_completo && c.nome && c.nome.toLowerCase().trim() === r.nome_completo.toLowerCase().trim())
            );

            return {
              ...r,
              email: r.email || matched?.email || null,
              telefone: r.telefone || matched?.telefone || '',
              cpf: r.cpf || matched?.cpf || null,
              endereco: r.endereco || matched?.endereco || null,
              cidade: r.cidade || matched?.cidade || null,
              estado: r.estado || matched?.estado || null,
              cep: r.cep || matched?.cep || null,
            };
          });
        }
      }
    } catch (enrichErr) {
      console.warn('Enriquecimento de resgates falhou silenciosamente:', enrichErr);
    }

    return redemptions;
  } catch (err) {
    console.error('Erro ao listar resgates do parceiro:', err);
    return [];
  }
}

export async function consultarProtocolo(
  codigo: string
): Promise<{ success: boolean; data?: ProtocolConsultResult; message?: string }> {
  try {
    const { data, error } = await supabase.rpc('gsa_public_consultar_protocolo', {
      p_codigo: codigo.trim().toUpperCase(),
    });

    if (error) {
      console.error('Erro RPC consultarProtocolo:', error);
      return { success: false, message: 'Erro ao consultar protocolo. Tente novamente.' };
    }

    if (!data || data.success === false) {
      return { success: false, message: data?.message || 'Protocolo não encontrado.' };
    }

    return { success: true, data: data as ProtocolConsultResult };
  } catch (err) {
    console.error('Erro inesperado ao consultar protocolo:', err);
    return { success: false, message: 'Erro inesperado. Tente novamente.' };
  }
}

export async function checkDuplicateRedemption(parceiroId: string, email?: string, telefone?: string): Promise<boolean> {
  if (!parceiroId || (!email && !telefone)) return false;

  let query = supabase
    .from('parceiros_resgates')
    .select('id')
    .eq('parceiro_id', parceiroId)
    .neq('status', 'recusado'); // Only count non-rejected as duplicates

  if (email && telefone) {
    query = query.or(\email.eq.\,telefone.eq.\\);
  } else if (email) {
    query = query.eq('email', email);
  } else if (telefone) {
    query = query.eq('telefone', telefone);
  }

  const { data, error } = await query.limit(1);
  if (error) {
    console.warn('Erro ao checar duplicidade:', error);
    return false;
  }

  return data && data.length > 0;
}

export async function approveRedemption(resgateId: string): Promise<boolean> {
  const { error } = await supabase
    .from('parceiros_resgates')
    .update({ status: 'pendente', alerta_duplicidade: false })
    .eq('id', resgateId);

  if (error) {
    console.error('Erro ao aprovar resgate:', error);
    return false;
  }
  return true;
}

export async function rejectRedemption(resgateId: string, motivo: string): Promise<boolean> {
  // 1. Atualizar o banco
  const { data, error } = await supabase
    .from('parceiros_resgates')
    .update({ status: 'recusado', motivo_recusa: motivo })
    .eq('id', resgateId)
    .select('telefone, nome_completo')
    .single();

  if (error) {
    console.error('Erro ao recusar resgate:', error);
    return false;
  }

  // 2. Disparar WhatsApp
  if (data?.telefone) {
    const nome = data.nome_completo ? data.nome_completo.split(' ')[0] : 'Cliente';
    const msg = \Olá, *\*.\n\nInformamos que a sua solicitação de resgate de benefício não pôde ser aprovada no momento.\n\n*Motivo:* \\n\nEm caso de dúvidas, entre em contato com nosso atendimento.\;
    
    await whatsappNotificationService.enviarWhatsAppDireto(data.telefone, msg);
  }

  return true;
}
fs.writeFileSync('c:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\\src\\features\\partners\\service.ts', content, 'utf8');
