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

// ─── URL pública de um arquivo R2 ─────────────────────────────────────────────
export function getR2PublicUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  return `${R2_PUBLIC_URL}/${normalized}`;
}

// ─── Obter token de autenticação Supabase ─────────────────────────────────────
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error('Sessão expirada. Faça login novamente.');
  return token;
}

// ─── Normalizar caminho ────────────────────────────────────────────────────────
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

// ─── Upload de arquivo para o R2 ─────────────────────────────────────────────
export async function uploadToR2(
  file: File,
  bucket: string,
  path: string,
): Promise<{ url: string | null; path: string; isPrivate: boolean }> {
  const token = await getAuthToken();
  const prefix = BUCKET_PREFIX[bucket] ?? `public/${bucket}`;
  const key = normalizePath(`${prefix}/${path}`);

  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('path', key);

  const resp = await fetch(`${R2_WORKER_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
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

// ─── Remover arquivo(s) do R2 ────────────────────────────────────────────────
export async function removeFromR2(paths: string | string[]): Promise<void> {
  const pathArray = Array.isArray(paths) ? paths : [paths];
  const normalized = pathArray.map(normalizePath).filter(Boolean);
  if (normalized.length === 0) return;

  // Filtra itens de demonstração para evitar disparo desnecessário ao Worker
  const realPaths = normalized.filter(p => 
    !p.includes('banner_home_2026') && 
    !p.includes('campanha_verao') && 
    !p.includes('doc_cliente_1024') && 
    !p.includes('comprovante_emprestimo_99') && 
    !p.includes('qrcodes_session_1') && 
    !p.includes('contrato_prestador_45') && 
    !p.includes('anuncio_veiculo_01')
  );

  if (realPaths.length === 0) return;

  try {
    const token = await getAuthToken().catch(() => '');
    if (token) {
      await fetch(`${R2_WORKER_URL}/delete`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ paths: realPaths }),
      }).catch(() => {});
    }
  } catch {
    // Retorno gracioso para exclusão no frontend
  }
}

// ─── Acesso a arquivo privado ou público (URL limpa e direta) ─────────────────
export async function getPrivateR2Url(path: string): Promise<string> {
  const normalized = normalizePath(path);
  const cleanPath = normalized.replace(/^(public|private)\//, '');

  if (normalized.startsWith('private/')) {
    try {
      const token = await getAuthToken();
      return `${R2_WORKER_URL}/private/${cleanPath}?token=${encodeURIComponent(token)}`;
    } catch {
      // Se não houver token, retorna o endpoint do worker público
    }
  }

  return `${R2_WORKER_URL}/file/${cleanPath}`;
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
  return result.path; // referência interna — resolver com getPrivateR2Url
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

// ─── Extrai o path R2 de uma URL pública ──────────────────────────────────────
export function getR2PathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith(R2_PUBLIC_URL)) {
    return url.slice(R2_PUBLIC_URL.length).replace(/^\/+/, '');
  }
  return null;
}
