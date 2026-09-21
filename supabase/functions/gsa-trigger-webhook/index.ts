import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { webhookUrl, payload } = await req.json();

    if (!webhookUrl) {
      throw new Error('webhookUrl is required');
    }

    // Call the webhook (from within the VPS where this Deno container runs)
    // The VPS can access its own public IP or localhost
    const targetUrl = webhookUrl.replace('localhost', '172.19.0.1').replace('127.0.0.1', '172.19.0.1');

    console.log('Triggering webhook:', targetUrl, payload);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log('Webhook response:', response.status, text);

    return new Response(JSON.stringify({ success: true, status: response.status, data: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});