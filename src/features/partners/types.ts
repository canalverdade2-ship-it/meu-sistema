export type PartnerStatus = 'em_analise' | 'ativo' | 'inativo' | 'encerrado' | 'excluido';
export type PartnerServiceMode = 'presencial' | 'online' | 'hibrido';

export interface Partner {
  id: string;
  slug: string;
  name: string;
  legal_name?: string | null;
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
  created_at: string;
  updated_at: string;
}

export type PartnerFormData = Omit<Partner, 'id' | 'created_at' | 'updated_at'>;

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
