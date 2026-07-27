import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { parseProductHtml, parseProductsHtml } from '../_shared/html_parser.ts';
import {
  assertUrlResolvesPublic,
  type DnsResolver,
} from '../_shared/ssrf_validator.ts';

type JsonRecord = Record<string, unknown>;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_URL_LENGTH = 2_048;
const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function configuredOrigins() {
  return new Set(
    `${Deno.env.get('PRODUCT_IMPORT_ALLOWED_ORIGINS') || ''},${DEFAULT_ALLOWED_ORIGINS.join(',')}`
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function corsHeaders(origin: string | null) {
  const allowed = origin && configuredOrigins().has(origin) ? origin : '';
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    vary: 'Origin',
  };
}

function json(status: number, body: JsonRecord, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'content-type': 'application/json; charset=utf-8' },
  });
}

async function readJsonWithinLimit(request: Request): Promise<JsonRecord> {
  if (!request.body) throw new SyntaxError('invalid_json');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new RangeError('payload_too_large');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('invalid_json');
    return parsed as JsonRecord;
  } finally {
    reader.releaseLock();
  }
}

function normalizedContentType(response: Response) {
  return (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
}

async function readLimitedBytes(response: Response, maximum: number) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maximum) throw new RangeError('response_too_large');
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel('response_too_large');
        throw new RangeError('response_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

type SafeFetchOptions = {
  accept: string;
  maximumBytes: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  resolver?: DnsResolver;
};

export async function safeFetch(urlValue: string, options: SafeFetchOptions): Promise<Response> {
  if (typeof urlValue !== 'string' || !urlValue || urlValue.length > MAX_URL_LENGTH) {
    throw new Error('URL inválida ou não permitida');
  }

  const fetcher = options.fetcher || fetch;
  const deadline = Date.now() + (options.timeoutMs || 10_000);
  let current = await assertUrlResolvesPublic(urlValue, options.resolver);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Tempo limite excedido ao consultar URL');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), remaining);
    let response: Response;
    try {
      response = await fetcher(current.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          accept: options.accept,
          'user-agent': 'Mozilla/5.0 (compatible; GSA-Store-Bot/2.0)',
        },
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('Tempo limite excedido ao consultar URL');
      throw new Error('Falha ao consultar a URL');
    } finally {
      clearTimeout(timeoutId);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectCount === MAX_REDIRECTS) {
        await response.body?.cancel();
        throw new Error('Limite de redirecionamentos excedido');
      }
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Redirecionamento sem destino válido');
      const target = new URL(location, current);
      if (current.protocol === 'https:' && target.protocol !== 'https:') {
        throw new Error('Redirecionamento inseguro não permitido');
      }
      current = await assertUrlResolvesPublic(target.toString(), options.resolver);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`O destino respondeu com status ${response.status}`);
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > options.maximumBytes) {
      await response.body?.cancel();
      throw new RangeError('response_too_large');
    }
    return response;
  }
  throw new Error('Limite de redirecionamentos excedido');
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function auditLog(client: any, actor: any, action: string, details: JsonRecord) {
  const { error } = await client.from('sistema_logs').insert({
    acao: action,
    detalhes: JSON.stringify(details),
    ator_tipo: actor.ator_tipo,
    ator_id: actor.ator_id,
    ator_nome: actor.ator_nome,
  });
  if (error) console.error(`Falha ao registrar auditoria ${action}:`, error);
}

async function requireRateLimit(client: any, key: string, maximum: number) {
  const { data, error } = await client.rpc('gsa_auth_rate_limit_check', {
    p_bucket_key: key,
    p_limit: maximum,
    p_window_seconds: 3600,
    p_block_seconds: 3600,
  });
  if (error || typeof data?.allowed !== 'boolean') throw new Error('rate_limit_unavailable');
  return data as { allowed: boolean; retry_after?: number };
}

