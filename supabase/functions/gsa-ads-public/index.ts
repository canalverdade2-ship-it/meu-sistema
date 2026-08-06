import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { r2PublicUrl, r2Delete } from '../_shared/r2.ts';

type JsonRecord = Record<string, unknown>;
const MAX_BODY_BYTES = 32_000;

// Configs for public form
const ALLOWED_COMPANY_SIZES = new Set(['autonomo', 'mei', 'micro', 'pequena', 'media', 'grande']);
const ALLOWED_FORMATS = new Set(['responsive_banner', 'sponsored_card', 'rectangle', 'sticky_banner', 'hero', 'inline_video', 'floating_video', 'lightbox', 'section_sponsorship', 'sponsored_content', 'takeover']);
const ALLOWED_PLACEMENTS = new Set(['ADS_PUBLIC_SHOWCASE', 'HOME_BANNER_TOP', 'HOME_INLINE_01', 'HOME_LIGHTBOX', 'SITE_STICKY_BOTTOM', 'MARKETPLACE_SPONSORED_CARD', 'CLASSIFIEDS_BANNER_TOP']);
const ALLOWED_DEVICES = new Set(['desktop', 'tablet', 'mobile']);
const ACCESS_ELIGIBLE_STATUSES = new Set(['proposal_sent', 'negotiation_requested', 'accepted']);
const DEFAULT_ALLOWED_ORIGINS = ['http://10.0.2.189:3000', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://grupo-gsa.com.br', 'https://www.grupo-gsa.com.br'];

function isLocalOrigin(origin: string) { return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin); }

function configuredOrigins() {
  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...envOrigins];
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (isLocalOrigin(origin)) return true;
  return configuredOrigins().includes(origin);
}

function corsHeaders(origin: string | null) {
  const allowed = origin && isAllowedOrigin(origin) ? origin : '*';
  return { 'access-control-allow-origin': allowed, 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-custom-header', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'access-control-max-age': '86400', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', vary: 'Origin' };
}

function json(status: number, body: JsonRecord, origin: string | null, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin), ...extra } });
}

// Helpers
function onlyDigits(value: unknown) { return String(value || '').replace(/\D/g, ''); }
function clientIp(request: Request) { return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; }
async function digest(value: string) { const bytes = new TextEncoder().encode(value); const hash = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function cleanIdentifier(value: unknown, max = 160) { const normalized = String(value || '').trim(); if (!normalized || normalized.length > max || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) return null; return normalized; }
function safeEqual(left: string, right: string) { const leftBytes = new TextEncoder().encode(left); const rightBytes = new TextEncoder().encode(right); if (leftBytes.length !== rightBytes.length) return false; let difference = 0; for (let index = 0; index < leftBytes.length; index += 1) { difference |= leftBytes[index] ^ rightBytes[index]; } return difference === 0; }
function normalizeProtocol(value: unknown) { const protocol = String(value || '').trim().toUpperCase(); return /^[A-Z]{3}-[A-Z0-9-]{8,40}$/.test(protocol) ? protocol : null; }
function normalizeEmail(value: unknown) { const email = String(value || '').trim().toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254 ? email : null; }
function normalizeDocument(value: unknown) { const document = String(value || '').replace(/\D/g, ''); return document.length === 11 || document.length === 14 ? document : null; }
function hasRepeatedDigits(value: string) { return /^(\d)\1+$/.test(value); }
function isHttpsUrl(value: string) { if (!value) return true; try { return new URL(value).protocol === 'https:'; } catch { return false; } }

function isValidCpf(value: string) {
  const digits = onlyDigits(value); if (digits.length !== 11 || hasRepeatedDigits(digits)) return false;
  const calc = (len: number) => { let sum = 0; for (let i = 0; i < len; i += 1) sum += Number(digits[i]) * (len + 1 - i); const rem = (sum * 10) % 11; return rem === 10 ? 0 : rem; };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function isValidCnpj(value: string) {
  const digits = onlyDigits(value); if (digits.length !== 14 || hasRepeatedDigits(digits)) return false;
  const calc = (len: 12 | 13) => { const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0); const rem = sum % 11; return rem < 2 ? 0 : 11 - rem; };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}
function isValidDoc(value: string) { return value.length === 11 ? isValidCpf(value) : isValidCnpj(value); }
function isIsoDate(value: string) { if (!value) return true; if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }
function normalizeArray(value: unknown, allowed: Set<string>) { if (!Array.isArray(value)) return []; return Array.from(new Set(value.map((item) => String(item || '').trim()).filter((item) => allowed.has(item)))).slice(0, 20); }

async function findUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data?.users?.find((u: any) => String(u.email || '').toLowerCase() === email);
    if (match) return match;
    if ((data?.users?.length || 0) < 200) break;
  }
  return null;
}

