import { handleRequest } from './index.ts';

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
}

async function configured(test: () => Promise<void>) {
  const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'test-key', SUPABASE_ANON_KEY: 'test-anon', ADVERTISING_CRON_SECRET: 'test-cron' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, Deno.env.get(key)]));
  for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected network access'); };
  try { await test(); } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
  }
}

const post = (body: string, headers: Record<string, string> = {}) => new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });

Deno.test('rejects untrusted origins for POST and preflight without wildcard CORS', async () => {
  for (const method of ['POST', 'OPTIONS']) {
    const response = await handleRequest(new Request('https://example.test', { method, headers: { origin: 'https://untrusted.example' } }));
    equal(response.status, 403);
    equal(response.headers.get('access-control-allow-origin'), '');
  }
});

Deno.test('rejects unsupported methods', async () => {
  const response = await handleRequest(new Request('https://example.test'));
  equal(response.status, 405);
});

Deno.test('rejects malformed and non-object JSON without network', () => configured(async () => {
  for (const body of ['{', 'null', '[]', '1', '"text"']) equal((await handleRequest(post(body))).status, 400);
}));

Deno.test('enforces actual body size without Content-Length', () => configured(async () => {
  equal((await handleRequest(post(JSON.stringify({ padding: 'x'.repeat(32_001) })))).status, 413);
}));

Deno.test('rejects invalid cron secret before scheduling or cleanup', () => configured(async () => {
  equal((await handleRequest(post('{}', { 'x-cron-secret': 'wrong' }))).status, 401);
}));

Deno.test('scheduler refreshes states and removes only RPC-selected orphan paths', () => configured(async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/rpc/gsa_ads_refresh_campaign_states')) return Response.json({ refreshed: 1 });
    if (url.endsWith('/rpc/gsa_ads_list_orphan_creative_paths')) return Response.json([{ storage_path: 'orphan/file.png' }]);
    if (url.endsWith('/storage/v1/object/gsa-ad-creatives')) {
      equal(JSON.stringify(JSON.parse(String(init?.body)).prefixes), '["orphan/file.png"]');
      return Response.json([]);
    }
    throw new Error(`Unexpected call: ${url}`);
  };
  const response = await handleRequest(post('{}', { 'x-cron-secret': 'test-cron' }));
  equal(response.status, 200);
  equal((await response.json()).orphan_creatives_deleted, 1);
  equal(calls.length, 3);
}));

Deno.test('delivery fails closed when rate limit is denied', () => configured(async () => {
  globalThis.fetch = async (input) => {
    if (!String(input).endsWith('/rpc/gsa_auth_rate_limit_check')) throw new Error('Delivery bypassed rate limit');
    return Response.json({ allowed: false, retry_after: 60 });
  };
  equal((await handleRequest(post('{"action":"serve"}'))).status, 429);
}));

Deno.test('valid ad request hashes identifiers and strips private storage paths', () => configured(async () => {
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/rpc/gsa_auth_rate_limit_check')) return Response.json({ allowed: true });
    if (String(input).endsWith('/rpc/gsa_ads_serve')) {
      const args = JSON.parse(String(init?.body));
      equal(args.p_viewer_hash.length, 64);
      equal(args.p_session_hash.length, 64);
      return Response.json({ ad: { title: 'Ad', storage_path: null }, event_token: 'event' });
    }
    throw new Error('Unexpected request');
  };
  const response = await handleRequest(post(JSON.stringify({ action: 'serve', placement_code: 'HOME_BANNER_TOP', viewer_id: 'viewer', session_id: 'session', route: '/', device: 'mobile' })));
  equal(response.status, 200);
  equal('storage_path' in (await response.json()).ad, false);
}));

Deno.test('checkout requires an authenticated account', () => configured(async () => {
  equal((await handleRequest(post('{"action":"create_checkout","payment_id":"00000000-0000-4000-8000-000000000001"}'))).status, 401);
}));
