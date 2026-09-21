import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_BODY_BYTES = 8_192;

const baseHeaders: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
  'X-Content-Type-Options': 'nosniff',
};

export type AuthAction =
  | 'login_pin'
  | 'register_affiliate'
  | 'login_admin'
  | 'login_colaborador'
  | 'request_partner_appeal'
  | 'submit_partner_appeal'
  | 'request_client_first_access'
  | 'complete_client_first_access'
  | 'request_client_recovery'
  | 'complete_client_recovery'
  | 'request_provider_registration_code'
  | 'verify_provider_registration_code';

type ManagementAction = 'gsa_tv_credentials_status' | 'gsa_tv_credentials_update';
type RequestAction = AuthAction | ManagementAction | 'process_partner_appeal_outbox';

type RateLimitRule = {
  limit: number;
  windowSeconds: number;
  blockSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining?: number;
  retry_after?: number;
};

const rateLimits: Record<AuthAction, { ip: RateLimitRule; subject: RateLimitRule }> = {
  register_affiliate: {
    ip: { limit: 10, windowSeconds: 3600, blockSeconds: 3600 },
    subject: { limit: 5, windowSeconds: 3600, blockSeconds: 7200 },
  },
  login_pin: {
    ip: { limit: 30, windowSeconds: 300, blockSeconds: 900 },
    subject: { limit: 8, windowSeconds: 600, blockSeconds: 900 },
  },
  login_admin: {
    ip: { limit: 20, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 6, windowSeconds: 1800, blockSeconds: 7200 },
  },
  login_colaborador: {
    ip: { limit: 20, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 6, windowSeconds: 1800, blockSeconds: 7200 },
  },
  request_client_first_access: {
    ip: { limit: 10, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 4, windowSeconds: 1800, blockSeconds: 7200 },
  },
  complete_client_first_access: {
    ip: { limit: 15, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 6, windowSeconds: 900, blockSeconds: 3600 },
  },
  request_client_recovery: {
    ip: { limit: 10, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 4, windowSeconds: 1800, blockSeconds: 7200 },
  },
  complete_client_recovery: {
    ip: { limit: 15, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 6, windowSeconds: 900, blockSeconds: 3600 },
  },
  request_provider_registration_code: {
    ip: { limit: 8, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 3, windowSeconds: 900, blockSeconds: 3600 },
  },
  verify_provider_registration_code: {
    ip: { limit: 15, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 6, windowSeconds: 900, blockSeconds: 3600 },
  },
  request_partner_appeal: {
    ip: { limit: 8, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 3, windowSeconds: 1800, blockSeconds: 3600 },
  },
  submit_partner_appeal: {
    ip: { limit: 15, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 5, windowSeconds: 900, blockSeconds: 3600 },
  },
};

const rpcByAction: Partial<Record<AuthAction, { name: string; params: (payload: Record<string, string>) => Record<string, unknown> }>> = {
  register_affiliate: {
    name: 'gsa_register_affiliate_account',
    params: (payload) => ({ p_payload: payload }),
  },
  login_pin: {
    name: 'gsa_login_pin',
    params: (payload) => ({ p_documento: payload.documento, p_pin: payload.pin, p_tipo: payload.tipo }),
  },
  login_admin: {
    name: 'gsa_login_admin',
    params: (payload) => ({ p_code: payload.code }),
  },
  login_colaborador: {
    name: 'gsa_login_colaborador',
    params: (payload) => ({ p_code: payload.code }),
  },
};

