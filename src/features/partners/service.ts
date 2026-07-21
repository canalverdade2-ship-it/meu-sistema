import { callAdminRpc } from '../../lib/adminRpc';
import { supabase } from '../../lib/supabase';
import type {
  Partner,
  PartnerApplicationData,
  PartnerApplicationResult,
  PartnerFormData,
} from './types';

const PUBLIC_FIELDS = [
  'id', 'slug', 'name', 'category', 'short_description', 'description', 'logo_url', 'cover_url',
  'phone', 'whatsapp', 'email', 'website', 'instagram', 'facebook', 'linkedin', 'street', 'number',
  'complement', 'neighborhood', 'city', 'state', 'zip_code', 'maps_url', 'business_hours',
  'service_mode', 'service_regions', 'services', 'products', 'benefits', 'featured', 'display_order',
  'status', 'created_at', 'updated_at',
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
  const snapshot = await callAdminRpc<{ partners?: Partner[] }>('gsa_admin_partners_snapshot');
  return (snapshot?.partners || []).map(normalizePartner);
}

export async function savePartner(payload: PartnerFormData, id?: string): Promise<Partner> {
  const normalized = {
    ...payload,
    slug: payload.slug.trim().toLowerCase(),
    name: payload.name.trim(),
    category: payload.category.trim(),
    short_description: payload.short_description.trim(),
    description: payload.description?.trim() || null,
    legal_name: payload.legal_name?.trim() || null,
    service_regions: normalizeList(payload.service_regions),
    services: normalizeList(payload.services),
    products: normalizeList(payload.products),
  };

  const result = await callAdminRpc<{ partner: Partner }>('gsa_admin_save_partner', {
    p_partner_id: id || null,
    p_payload: normalized,
  });
  return normalizePartner(result.partner);
}

export async function setPartnerStatus(id: string, status: Partner['status']): Promise<void> {
  await callAdminRpc('gsa_admin_set_partner_status', {
    p_partner_id: id,
    p_status: status,
  });
}
