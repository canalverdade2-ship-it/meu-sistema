import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

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

function json(status: number, body: JsonRecord, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

async function findExistingUser(admin: any, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data?.users?.find((user: any) => String(user.email || '').toLowerCase() === email);
    if (match) return match;
    if (!data?.nextPage && (data?.users?.length || 0) < 200) break;
  }
  return null;
}

export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !configuredOrigins().includes(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return json(401, { error: 'authentication_required' }, origin);

  let body: JsonRecord;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'invalid_json' }, origin);
  }

  if (body.action !== 'invite' || typeof body.request_id !== 'string') {
    return json(400, { error: 'invalid_request' }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(503, { error: 'server_not_configured' }, origin);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json(401, { error: 'invalid_session' }, origin);

  const { data: target, error: targetError } = await userClient.rpc('gsa_admin_get_advertiser_invite_target', {
    p_request_id: body.request_id,
  });
  if (targetError || !target?.advertiser_id || !target?.email) {
    console.error('Failed to resolve advertiser invite target', targetError);
    return json(403, { error: 'invite_not_allowed' }, origin);
  }

  if (target.auth_user_id) {
    return json(200, { success: true, advertiser_id: target.advertiser_id, already_linked: true }, origin);
  }

  const email = String(target.email).trim().toLowerCase();
  const redirectTo = `${origin && configuredOrigins().includes(origin) ? origin : configuredOrigins()[0]}/anunciante`;
  let authUser: any = null;

  const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { gsa_role: 'advertiser', advertiser_id: target.advertiser_id },
  });

  if (inviteData?.user) {
    authUser = inviteData.user;
  } else if (inviteError) {
    authUser = await findExistingUser(service, email);
    if (!authUser) {
      console.error('Failed to invite advertiser', inviteError);
      return json(502, { error: 'invite_failed' }, origin);
    }
  }

  const { data: linked, error: linkError } = await userClient.rpc('gsa_admin_link_advertiser_auth', {
    p_advertiser_id: target.advertiser_id,
    p_auth_user_id: authUser.id,
  });
  if (linkError || !linked?.success) {
    console.error('Failed to link advertiser auth user', linkError);
    return json(500, { error: 'link_failed' }, origin);
  }

  return json(200, {
    success: true,
    advertiser_id: target.advertiser_id,
    email,
    invited: Boolean(inviteData?.user),
  }, origin);
}

if (import.meta.main) Deno.serve(handleRequest);