// ------------------------------
// Route Handlers
// ------------------------------

async function handleScheduler(request: Request, admin: any) {
  const expectedSecret = Deno.env.get('ADVERTISING_CRON_SECRET');
  const providedSecret = request.headers.get('x-cron-secret');
  if (!expectedSecret) return json(503, { error: 'server_not_configured' }, null);
  if (!providedSecret || !safeEqual(providedSecret, expectedSecret)) return json(401, { error: 'invalid_secret' }, null);

  const { data: stateData, error: stateError } = await admin.rpc('gsa_ads_refresh_campaign_states');
  if (stateError) { console.error('Scheduler state refresh failed', stateError); return json(500, { error: 'refresh_failed' }, null); }

  const { data: orphanRows, error: orphanError } = await admin.rpc('gsa_ads_list_orphan_creative_paths');
  if (orphanError) { console.error('Orphan lookup failed', orphanError); return json(500, { error: 'orphan_lookup_failed' }, null); }

  const orphanPaths = Array.isArray(orphanRows) ? orphanRows.map((r: any) => String(r?.storage_path || '').trim()).filter(Boolean) : [];
  if (orphanPaths.length > 0) {
    try { await r2Delete(orphanPaths.map((p: string) => 'public/ad-creatives/' + p)); } catch (err) { console.error('Orphan cleanup failed', err); return json(500, { error: 'orphan_cleanup_failed' }, null); }
  }
  return json(200, { success: true, ...(stateData || {}), orphan_creatives_deleted: orphanPaths.length }, null);
}

async function handleAdDelivery(body: JsonRecord, origin: string | null, admin: any) {
  const action = body.action;
  if (action === 'serve') {
    const placement = cleanIdentifier(body.placement_code, 80); const viewer = cleanIdentifier(body.viewer_id, 160); const session = cleanIdentifier(body.session_id, 160); const route = String(body.route || '').trim().slice(0, 500); const device = String(body.device || '').trim().slice(0, 20);
    if (!placement || !viewer || !session || !['desktop', 'tablet', 'mobile'].includes(device)) return json(400, { error: 'invalid_payload' }, origin);
    
    const { data, error } = await admin.rpc('gsa_ads_serve', { p_placement: placement, p_viewer_id: viewer, p_session_id: session, p_route: route, p_device: device });
    if (error || !data?.ad) return json(404, { error: 'no_ad_available' }, origin);
    
    return json(200, { success: true, ad: { ...data.ad, creative_url: r2PublicUrl('private/ad-creatives/' + data.ad.storage_path) } }, origin);
  }

  if (action === 'event') {
    const token = cleanIdentifier(body.event_token, 60); const eventType = String(body.event_type || '').trim();
    if (!token || !['viewable', 'click', 'video_start', 'video_complete'].includes(eventType)) return json(400, { error: 'invalid_event' }, origin);
    const { data, error } = await admin.rpc('gsa_ads_record_event', { p_event_token: token, p_event_type: eventType });
    if (error) return json(404, { error: 'event_not_found' }, origin);
    return json(200, { success: true, recorded: Boolean(data?.recorded) }, origin);
  }
  return json(400, { error: 'invalid_action' }, origin);
}

