import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

function json(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export function normalizePaymentEvent(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const source = input as JsonRecord;
  const provider = String(source.provider || '').trim().slice(0, 50);
  const eventId = String(source.event_id || '').trim().slice(0, 200);
  const reference = String(source.reference || '').trim().slice(0, 200);
  const status = String(source.status || '').trim();
  if (!provider || !eventId || !reference || !['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'].includes(status)) return null;
  return { provider, eventId, reference, status };
}

export async function handleRequest(request: Request) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 128_000) return json(413, { error: 'payload_too_large' });

  const secret = Deno.env.get('ADVERTISING_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supabaseUrl || !serviceRoleKey) return json(503, { error: 'server_not_configured' });

  const raw = await request.text();
  const providedSignature = String(request.headers.get('x-gsa-signature') || '').toLowerCase().replace(/^sha256=/, '');
  const expectedSignature = await hmacHex(secret, raw);
  if (!providedSignature || !safeEqual(providedSignature, expectedSignature)) return json(401, { error: 'invalid_signature' });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const event = normalizePaymentEvent(payload);
  if (!event) return json(400, { error: 'invalid_event' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
  const { data, error } = await admin.rpc('gsa_ads_process_payment_event', {
    p_provider: event.provider,
    p_event_id: event.eventId,
    p_reference: event.reference,
    p_status: event.status,
    p_payload: payload,
  });
  if (error) {
    console.error('Advertising payment webhook failed', error);
    return json(error.code === 'P0002' ? 404 : 500, { error: 'event_processing_failed' });
  }
  return json(200, { success: true, duplicate: Boolean(data?.duplicate), status: data?.status || event.status });
}

if (import.meta.main) Deno.serve(handleRequest);
