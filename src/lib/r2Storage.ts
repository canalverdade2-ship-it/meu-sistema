/**
 * r2Storage.ts — Camada de abstração para Cloudflare R2
 *
 * Substitui o Supabase Storage em todas as operações de arquivo.
 * Todos os uploads passam pelo gsa-hub-r2-worker que valida a sessão
 * antes de gravar no R2.
 *
 * Mapeamento de buckets antigos → prefixos R2:
 *   gsa-store-images        → public/store-images/
 *   gsa-site-campaigns      → public/site-campaigns/
 *   classificados-midias    → public/classified-media/
 *   gsa-ad-creatives        → private/ad-creatives/
 *   gsa-private-documents   → private/documents/
 *   documentos_cliente      → private/client-docs/
 *   documentos_prestador    → private/provider-docs/
 *   entregas_demandas       → private/demand-deliveries/
 *   emprestimos             → private/loans/
 *   gsa-partner-applications→ public/partner-applications/
 *   whatsapp                → public/whatsapp/
 *   product-imports         → private/product-imports/
 */

import { supabase } from './supabase';
import { sessionService } from './sessionService';

export const VPS_API_URL = import.meta.env.VITE_SUPABASE_URL || 'https://api.147-15-43-141.nip.io';
export const R2_WORKER_URL = import.meta.env.VITE_R2_WORKER_URL || 'https://gsa-hub-r2-worker.r2-handler.workers.dev';
export const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev';

// ─── Prefixos por bucket antigo ───────────────────────────────────────────────
export const BUCKET_PREFIX: Record<string, string> = {
  'gsa-store-images':         'public/store-images',
  'gsa-site-campaigns':       'public/site-campaigns',
  'classificados-midias':     'public/classified-media',
  'gsa-ad-creatives':         'private/ad-creatives',
  'gsa-private-documents':    'private/documents',
  'documentos_cliente':       'private/client-docs',
  'documentos_prestador':     'private/provider-docs',
  'entregas_demandas':        'private/demand-deliveries',
  'emprestimos':              'private/loans',
  'gsa-partner-applications': 'public/partner-applications',
  'whatsapp':                 'public/whatsapp',
  'product-imports':          'private/product-imports',
  'careers':                  'public/careers',
  'reembolsos':               'private/reembolsos',
};

export function isPrivatePath(path: string): boolean {
  return path.startsWith('private/');
}

// ─── URL pública de um arquivo R2 / Storage ──────────────────────────────────
export function getR2PublicUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.replace(/^\/+/, '');
  if (normalized.startsWith('uploads/')) {
    return `${VPS_API_URL}/${normalized}`;
  }
  return `${R2_PUBLIC_URL}/${normalized}`;
}

// ─── Obter headers de autenticação ───────────────────────────────────────────
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  
  // 1. Verificar sessão atômica GSA
  try {
    const session = sessionService.getCurrentSession();
    if (session?.sessaoId) {
      headers['x-gsa-session-id'] = session.sessaoId;
    }
    if (session?.sessionToken) {
      headers['x-gsa-session-token'] = session.sessionToken;
    }
  } catch {
    // Silently continue
  }

  // 2. Verificar token JWT Supabase
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
    }
  } catch {
    // Silently continue
  }

  return headers;
}

// ─── Normalizar caminho ────────────────────────────────────────────────────────
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

