/**
 * r2.ts — Módulo compartilhado para acesso ao Cloudflare R2 via API S3
 * Usado pelas Edge Functions do Supabase para upload/download/delete de arquivos.
 *
 * Requer as variáveis de ambiente (Supabase Secrets):
 *   R2_ACCOUNT_ID   — ID da conta Cloudflare
 *   R2_ACCESS_KEY_ID — Access Key ID do R2 API Token
 *   R2_SECRET_ACCESS_KEY — Secret Access Key do R2 API Token
 *   R2_BUCKET_NAME  — Nome do bucket (gsa-hub-storage)
 *   R2_PUBLIC_URL   — URL pública do bucket R2
 */

export const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME') ?? 'gsa-hub-storage';
export const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL') ?? 'https://pub-7f7b1419c83c407ba9bcf6512329e79a.r2.dev';

const R2_ACCOUNT_ID = () => Deno.env.get('R2_ACCOUNT_ID') ?? '';
const R2_ACCESS_KEY = () => Deno.env.get('R2_ACCESS_KEY_ID') ?? '';
const R2_SECRET_KEY = () => Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '';

function getEndpoint() {
  return `https://${R2_ACCOUNT_ID()}.r2.cloudflarestorage.com`;
}

// ─── AWS Signature V4 ─────────────────────────────────────────────────────────
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}

async function sha256hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signRequest(
  method: string,
  key: string,
  body: Uint8Array | null,
  contentType?: string,
): Promise<Record<string, string>> {
  const endpoint = getEndpoint();
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const host = new URL(endpoint).host;

  const payloadHash = body ? await sha256hex(body) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const signedHeaders = contentType
    ? 'content-type;host;x-amz-content-sha256;x-amz-date'
    : 'host;x-amz-content-sha256;x-amz-date';

  const canonicalHeaders = contentType
    ? `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${datetime}\n`
    : `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${datetime}\n`;

  const canonicalPath = `/${R2_BUCKET}/${key.replace(/^\/+/, '')}`;
  const canonicalRequest = [method, canonicalPath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, await sha256hex(canonicalRequest)].join('\n');

  const enc = new TextEncoder();
  const kDate = await hmac(enc.encode(`AWS4${R2_SECRET_KEY()}`), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signatureBytes = await hmac(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY()}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authHeader,
    'x-amz-date': datetime,
    'x-amz-content-sha256': payloadHash,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

// ─── Upload de arquivo ────────────────────────────────────────────────────────
export async function r2Upload(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<{ publicUrl: string; path: string }> {
  const normalizedKey = key.replace(/^\/+/, '');
  const headers = await signRequest('PUT', normalizedKey, body, contentType);

  const resp = await fetch(`${getEndpoint()}/${R2_BUCKET}/${normalizedKey}`, {
    method: 'PUT',
    headers,
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`R2 upload falhou [${resp.status}]: ${text}`);
  }

  return {
    publicUrl: `${R2_PUBLIC_URL}/${normalizedKey}`,
    path: normalizedKey,
  };
}

// ─── Download de arquivo ──────────────────────────────────────────────────────
export async function r2Download(key: string): Promise<{ body: Uint8Array; contentType: string }> {
  const normalizedKey = key.replace(/^\/+/, '');
  const headers = await signRequest('GET', normalizedKey, null);

  const resp = await fetch(`${getEndpoint()}/${R2_BUCKET}/${normalizedKey}`, { headers });
  if (!resp.ok) throw new Error(`R2 download falhou [${resp.status}]`);

  const body = new Uint8Array(await resp.arrayBuffer());
  const contentType = resp.headers.get('content-type') ?? 'application/octet-stream';
  return { body, contentType };
}

// ─── Delete de arquivo(s) ────────────────────────────────────────────────────
export async function r2Delete(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      const normalizedKey = key.replace(/^\/+/, '');
      const headers = await signRequest('DELETE', normalizedKey, null);
      const resp = await fetch(`${getEndpoint()}/${R2_BUCKET}/${normalizedKey}`, { method: 'DELETE', headers });
      if (!resp.ok && resp.status !== 404) {
        throw new Error(`R2 delete falhou [${resp.status}]: ${key}`);
      }
    }),
  );
}

// ─── URL pública ──────────────────────────────────────────────────────────────
export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key.replace(/^\/+/, '')}`;
}

// ─── Mapeamento de bucket antigo → prefixo R2 ────────────────────────────────
export const BUCKET_PREFIX: Record<string, string> = {
  'classificados-midias':     'public/classified-media',
  'gsa-store-images':         'public/store-images',
  'gsa-site-campaigns':       'public/site-campaigns',
  'gsa-partner-applications': 'public/partner-applications',
  'gsa-ad-creatives':         'private/ad-creatives',
  'gsa-private-documents':    'private/documents',
  'documentos_cliente':       'private/client-docs',
  'documentos_prestador':     'private/provider-docs',
  'entregas_demandas':        'private/demand-deliveries',
  'emprestimos':              'private/loans',
  'whatsapp':                 'public/whatsapp',
  'product-imports':          'private/product-imports',
};
