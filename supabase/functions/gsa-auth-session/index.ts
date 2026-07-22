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
  | 'set_pin_and_login'
  | 'login_admin'
  | 'login_colaborador'
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
  set_pin_and_login: {
    ip: { limit: 12, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 5, windowSeconds: 1800, blockSeconds: 7200 },
  },
  login_admin: {
    ip: { limit: 20, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 6, windowSeconds: 1800, blockSeconds: 7200 },
  },
  login_colaborador: {
    ip: { limit: 20, windowSeconds: 900, blockSeconds: 3600 },
    subject: { limit: 6, windowSeconds: 1800, blockSeconds: 7200 },
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
  set_pin_and_login: {
    name: 'gsa_set_pin_and_login',
    params: (payload) => ({ p_documento: payload.documento, p_telefone: payload.telefone, p_pin: payload.pin, p_tipo: payload.tipo }),
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

export function configuredOrigins() {
  const rawOrigins = [Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')]
    .filter(Boolean)
    .join(',');

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

  if (action === 'set_pin_and_login') {
    const documento = digits(payload.documento);
    const telefone = digits(payload.telefone);
    const pin = digits(payload.pin);
    const tipo = payload.tipo === 'cliente' || payload.tipo === 'prestador' ? payload.tipo : '';
    if (![11, 14].includes(documento.length) || ![10, 11].includes(telefone.length) || pin.length !== 4 || !tipo) return null;
    return { documento, telefone, pin, tipo };
  }

  if (action === 'request_client_recovery') {
    const documento = digits(payload.documento);
    const email = text(payload.email, 254).toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (![11, 14].includes(documento.length) || !validEmail) return null;
    return { documento, email };
  }

  if (action === 'complete_client_recovery') {
    const recoveryId = text(payload.recovery_id, 36).toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(recoveryId)) return null;
    return { recovery_id: recoveryId };
  }

  const code = text(payload.code, 128);
  if (!code) return null;
  return { code };
}

function subjectFor(action: AuthAction, payload: Record<string, string>) {
  if (action === 'login_admin' || action === 'login_colaborador') return payload.code;
  return payload.documento || payload.recovery_id;
}

export function subjectRateLimitMode(action: AuthAction): 'before' | 'invalid-only' {
  return action === 'request_client_recovery' || action === 'complete_client_recovery'
    ? 'before'
    : 'invalid-only';
}

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || forwarded
    || 'unknown';
}

async function hashBucket(secret: string, scope: string, value: string) {
  const encoded = new TextEncoder().encode(`${secret}:${scope}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function checkRateLimit(
  admin: any,
  bucketKey: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const { data, error } = await admin.rpc('gsa_auth_rate_limit_check', {
    p_bucket_key: bucketKey,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
    p_block_seconds: rule.blockSeconds,
  });

  if (error || typeof data?.allowed !== 'boolean') {
    console.error('Falha ao consultar rate limiting.', error);
    throw new Error('rate_limit_unavailable');
  }

  return data as RateLimitResult;
}

async function clearSubjectRateLimit(
  admin: any,
  bucketKey: string,
) {
  const { error } = await admin
    .from('gsa_auth_rate_limits')
    .delete()
    .eq('bucket_key', bucketKey);

  if (error) console.error('Não foi possível limpar o limitador após autenticação válida.', error);
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
  const allowedOrigin = requestOrigin && configuredOrigins().has(requestOrigin) ? requestOrigin : null;

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

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'payload_too_large' }, 413, allowedOrigin);
    }

    let body: { action?: AuthAction; payload?: Record<string, unknown> };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: 'invalid_json' }, 400, allowedOrigin);
    }

    const supportedActions = new Set<AuthAction>([
      'login_pin',
      'set_pin_and_login',
      'login_admin',
      'login_colaborador',
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

    if (body.action === 'request_client_recovery') {
      const recoveryId = crypto.randomUUID();
      const { data: beginData, error: beginError } = await admin.rpc('gsa_begin_client_recovery', {
        p_documento: normalizedPayload.documento,
        p_email: normalizedPayload.email,
        p_challenge_id: recoveryId,
      });

      let delivered = false;
      if (!beginError && beginData?.success === true) {
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!anonKey) return json({ error: 'server_not_configured' }, 500, allowedOrigin);
        const publicClient = createClient<any>(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: otpError } = await publicClient.auth.signInWithOtp({
          email: normalizedPayload.email,
          options: { shouldCreateUser: false },
        });
        delivered = !otpError;
        if (otpError) console.error('Falha ao enviar o código de recuperação.', otpError);
      }

      if (!delivered) {
        await admin.from('gsa_client_recovery_challenges').delete().eq('id', recoveryId);
      }

      return json({ success: true, recovery_id: recoveryId, expires_in: 600 }, 200, allowedOrigin);
    }

    if (body.action === 'complete_client_recovery') {
      const authorization = request.headers.get('authorization') || '';
      const accessToken = authorization.toLowerCase().startsWith('bearer ')
        ? authorization.slice(7).trim()
        : '';
      if (!accessToken) return json({ error: 'recovery_verification_required' }, 401, allowedOrigin);

      const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
      const verifiedUser = userData.user;
      const verifiedEmail = verifiedUser?.email?.trim().toLowerCase();
      if (userError || !verifiedUser || !verifiedEmail) {
        return json({ error: 'recovery_verification_required' }, 401, allowedOrigin);
      }

      const now = new Date().toISOString();
      const { data: challenge, error: challengeError } = await admin
        .from('gsa_client_recovery_challenges')
        .update({ consumed_at: now })
        .eq('id', normalizedPayload.recovery_id)
        .eq('auth_email', verifiedEmail)
        .is('consumed_at', null)
        .gt('expires_at', now)
        .select('id, cliente_id, documento, auth_email')
        .maybeSingle();

      if (challengeError || !challenge) {
        return json({ error: 'invalid_or_expired_recovery' }, 400, allowedOrigin);
      }

      const { data: recoveryData, error: recoveryError } = await admin.rpc('gsa_recuperar_senha_cliente', {
        p_documento: challenge.documento,
        p_email: challenge.auth_email,
      });
      const rpcSession = recoveryData?.session || recoveryData;
      if (recoveryError || !recoveryData?.success || !rpcSession?.sessao_id || !rpcSession?.session_token) {
        console.error('Falha ao concluir recuperação validada.', recoveryError);
        return json({ error: 'recovery_completion_failed' }, 500, allowedOrigin);
      }

      const existingMetadata = verifiedUser.app_metadata || {};
      const { error: metadataError } = await admin.auth.admin.updateUserById(verifiedUser.id, {
        app_metadata: {
          ...existingMetadata,
          gsa_session_id: rpcSession.sessao_id,
          gsa_actor_type: rpcSession.ator_tipo,
          gsa_actor_id: rpcSession.ator_id,
        },
      });
      if (metadataError) {
        console.error('Falha ao vincular a sessão recuperada ao usuário Auth.', metadataError);
        await admin.rpc('gsa_end_session', {
          p_sessao_id: rpcSession.sessao_id,
          p_session_token: rpcSession.session_token,
        });
        return json({ error: 'recovery_completion_failed' }, 500, allowedOrigin);
      }

      await admin.from('sistema_sessoes').update({ status: 'encerrado' })
        .eq('ator_tipo', 'cliente').eq('ator_id', rpcSession.ator_id)
        .neq('id', rpcSession.sessao_id).neq('status', 'encerrado');

      return json({
        success: true,
        valid: true,
        id: rpcSession.ator_id,
        nome: rpcSession.ator_nome,
        session: {
          sessao_id: rpcSession.sessao_id,
          session_token: rpcSession.session_token,
          ator_tipo: rpcSession.ator_tipo,
          ator_id: rpcSession.ator_id,
          ator_nome: rpcSession.ator_nome,
          metadata: { ...(rpcSession.metadata || {}), precisa_trocar_senha: true },
        },
      }, 200, allowedOrigin);
    }

    const operation = rpcByAction[body.action];
    if (!operation) return json({ error: 'invalid_action' }, 400, allowedOrigin);
    const { data, error } = await admin.rpc(operation.name, operation.params(normalizedPayload));
    if (error) {
      console.error(`Falha em ${operation.name}:`, error);
      return json({ error: 'authentication_failed' }, 500, allowedOrigin);
    }

    const successful = Boolean(data?.valid || data?.success);
    if (!successful) {
      // O bucket por identidade só recebe tentativas inválidas. Assim, conhecer um
      // CPF/CNPJ não permite impedir que o titular entre com a credencial correta.
      const subjectLimit = await checkRateLimit(admin, subjectBucket, rules.subject);
      if (!subjectLimit.allowed) {
        const retryAfter = Math.max(1, Number(subjectLimit.retry_after || rules.subject.blockSeconds));
        return tooManyAttempts(retryAfter, allowedOrigin);
      }

      return json({ valid: false, success: false, error: 'invalid_credentials' }, 200, allowedOrigin);
    }

    // Uma credencial válida sempre pode entrar e reinicia o contador de falhas.
    await clearSubjectRateLimit(admin, subjectBucket);

    const rpcSession = data?.session || data;
    const email = rpcSession?.auth?.email;
    if (!email) {
      console.error('A RPC de autenticação não retornou a identidade Auth esperada.');
      return json({ error: 'auth_identity_not_provisioned' }, 500, allowedOrigin);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error('Não foi possível gerar o token de uso único.', linkError);
      return json({ error: 'session_exchange_failed' }, 500, allowedOrigin);
    }

    const safeSession = {
      sessao_id: rpcSession.sessao_id,
      session_token: rpcSession.session_token,
      ator_tipo: rpcSession.ator_tipo,
      ator_id: rpcSession.ator_id,
      ator_nome: rpcSession.ator_nome,
      metadata: rpcSession.metadata || {},
      auth: { email, token_hash: tokenHash, type: 'magiclink' },
    };

    return json({
      valid: Boolean(data?.valid ?? data?.success),
      success: Boolean(data?.success ?? data?.valid),
      id: data?.id || rpcSession.ator_id,
      nome: data?.nome || rpcSession.ator_nome,
      modulos: data?.modulos || rpcSession.metadata?.modulos || [],
      session: safeSession,
    }, 200, allowedOrigin);
  } catch (error) {
    console.error('Erro inesperado no gateway de autenticação:', error);
    return json({ error: 'unexpected_error' }, 500, allowedOrigin);
  }
}

if (import.meta.main) Deno.serve(handleRequest);
