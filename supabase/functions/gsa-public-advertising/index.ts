import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

type JsonRecord = Record<string, unknown>;

const MAX_BODY_BYTES = 32_000;
const ALLOWED_COMPANY_SIZES = new Set(['autonomo', 'mei', 'micro', 'pequena', 'media', 'grande']);
const ALLOWED_FORMATS = new Set([
  'responsive_banner', 'sponsored_card', 'rectangle', 'sticky_banner', 'hero',
  'inline_video', 'floating_video', 'lightbox', 'section_sponsorship',
  'sponsored_content', 'takeover',
]);
const ALLOWED_PLACEMENTS = new Set([
  'ADS_PUBLIC_SHOWCASE', 'HOME_BANNER_TOP', 'HOME_INLINE_01', 'HOME_LIGHTBOX',
  'SITE_STICKY_BOTTOM', 'MARKETPLACE_SPONSORED_CARD', 'CLASSIFIEDS_BANNER_TOP',
]);
const ALLOWED_DEVICES = new Set(['desktop', 'tablet', 'mobile']);

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
    vary: 'Origin',
  };
}

function json(status: number, body: JsonRecord, origin: string | null, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin), ...extra },
  });
}

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeArray(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((item) => String(item || '').trim())
      .filter((item) => allowed.has(item)),
  )).slice(0, 20);
}

function isHttpsUrl(value: string) {
  if (!value) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false;
  const calculate = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(9) === Number(digits[9]) && calculate(10) === Number(digits[10]);
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false;
  const calculate = (length: 12 | 13) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}

function isValidDocument(value: string) {
  return value.length === 11 ? isValidCpf(value) : isValidCnpj(value);
}

function isIsoDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeSourceMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as JsonRecord;
  const pathname = String(source.pathname || '').trim().slice(0, 300);
  const referrer = String(source.referrer || '').trim().slice(0, 500);
  const utmSource = String(source.utm_source || '').trim().slice(0, 120);
  return {
    ...(pathname ? { pathname } : {}),
    ...(referrer ? { referrer } : {}),
    ...(utmSource ? { utm_source: utmSource } : {}),
  };
}

async function readJsonWithinLimit(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RangeError('payload_too_large');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}