async function handleAdvertiserAccess(request: Request, body: JsonRecord, origin: string | null, admin: any, supabaseUrl: string, anonKey: string) {
  const action = body.action;
  const protocol = normalizeProtocol(body.protocol);
  if (!protocol || !['validate', 'register'].includes(action as string)) return json(400, { error: 'invalid_request' }, origin);

  const ipHash = await digest(clientIp(request));
  const { data: rateLimit, error: rateError } = await admin.rpc('gsa_auth_rate_limit_check', { p_bucket_key: `ads:advertiser-access:${action}:${ipHash}`, p_limit: action === 'validate' ? 20 : 8, p_window_seconds: 3600, p_block_seconds: 7200 });
  if (rateError) return json(503, { error: 'rate_limit_unavailable' }, origin);
  if (rateLimit?.allowed === false) return json(429, { error: 'too_many_attempts', retry_after: Number(rateLimit.retry_after || 3600) }, origin);

  const { data: validation, error: validationError } = await admin.rpc('gsa_public_validate_advertising_protocol', { p_protocol: protocol });
  if (validationError) return json(500, { error: 'validation_failed' }, origin);
  if (!validation?.success || !validation?.request) return json(404, { error: 'protocol_not_found' }, origin);
  if (!ACCESS_ELIGIBLE_STATUSES.has(String(validation.request.status || ''))) return json(403, { error: 'advertiser_access_not_approved' }, origin);
  if (action === 'validate') return json(200, { success: true, request: validation.request }, origin);

  const email = normalizeEmail(body.email); const document = normalizeDocument(body.document); const password = String(body.password || '');
  if (!email || !document || password.length < 8 || password.length > 128) return json(400, { error: 'invalid_registration' }, origin);
  if (email !== String(validation.request.contact_email || '').toLowerCase() || document !== String(validation.request.document || '').replace(/\D/g, '')) return json(403, { error: 'registration_data_mismatch' }, origin);

  let user = await findUserByEmail(admin, email);
  const accountExists = Boolean(user);
  const redirectUrl = new URL('/anuncios/login', origin && configuredOrigins().includes(origin) ? origin : configuredOrigins()[0]);
  redirectUrl.searchParams.set('protocolo', protocol);
  const publicClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) as any;

  if (!user) {
    const { data: created, error: createError } = await publicClient.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl.toString(), data: { gsa_role: 'advertiser', protocol } } });
    if (createError || !created?.user) return json(502, { error: 'account_creation_failed' }, origin);
    return json(202, { success: true, account_exists: false, verification_required: true }, origin);
  }

  if (!user.email_confirmed_at) {
    const { error: resendError } = await publicClient.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectUrl.toString() } });
    if (resendError) return json(502, { error: 'confirmation_email_failed' }, origin);
    return json(202, { success: true, account_exists: true, verification_required: true }, origin);
  }

  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  let possessionVerified = false;
  if (accessToken) {
    const { data: tokenUser } = await admin.auth.getUser(accessToken);
    possessionVerified = tokenUser.user?.id === user.id && String(tokenUser.user?.email || '').toLowerCase() === email;
  }
  if (!possessionVerified) {
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
    possessionVerified = !signInError && signInData.user?.id === user.id && String(signInData.user?.email || '').toLowerCase() === email;
  }
  if (!possessionVerified) return json(401, { error: 'invalid_credentials' }, origin);

  const { data: claimed, error: claimError } = await admin.rpc('gsa_ads_claim_protocol_for_user', { p_protocol: protocol, p_auth_user_id: user.id });
  if (claimError || !claimed?.success) return json(409, { error: 'protocol_claim_failed' }, origin);

  return json(200, { success: true, account_exists: accountExists, verification_required: false, advertiser_status: claimed.advertiser_status }, origin);
}

