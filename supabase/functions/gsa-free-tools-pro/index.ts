import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_BODY_BYTES = 16_384;
const TOOLS = new Set(['termination', 'retirement', 'vacation']);
const CHECKOUT_ENDPOINT = 'https://api.checkout.infinitepay.io/links';
const PAYMENT_CHECK_ENDPOINT = 'https://api.checkout.infinitepay.io/payment_check';
const VISITOR_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{20,160}$/;

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function configuredOrigins() {
  const configured = [Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')]
    .filter(Boolean)
    .join(',');
  return new Set(`${configured}${configured ? ',' : ''}${DEFAULT_ALLOWED_ORIGINS.join(',')}`
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean));
}

function responseHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

function text(value: unknown, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function digits(value: unknown, maxLength = 20) {
  return text(value, maxLength + 8).replace(/\D/g, '').slice(0, maxLength);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validUuid(value: unknown) {
  const normalized = text(value, 36).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

async function authenticatedClient(admin: any, request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user || user.app_metadata?.gsa_actor_type !== 'cliente') return null;
  const clientId = validUuid(user.app_metadata?.gsa_actor_id);
  if (!clientId) return null;

  const { data: client } = await admin
    .from('clientes')
    .select('id, nome, email, telefone, status')
    .eq('id', clientId)
    .maybeSingle();

  return client || null;
}

async function loadProduct(admin: any, toolId: string) {
  const { data, error } = await admin
    .from('gsa_calculator_pro_products')
    .select('*')
    .eq('tool_id', toolId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function hasPaidInvoice(admin: any, clientId: string) {
  const { data } = await admin
    .from('faturas')
    .select('id')
    .eq('cliente_id', clientId)
    .eq('status', 'pago')
    .limit(1);
  return Boolean(data?.length);
}

async function findGrant(admin: any, toolId: string, visitorHash: string, clientId: string | null) {
  const now = new Date().toISOString();
  const candidates: any[] = [];

  if (clientId) {
    const { data } = await admin
      .from('gsa_calculator_pro_grants')
      .select('*')
      .eq('tool_id', toolId)
      .eq('cliente_id', clientId)
      .eq('status', 'active')
      .lte('valid_from', now)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) candidates.push(...data);
  }

  if (visitorHash) {
    const { data } = await admin
      .from('gsa_calculator_pro_grants')
      .select('*')
      .eq('tool_id', toolId)
      .eq('visitor_token_hash', visitorHash)
      .eq('status', 'active')
      .lte('valid_from', now)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) candidates.push(...data);
  }

  return candidates
    .filter((grant) => (!grant.valid_until || new Date(grant.valid_until).getTime() > Date.now())
      && (grant.max_uses == null || Number(grant.used_count || 0) < Number(grant.max_uses)))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] || null;
}

async function findSession(admin: any, toolId: string, visitorHash: string, clientId: string | null, rawToken: string) {
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const { data } = await admin
    .from('gsa_calculator_pro_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('tool_id', toolId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  if (data.cliente_id && data.cliente_id !== clientId) return null;
  if (data.visitor_token_hash && data.visitor_token_hash !== visitorHash) return null;
  return data;
}

async function accessState(admin: any, request: Request, toolId: string, visitorHash: string, proSessionToken = '') {
  const product = await loadProduct(admin, toolId);
  if (!product) return { available: false, access: false, reason: 'product_not_found' };

  const client = await authenticatedClient(admin, request);
  const clientId = client?.id || null;
  const session = await findSession(admin, toolId, visitorHash, clientId, proSessionToken);
  if (session) {
    return { available: Boolean(product.ativo), access: true, source: 'session', session, product, client };
  }

  if (!product.ativo) return { available: false, access: false, reason: 'product_disabled', product, client };

  const now = Date.now();
  const freeStart = product.gratuito_inicio ? new Date(product.gratuito_inicio).getTime() : null;
  const freeEnd = product.gratuito_fim ? new Date(product.gratuito_fim).getTime() : null;
  const freePeriod = freeStart != null && freeEnd != null && freeStart <= now && freeEnd > now;
  if (freePeriod) return { available: true, access: true, source: 'free_period', product, client };

  if (clientId && client.status === 'ativo' && product.liberar_cliente_com_fatura_paga && await hasPaidInvoice(admin, clientId)) {
    return { available: true, access: true, source: 'client_paid_invoice', product, client };
  }

  const grant = await findGrant(admin, toolId, visitorHash, clientId);
  if (grant) return { available: true, access: true, source: grant.source, grant, product, client };

  return { available: true, access: false, source: null, product, client };
}

async function createProSession(admin: any, request: Request, toolId: string, visitorHash: string, access: any) {
  if (access.session) {
    return { success: true, source: access.session.source, expires_at: access.session.expires_at, existing: true };
  }

  const clientId = access.client?.id || null;
  const rawToken = randomToken();
  const tokenHash = await sha256(rawToken);
  const productDuration = Math.max(15, Number(access.product?.duracao_acesso_minutos || 120));
  let expiresAt = new Date(Date.now() + Math.min(productDuration, 120) * 60_000);

  if (access.grant?.valid_until) {
    expiresAt = new Date(Math.min(expiresAt.getTime(), new Date(access.grant.valid_until).getTime()));
  }
  if (access.source === 'free_period' && access.product?.gratuito_fim) {
    expiresAt = new Date(Math.min(expiresAt.getTime(), new Date(access.product.gratuito_fim).getTime()));
  }

  const { data, error } = await admin.rpc('gsa_calculator_create_session_internal', {
    p_tool_id: toolId,
    p_visitor_hash: visitorHash,
    p_cliente_id: clientId,
    p_source: access.source,
    p_grant_id: access.grant?.id || null,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
  if (!data?.success) return data;
  return { success: true, token: rawToken, source: access.source, expires_at: data.expires_at };
}

async function verifyInfinitePay(admin: any, payment: any, transactionNsu: string, invoiceSlug: string) {
  const handle = text(Deno.env.get('INFINITEPAY_HANDLE'), 100).replace(/^\$/, '');
  if (!handle) throw new Error('infinitepay_not_configured');
  if (!transactionNsu || !invoiceSlug) return { success: false, paid: false, error: 'payment_identifiers_missing' };

  const response = await fetch(PAYMENT_CHECK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle,
      order_nsu: payment.order_nsu,
      transaction_nsu: transactionNsu,
      slug: invoiceSlug,
    }),
  });
  if (!response.ok) throw new Error('payment_check_failed');
  const result = await response.json();
  if (!result?.success || !result?.paid) return { success: true, paid: false, result };
  if (Number(result.amount || 0) < Number(payment.valor_centavos || 0)) {
    return { success: false, paid: false, error: 'amount_mismatch' };
  }

  const { data, error } = await admin.rpc('gsa_calculator_finalize_payment_internal', {
    p_order_nsu: payment.order_nsu,
    p_transaction_nsu: transactionNsu,
    p_invoice_slug: invoiceSlug,
    p_receipt_url: text(result.receipt_url || payment.receipt_url, 2000) || null,
    p_capture_method: text(result.capture_method, 50) || null,
    p_paid_amount_centavos: Number(result.paid_amount || result.amount || 0),
    p_payload: result,
  });
  if (error) throw error;
  return { success: Boolean(data?.success), paid: Boolean(data?.success), result, finalization: data };
}

export async function handleRequest(request: Request) {
  const requestOrigin = request.headers.get('origin')?.replace(/\/$/, '') || null;
  const allowedOrigin = requestOrigin && configuredOrigins().has(requestOrigin) ? requestOrigin : null;
  if (requestOrigin && !allowedOrigin) return json({ error: 'origin_not_allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(allowedOrigin) });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, allowedOrigin);

  try {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413, allowedOrigin);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413, allowedOrigin);

    const body = JSON.parse(rawBody || '{}') as { action?: string; payload?: Record<string, unknown> };
    const action = text(body.action, 40);
    const payload = body.payload || {};
    const toolId = text(payload.tool_id, 30);
    if (!TOOLS.has(toolId)) return json({ error: 'invalid_tool' }, 400, allowedOrigin);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 503, allowedOrigin);
    const admin = createClient<any>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const visitorToken = text(payload.visitor_token, 180);
    if (!VISITOR_TOKEN_PATTERN.test(visitorToken)) return json({ error: 'invalid_visitor_token' }, 400, allowedOrigin);
    const visitorHash = await sha256(visitorToken);
    const proSessionToken = text(payload.pro_session_token, 180);

    if (action === 'status') {
      const state = await accessState(admin, request, toolId, visitorHash, proSessionToken);
      return json({
        success: true,
        available: state.available,
        access: state.access,
        source: state.source || null,
        logged_in: Boolean(state.client),
        client_active: state.client?.status === 'ativo',
        product: state.product ? {
          tool_id: state.product.tool_id,
          nome: state.product.nome,
          preco_centavos: state.product.preco_centavos,
          duracao_acesso_minutos: state.product.duracao_acesso_minutos,
          gratuito_inicio: state.product.gratuito_inicio,
          gratuito_fim: state.product.gratuito_fim,
        } : null,
        session_expires_at: state.session?.expires_at || null,
      }, 200, allowedOrigin);
    }

    if (action === 'activate') {
      const state = await accessState(admin, request, toolId, visitorHash, proSessionToken);
      if (!state.access) return json({ success: false, error: 'pro_access_required', product: state.product }, 403, allowedOrigin);
      const session = await createProSession(admin, request, toolId, visitorHash, state);
      return json(session, session?.success ? 200 : 409, allowedOrigin);
    }

    if (action === 'redeem_voucher') {
      const code = text(payload.code, 80).toUpperCase().replace(/\s+/g, '');
      if (!/^GSA-PRO-[A-Z0-9]{8,20}$/.test(code)) return json({ success: false, error: 'invalid_voucher' }, 400, allowedOrigin);
      const client = await authenticatedClient(admin, request);
      const { data, error } = await admin.rpc('gsa_calculator_redeem_voucher_internal', {
        p_code_hash: await sha256(code),
        p_tool_id: toolId,
        p_visitor_hash: visitorHash,
        p_cliente_id: client?.id || null,
      });
      if (error) throw error;
      if (!data?.success) return json(data, 400, allowedOrigin);
      const state = await accessState(admin, request, toolId, visitorHash);
      const session = await createProSession(admin, request, toolId, visitorHash, state);
      return json({ ...data, session }, session?.success ? 200 : 409, allowedOrigin);
    }

    if (action === 'create_checkout') {
      const product = await loadProduct(admin, toolId);
      if (!product?.ativo) return json({ success: false, error: 'product_unavailable' }, 409, allowedOrigin);
      if (Number(product.preco_centavos || 0) <= 0) return json({ success: false, error: 'invalid_product_price' }, 409, allowedOrigin);

      const handle = text(Deno.env.get('INFINITEPAY_HANDLE'), 100).replace(/^\$/, '');
      if (!handle) return json({ success: false, error: 'infinitepay_not_configured' }, 503, allowedOrigin);
      const client = await authenticatedClient(admin, request);
      const orderNsu = crypto.randomUUID();
      const publicSiteUrl = text(Deno.env.get('PUBLIC_SITE_URL'), 500).replace(/\/$/, '') || allowedOrigin;
      if (!publicSiteUrl) return json({ success: false, error: 'public_site_url_not_configured' }, 503, allowedOrigin);

      const redirectUrl = `${publicSiteUrl}/servicos-gratuitos?calculator=${encodeURIComponent(toolId)}&pro_payment=${encodeURIComponent(orderNsu)}`;
      const webhookUrl = `${supabaseUrl}/functions/v1/gsa-free-tools-pro-webhook`;
      const customerName = text(payload.customer_name, 120) || text(client?.nome, 120);
      const customerEmail = text(payload.customer_email, 254).toLowerCase() || text(client?.email, 254).toLowerCase();
      const customerPhone = digits(payload.customer_phone, 13) || digits(client?.telefone, 13);

      const { data: inserted, error: insertError } = await admin
        .from('gsa_calculator_pro_payments')
        .insert({
          order_nsu: orderNsu,
          tool_id: toolId,
          cliente_id: client?.id || null,
          visitor_token_hash: visitorHash,
          valor_centavos: Number(product.preco_centavos),
          status: 'processing',
          expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
        })
        .select('*')
        .single();
      if (insertError) throw insertError;

      const checkoutPayload: Record<string, unknown> = {
        handle,
        redirect_url: redirectUrl,
        webhook_url: webhookUrl,
        order_nsu: orderNsu,
        items: [{ quantity: 1, price: Number(product.preco_centavos), description: product.nome }],
      };
      if (customerName || customerEmail || customerPhone) {
        checkoutPayload.customer = {
          ...(customerName ? { name: customerName } : {}),
          ...(customerEmail ? { email: customerEmail } : {}),
          ...(customerPhone ? { phone_number: customerPhone.startsWith('55') ? `+${customerPhone}` : `+55${customerPhone}` } : {}),
        };
      }

      const checkoutResponse = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload),
      });
      const checkoutResult = await checkoutResponse.json().catch(() => ({}));
      const checkoutUrl = text(checkoutResult?.url, 2000);
      if (!checkoutResponse.ok || !checkoutUrl.startsWith('https://')) {
        await admin.from('gsa_calculator_pro_payments').update({ status: 'failed', raw_payload: checkoutResult }).eq('id', inserted.id);
        return json({ success: false, error: 'checkout_creation_failed' }, 502, allowedOrigin);
      }

      await admin.from('gsa_calculator_pro_payments').update({ status: 'pending', checkout_url: checkoutUrl, raw_payload: checkoutResult }).eq('id', inserted.id);
      return json({ success: true, order_nsu: orderNsu, checkout_url: checkoutUrl }, 200, allowedOrigin);
    }

    if (action === 'verify_payment') {
      const orderNsu = text(payload.order_nsu, 100);
      const transactionNsu = text(payload.transaction_nsu, 200);
      const invoiceSlug = text(payload.slug, 200);
      const client = await authenticatedClient(admin, request);
      const { data: payment } = await admin
        .from('gsa_calculator_pro_payments')
        .select('*')
        .eq('order_nsu', orderNsu)
        .eq('tool_id', toolId)
        .maybeSingle();
      if (!payment) return json({ success: false, error: 'payment_not_found' }, 404, allowedOrigin);
      if (payment.cliente_id && payment.cliente_id !== client?.id) return json({ success: false, error: 'payment_identity_mismatch' }, 403, allowedOrigin);
      if (payment.visitor_token_hash && payment.visitor_token_hash !== visitorHash) return json({ success: false, error: 'payment_identity_mismatch' }, 403, allowedOrigin);

      if (payment.status !== 'paid') {
        const verification = await verifyInfinitePay(admin, payment, transactionNsu || payment.transaction_nsu, invoiceSlug || payment.invoice_slug);
        if (!verification.paid) return json({ success: true, paid: false, status: payment.status }, 200, allowedOrigin);
      }

      const state = await accessState(admin, request, toolId, visitorHash);
      if (!state.access) return json({ success: false, error: 'grant_not_available_after_payment' }, 409, allowedOrigin);
      const session = await createProSession(admin, request, toolId, visitorHash, state);
      return json({ success: true, paid: true, session }, session?.success ? 200 : 409, allowedOrigin);
    }

    return json({ error: 'invalid_action' }, 400, allowedOrigin);
  } catch (error) {
    console.error('Free tools Pro request failed', error);
    return json({ error: error instanceof Error ? error.message : 'internal_error' }, 500, allowedOrigin);
  }
}

if (import.meta.main) Deno.serve(handleRequest);
