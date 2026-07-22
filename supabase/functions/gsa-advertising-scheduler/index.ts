import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function safeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function handleRequest(request: Request) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const expectedSecret = Deno.env.get('ADVERTISING_CRON_SECRET');
  const providedSecret = request.headers.get('x-cron-secret');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!expectedSecret || !supabaseUrl || !serviceRoleKey) return json(503, { error: 'server_not_configured' });
  if (!providedSecret || !safeEqual(providedSecret, expectedSecret)) return json(401, { error: 'invalid_secret' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;

  const { data: stateData, error: stateError } = await admin.rpc('gsa_ads_refresh_campaign_states');
  if (stateError) {
    console.error('Advertising scheduler state refresh failed', stateError);
    return json(500, { error: 'refresh_failed' });
  }

  const { data: orphanRows, error: orphanError } = await admin.rpc('gsa_ads_list_orphan_creative_paths');
  if (orphanError) {
    console.error('Advertising orphan lookup failed', orphanError);
    return json(500, { error: 'orphan_lookup_failed' });
  }

  const orphanPaths = Array.isArray(orphanRows)
    ? orphanRows
      .map((row: { storage_path?: unknown }) => String(row?.storage_path || '').trim())
      .filter(Boolean)
    : [];

  if (orphanPaths.length > 0) {
    const { error: removalError } = await admin.storage.from('gsa-ad-creatives').remove(orphanPaths);
    if (removalError) {
      console.error('Advertising orphan cleanup failed', removalError);
      return json(500, { error: 'orphan_cleanup_failed' });
    }
  }

  return json(200, {
    success: true,
    ...(stateData || {}),
    orphan_creatives_deleted: orphanPaths.length,
  });
}

if (import.meta.main) Deno.serve(handleRequest);