// ─── Upload de arquivo ────────────────────────────────────────────────────────
export async function uploadToR2(
  file: File,
  bucket: string,
  path: string,
): Promise<{ url: string | null; path: string; isPrivate: boolean }> {
  const headers = await getAuthHeaders();
  const prefix = BUCKET_PREFIX[bucket] ?? `public/${bucket}`;
  const key = normalizePath(`${prefix}/${path}`);

  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('path', key);

  // 1. Tentar upload primário na VPS (alta velocidade e compatibilidade total)
  try {
    const vpsResp = await fetch(`${VPS_API_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (vpsResp.ok) {
      const vpsJson = await vpsResp.json() as { success?: boolean; url?: string | null; path?: string; isPrivate?: boolean; error?: string };
      if (vpsJson.success) {
        return {
          url: vpsJson.url ?? null,
          path: vpsJson.path ?? key,
          isPrivate: vpsJson.isPrivate ?? false,
        };
      }
    }
  } catch (vpsErr) {
    console.warn('[r2Storage] Fallback para worker R2 após erro na VPS:', vpsErr);
  }

  // 2. Fallback: R2 Worker Cloudflare
  const resp = await fetch(`${R2_WORKER_URL}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const json = await resp.json() as { success?: boolean; url?: string | null; path?: string; isPrivate?: boolean; error?: string };
  if (!resp.ok || !json.success) {
    throw new Error(json.error || 'Falha ao enviar o arquivo.');
  }

  return {
    url: json.url ?? null,
    path: json.path ?? key,
    isPrivate: json.isPrivate ?? false,
  };
}

// ─── Remover arquivo(s) ───────────────────────────────────────────────────────
export async function removeFromR2(paths: string | string[]): Promise<void> {
  const pathArray = Array.isArray(paths) ? paths : [paths];
  const normalized = pathArray.map(normalizePath).filter(Boolean);
  if (normalized.length === 0) return;

  const headers = await getAuthHeaders();
  headers['Content-Type'] = 'application/json';

  // A migration or fallback can leave a copy on either backend.
  const results = await Promise.allSettled(
    [VPS_API_URL, R2_WORKER_URL].map(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/delete`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ paths: normalized }),
      });
      const result = await response.json() as { success?: boolean };
      if (!response.ok || result.success !== true) {
        throw new Error('O armazenamento não confirmou a exclusão.');
      }
    }),
  );
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Não foi possível confirmar a exclusão em todos os armazenamentos. Tente novamente.');
  }
}

// ─── Acesso a arquivo privado ou público (URL limpa e direta) ─────────────────
export function privatePathFromLegacyUrl(reference: string): string | null {
  try {
    const url = new URL(reference);
    const api = new URL(VPS_API_URL);
    const worker = new URL(R2_WORKER_URL);
    const publicR2 = new URL(R2_PUBLIC_URL);
    let key: string | null = null;
    if (url.origin === api.origin && url.pathname.startsWith('/uploads/private/')) {
      key = url.pathname.slice('/uploads/'.length);
    } else if ((url.origin === worker.origin || url.origin === publicR2.origin) && url.pathname.startsWith('/private/')) {
      key = url.pathname.slice(1);
    }
    return key === null ? null : decodeURIComponent(key);
  } catch { return null; }
}

export function privateBucketPath(bucket: string, path: string): string {
  const prefix = BUCKET_PREFIX[bucket];
  if (!prefix?.startsWith('private/')) throw new Error('Bucket privado inválido.');
  const normalized = normalizePath(path);
  if (normalized.startsWith('private/')) {
    if (!normalized.startsWith(`${prefix}/`)) throw new Error('Documento pertence a outro bucket.');
    return normalized;
  }
  return `${prefix}/${normalized}`;
}

export async function getPrivateR2Url(path: string): Promise<string> {
  const normalized = normalizePath(path);
  if (normalized.split('/').some(part => part === '..' || part === '.') || normalized.includes('\0')) {
    throw new Error('Caminho de arquivo inválido.');
  }
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  if (!normalized.startsWith('private/')) {
    return `${R2_WORKER_URL}/file/${encoded.replace(/^public\//, '')}`;
  }
  const headers = await getAuthHeaders();
  if (!headers.Authorization && !(headers['x-gsa-session-id'] && headers['x-gsa-session-token'])) {
    throw new Error('Faça login para acessar o documento.');
  }
  // Credentials remain in request headers, never in a shareable URL.
  let response = await fetch(`${VPS_API_URL}/uploads/${encoded}`, { headers, cache: 'no-store' });
  if (response.status === 404) {
    response = await fetch(`${R2_WORKER_URL}/${encoded}`, { headers, cache: 'no-store' });
  }
  if (!response.ok) throw new Error('Não foi possível autorizar o acesso ao documento.');
  const url = URL.createObjectURL(await response.blob());
  window.setTimeout(() => URL.revokeObjectURL(url), 15 * 60 * 1000);
  return url;
}

// ─── Helpers de upload com prefixo pré-definido ───────────────────────────────

export async function uploadPublicStoreImageR2(file: File, prefix: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'img';
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const result = await uploadToR2(file, 'gsa-store-images', path);
  return result.url!;
}

export async function uploadSiteCampaignImageR2(file: File, path: string): Promise<string> {
  const result = await uploadToR2(file, 'gsa-site-campaigns', path);
  return result.url!;
}

export async function uploadClientDocumentR2(file: File, clientId: string, context: string): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${clientId}/${context}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const result = await uploadToR2(file, 'documentos_cliente', path);
  return { url: getR2PublicUrl(result.path), path: result.path };
}

export async function uploadProviderDocumentR2(file: File, providerId: string, scope: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${providerId}/${scope}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const result = await uploadToR2(file, 'documentos_prestador', path);
  return result.path;
}

export async function uploadDemandDeliveryR2(file: File, demandId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${demandId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const result = await uploadToR2(file, 'entregas_demandas', path);
  return getR2PublicUrl(result.path);
}

export async function uploadLoanFileR2(file: File, clientId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${clientId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const result = await uploadToR2(file, 'emprestimos', path);
  return getR2PublicUrl(result.path);
}

// ─── Extrai o path de uma URL pública ─────────────────────────────────────────
export function getR2PathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith(VPS_API_URL + '/uploads/')) {
    return url.slice((VPS_API_URL + '/uploads/').length).replace(/^\/+/, '');
  }
  if (url.startsWith(R2_PUBLIC_URL)) {
    return url.slice(R2_PUBLIC_URL.length).replace(/^\/+/, '');
  }
  return null;
}
