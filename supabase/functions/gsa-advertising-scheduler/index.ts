import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function handleRequest(request: Request) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const expectedSecret = Deno.env.get('ADVERTISING_CRON_SECRET');
  const providedSecret = request.headers.get('x-cron-secret');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!expectedSecret || !supabaseUrl || !serviceRoleKey) return json(503, { error: 'server_not_configured' });
  if (!providedSecret || providedSecret !== expectedSecret) return json(401, { error: 'invalid_secret' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
  const { data, error } = await admin.rpc('gsa_ads_refresh_campaign_states');
  if (error) {
    console.error('Advertising scheduler failed', error);
    return json(500, { error: 'refresh_failed' });
  }
  return json(200, { success: true, ...data });
}

if (import.meta.main) Deno.serve(handleRequest);
