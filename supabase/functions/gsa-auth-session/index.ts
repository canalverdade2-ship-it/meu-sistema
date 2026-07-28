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
  | 'login_admin'
  | 'login_colaborador'
  | 'request_client_first_access'
  | 'complete_client_first_access'
  | 'request_client_recovery'
  | 'complete_client_recovery';

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
};

const rpcByAction: Partial<Record<AuthAction, { name: string; params: (payload: Record<string, string>) => Record<string, string> }>> = {
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

async function readJsonWithinLimit(request: Request) {
  if (!request.body) throw new SyntaxError('invalid_json');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let rawBody = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new RangeError('payload_too_large');
      rawBody += decoder.decode(value, { stream: true });
    }
    rawBody += decoder.decode();
    return JSON.parse(rawBody) as { action?: AuthAction; payload?: Record<string, unknown> };
  } finally {
    reader.releaseLock();
  }
}

export function normalizePayload(
  action: AuthAction,
  payload: Record<string, unknown>,
): Record<string, string> | null {
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
  return payload.documento || payload.challenge_id;
}

export function subjectRateLimitMode(action: AuthAction): 'before' | 'invalid-only' {
  return action === 'request_client_recovery'
      || action === 'complete_client_recovery'
      || action === 'request_client_first_access'
      || action === 'complete_client_first_access'
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
): Promise<RateLimitResult> {
  try {
    const { data, error } = await admin.rpc('gsa_consume_auth_rate_limit', {
      p_bucket_key: bucketKey,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_block_seconds: rule.blockSeconds,
    });

    if (error || !data) {
      console.warn('Rate limiter indisponível:', error);
      return { allowed: true };
    }

    return data as RateLimitResult;
  } catch {
    return { allowed: true };
  }
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

    let body: { action?: AuthAction; payload?: Record<string, unknown> };
    try {
      body = await readJsonWithinLimit(request);
    } catch (error) {
      return json(
        { error: error instanceof RangeError ? 'payload_too_large' : 'invalid_json' },
        error instanceof RangeError ? 413 : 400,
        allowedOrigin,
      );
    }

    const supportedActions = new Set<AuthAction>([
      'login_pin',
      'login_admin',
      'login_colaborador',
      'request_client_first_access',
      'complete_client_first_access',
      'request_client_recovery',
      'complete_client_recovery',
    ]);
    if (!body.action || !supportedActions.has(body.action)) return json({ error: 'invalid_action' }, 400, allowedOrigin);

    const normalizedPayload = normalizePayload(body.action, body.payload || {});
    if (!normalizedPayload) return json({ error: 'invalid_payload' }, 400, allowedOrigin);

    const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rules = rateLimits[body.action];
    const ipBucket = await hashBucket(serviceRoleKey, `${body.action}:ip`, clientIp(request));
    const ipLimit = await checkRateLimit(admin, ipBucket, rules.ip);
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
      const subjectLimit = await checkRateLimit(admin, subjectBucket, rules.subject);
      if (!subjectLimit.allowed) {
        const retryAfter = Math.max(1, Number(subjectLimit.retry_after || rules.subject.blockSeconds));
        return tooManyAttempts(retryAfter, allowedOrigin);
      }
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
        let linkRes = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: authObj.email,
        });

        if (linkRes.error && (linkRes.error.message?.includes('User not found') || (linkRes.error as any).status === 404)) {
          console.log(`[gsa-auth-session] Criando usuário em auth.users para ${authObj.email}...`);
          const createRes = await admin.auth.admin.createUser({
            email: authObj.email,
            email_confirm: true,
            user_metadata: { name: authObj.nome || data?.nome },
          });
          if (!createRes.error) {
            linkRes = await admin.auth.admin.generateLink({
              type: 'magiclink',
              email: authObj.email,
            });
          }
        }

        const hashedToken = linkRes.data?.properties?.hashed_token;
        if (hashedToken) {
          if (!data.session) data.session = {};
          if (!data.session.auth) data.session.auth = {};
          data.session.auth.token_hash = hashedToken;
          data.session.auth.email = authObj.email;
        } else {
          console.warn('[gsa-auth-session] Não foi possível obter token_hash do Supabase Auth:', linkRes.error);
        }
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
