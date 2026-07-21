export type PartnerStatus = 'em_analise' | 'ativo' | 'inativo' | 'encerrado' | 'excluido';
export type PartnerServiceMode = 'presencial' | 'online' | 'hibrido';
export type PartnerApplicationSource = 'admin' | 'public_form';

export interface Partner {
  id: string;
  slug: string;
  name: string;
  legal_name?: string | null;
  tax_document?: string | null;
  category: string;
  short_description: string;
  description?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  maps_url?: string | null;
  business_hours?: string | null;
  service_mode: PartnerServiceMode;
  service_regions: string[];
  services: string[];
  products: string[];
  benefits?: string | null;
  contact_person?: string | null;
  internal_notes?: string | null;
  featured: boolean;
  display_order: number;
  status: PartnerStatus;
  application_source?: PartnerApplicationSource;
  application_protocol?: string | null;
  submitted_at?: string | null;
  privacy_consent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type PartnerFormData = Omit<
  Partner,
  | 'id'
  | 'tax_document'
  | 'application_source'
  | 'application_protocol'
  | 'submitted_at'
  | 'privacy_consent_at'
  | 'created_at'
  | 'updated_at'
>;

export interface PartnerApplicationData {
  name: string;
  legal_name: string;
  tax_document: string;
  category: string;
  short_description: string;
  description: string;
  contact_person: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  business_hours: string;
  service_mode: PartnerServiceMode;
  service_regions: string[];
  services: string[];
  products: string[];
  benefits: string;
  privacy_consent: boolean;
  started_at: string;
  company_website: string;
}

export interface PartnerApplicationResult {
  success: boolean;
  protocol: string;
  message: string;
}

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  em_analise: 'Em análise',
  ativo: 'Ativo',
  inativo: 'Inativo',
  encerrado: 'Encerrado',
  excluido: 'Excluído',
};

export const PARTNER_MODE_LABELS: Record<PartnerServiceMode, string> = {
  presencial: 'Presencial',
  online: 'On-line',
  hibrido: 'Presencial e on-line',
};