async function fetchHtml(url: string) {
  const response = await safeFetch(url, {
    accept: 'text/html,application/xhtml+xml',
    maximumBytes: MAX_HTML_BYTES,
  });
  if (!HTML_TYPES.has(normalizedContentType(response))) {
    await response.body?.cancel();
    throw new TypeError('A URL não retornou conteúdo HTML válido');
  }
  const bytes = await readLimitedBytes(response, MAX_HTML_BYTES);
  return {
    html: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
    finalUrl: response.url || url,
  };
}

async function fetchImage(url: string) {
  const response = await safeFetch(url, {
    accept: 'image/jpeg,image/png,image/webp',
    maximumBytes: MAX_IMAGE_BYTES,
  });
  const contentType = normalizedContentType(response);
  if (!IMAGE_TYPES.has(contentType)) {
    await response.body?.cancel();
    throw new TypeError('Tipo de imagem inválido');
  }
  const bytes = await readLimitedBytes(response, MAX_IMAGE_BYTES);
  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !configuredOrigins().has(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return json(415, { error: 'unsupported_media_type' }, origin);
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);

  let body: JsonRecord;
  try {
    body = await readJsonWithinLimit(request);
  } catch (error) {
    return json(
      error instanceof RangeError ? 413 : 400,
      { error: error instanceof RangeError ? 'payload_too_large' : 'invalid_json' },
      origin,
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(503, { error: 'server_not_configured' }, origin);
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;

  const sessaoId = String(body.sessaoId || '');
  const sessionToken = String(body.sessionToken || '');
  if (!sessaoId || sessaoId.length > 64 || !sessionToken || sessionToken.length > 256) {
    return json(401, { error: 'session_required' }, origin);
  }

  const { data: actor, error: authError } = await client.rpc(
    'gsa_admin_authorize_product_url_import',
    { p_sessao_id: sessaoId, p_session_token: sessionToken },
  );
  if (authError || !actor?.ator_id) {
    return json(403, { error: 'session_or_module_not_allowed' }, origin);
  }

  const action = String(body.action || '');
  const actorHash = await digest(`${serviceRoleKey}:actor:${actor.ator_tipo}:${actor.ator_id}`);
  const ipHash = await digest(`${serviceRoleKey}:ip:${clientIp(request)}`);
  try {
    const [actorLimit, ipLimit] = await Promise.all([
      requireRateLimit(client, `product-url-import:${action}:actor:${actorHash}`, 120),
      requireRateLimit(client, `product-url-import:${action}:ip:${ipHash}`, 180),
    ]);
    const blocked = !actorLimit.allowed || !ipLimit.allowed;
    if (blocked) {
      const retryAfter = Math.max(
        1,
        Number(actorLimit.retry_after || 0),
        Number(ipLimit.retry_after || 0),
      );
      return json(429, { error: 'too_many_attempts', retry_after: retryAfter }, origin);
    }
  } catch (error) {
    console.error('Limitador da importação por URL indisponível:', error);
    return json(503, { error: 'rate_limit_unavailable' }, origin);
  }

  try {
    if (action === 'analyze' || action === 'discover_products') {
      const sourceUrl = String(body.url || '');
      const { html, finalUrl } = await fetchHtml(sourceUrl);
      if (action === 'analyze') {
        const parsed = parseProductHtml(html, finalUrl);
        await auditLog(client, actor, 'IMPORTAR_DADOS_PRODUTO_URL', {
          url_consultada: new URL(sourceUrl).hostname,
          campos_encontrados: Object.keys(parsed.origem_campos),
          status: 'sucesso',
        });
        return json(200, {
          success: true,
          data: { ...parsed, url_original: sourceUrl, url_final: finalUrl, avisos: [] },
        }, origin);
      }

      const candidates = parseProductsHtml(html, finalUrl).slice(0, 500);
      await auditLog(client, actor, 'DESCOBRIR_PRODUTOS_PAGINA', {
        url_consultada: new URL(sourceUrl).hostname,
        encontrados: candidates.length,
        status: 'sucesso',
      });
      return json(200, {
        success: true,
        data: { candidates, total: candidates.length },
      }, origin);
    }

    if (action === 'analyze_products') {
      const urls = body.urls;
      if (!Array.isArray(urls) || urls.length === 0 || urls.length > 10) {
        return json(400, { error: 'invalid_url_batch' }, origin);
      }
      const results = await Promise.all(urls.map(async (value) => {
        const sourceUrl = typeof value === 'string' ? value : '';
        try {
          const { html, finalUrl } = await fetchHtml(sourceUrl);
          const parsed = parseProductHtml(html, finalUrl);
          return { url: sourceUrl, success: true, data: { ...parsed, url_final: finalUrl } };
        } catch (error: any) {
          return { url: sourceUrl, error: error?.message || 'Falha ao analisar URL' };
        }
      }));
      await auditLog(client, actor, 'ANALISAR_PRODUTOS_EM_LOTE', {
        quantidade: urls.length,
        status: 'concluido',
      });
      return json(200, { success: true, data: results }, origin);
    }

    if (action === 'copy_images') {
      const images = body.images;
      if (!Array.isArray(images) || images.length === 0 || images.length > 10) {
        return json(400, { error: 'invalid_image_batch' }, origin);
      }
      const uploaded: string[] = [];
      const failed: string[] = [];
      for (const value of images) {
        const imageUrl = typeof value === 'string' ? value : '';
        try {
          const { blob, contentType } = await fetchImage(imageUrl);
          const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
          const fileName = `imports/produtos/${crypto.randomUUID()}.${extension}`;
          const { data, error } = await client.storage
            .from('gsa-store-images')
            .upload(fileName, blob, { contentType, upsert: false });
          if (error || !data) throw error || new Error('Falha no upload');
          const publicUrl = client.storage.from('gsa-store-images').getPublicUrl(fileName).data.publicUrl;
          uploaded.push(publicUrl);
        } catch {
          failed.push(imageUrl);
        }
      }
      await auditLog(client, actor, 'IMPORTAR_DADOS_PRODUTO_URL', {
        imagens_copiadas: uploaded.length,
        imagens_falhas: failed.length,
        status: 'copia_imagens',
      });
      return json(200, { success: true, data: { uploaded, failed } }, origin);
    }

    if (action === 'copy_product_images') {
      const batchId = String(body.batchId || '');
      const products = body.products;
      if (
        !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(batchId)
        || !Array.isArray(products)
        || products.length === 0
        || products.length > 10
      ) {
        return json(400, { error: 'invalid_product_batch' }, origin);
      }

      const results: JsonRecord[] = [];
      for (const value of products) {
        const product = value && typeof value === 'object' ? value as JsonRecord : {};
        const clientId = String(product.client_id || '');
        const images = Array.isArray(product.images) ? product.images.slice(0, 5) : [];
        const uploaded: string[] = [];
        const failed: string[] = [];
        if (!/^[a-zA-Z0-9_-]{1,80}$/.test(clientId)) {
          results.push({ client_id: clientId, uploaded, failed: images.map(String) });
          continue;
        }
        for (const value of images) {
          const imageUrl = typeof value === 'string' ? value : '';
          try {
            const { blob, contentType } = await fetchImage(imageUrl);
            const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
            const fileName = `imports/produtos/${batchId}/${clientId}/${crypto.randomUUID()}.${extension}`;
            const { data, error } = await client.storage
              .from('gsa-store-images')
              .upload(fileName, blob, { contentType, upsert: false });
            if (error || !data) throw error || new Error('Falha no upload');
            uploaded.push(client.storage.from('gsa-store-images').getPublicUrl(fileName).data.publicUrl);
          } catch {
            failed.push(imageUrl);
          }
        }
        results.push({ client_id: clientId, uploaded, failed });
      }
      await auditLog(client, actor, 'COPIAR_IMAGENS_LOTE', {
        batch_id: batchId,
        produtos_processados: products.length,
      });
      return json(200, { success: true, data: results }, origin);
    }

    return json(400, { error: 'invalid_action' }, origin);
  } catch (error: any) {
    console.error('Falha na importação por URL:', error);
    const status = error instanceof RangeError
      ? 413
      : error instanceof TypeError
        ? 415
        : 400;
    return json(status, { error: error?.message || 'import_failed' }, origin);
  }
}

if (import.meta.main) serve(handleRequest);