const DEFAULT_ALLOWED_ORIGINS = [
  'https://gsahub.pages.dev',
  'https://gsa-hub.pages.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://10.0.2.189:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function configuredOrigins() {
  const envOrigins = [Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')]
    .filter(Boolean)
    .join(',');

  const rawOrigins = envOrigins
    ? `${envOrigins},${DEFAULT_ALLOWED_ORIGINS.join(',')}`
    : DEFAULT_ALLOWED_ORIGINS.join(',');

  return new Set(
    rawOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function responseHeaders(origin: string | null, extraHeaders: Record<string, string> = {}) {
  const headers = { ...baseHeaders, ...extraHeaders };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

function json(body: unknown, status = 200, origin: string | null = null, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin, extraHeaders),
  });
}

function digits(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function text(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function secretKeyBytes() {
  const raw = (Deno.env.get('GSA_TV_SECRET_KEY') || '').trim();
  if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error('tv_secret_key_not_configured');
  return Uint8Array.from(raw.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
}

async function encryptTvStreamKey(value: string) {
  const key = await crypto.subtle.importKey('raw', secretKeyBytes(), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(value);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return `v1.${base64Url(iv)}.${base64Url(encrypted)}`;
}

function validRtmpServer(value: string) {
  try {
    const parsed = new URL(value);
    return ['rtmp:', 'rtmps:'].includes(parsed.protocol)
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

async function requireGsaAdmin(
  request: Request,
  admin: any,
  payload: Record<string, unknown> = {},
) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (accessToken) {
    const { data, error } = await admin.auth.getUser(accessToken);
    const user = data?.user;
    const sessionId = String(user?.app_metadata?.gsa_session_id || '');
    if (!error && user?.app_metadata?.gsa_actor_type === 'admin' && sessionId) {
      const { data: session } = await admin
        .from('sistema_sessoes')
        .select('id')
        .eq('id', sessionId)
        .eq('ator_tipo', 'admin')
        .eq('status', 'ativo')
        .maybeSingle();
      if (session) return { user, sessionId, actorId: user.id };
    }
  }

  const sessionId = text(payload.sessao_id, 64);
  const sessionToken = text(payload.session_token, 256);
  if (!sessionId || !sessionToken) return null;

  const { data: validated, error: validationError } = await admin.rpc('gsa_validate_session', {
    p_sessao_id: sessionId,
    p_session_token: sessionToken,
  });
  const session = Array.isArray(validated) ? validated[0] : validated;
  if (validationError || !session?.is_valid || session.ator_tipo !== 'admin') return null;
  return { user: null, sessionId, actorId: String(session.ator_id || '') };
}

async function readJsonWithinLimit(request: Request) {
  try {
    return await request.json() as { action?: RequestAction; payload?: Record<string, unknown> };
  } catch (err: any) {
    console.error('[readJsonWithinLimit error]:', err);
    throw new SyntaxError('invalid_json');
  }
}

export function normalizePayload(
  action: AuthAction,
  payload: Record<string, unknown>,
): Record<string, string> | null {
  if (action === 'register_affiliate') {
    const documento = digits(payload.documento);
    const nome = text(payload.nome, 180);
    const nomeDivulgacao = text(payload.nome_divulgacao, 120);
    const email = text(payload.email, 254).toLowerCase();
    const telefone = digits(payload.telefone);
    const pin = digits(payload.pin);
    const pixTipo = text(payload.pix_tipo, 20).toLowerCase();
    const pixChave = text(payload.pix_chave, 180);
    const termosVersao = text(payload.termos_versao, 40) || '2026-08-29';
    const termosAceitos = payload.termos_aceitos === true ? 'true' : 'false';
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (![11, 14].includes(documento.length) || nome.length < 3 || nomeDivulgacao.length < 3) return null;
    if (!validEmail || telefone.length < 10 || telefone.length > 13 || pin.length !== 4) return null;
    if (!['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'].includes(pixTipo) || !pixChave || termosAceitos !== 'true') return null;
    return {
      documento,
      nome,
      nome_divulgacao: nomeDivulgacao,
      email,
      telefone,
      pin,
      pix_tipo: pixTipo,
      pix_chave: pixChave,
      termos_versao: termosVersao,
      termos_aceitos: termosAceitos,
    };
  }

  if (action === 'request_partner_appeal') {
    const protocol = text(payload.protocol, 80).toUpperCase();
    if (!/^PROT-RES-[A-Z0-9-]{6,60}$/.test(protocol)) return null;
    return { protocol };
  }

  if (action === 'submit_partner_appeal') {
    const challengeId = text(payload.challenge_id, 36).toLowerCase();
    const code = digits(payload.code);
    const contestacao = text(payload.contestacao, 4000);
    const idempotencyKey = text(payload.idempotency_key, 36).toLowerCase();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!uuidPattern.test(challengeId) || !uuidPattern.test(idempotencyKey) || code.length !== 6 || contestacao.length < 20) return null;
    return { challenge_id: challengeId, code, contestacao, idempotency_key: idempotencyKey };
  }

  if (action === 'request_provider_registration_code') {
    const telefone = digits(payload.telefone);
    if (![10, 11].includes(telefone.length)) return null;
    return { telefone };
  }

  if (action === 'verify_provider_registration_code') {
    const challengeId = text(payload.challenge_id, 36).toLowerCase();
    const telefone = digits(payload.telefone);
    const code = digits(payload.code);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!uuidPattern.test(challengeId) || ![10, 11].includes(telefone.length) || code.length !== 6) return null;
    return { challenge_id: challengeId, telefone, code };
  }

  if (action === 'login_pin') {
    const documento = digits(payload.documento);
    const pin = digits(payload.pin);
    const tipo = payload.tipo === 'cliente' || payload.tipo === 'prestador' || payload.tipo === 'fornecedor' ? payload.tipo : '';
    if (![11, 14].includes(documento.length) || pin.length !== 4 || !tipo) return null;
    return { documento, pin, tipo };
  }

  if (action === 'request_client_recovery' || action === 'request_client_first_access') {
    const documento = digits(payload.documento);
    const email = text(payload.email, 254).toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (![11, 14].includes(documento.length) || !validEmail) return null;
    return { documento, email };
  }

  if (action === 'complete_client_recovery' || action === 'complete_client_first_access') {
    const challengeId = text(payload.challenge_id || payload.recovery_id, 36).toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(challengeId)) return null;
    if (action === 'complete_client_first_access') {
      const newPin = digits(payload.new_pin);
      if (newPin.length !== 4) return null;
      return { challenge_id: challengeId, new_pin: newPin };
    }
    return { challenge_id: challengeId };
  }

  const code = text(payload.code, 128);
  if (!code) return null;
  return { code };
}

function subjectFor(action: AuthAction, payload: Record<string, string>) {
  if (action === 'login_admin' || action === 'login_colaborador') return payload.code;
  if (action === 'request_provider_registration_code') return payload.telefone;
  return payload.documento || payload.challenge_id || payload.protocol || payload.telefone;
}

export function subjectRateLimitMode(action: AuthAction): 'before' | 'invalid-only' {
  return action === 'register_affiliate'
      || action === 'request_partner_appeal'
      || action === 'submit_partner_appeal'
      || action === 'request_client_recovery'
      || action === 'complete_client_recovery'
      || action === 'request_client_first_access'
      || action === 'complete_client_first_access'
      || action === 'request_provider_registration_code'
      || action === 'verify_provider_registration_code'
    ? 'before'
    : 'invalid-only';
}

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return 'unknown';
}

async function hashBucket(secret: string, category: string, rawValue: string) {
  const source = `${category}:${rawValue}:${secret}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function checkRateLimit(
  admin: any,
  bucketKey: string,
  rule: RateLimitRule,
  failClosed = false,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await admin.rpc('gsa_auth_rate_limit_check', {
      p_bucket_key: bucketKey,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_block_seconds: rule.blockSeconds,
    });

    if (error || !data) {
      console.warn('Rate limiter indisponível ou falhou, permitindo login (fail-open):', error);
      return failClosed ? { allowed: false, retry_after: 60 } : { allowed: true };
    }

    return data as RateLimitResult;
  } catch (error) {
    console.warn('Rate limiter indisponível, permitindo login (fail-open):', error);
    return failClosed ? { allowed: false, retry_after: 60 } : { allowed: true };
  }
}

async function hashAppealCode(secret: string, challengeId: string, code: string) {
  return hashBucket(secret, `partner-appeal:${challengeId}`, code);
}

async function resolveEvolutionDestination(
  evolutionUrl: string,
  evolutionKey: string,
  phoneDestination: string,
) {
  try {
    const response = await fetch(`${evolutionUrl}/chat/findMessages/GSA_WhatsApp`, {
      method: 'POST',
      headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ where: {}, limit: 50 }),
    });
    if (!response.ok) return phoneDestination;

    const payload = await response.json();
    const records = Array.isArray(payload?.messages?.records) ? payload.messages.records : [];
    const phoneJid = `${phoneDestination}@s.whatsapp.net`;
    const lidRecord = records.find((record: any) => {
      const key = record?.key || {};
      return String(key.remoteJid || '').endsWith('@lid')
        && String(key.remoteJidAlt || '') === phoneJid;
    });

    return String(lidRecord?.key?.remoteJid || phoneDestination);
  } catch (error) {
    console.warn('Não foi possível resolver o LID do destinatário; usando o número cadastrado.', error);
    return phoneDestination;
  }
}

async function sendWhatsAppMessage(phone: string, message: string) {
  const cleanPhone = digits(phone);
  if (cleanPhone.length < 10) return { success: false, error: 'invalid_phone' };
  const destination = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const evolutionUrl = (Deno.env.get('EVOLUTION_API_URL') || 'http://evolution-api:8080').replace(/\/$/, '');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
  if (!evolutionKey) return { success: false, error: 'provider_not_configured' };
  const resolvedDestination = await resolveEvolutionDestination(evolutionUrl, evolutionKey, destination);

  const response = await fetch(`${evolutionUrl}/message/sendText/GSA_WhatsApp`, {
    method: 'POST',
    headers: { apikey: evolutionKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: resolvedDestination,
      text: message,
      delay: 800,
      linkPreview: false,
    }),
  });
  if (!response.ok) return { success: false, error: `provider_http_${response.status}` };
  let providerMessageId = '';
  try {
    const payload = await response.json();
    providerMessageId = String(payload?.key?.id || payload?.id || '');
  } catch {
    // A entrega HTTP já foi confirmada.
  }
  return { success: true, providerMessageId };
}

async function sendAppealVerificationCode(phone: string, code: string) {
  const result = await sendWhatsAppMessage(
    phone,
    `Seu código de confirmação para apresentar recurso no GSA HUB é: *${code}*\n\nEle expira em 10 minutos. Não compartilhe este código.`,
  );
  return result.success;
}

async function clearSubjectRateLimit(
  admin: any,
  bucketKey: string,
) {
  try {
    await admin.from('gsa_auth_rate_limits').delete().eq('bucket_key', bucketKey);
  } catch {
    // Ignora silenciosamente se o bucket não puder ser limpo
  }
}

function tooManyAttempts(
  retryAfter: number,
  origin: string | null,
) {
  return json(
    { valid: false, success: false, error: 'too_many_attempts', retry_after: retryAfter },
    429,
    origin,
    { 'Retry-After': String(retryAfter) },
  );
}

export async function handleRequest(request: Request) {
  const requestOrigin = request.headers.get('origin');
  const isLocalOrigin = requestOrigin && /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(requestOrigin);
  const allowedOrigin = requestOrigin && (configuredOrigins().has(requestOrigin) || isLocalOrigin) ? requestOrigin : null;

  if (requestOrigin && !allowedOrigin) {
    return json({ error: 'origin_not_allowed' }, 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(allowedOrigin) });
  }

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, allowedOrigin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500, allowedOrigin);

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413, allowedOrigin);

    let body: { action?: RequestAction; payload?: Record<string, unknown> };
    try {
      body = await readJsonWithinLimit(request);
    } catch (error) {
      return json(
        { error: error instanceof RangeError ? 'payload_too_large' : 'invalid_json' },
        error instanceof RangeError ? 413 : 400,
        allowedOrigin,
      );
    }

    if (body.action === 'gsa_tv_credentials_status' || body.action === 'gsa_tv_credentials_update') {
      const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const payload = body.payload || {};
      const actor = await requireGsaAdmin(request, admin, payload);
      if (!actor) return json({ error: 'forbidden' }, 403, allowedOrigin);

      const channelId = text(payload.channel_id, 64) || 'ch-main';
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(channelId)) return json({ error: 'invalid_channel' }, 400, allowedOrigin);

      const { data: existing, error: lookupError } = await admin
        .from('gsa_tv_channel_secrets')
        .select('channel_id,provider,rtmp_server,stream_key_ciphertext,updated_at')
        .eq('channel_id', channelId)
        .maybeSingle();
      if (lookupError) {
        console.error('[gsa-tv] Falha ao consultar credenciais protegidas.', lookupError);
        return json({ error: 'tv_credentials_unavailable' }, 503, allowedOrigin);
      }

      if (body.action === 'gsa_tv_credentials_status') {
        const configured = Boolean(existing?.stream_key_ciphertext);
        return json({
          success: true,
          channel_id: channelId,
          provider: existing?.provider || 'youtube',
          rtmp_server: existing?.rtmp_server || 'rtmp://a.rtmp.youtube.com/live2',
          stream_key_configured: configured,
          stream_key_masked: configured ? '••••••••••••' : null,
          updated_at: existing?.updated_at || null,
        }, 200, allowedOrigin);
      }

      const requestedServer = text(payload.rtmp_server, 500);
      const rtmpServer = requestedServer || existing?.rtmp_server || 'rtmp://a.rtmp.youtube.com/live2';
      if (!validRtmpServer(rtmpServer)) return json({ error: 'invalid_rtmp_server' }, 400, allowedOrigin);

      const rawStreamKey = typeof payload.stream_key === 'string' ? payload.stream_key.trim() : '';
      const clearStreamKey = payload.clear_stream_key === true;
      if (clearStreamKey && rawStreamKey) return json({ error: 'invalid_stream_key_operation' }, 400, allowedOrigin);
      if (
        rawStreamKey
        && (
          rawStreamKey.length < 6
          || rawStreamKey.length > 512
          || /\s/.test(rawStreamKey)
          || /^rtmps?:\/\//i.test(rawStreamKey)
        )
      ) {
        return json({ error: 'invalid_stream_key' }, 400, allowedOrigin);
      }

      let streamKeyCiphertext = clearStreamKey ? null : existing?.stream_key_ciphertext || null;
      if (rawStreamKey) streamKeyCiphertext = await encryptTvStreamKey(rawStreamKey);
      const now = new Date().toISOString();
      const { error: saveError } = await admin.from('gsa_tv_channel_secrets').upsert({
        channel_id: channelId,
        provider: 'youtube',
        rtmp_server: rtmpServer,
        stream_key_ciphertext: streamKeyCiphertext,
        encryption_version: 1,
        updated_by: actor.actorId || null,
        updated_at: now,
      }, { onConflict: 'channel_id' });
      if (saveError) {
        console.error('[gsa-tv] Falha ao salvar credenciais protegidas.', saveError);
        return json({ error: 'tv_credentials_save_failed' }, 500, allowedOrigin);
      }

      const { error: auditError } = await admin.from('gsa_tv_audit_log').insert({
        channel_id: channelId,
        actor: 'Administrador',
        action: 'stream_credentials_updated',
        resource_type: 'channel_credentials',
        resource_id: channelId,
        ip_address: clientIp(request),
        details: {
          provider: 'youtube',
          rtmp_server: rtmpServer,
          stream_key_changed: Boolean(rawStreamKey),
          stream_key_cleared: clearStreamKey,
        },
      });
      if (auditError) console.warn('[gsa-tv] Credencial salva; auditoria falhou.', auditError);

      const configured = Boolean(streamKeyCiphertext);
      return json({
        success: true,
        channel_id: channelId,
        provider: 'youtube',
        rtmp_server: rtmpServer,
        stream_key_configured: configured,
        stream_key_masked: configured ? '••••••••••••' : null,
        updated_at: now,
      }, 200, allowedOrigin);
    }

    if (body.action === 'process_partner_appeal_outbox') {
      const configuredWorkerToken = Deno.env.get('APPEAL_WORKER_TOKEN') || '';
      const receivedWorkerToken = request.headers.get('x-gsa-worker-token') || '';
      if (!configuredWorkerToken || receivedWorkerToken !== configuredWorkerToken) {
        return json({ error: 'forbidden' }, 403, allowedOrigin);
      }

      const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: notifications, error: claimError } = await admin.rpc('gsa_claim_partner_appeal_notifications', { p_limit: 20 });
      if (claimError) {
        console.error('Falha ao reservar notificações de recurso.', claimError);
        return json({ error: 'outbox_unavailable' }, 503, allowedOrigin);
      }

      let sent = 0;
      let failed = 0;
      for (const notification of Array.isArray(notifications) ? notifications : []) {
        let delivery: { success: boolean; providerMessageId?: string; error?: string };
        try {
          delivery = await sendWhatsAppMessage(notification.telefone, notification.mensagem);
        } catch (error: any) {
          delivery = { success: false, error: String(error?.message || 'provider_error') };
        }
        await admin.rpc('gsa_finish_partner_appeal_notification', {
          p_notification_id: notification.id,
          p_success: delivery.success,
          p_provider_message_id: delivery.providerMessageId || null,
          p_error: delivery.error || null,
        });
        if (delivery.success) sent += 1;
        else failed += 1;
      }

      return json({ success: true, claimed: (notifications || []).length, sent, failed }, 200, allowedOrigin);
    }

    const supportedActions = new Set<AuthAction>([
      'register_affiliate',
      'login_pin',
      'login_admin',
      'login_colaborador',
      'request_partner_appeal',
      'submit_partner_appeal',
      'request_client_first_access',
      'complete_client_first_access',
      'request_client_recovery',
      'complete_client_recovery',
      'request_provider_registration_code',
      'verify_provider_registration_code',
    ]);
    if (!body.action || !supportedActions.has(body.action)) return json({ error: 'invalid_action' }, 400, allowedOrigin);

    const normalizedPayload = normalizePayload(body.action, body.payload || {});
    if (!normalizedPayload) return json({ error: 'invalid_payload' }, 400, allowedOrigin);

    const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rules = rateLimits[body.action];
    const ipBucket = await hashBucket(serviceRoleKey, `${body.action}:ip`, clientIp(request));
    const appealAction = body.action === 'request_partner_appeal' || body.action === 'submit_partner_appeal';
    const ipLimit = await checkRateLimit(admin, ipBucket, rules.ip, appealAction);
    if (!ipLimit.allowed) {
      const retryAfter = Math.max(1, Number(ipLimit.retry_after || rules.ip.blockSeconds));
      return tooManyAttempts(retryAfter, allowedOrigin);
    }

    const subjectBucket = await hashBucket(
      serviceRoleKey,
      `${body.action}:subject`,
      subjectFor(body.action, normalizedPayload),
    );

    if (subjectRateLimitMode(body.action) === 'before') {
      const subjectLimit = await checkRateLimit(admin, subjectBucket, rules.subject, appealAction);
      if (!subjectLimit.allowed) {
        const retryAfter = Math.max(1, Number(subjectLimit.retry_after || rules.subject.blockSeconds));
        return tooManyAttempts(retryAfter, allowedOrigin);
      }
    }

    if (body.action === 'request_provider_registration_code') {
      const challengeId = crypto.randomUUID();
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
      const codeHash = await hashBucket(serviceRoleKey, `provider-registration:${challengeId}`, code);
      const { error: challengeError } = await admin.from('gsa_provider_registration_challenges').insert({ id: challengeId, telefone: normalizedPayload.telefone, code_hash: codeHash, expires_at: new Date(Date.now() + 300_000).toISOString() });
      if (challengeError) { console.error('Falha ao criar desafio do prestador.', challengeError); return json({ error: 'verification_unavailable' }, 503, allowedOrigin); }
      const delivery = await sendWhatsAppMessage(normalizedPayload.telefone, `Seu código de confirmação para cadastro no GSA HUB é: *${code}*\n\nEle expira em 5 minutos. Não compartilhe este código.`);
      if (!delivery.success) { await admin.from('gsa_provider_registration_challenges').delete().eq('id', challengeId); return json({ error: 'verification_delivery_failed' }, 503, allowedOrigin); }
      const phoneDigits = digits(normalizedPayload.telefone);
      return json({ success: true, challenge_id: challengeId, expires_in: 300, destination: `••••${phoneDigits.slice(-4)}` }, 200, allowedOrigin);
    }

    if (body.action === 'verify_provider_registration_code') {
      const codeHash = await hashBucket(serviceRoleKey, `provider-registration:${normalizedPayload.challenge_id}`, normalizedPayload.code);
      const { data: verification, error: verificationError } = await admin.rpc('gsa_verify_provider_registration_challenge', { p_challenge_id: normalizedPayload.challenge_id, p_telefone: normalizedPayload.telefone, p_code_hash: codeHash });
      if (verificationError) { console.error('Falha ao validar WhatsApp do prestador.', verificationError); return json({ error: 'verification_unavailable' }, 503, allowedOrigin); }
      if (!verification?.success) return json(verification || { success: false, error: 'invalid_code' }, verification?.error === 'too_many_attempts' ? 429 : 400, allowedOrigin);
      await clearSubjectRateLimit(admin, subjectBucket);
      return json(verification, 200, allowedOrigin);
    }

    if (body.action === 'request_partner_appeal') {
      const challengeId = crypto.randomUUID();
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
      const codeHash = await hashAppealCode(serviceRoleKey, challengeId, code);
      const { data: challenge, error: challengeError } = await admin.rpc('gsa_begin_partner_appeal_challenge', {
        p_codigo: normalizedPayload.protocol,
        p_challenge_id: challengeId,
        p_code_hash: codeHash,
      });

      if (challengeError) {
        console.error('Falha ao iniciar o recurso.', challengeError);
        return json({ error: 'appeal_unavailable' }, 503, allowedOrigin);
      }
      if (!challenge?.success || !challenge?.eligible) {
        return json({ error: challenge?.already_used ? 'appeal_already_used' : 'appeal_not_available' }, 400, allowedOrigin);
      }

      let delivered = false;
      try {
        delivered = await sendAppealVerificationCode(challenge.telefone, code);
      } catch (error) {
        console.error('Falha ao enviar o código do recurso.', error);
      }
      if (!delivered) return json({ error: 'verification_delivery_failed' }, 503, allowedOrigin);

      const phoneDigits = digits(challenge.telefone);
      return json({
        success: true,
        challenge_id: challengeId,
        expires_in: 600,
        destination: phoneDigits.length >= 4 ? `••••${phoneDigits.slice(-4)}` : 'WhatsApp cadastrado',
      }, 200, allowedOrigin);
    }

    if (body.action === 'submit_partner_appeal') {
      const codeHash = await hashAppealCode(serviceRoleKey, normalizedPayload.challenge_id, normalizedPayload.code);
      const { data: result, error: appealError } = await admin.rpc('gsa_complete_partner_appeal', {
        p_challenge_id: normalizedPayload.challenge_id,
        p_code_hash: codeHash,
        p_contestacao: normalizedPayload.contestacao,
        p_idempotency_key: normalizedPayload.idempotency_key,
      });
      if (appealError) {
        console.error('Falha ao registrar o recurso.', appealError);
        return json({ error: 'appeal_submission_failed' }, 500, allowedOrigin);
      }
      if (!result?.success) return json({ error: result?.error || 'appeal_submission_failed' }, 400, allowedOrigin);
      await clearSubjectRateLimit(admin, subjectBucket);
      return json(result, 200, allowedOrigin);
    }

    if (
      body.action === 'request_client_recovery'
      || body.action === 'request_client_first_access'
    ) {
      const challengeId = crypto.randomUUID();
      const isFirstAccess = body.action === 'request_client_first_access';
      const { data: beginData, error: beginError } = await admin.rpc(
        isFirstAccess ? 'gsa_begin_client_first_access' : 'gsa_begin_client_recovery',
        {
          p_documento: normalizedPayload.documento,
          p_email: normalizedPayload.email,
          p_challenge_id: challengeId,
        },
      );

      let delivered = false;
      const challengeCreated = beginData?.challenge_created === true
        || (beginData?.challenge_created === undefined && beginData?.success === true);
      if (!beginError && challengeCreated) {
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!anonKey) return json({ error: 'server_not_configured' }, 500, allowedOrigin);
        const publicClient = createClient<any>(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: otpError } = await publicClient.auth.signInWithOtp({
          email: normalizedPayload.email,
          options: { shouldCreateUser: true },
        });
        delivered = !otpError;
        if (otpError) console.error('Falha ao enviar o código de confirmação.', otpError);
      } else if (beginError) {
        console.error('Falha ao iniciar o desafio de confirmação.', beginError);
      }

      return json({
        success: true,
        challenge_id: challengeId,
        recovery_id: isFirstAccess ? undefined : challengeId,
        expires_in: 600,
      }, 200, allowedOrigin);
    }

    if (
      body.action === 'complete_client_recovery'
      || body.action === 'complete_client_first_access'
    ) {
      const authorization = request.headers.get('authorization') || '';
      const accessToken = authorization.toLowerCase().startsWith('bearer ')
        ? authorization.slice(7).trim()
        : '';
      if (!accessToken) return json({ error: 'recovery_verification_required' }, 401, allowedOrigin);

      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (!anonKey) return json({ error: 'server_not_configured' }, 500, allowedOrigin);
      const userClient = createClient<any>(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const isFirstAccess = body.action === 'complete_client_first_access';
      const { data: completionData, error: completionError } = await userClient.rpc(
        isFirstAccess ? 'gsa_complete_client_first_access' : 'gsa_complete_client_recovery',
        isFirstAccess
          ? {
            p_challenge_id: normalizedPayload.challenge_id,
            p_new_pin: normalizedPayload.new_pin,
          }
          : {
            p_challenge_id: normalizedPayload.challenge_id,
          },
      );
      const rpcSession = completionData?.session || completionData;
      if (
        completionError
        || !completionData?.success
        || !rpcSession?.sessao_id
        || !rpcSession?.session_token
      ) {
        console.error('Falha ao concluir a confirmação de identidade.', completionError);
        const denied = completionError?.code === '42501'
          || completionError?.code === 'P0002'
          || completionData?.error;
        return json(
          { error: denied ? 'invalid_or_expired_challenge' : 'identity_completion_failed' },
          denied ? 400 : 500,
          allowedOrigin,
        );
      }

      return json({
        ...completionData,
        success: true,
        valid: true,
        id: completionData.id || rpcSession.ator_id,
        nome: completionData.nome || rpcSession.ator_nome,
        session: {
          ...rpcSession,
          metadata: {
            ...(rpcSession.metadata || {}),
            ...(isFirstAccess ? {} : { precisa_trocar_senha: true }),
          },
        },
      }, 200, allowedOrigin);
    }

    const mapping = rpcByAction[body.action];
    if (!mapping) return json({ error: 'invalid_action' }, 400, allowedOrigin);

    const { data, error } = await admin.rpc(mapping.name, mapping.params(normalizedPayload));
    if (error) {
      console.error(`Erro ao executar RPC ${mapping.name}:`, error);
      if (body.action === 'register_affiliate') {
        const message = String(error?.message || '').toLowerCase();
        const registrationError = message.includes('documento ou pin')
          ? 'invalid_affiliate_credentials'
          : message.includes('e-mail ja esta vinculado')
            ? 'affiliate_email_in_use'
            : message.includes('telefone ja esta vinculado')
              ? 'affiliate_phone_in_use'
              : message.includes('temporariamente bloqueada')
                ? 'affiliate_account_blocked'
                : message.includes('ainda nao possui acesso') || message.includes('indisponivel')
                  ? 'affiliate_account_unavailable'
                  : 'affiliate_registration_failed';
        return json({ valid: false, success: false, error: registrationError }, 400, allowedOrigin);
      }
      return json({ valid: false, success: false, error: 'authentication_failed' }, 400, allowedOrigin);
    }

    const isSuccess = Boolean(data?.valid || data?.success);
    if (isSuccess) {
      let authObj = data?.session?.auth || data?.auth;
      const atorId = data?.session?.ator_id || data?.id;
      const atorTipo = data?.session?.ator_tipo || normalizedPayload.tipo || 'cliente';

      // Se o objeto auth não veio com e-mail na RPC, busca o e-mail no banco
      if (!authObj?.email && atorId) {
        try {
          if (atorTipo === 'cliente') {
            const { data: c } = await admin.from('clientes').select('email, nome').eq('id', atorId).maybeSingle();
            if (c?.email) authObj = { email: c.email, nome: c.nome };
          } else if (atorTipo === 'prestador') {
            const { data: p } = await admin.from('prestadores').select('email, nome_razao').eq('id', atorId).maybeSingle();
            if (p?.email) authObj = { email: p.email, nome: p.nome_razao };
          } else if (atorTipo === 'fornecedor') {
            const { data: f } = await admin.from('fornecedores').select('email, razao_social').eq('id', atorId).maybeSingle();
            if (f?.email) authObj = { email: f.email, nome: f.razao_social };
          }
        } catch (e) {
          console.warn('[gsa-auth-session] Erro ao buscar e-mail do ator:', e);
        }
      }

      if (authObj?.email) {
        // We now use the password generated by the RPC directly.
        // No need to call generateLink or createUser via GoTrue.
        console.log(`[gsa-auth-session] Autenticação concluída via RPC para ${authObj.email}. Repassando credenciais.`);
      }

      await clearSubjectRateLimit(admin, subjectBucket);
    } else if (subjectRateLimitMode(body.action) === 'invalid-only') {
      const subjectLimit = await checkRateLimit(admin, subjectBucket, rules.subject);
      if (!subjectLimit.allowed) {
        const retryAfter = Math.max(1, Number(subjectLimit.retry_after || rules.subject.blockSeconds));
        return tooManyAttempts(retryAfter, allowedOrigin);
      }
    }

    return json(data, 200, allowedOrigin);
  } catch (err: any) {
    console.error('Erro na Edge Function gsa-auth-session:', err);
    return json({ error: 'internal_error' }, 500, allowedOrigin);
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}
