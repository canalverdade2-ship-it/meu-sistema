// Acesso público controlado: valida protocolo no banco e vincula a conta somente após conferência dos dados.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

type JsonRecord = Record<string, unknown>;
const MAX_BODY_BYTES = 8_000;
const ACCESS_ELIGIBLE_STATUSES = new Set([
  'proposal_sent',
  'negotiation_requested',
  'accepted',
]);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://grupo-gsa.com.br',
  'https://www.grupo-gsa.com.br',
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

function json(status: number, body: JsonRecord, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readJson(request: Request) {
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
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError('invalid_json');
    return value as JsonRecord;
  } finally {
    reader.releaseLock();
  }
}

function normalizeProtocol(value: unknown) {
  const protocol = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}-[A-Z0-9-]{8,40}$/.test(protocol) ? protocol : null;
}

function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254 ? email : null;
}

function normalizeDocument(value: unknown) {
  const document = String(value || '').replace(/\D/g, '');
  return document.length === 11 || document.length === 14 ? document : null;
}

async function findUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data?.users?.find((user: any) => String(user.email || '').toLowerCase() === email);
    if (match) return match;
    if ((data?.users?.length || 0) < 200) break;
  }
  return null;
}

export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !configuredOrigins().includes(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return json(415, { error: 'unsupported_media_type' }, origin);
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);

  let body: JsonRecord;
  try {
    body = await readJson(request);
  } catch (error) {
    return json(error instanceof RangeError ? 413 : 400, { error: error instanceof RangeError ? 'payload_too_large' : 'invalid_json' }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(503, { error: 'server_not_configured' }, origin);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) as any;

  const action = String(body.action || '').trim();
  const protocol = normalizeProtocol(body.protocol);
  if (!protocol || !['validate', 'register'].includes(action)) return json(400, { error: 'invalid_request' }, origin);

  const ipHash = await digest(clientIp(request));
  const { data: rateLimit, error: rateError } = await admin.rpc('gsa_auth_rate_limit_check', {
    p_bucket_key: `ads:advertiser-access:${action}:${ipHash}`,
    p_limit: action === 'validate' ? 20 : 8,
    p_window_seconds: 3600,
    p_block_seconds: 7200,
  });
  if (rateError) return json(503, { error: 'rate_limit_unavailable' }, origin);
  if (rateLimit?.allowed === false) {
    return json(429, { error: 'too_many_attempts', retry_after: Number(rateLimit.retry_after || 3600) }, origin);
  }

  const { data: validation, error: validationError } = await admin.rpc('gsa_public_validate_advertising_protocol', { p_protocol: protocol });
  if (validationError) {
    console.error('Protocol validation failed', validationError);
    return json(500, { error: 'validation_failed' }, origin);
  }
  if (!validation?.success || !validation?.request) return json(404, { error: 'protocol_not_found' }, origin);
  if (!ACCESS_ELIGIBLE_STATUSES.has(String(validation.request.status || ''))) {
    return json(403, { error: 'advertiser_access_not_approved' }, origin);
  }
  if (action === 'validate') return json(200, { success: true, request: validation.request }, origin);

  const email = normalizeEmail(body.email);
  const document = normalizeDocument(body.document);
  const password = String(body.password || '');
  if (!email || !document || password.length < 8 || password.length > 128) return json(400, { error: 'invalid_registration' }, origin);
  if (email !== String(validation.request.contact_email || '').toLowerCase()
      || document !== String(validation.request.document || '').replace(/\D/g, '')) {
    return json(403, { error: 'registration_data_mismatch' }, origin);
  }

  let user = await findUserByEmail(admin, email);
  const accountExists = Boolean(user);
  const redirectUrl = new URL(
    '/anuncios/login',
    origin && configuredOrigins().includes(origin) ? origin : configuredOrigins()[0],
  );
  redirectUrl.searchParams.set('protocolo', protocol);
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;

  if (!user) {
    const { data: created, error: createError } = await publicClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl.toString(),
        data: { gsa_role: 'advertiser', protocol },
      },
    });
    if (createError || !created?.user) {
      console.error('Advertiser user creation failed', createError);
      return json(502, { error: 'account_creation_failed' }, origin);
    }
    return json(202, {
      success: true,
      account_exists: false,
      verification_required: true,
    }, origin);
  }

  if (!user.email_confirmed_at) {
    const { error: resendError } = await publicClient.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectUrl.toString() },
    });
    if (resendError) {
      console.error('Advertiser confirmation resend failed', resendError);
      return json(502, { error: 'confirmation_email_failed' }, origin);
    }
    return json(202, {
      success: true,
      account_exists: true,
      verification_required: true,
    }, origin);
  }

  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  let possessionVerified = false;
  if (accessToken) {
    const { data: tokenUser } = await admin.auth.getUser(accessToken);
    possessionVerified = tokenUser.user?.id === user.id
      && String(tokenUser.user?.email || '').toLowerCase() === email;
  }
  if (!possessionVerified) {
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email,
      password,
    });
    possessionVerified = !signInError
      && signInData.user?.id === user.id
      && String(signInData.user?.email || '').toLowerCase() === email;
  }
  if (!possessionVerified) {
    return json(401, { error: 'invalid_credentials' }, origin);
  }

  const { data: claimed, error: claimError } = await admin.rpc('gsa_ads_claim_protocol_for_user', {
    p_protocol: protocol,
    p_auth_user_id: user.id,
  });
  if (claimError || !claimed?.success) {
    console.error('Advertiser protocol claim failed', claimError);
    return json(409, { error: 'protocol_claim_failed' }, origin);
  }

  return json(200, {
    success: true,
    account_exists: accountExists,
    verification_required: false,
    advertiser_status: claimed.advertiser_status,
  }, origin);
}

if (import.meta.main) Deno.serve(handleRequest);
