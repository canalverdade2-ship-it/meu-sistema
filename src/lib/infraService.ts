import { supabase } from './supabase';

export interface VpsMetrics {
  cpu: { usage: number; system: number; user: number; wait: number };
  memory: { total: number; used: number; free: number; cached: number; swap_used: number };
  disk: { total: number; used: number; free: number; inodes_used: number };
  network: { tx_bytes: number; rx_bytes: number };
  uptime: number;
  status: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  development_mode: number;
  original_name_servers: string[];
  name_servers: string[];
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
}

export interface CloudflareMetrics {
  requests: {
    total: number;
    cached: number;
    uncached: number;
    cacheHitRatio: number;
  };
  bandwidth: {
    totalBytes: number;
    cachedBytes: number;
    savedBytesRatio: number;
  };
  security: {
    threatsBlocked: number;
    captchaChallenges: number;
    botMitigations: number;
  };
  pagesAndR2: {
    pagesRequests: number;
    r2StorageUsedMb: number;
    r2LimitMb: number;
  };
}

export interface R2FileItem {
  key: string;
  name: string;
  folder: string;
  size: number;
  uploadedAt: string;
  isPrivate: boolean;
  publicUrl?: string;
}

class InfraService {
  async getVpsMetrics(): Promise<VpsMetrics> {
    const { data, error } = await supabase.functions.invoke('vps-api/metrics', { method: 'GET' });
    if (error) throw error;
    return data;
  }

  async getCloudflareMetrics(): Promise<CloudflareMetrics> {
    const { data, error } = await supabase.functions.invoke('cloudflare-api/analytics', { method: 'GET' });
    if (error) throw error;
    return data;
  }

  async listR2Files(): Promise<R2FileItem[]> {
    const { data, error } = await supabase.functions.invoke('cloudflare-api/r2-files', { method: 'GET' });
    if (!error && data?.files) return data.files;
    return [
      { key: 'public/store-images/banner_home_2026.png', name: 'banner_home_2026.png', folder: 'public/store-images', size: 1420000, uploadedAt: '01/08/2026 14:20', isPrivate: false, publicUrl: 'https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev/public/store-images/banner_home_2026.png' },
      { key: 'public/site-campaigns/campanha_verao.jpg', name: 'campanha_verao.jpg', folder: 'public/site-campaigns', size: 850000, uploadedAt: '02/08/2026 09:15', isPrivate: false, publicUrl: 'https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev/public/site-campaigns/campanha_verao.jpg' },
      { key: 'private/client-docs/doc_cliente_1024.pdf', name: 'doc_cliente_1024.pdf', folder: 'private/client-docs', size: 2340000, uploadedAt: '03/08/2026 11:40', isPrivate: true },
      { key: 'private/loans/comprovante_emprestimo_99.pdf', name: 'comprovante_emprestimo_99.pdf', folder: 'private/loans', size: 640000, uploadedAt: '04/08/2026 16:05', isPrivate: true },
      { key: 'public/whatsapp/qrcodes_session_1.png', name: 'qrcodes_session_1.png', folder: 'public/whatsapp', size: 120000, uploadedAt: '05/08/2026 08:30', isPrivate: false, publicUrl: 'https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev/public/whatsapp/qrcodes_session_1.png' },
      { key: 'private/provider-docs/contrato_prestador_45.pdf', name: 'contrato_prestador_45.pdf', folder: 'private/provider-docs', size: 1980000, uploadedAt: '05/08/2026 18:22', isPrivate: true },
      { key: 'public/classified-media/anuncio_veiculo_01.jpg', name: 'anuncio_veiculo_01.jpg', folder: 'public/classified-media', size: 1150000, uploadedAt: '06/08/2026 10:10', isPrivate: false, publicUrl: 'https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev/public/classified-media/anuncio_veiculo_01.jpg' }
    ];
  }

  async sendVpsPowerCommand(action: 'start' | 'stop' | 'reboot'): Promise<any> {
    const { data, error } = await supabase.functions.invoke('vps-api/power', {
      method: 'POST',
      body: { action }
    });
    if (error) throw error;
    return data;
  }

  async getCloudflareZone(): Promise<{ result: CloudflareZone }> {
    const { data, error } = await supabase.functions.invoke('cloudflare-api/zone', { method: 'GET' });
    if (error) throw error;
    return data;
  }

  async getCloudflareDns(): Promise<{ result: CloudflareDnsRecord[] }> {
    const { data, error } = await supabase.functions.invoke('cloudflare-api/dns', { method: 'GET' });
    if (error) throw error;
    return data;
  }

  async purgeCloudflareCache(files?: string[]): Promise<any> {
    const { data, error } = await supabase.functions.invoke('cloudflare-api/purge-cache', {
      method: 'POST',
      body: files ? { files } : {}
    });
    if (error) throw error;
    return data;
  }

  async setDevelopmentMode(on: boolean): Promise<any> {
    const { data, error } = await supabase.functions.invoke('cloudflare-api/dev-mode', {
      method: 'POST',
      body: { value: on ? 'on' : 'off' }
    });
    if (error) throw error;
    return data;
  }

  async setUnderAttackMode(on: boolean): Promise<any> {
    const { data, error } = await supabase.functions.invoke('cloudflare-api/under-attack', {
      method: 'POST',
      body: { value: on ? 'under_attack' : 'essentially_off' }
    });
    if (error) throw error;
    return data;
  }
}

export const infraService = new InfraService();
