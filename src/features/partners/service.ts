import { supabase } from '../../lib/supabase';
import type { Partner, PartnerFormData } from './types';

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
    service_regions: normalizeList(partner.service_regions),
    services: normalizeList(partner.services),
    products: normalizeList(partner.products),
    featured: Boolean(partner.featured),
    display_order: Number(partner.display_order || 0),
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

export async function listAdminPartners(): Promise<Partner[]> {
  const { data, error } = await supabase
    .from('parceiros')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizePartner);
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

  const query = id
    ? supabase.from('parceiros').update(normalized).eq('id', id)
    : supabase.from('parceiros').insert(normalized);

  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return normalizePartner(data);
}

export async function setPartnerStatus(id: string, status: Partner['status']): Promise<void> {
  const { error } = await supabase.from('parceiros').update({ status }).eq('id', id);
  if (error) throw error;
}
