export type AdvertisingFormat =
  | 'responsive_banner'
  | 'sponsored_card'
  | 'rectangle'
  | 'sticky_banner'
  | 'hero'
  | 'inline_video'
  | 'floating_video'
  | 'lightbox'
  | 'section_sponsorship'
  | 'sponsored_content'
  | 'takeover';

export type AdvertisingRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'awaiting_information'
  | 'proposal_sent'
  | 'negotiation_requested'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

export interface PublicAdvertisement {
  campaign_id: string;
  slug: string;
  name: string;
  advertiser_name: string;
  creative_id: string;
  kind: 'image' | 'video' | 'text';
  storage_path?: string | null;
  target_url?: string | null;
  headline?: string | null;
  body?: string | null;
  alt_text?: string | null;
  placement_code: string;
}

export interface AdvertisingRequest {
  id: string;
  protocol: string;
  company_name: string;
  company_size: string;
  segment: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  objective: string;
  desired_formats: AdvertisingFormat[];
  desired_pages: string[];
  devices: string[];
  desired_start_date?: string | null;
  desired_end_date?: string | null;
  intended_budget: number;
  needs_creative_service: boolean;
  notes?: string | null;
  status: AdvertisingRequestStatus;
  created_at: string;
}
