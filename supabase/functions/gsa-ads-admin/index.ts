import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

type JsonRecord = Record<string, unknown>;
const MAX_BODY_BYTES = 128_000;

const DEFAULT_ALLOWED_ORIGINS = ['http://10.0.2.189:3000', 'http://localhost:3000', 'http://127.0.0.1:3000'];

function configuredOrigins() {
  return (Deno.env.get('ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',').map((o) => o.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null) {
  const allowed = origin && configuredOrigins().includes(origin) ? origin : '';
  return { 'access-control-allow-origin': allowed, 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-max-age': '86400', vary: 'Origin' };
}

function json(status: number, body: JsonRecord, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) } });
}

function toHex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function hmacHex(secret: string, value: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))); }
function safeEqual(left: string, right: string) { if (left.length !== right.length) return false; let r = 0; for (let i = 0; i < left.length; i += 1) r |= left.charCodeAt(i) ^ right.charCodeAt(i); return r === 0; }

function normalizePaymentEvent(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const source = input as JsonRecord;
  const provider = String(source.provider || '').trim().slice(0, 50);
  const eventId = String(source.event_id || '').trim().slice(0, 200);
  const reference = String(source.reference || '').trim().slice(0, 200);
  const status = String(source.status || '').trim();
  if (!provider || !eventId || !reference || !['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'].includes(status)) return null;
  return { provider, eventId, reference, status };
}

async function handleWebhook(request: Request, raw: string, supabaseUrl: string, serviceRoleKey: string): Promise<Response> {
  const secret = Deno.env.get('ADVERTISING_WEBHOOK_SECRET');
  if (!secret) return json(503, { error: 'server_not_configured' });
  const providedSig = String(request.headers.get('x-gsa-signature') || '').toLowerCase().replace(/^sha256=/, '');
  const expectedSig = await hmacHex(secret, raw);
  if (!providedSig || !safeEqual(providedSig, expectedSig)) return json(401, { error: 'invalid_signature' });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return json(400, { error: 'invalid_json' }); }
  const event = normalizePaymentEvent(payload);
  if (!event) return json(400, { error: 'invalid_event' });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) as any;
  const { data, error } = await admin.rpc('gsa_ads_process_payment_event', { p_provider: event.provider, p_event_id: event.eventId, p_reference: event.reference, p_status: event.status, p_payload: payload });
  if (error) { console.error('Advertising payment webhook failed', error); return json(error.code === 'P0002' ? 404 : 500, { error: 'event_processing_failed' }); }
  return json(200, { success: true, duplicate: Boolean(data?.duplicate), status: data?.status || event.status });
}

async function findExistingUser(admin: any, email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data?.users?.find((u: any) => String(u.email || '').toLowerCase() === email);
    if (match) return match;
    if ((data?.users?.length || 0) < 200 || (data?.lastPage && page >= data.lastPage)) break;
  }
  return null;
}

function isUuid(value: unknown) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

async function readJsonWithinLimit(request: Request, maxBytes: number): Promise<JsonRecord> {
  if (!request.body) throw new SyntaxError('empty_body');
  const reader = request.body.getReader(); const decoder = new TextDecoder(); let size = 0; let txt = '';
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) throw new RangeError('payload_too_large'); txt += decoder.decode(value, { stream: true }); }
    txt += decoder.decode();
    const parsed = JSON.parse(txt);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('invalid_body');
    return parsed as JsonRecord;
  } finally { reader.releaseLock(); }
}

async function handleAdminInvite(request: Request, body: JsonRecord, origin: string | null, supabaseUrl: string, anonKey: string, serviceRoleKey: string): Promise<Response> {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return json(401, { error: 'authentication_required' }, origin);
  if (body.action !== 'invite' || !isUuid(body.request_id)) return json(400, { error: 'invalid_request' }, origin);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } }) as any;
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) as any;
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json(401, { error: 'invalid_session' }, origin);
  const { data: target, error: targetError } = await userClient.rpc('gsa_admin_get_advertiser_invite_target', { p_request_id: body.request_id });
  if (targetError || !target?.advertiser_id || !target?.email) { console.error('Failed to resolve advertiser invite target', targetError); return json(403, { error: 'invite_not_allowed' }, origin); }
  const email = String(target.email).trim().toLowerCase();
  const redirectTo = `${origin && configuredOrigins().includes(origin) ? origin : configuredOrigins()[0]}/anuncios/login`;
  if (target.auth_user_id) {
    const { error: accessError } = await service.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    if (accessError) { console.error('Failed to resend advertiser access', accessError); return json(502, { error: 'access_email_failed' }, origin); }
    return json(200, { success: true, advertiser_id: target.advertiser_id, already_linked: true, access_sent: true }, origin);
  }
  let authUser: any = null;
  const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, { redirectTo, data: { gsa_role: 'advertiser', advertiser_id: target.advertiser_id } });
  if (inviteData?.user) { authUser = inviteData.user; } else if (inviteError) { authUser = await findExistingUser(service, email); if (!authUser) { console.error('Failed to invite advertiser', inviteError); return json(502, { error: 'invite_failed' }, origin); } }
  const { data: linked, error: linkError } = await userClient.rpc('gsa_admin_link_advertiser_auth', { p_advertiser_id: target.advertiser_id, p_auth_user_id: authUser.id });
  if (linkError || !linked?.success) { console.error('Failed to link advertiser auth user', linkError); return json(500, { error: 'link_failed' }, origin); }
  if (!inviteData?.user) {
    const { error: accessError } = await service.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    if (accessError) { console.error('Failed to send access to existing advertiser user', accessError); return json(502, { error: 'access_email_failed' }, origin); }
  }
  return json(200, { success: true, advertiser_id: target.advertiser_id, email, invited: Boolean(inviteData?.user) }, origin);
}

export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !configuredOrigins().includes(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(503, { error: 'server_not_configured' }, origin);
  // Webhook: detected by x-gsa-signature header
  if (request.headers.get('x-gsa-signature')) { const raw = await request.text(); return handleWebhook(request, raw, supabaseUrl, serviceRoleKey); }
  // Admin invite: requires JWT
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) return json(415, { error: 'unsupported_media_type' }, origin);
  let body: JsonRecord;
  try { body = await readJsonWithinLimit(request, MAX_BODY_BYTES); } catch (error) { return json(error instanceof RangeError ? 413 : 400, { error: error instanceof RangeError ? 'payload_too_large' : 'invalid_json' }, origin); }
  try { return await handleAdminInvite(request, body, origin, supabaseUrl, anonKey, serviceRoleKey); } catch (error) { console.error('gsa-ads-admin error', error); return json(500, { error: error instanceof Error ? error.message : 'internal_error' }, origin); }
}

if (import.meta.main) Deno.serve(handleRequest);
