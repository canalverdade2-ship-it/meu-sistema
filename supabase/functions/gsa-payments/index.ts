import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const INFINITEPAY_HANDLE = Deno.env.get('INFINITEPAY_HANDLE') || 'getsemani-gsa';
const INFINITEPAY_API_URL = 'https://api.checkout.infinitepay.io/links';
const INFINITEPAY_CHECK_URL = 'https://api.checkout.infinitepay.io/payment_check';

export async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
      },
    });
  }

  const PROJECT_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const WEBHOOK_URL = `${PROJECT_URL}/functions/v1/gsa-payments`;
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://sistema.grupogsaservicos.com.br';
  
  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400 });
  }

  // Route 1: InfinitePay Webhook (detected by order_nsu without action)
  if (payload.order_nsu && !payload.action) {
    console.log("InfinitePay Webhook recebido:", JSON.stringify(payload));
    const { transaction_nsu, order_nsu } = payload;
    if (!order_nsu) return new Response(JSON.stringify({ error: "order_nsu ausente" }), { status: 400 });
    if (!transaction_nsu) return new Response(JSON.stringify({ error: "transaction_nsu ausente" }), { status: 400 });

    const verificationResponse = await fetch(INFINITEPAY_CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: INFINITEPAY_HANDLE, order_nsu, transaction_nsu }),
    });
    if (!verificationResponse.ok) {
      console.error('Falha ao validar pagamento na InfinitePay:', verificationResponse.status);
      return new Response(JSON.stringify({ error: 'Pagamento nao confirmado pelo provedor' }), { status: 401 });
    }
    const verified = await verificationResponse.json();
    const isPaid = verified?.paid === true || verified?.status === 'paid' || verified?.status === 'approved';
    const verifiedPaidAmount = Number(verified?.paid_amount ?? verified?.amount ?? 0);
    if (!isPaid || !Number.isFinite(verifiedPaidAmount) || verifiedPaidAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Pagamento ainda nao confirmado' }), { status: 409 });
    }

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
    const { data: fatura, error: findError } = await supabase.from("faturas").select("*").eq("infinitepay_order_nsu", order_nsu).single();

    if (findError || !fatura) {
      const { data: faturaByCode, error: codeError } = await supabase.from("faturas").select("*").eq("codigo_fatura", order_nsu).single();
      if (codeError || !faturaByCode) {
        console.error("Fatura não encontrada para order_nsu:", order_nsu);
        return new Response(JSON.stringify({ error: "Fatura não encontrada" }), { status: 400 });
      }
      const { error: processError } = await supabase.rpc('gsa_finalize_external_invoice_payment', {
        p_fatura_id: faturaByCode.id, p_order_nsu: order_nsu, p_transaction_nsu: transaction_nsu,
        p_paid_amount: verifiedPaidAmount / 100, p_capture_method: verified?.capture_method || payload.capture_method || 'infinitepay',
        p_payload: { webhook: payload, verification: verified },
      });
      if (processError) throw processError;
    } else {
      const { error: processError } = await supabase.rpc('gsa_finalize_external_invoice_payment', {
        p_fatura_id: fatura.id, p_order_nsu: order_nsu, p_transaction_nsu: transaction_nsu,
        p_paid_amount: verifiedPaidAmount / 100, p_capture_method: verified?.capture_method || payload.capture_method || 'infinitepay',
        p_payload: { webhook: payload, verification: verified },
      });
      if (processError) throw processError;
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // Route 2: Create Payment Link (Requires Auth)
  if (payload.action === 'create_link') {
    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
    const { fatura_id, sessao_id, session_token } = payload;
    if (!fatura_id || !sessao_id || !session_token) return new Response(JSON.stringify({ error: "Sessao e fatura sao obrigatorias" }), { status: 400 });

    const { data: actors, error: actorError } = await supabase.rpc('gsa_client_session_actor', {
      p_sessao_id: sessao_id, p_session_token: session_token,
    });
    const actor = Array.isArray(actors) ? actors[0] : actors;
    if (actorError || !actor?.cliente_id) return new Response(JSON.stringify({ error: 'Sessao de cliente invalida' }), { status: 401 });

    const { data: fatura, error: faturaError } = await supabase.from("faturas").select("*").eq("id", fatura_id).eq('cliente_id', actor.cliente_id).single();
    if (faturaError || !fatura) return new Response(JSON.stringify({ error: "Fatura não encontrada" }), { status: 404 });
    if (!['pendente', 'vencida', 'revisada', 'pendente_pagamento'].includes(fatura.status)) {
      return new Response(JSON.stringify({ error: 'Fatura nao esta disponivel para pagamento' }), { status: 409 });
    }

    const { data: cliente } = await supabase.from("clientes").select("nome, email, telefone").eq("id", actor.cliente_id).single();

    const valorFinal = Number(fatura.valor_final_pendente ?? fatura.valor_total);
    const valorEmCentavos = Math.round(valorFinal * 100);
    if (valorEmCentavos <= 0) return new Response(JSON.stringify({ error: "Valor da fatura inválido para pagamento" }), { status: 400 });

    const orderNsu = `${fatura.codigo_fatura}-${Date.now()}`;
    const checkoutPayload: any = {
      handle: INFINITEPAY_HANDLE,
      items: [{ quantity: 1, price: valorEmCentavos, description: `Fatura ${fatura.codigo_fatura} - Grupo GSA` }],
      order_nsu: orderNsu,
      webhook_url: WEBHOOK_URL,
      redirect_url: `${APP_URL}/pagamento-concluido?fatura_id=${fatura_id}&order_nsu=${orderNsu}`,
    };

    if (cliente) {
      checkoutPayload.customer = {
        name: cliente.nome || "Cliente GSA",
        email: cliente.email || undefined,
        phone_number: cliente.telefone ? `+55${cliente.telefone.replace(/\D/g, "")}` : undefined,
      };
    }

    const ipResponse = await fetch(INFINITEPAY_API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checkoutPayload),
    });

    if (!ipResponse.ok) {
      const errorBody = await ipResponse.text();
      console.error("InfinitePay error:", errorBody);
      return new Response(JSON.stringify({ error: `Erro na InfinitePay: ${ipResponse.status}`, details: errorBody }), { status: 500 });
    }

    const ipData = await ipResponse.json();
    const checkoutLink = ipData.payment_url || ipData.url || ipData.link || ipData.checkout_url;
    const invoiceSlug = ipData.slug || ipData.invoice_slug || null;

    if (!checkoutLink) {
      console.error("InfinitePay response sem link:", JSON.stringify(ipData));
      return new Response(JSON.stringify({ error: "InfinitePay não retornou um link de pagamento", raw: ipData }), { status: 500 });
    }

    await supabase.from("faturas").update({
      infinitepay_link: checkoutLink, infinitepay_slug: invoiceSlug, infinitepay_order_nsu: orderNsu,
    }).eq("id", fatura_id);

    return new Response(JSON.stringify({ link: checkoutLink, order_nsu: orderNsu }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Route 3: Generate Recurring Invoices (Requires cron secret)
  if (payload.action === 'generate_invoices') {
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!req.headers.get('x-cron-secret') || req.headers.get('x-cron-secret') !== cronSecret) {
       return new Response(JSON.stringify({ error: 'Unauthorized: missing or invalid cron secret' }), { status: 401 });
    }

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
    try {
      const { data: ordens, error: ordensError } = await supabase
        .from("ordens_assinatura")
        .select(`id, codigo_ordem, assinatura_id, cliente_id, status, orcamentos:orcamento_id(dia_vencimento, quantidade_meses, prazo_indeterminado, total)`)
        .eq("status", "aprovado");

      if (ordensError) throw ordensError;

      const results = [];
      const today = new Date();
      
      for (const ordem of ordens) {
        const orc = (ordem as any).orcamentos;
        if (!orc) continue;

        const diaVenc = orc.dia_vencimento || 10;
        const checkMonths = [0, 1];
        
        for (const offset of checkMonths) {
            const targetDueDate = new Date();
            targetDueDate.setMonth(targetDueDate.getMonth() + offset);
            targetDueDate.setDate(diaVenc);
            targetDueDate.setHours(0, 0, 0, 0);

            const mesRef = `${(targetDueDate.getMonth() + 1).toString().padStart(2, '0')}/${targetDueDate.getFullYear()}`;
            const generationDate = new Date(targetDueDate);
            generationDate.setDate(targetDueDate.getDate() - 10);
            generationDate.setHours(0, 0, 0, 0);

            if (today >= generationDate) {
              const { data: existing } = await supabase.from("faturas").select("id").eq("ordem_assinatura_id", ordem.id).eq("mes_referencia", mesRef).maybeSingle();

              if (!existing) {
                if (!orc.prazo_indeterminado) {
                  const { count } = await supabase.from("faturas").select("id", { count: 'exact', head: true }).eq("ordem_assinatura_id", ordem.id);
                  if (count && count >= orc.quantidade_meses) {
                    results.push({ ordem_id: ordem.id, mes: mesRef, status: "skip", reason: "limit reached" });
                    continue;
                  }
                }

                const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
                const { data: newFat, error: fatError } = await supabase.from("faturas").insert([{
                    codigo_fatura: `FAT-REC-${shortId}`,
                    ordem_assinatura_id: ordem.id,
                    cliente_id: ordem.cliente_id,
                    valor_total: orc.total,
                    valor_final_pendente: orc.total,
                    status: "pendente",
                    tipo: "assinatura",
                    data_vencimento: targetDueDate.toISOString().split('T')[0],
                    mes_referencia: mesRef,
                    gerada_automaticamente: true
                  }]).select().single();

                if (fatError) {
                    results.push({ ordem_id: ordem.id, mes: mesRef, status: "error", error: fatError });
                } else {
                    results.push({ ordem_id: ordem.id, mes: mesRef, status: "created", fatura_id: newFat.id });
                }
              }
            }
        }
      }
      return new Response(JSON.stringify({ success: true, processed: results }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (err: any) {
      console.error(err);
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }});
    }
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
}

if (import.meta.main) Deno.serve(handleRequest);

