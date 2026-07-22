import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

const MAX_BODY_BYTES = 16_000;
const DEFAULT_ALLOWED_ORIGINS = [
  'http://10.0.2.189:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function configuredOrigins() {
  return (Deno.env.get('ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null) {
  const allowed = origin && configuredOrigins().includes(origin) ? origin : '';
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '86400',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    vary: 'Origin',
  };
}

function json(status: number, body: JsonRecord, origin: string | null, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin), ...extraHeaders },
  });
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cleanIdentifier(value: unknown, max = 160) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) return null;
  return normalized;
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

async function checkRateLimit(
  admin: any,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
) {
  const { data, error } = await admin.rpc('gsa_auth_rate_limit_check', {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });
  if (error || typeof data?.allowed !== 'boolean') throw new Error('rate_limit_unavailable');
  return data as { allowed: boolean; retry_after?: number };
}

export function normalizeServePayload(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const source = input as JsonRecord;
  const placement = cleanIdentifier(source.placement_code, 80);
  const viewer = cleanIdentifier(source.viewer_id, 160);
  const session = cleanIdentifier(source.session_id, 160);
  const route = String(source.route || '').trim().slice(0, 500);
  const device = String(source.device || '').trim().slice(0, 20);
  if (!placement || !viewer || !session || !['desktop', 'tablet', 'mobile'].includes(device)) return null;
  return { placement, viewer, session, route, device };
}

export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !configuredOrigins().includes(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin, { allow: 'POST, OPTIONS' });

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: 'payload_too_large' }, origin);
  }

  let body: JsonRecord;
  try {
    body = JSON.parse(rawBody) as JsonRecord;
  } catch {
    return json(400, { error: 'invalid_json' }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hashSalt = Deno.env.get('AD_DELIVERY_HASH_SALT');
  if (!supabaseUrl || !serviceRoleKey || !hashSalt) return json(503, { error: 'server_not_configured' }, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;

  const ipHash = await digest(`${hashSalt}:ip:${clientIp(request)}`);
  const action = String(body.action || '');
  const limit = action === 'event'
    ? { maximum: 600, window: 60, block: 300 }
    : { maximum: 240, window: 60, block: 300 };

  try {
    const ipLimit = await checkRateLimit(
      admin,
      `ads:delivery:${action || 'unknown'}:ip:${ipHash}`,
      limit.maximum,
      limit.window,
      limit.block,
    );
    if (!ipLimit.allowed) {
      const retryAfter = Math.max(1, Number(ipLimit.retry_after || limit.block));
      return json(429, { error: 'too_many_attempts', retry_after: retryAfter }, origin, {
        'retry-after': String(retryAfter),
      });
    }
  } catch (error) {
    console.error('Ad delivery rate limiting unavailable', error);
    return json(503, { error: 'rate_limit_unavailable' }, origin);
  }

  if (action === 'serve') {
    const payload = normalizeServePayload(body);
    if (!payload) return json(400, { error: 'invalid_request' }, origin);

    const viewerHash = await digest(`${hashSalt}:viewer:${payload.viewer}`);
    const sessionHash = await digest(`${hashSalt}:session:${payload.session}`);

    const viewerLimit = await checkRateLimit(
      admin,
      `ads:delivery:viewer:${viewerHash}`,
      90,
      60,
      300,
    ).catch(() => null);
    if (!viewerLimit) return json(503, { error: 'rate_limit_unavailable' }, origin);
    if (!viewerLimit.allowed) {
      const retryAfter = Math.max(1, Number(viewerLimit.retry_after || 300));
      return json(429, { error: 'too_many_attempts', retry_after: retryAfter }, origin, {
        'retry-after': String(retryAfter),
      });
    }

    const { data, error } = await admin.rpc('gsa_ads_serve', {
      p_placement_code: payload.placement,
      p_viewer_hash: viewerHash,
      p_session_hash: sessionHash,
      p_route: payload.route,
      p_device: payload.device,
    });
    if (error) {
      console.error('Ad serving failed', error);
      return json(500, { error: 'serve_failed' }, origin);
    }
    if (!data?.ad) return json(200, { success: true, ad: null }, origin);

    let assetUrl: string | null = null;
    if (data.ad.storage_path) {
      const { data: signed, error: signedError } = await admin.storage
        .from('gsa-ad-creatives')
        .createSignedUrl(data.ad.storage_path, 300);
      if (signedError) console.error('Creative signed URL failed', signedError);
      assetUrl = signed?.signedUrl || null;
    }

    return json(200, {
      success: true,
      event_token: data.event_token,
      ad: { ...data.ad, asset_url: assetUrl },
    }, origin);
  }

  if (action === 'event') {
    const token = cleanIdentifier(body.event_token, 60);
    const eventType = String(body.event_type || '').trim();
    if (!token || !['viewable', 'click', 'video_start', 'video_complete'].includes(eventType)) {
      return json(400, { error: 'invalid_event' }, origin);
    }
    const { data, error } = await admin.rpc('gsa_ads_record_event', {
      p_event_token: token,
      p_event_type: eventType,
    });
    if (error) return json(404, { error: 'event_not_found' }, origin);
    return json(200, { success: true, recorded: Boolean(data?.recorded) }, origin);
  }

  return json(400, { error: 'invalid_action' }, origin);
}

if (import.meta.main) Deno.serve(handleRequest);
