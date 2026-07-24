import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYMENT_CHECK_ENDPOINT = 'https://api.checkout.infinitepay.io/payment_check';
const MAX_BODY_BYTES = 64_000;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function text(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function verifyAndFinalize(payload: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const handle = text(Deno.env.get('INFINITEPAY_HANDLE'), 100).replace(/^\$/, '');
  if (!supabaseUrl || !serviceRoleKey || !handle) throw new Error('server_not_configured');

  const orderNsu = text(payload.order_nsu, 200);
  const transactionNsu = text(payload.transaction_nsu, 200);
  const invoiceSlug = text(payload.invoice_slug || payload.slug, 200);
  if (!orderNsu || !transactionNsu || !invoiceSlug) throw new Error('invalid_payment_event');

  const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: payment, error: paymentError } = await admin
    .from('gsa_calculator_pro_payments')
    .select('*')
    .eq('order_nsu', orderNsu)
    .maybeSingle();
  if (paymentError || !payment) throw new Error('payment_not_found');
  if (payment.status === 'paid') return;

  const response = await fetch(PAYMENT_CHECK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle,
      order_nsu: orderNsu,
      transaction_nsu: transactionNsu,
      slug: invoiceSlug,
    }),
  });
  if (!response.ok) throw new Error('payment_check_failed');
  const verification = await response.json();
  if (!verification?.success || !verification?.paid) throw new Error('payment_not_confirmed');
  if (Number(verification.amount || 0) < Number(payment.valor_centavos || 0)) throw new Error('amount_mismatch');

  const { data, error } = await admin.rpc('gsa_calculator_finalize_payment_internal', {
    p_order_nsu: orderNsu,
    p_transaction_nsu: transactionNsu,
    p_invoice_slug: invoiceSlug,
    p_receipt_url: text(payload.receipt_url || verification.receipt_url, 2000) || null,
    p_capture_method: text(payload.capture_method || verification.capture_method, 50) || null,
    p_paid_amount_centavos: Number(verification.paid_amount || verification.amount || payload.paid_amount || payload.amount || 0),
    p_payload: { webhook: payload, verification },
  });
  if (error || !data?.success) throw error || new Error(data?.error || 'payment_finalization_failed');
}

export async function handleRequest(request: Request) {
  if (request.method !== 'POST') return json(405, { success: false, message: 'Método não permitido' });
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json(413, { success: false, message: 'Payload muito grande' });

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(413, { success: false, message: 'Payload muito grande' });
    const payload = JSON.parse(raw || '{}') as Record<string, unknown>;
    if (!text(payload.order_nsu, 200)) return json(400, { success: false, message: 'Pedido não informado' });

    const task = verifyAndFinalize(payload).catch((error) => {
      console.error('InfinitePay calculator webhook verification failed', error);
    });

    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(task);
    else await task;

    return json(200, { success: true, message: null });
  } catch (error) {
    console.error('Invalid InfinitePay calculator webhook', error);
    return json(400, { success: false, message: 'Evento inválido' });
  }
}

if (import.meta.main) Deno.serve(handleRequest);