export function normalizePayload(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const source = input as JsonRecord;
  const payload = {
    company_name: String(source.company_name || '').trim().slice(0, 160),
    document: onlyDigits(source.document).slice(0, 14),
    company_size: String(source.company_size || '').trim(),
    segment: String(source.segment || '').trim().slice(0, 120),
    contact_name: String(source.contact_name || '').trim().slice(0, 120),
    contact_email: String(source.contact_email || '').trim().toLowerCase().slice(0, 180),
    contact_phone: onlyDigits(source.contact_phone).slice(0, 13),
    website: String(source.website || '').trim().slice(0, 300),
    objective: String(source.objective || '').trim().slice(0, 160),
    desired_formats: normalizeArray(source.desired_formats, ALLOWED_FORMATS),
    desired_pages: normalizeArray(source.desired_pages, ALLOWED_PLACEMENTS),
    devices: normalizeArray(source.devices, ALLOWED_DEVICES),
    desired_start_date: String(source.desired_start_date || '').trim().slice(0, 10),
    desired_end_date: String(source.desired_end_date || '').trim().slice(0, 10),
    intended_budget: Number(source.intended_budget || 0),
    needs_creative_service: Boolean(source.needs_creative_service),
    notes: String(source.notes || '').trim().slice(0, 2000),
    website_confirmation: String(source.website_confirmation || '').trim(),
    started_at: String(source.started_at || '').trim(),
    source_metadata: normalizeSourceMetadata(source.source_metadata),
  };

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.contact_email);
  const today = new Date().toISOString().slice(0, 10);
  const durationDays = payload.desired_start_date && payload.desired_end_date
    ? Math.round((Date.parse(`${payload.desired_end_date}T00:00:00Z`) - Date.parse(`${payload.desired_start_date}T00:00:00Z`)) / 86_400_000)
    : 0;
  const dateRangeValid = isIsoDate(payload.desired_start_date)
    && isIsoDate(payload.desired_end_date)
    && (!payload.desired_start_date || payload.desired_start_date >= today)
    && (!payload.desired_end_date || Boolean(payload.desired_start_date))
    && (!payload.desired_start_date || !payload.desired_end_date || (
      payload.desired_end_date >= payload.desired_start_date && durationDays <= 366
    ));
  const startedAt = Date.parse(payload.started_at);
  const formAge = Date.now() - startedAt;
  const formAgeValid = Number.isFinite(startedAt) && formAge >= 2500 && formAge <= 2 * 60 * 60 * 1000;

  if (
    payload.website_confirmation ||
    payload.company_name.length < 2 ||
    !isValidDocument(payload.document) ||
    !ALLOWED_COMPANY_SIZES.has(payload.company_size) ||
    payload.segment.length < 2 ||
    payload.contact_name.length < 2 ||
    !emailValid ||
    payload.contact_phone.length < 10 ||
    payload.objective.length < 3 ||
    payload.desired_formats.length === 0 ||
    payload.desired_pages.length === 0 ||
    payload.devices.length === 0 ||
    !Number.isFinite(payload.intended_budget) ||
    payload.intended_budget <= 0 ||
    payload.intended_budget > 100_000_000 ||
    !isHttpsUrl(payload.website) ||
    !dateRangeValid ||
    !formAgeValid
  ) return null;

  return payload;
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !configuredOrigins().includes(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin, { allow: 'POST, OPTIONS' });

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return json(415, { error: 'unsupported_media_type' }, origin);

  let raw: unknown;
  try {
    raw = await readJsonWithinLimit(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RangeError) return json(413, { error: 'payload_too_large' }, origin);
    return json(400, { error: 'invalid_json' }, origin);
  }

  const payload = normalizePayload(raw);
  if (!payload) return json(400, { error: 'invalid_request' }, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(503, { error: 'server_not_configured' }, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) as any;
  const ipHash = await digest(clientIp(request));
  const identityHash = await digest(`${payload.document}:${payload.contact_email}`);

  const { data: ipLimit, error: ipLimitError } = await admin.rpc('gsa_auth_rate_limit_check', {
    p_bucket_key: `ads:ip:${ipHash}`,
    p_limit: 8,
    p_window_seconds: 3600,
    p_block_seconds: 7200,
  });
  if (ipLimitError) return json(503, { error: 'rate_limit_unavailable' }, origin);
  if (ipLimit?.allowed === false) {
    const retryAfter = Number(ipLimit.retry_after || 3600);
    return json(429, { error: 'too_many_attempts', retry_after: retryAfter }, origin, { 'retry-after': String(retryAfter) });
  }

  const { data: identityLimit, error: identityLimitError } = await admin.rpc('gsa_auth_rate_limit_check', {
    p_bucket_key: `ads:identity:${identityHash}`,
    p_limit: 5,
    p_window_seconds: 86400,
    p_block_seconds: 86400,
  });
  if (identityLimitError) return json(503, { error: 'rate_limit_unavailable' }, origin);
  if (identityLimit?.allowed === false) {
    const retryAfter = Number(identityLimit.retry_after || 3600);
    return json(429, { error: 'too_many_attempts', retry_after: retryAfter }, origin, { 'retry-after': String(retryAfter) });
  }

  const { data, error } = await admin.rpc('gsa_public_submit_advertising_request', { p_payload: payload });
  if (error || !data?.success) {
    console.error('Advertising request failed', error);
    return json(500, { error: 'request_failed' }, origin);
  }

  return json(201, { success: true, protocol: data.protocol, status: data.status }, origin);
}

if (import.meta.main) Deno.serve(handleRequest);
