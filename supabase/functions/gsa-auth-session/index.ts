import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type AuthAction =
  | 'login_pin'
  | 'set_pin_and_login'
  | 'login_admin'
  | 'login_colaborador'
  | 'recover_client';

const rpcByAction: Record<AuthAction, { name: string; params: (payload: Record<string, unknown>) => Record<string, unknown> }> = {
  login_pin: {
    name: 'gsa_login_pin',
    params: (payload) => ({
      p_documento: payload.documento,
      p_pin: payload.pin,
      p_tipo: payload.tipo,
    }),
  },
  set_pin_and_login: {
    name: 'gsa_set_pin_and_login',
    params: (payload) => ({
      p_documento: payload.documento,
      p_telefone: payload.telefone,
      p_pin: payload.pin,
      p_tipo: payload.tipo,
    }),
  },
  login_admin: {
    name: 'gsa_login_admin',
    params: (payload) => ({ p_code: payload.code }),
  },
  login_colaborador: {
    name: 'gsa_login_colaborador',
    params: (payload) => ({ p_code: payload.code }),
  },
  recover_client: {
    name: 'gsa_recuperar_senha_cliente',
    params: (payload) => ({
      p_documento: payload.documento,
      p_email: payload.email,
    }),
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function sanitizeFailure(data: any) {
  return {
    valid: false,
    success: false,
    error: data?.error === 'blocked' ? 'blocked' : 'invalid_credentials',
    attempts_left: typeof data?.attempts_left === 'number' ? data.attempts_left : undefined,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500);

    const body = await request.json() as { action?: AuthAction; payload?: Record<string, unknown> };
    if (!body.action || !rpcByAction[body.action]) return json({ error: 'invalid_action' }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const operation = rpcByAction[body.action];
    const { data, error } = await admin.rpc(operation.name, operation.params(body.payload || {}));
    if (error) {
      console.error(`Falha em ${operation.name}:`, error);
      return json({ error: 'authentication_failed' }, 401);
    }

    const successful = Boolean(data?.valid || data?.success);
    if (!successful) return json(sanitizeFailure(data), 401);

    const rpcSession = data?.session || data;
    const email = rpcSession?.auth?.email;
    if (!email) {
      console.error('A RPC de autenticação não retornou a identidade Auth esperada.');
      return json({ error: 'auth_identity_not_provisioned' }, 500);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error('Não foi possível gerar o token de uso único.', linkError);
      return json({ error: 'session_exchange_failed' }, 500);
    }

    const safeSession = {
      sessao_id: rpcSession.sessao_id,
      session_token: rpcSession.session_token,
      ator_tipo: rpcSession.ator_tipo,
      ator_id: rpcSession.ator_id,
      ator_nome: rpcSession.ator_nome,
      metadata: rpcSession.metadata || {},
      auth: {
        email,
        token_hash: tokenHash,
        type: 'magiclink',
      },
    };

    const response = data?.session
      ? { ...data, session: safeSession }
      : { ...data, ...safeSession, auth: safeSession.auth };

    return json(response);
  } catch (error) {
    console.error('Erro inesperado no gateway de autenticação:', error);
    return json({ error: 'unexpected_error' }, 500);
  }
});