async function handlePublicAdvertisingForm(request: Request, body: JsonRecord, origin: string | null, admin: any) {
  const p = {
    company_name: String(body.company_name || '').trim().slice(0, 160), document: onlyDigits(body.document).slice(0, 14), company_size: String(body.company_size || '').trim(), segment: String(body.segment || '').trim().slice(0, 120), contact_name: String(body.contact_name || '').trim().slice(0, 120), contact_email: String(body.contact_email || '').trim().toLowerCase().slice(0, 180), contact_phone: onlyDigits(body.contact_phone).slice(0, 13), website: String(body.website || '').trim().slice(0, 300), objective: String(body.objective || '').trim().slice(0, 160), desired_formats: normalizeArray(body.desired_formats, ALLOWED_FORMATS), desired_pages: normalizeArray(body.desired_pages, ALLOWED_PLACEMENTS), devices: normalizeArray(body.devices, ALLOWED_DEVICES), desired_start_date: String(body.desired_start_date || '').trim().slice(0, 10), desired_end_date: String(body.desired_end_date || '').trim().slice(0, 10), intended_budget: Number(body.intended_budget || 0), needs_creative_service: Boolean(body.needs_creative_service), notes: String(body.notes || '').trim().slice(0, 2000), website_confirmation: String(body.website_confirmation || '').trim(), started_at: String(body.started_at || '').trim(), source_metadata: (body.source_metadata as JsonRecord) || {},
  };

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.contact_email);
  const today = new Date().toISOString().slice(0, 10);
  const durationDays = p.desired_start_date && p.desired_end_date ? Math.round((Date.parse(`${p.desired_end_date}T00:00:00Z`) - Date.parse(`${p.desired_start_date}T00:00:00Z`)) / 86_400_000) : 0;
  const dateRangeValid = isIsoDate(p.desired_start_date) && isIsoDate(p.desired_end_date) && (!p.desired_start_date || p.desired_start_date >= today) && (!p.desired_end_date || Boolean(p.desired_start_date)) && (!p.desired_start_date || !p.desired_end_date || (p.desired_end_date >= p.desired_start_date && durationDays <= 366));
  const startedAt = Date.parse(p.started_at); const formAge = Date.now() - startedAt; const formAgeValid = Number.isFinite(startedAt) && formAge >= 2500 && formAge <= 2 * 60 * 60 * 1000;

  if (p.website_confirmation || p.company_name.length < 2 || !isValidDoc(p.document) || !ALLOWED_COMPANY_SIZES.has(p.company_size) || p.segment.length < 2 || p.contact_name.length < 2 || !emailValid || p.contact_phone.length < 10 || p.objective.length < 3 || p.desired_formats.length === 0 || p.desired_pages.length === 0 || p.devices.length === 0 || !Number.isFinite(p.intended_budget) || p.intended_budget <= 0 || p.intended_budget > 100_000_000 || !isHttpsUrl(p.website) || !dateRangeValid || !formAgeValid) return json(400, { error: 'invalid_request' }, origin);

  const ipHash = await digest(clientIp(request));
  const identityHash = await digest(`${p.document}:${p.contact_email}`);

  const { data: ipLimit, error: ipLimitError } = await admin.rpc('gsa_auth_rate_limit_check', { p_bucket_key: `ads:ip:${ipHash}`, p_limit: 8, p_window_seconds: 3600, p_block_seconds: 7200 });
  if (ipLimitError) return json(503, { error: 'rate_limit_unavailable' }, origin);
  if (ipLimit?.allowed === false) return json(429, { error: 'too_many_attempts', retry_after: Number(ipLimit.retry_after || 3600) }, origin, { 'retry-after': String(Number(ipLimit.retry_after || 3600)) });

  const { data: idLimit, error: idLimitError } = await admin.rpc('gsa_auth_rate_limit_check', { p_bucket_key: `ads:identity:${identityHash}`, p_limit: 5, p_window_seconds: 86400, p_block_seconds: 86400 });
  if (idLimitError) return json(503, { error: 'rate_limit_unavailable' }, origin);
  if (idLimit?.allowed === false) return json(429, { error: 'too_many_attempts', retry_after: Number(idLimit.retry_after || 3600) }, origin, { 'retry-after': String(Number(idLimit.retry_after || 3600)) });

  const { data, error } = await admin.rpc('gsa_public_submit_advertising_request', { p_payload: p });
  if (error || !data?.success) return json(500, { error: 'request_failed' }, origin);

  return json(201, { success: true, protocol: data.protocol, status: data.status }, origin);
}

// ------------------------------
// Main Handler
// ------------------------------
export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (origin && !isAllowedOrigin(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin, { allow: 'POST, OPTIONS' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json(503, { error: 'server_not_configured' }, origin);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) as any;

  if (request.headers.get('x-cron-secret')) {
    return handleScheduler(request, admin);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);

  let raw = '';
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
  }

  let body: JsonRecord;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'invalid_json' }, origin); }

  if (body.action === 'serve' || body.action === 'event') {
    return handleAdDelivery(body, origin, admin);
  }
  
  if (body.action === 'validate' || body.action === 'register') {
    return handleAdvertiserAccess(request, body, origin, admin, supabaseUrl, anonKey);
  }

  return handlePublicAdvertisingForm(request, body, origin, admin);
}

if (import.meta.main) Deno.serve(handleRequest);
