import { handleRequest } from './index.ts';

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
}

async function configured(test: () => Promise<void>) {
  const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'test-key', SUPABASE_ANON_KEY: 'test-anon', ADVERTISING_WEBHOOK_SECRET: 'test-secret' };
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

Deno.test('rejects untrusted origin and unauthenticated invitation', () => configured(async () => {
  equal((await handleRequest(post('{}', { origin: 'https://untrusted.example' }))).status, 403);
  equal((await handleRequest(post('{"action":"invite"}'))).status, 401);
}));

Deno.test('rejects invalid HMAC without processing a payment', () => configured(async () => {
  equal((await handleRequest(post('{}', { 'x-gsa-signature': 'invalid' }))).status, 401);
}));

Deno.test('applies actual size limit to signed webhook body', () => configured(async () => {
  equal((await handleRequest(post('x'.repeat(128_001), { 'x-gsa-signature': 'invalid' }))).status, 413);
}));

Deno.test('rejects malformed and non-object admin requests', () => configured(async () => {
  for (const raw of ['{', 'null', '[]']) equal((await handleRequest(post(raw))).status, 400);
}));

Deno.test('verified webhook delegates idempotency and keeps duplicate result', () => configured(async () => {
  const raw = JSON.stringify({ provider: 'test', event_id: 'event-1', reference: 'order-1', status: 'paid' });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
  globalThis.fetch = async (input, init) => {
    if (!String(input).endsWith('/rpc/gsa_ads_process_payment_event')) throw new Error('Unexpected RPC');
    const args = JSON.parse(String(init?.body));
    equal(args.p_event_id, 'event-1');
    equal(args.p_reference, 'order-1');
    return Response.json({ duplicate: true, status: 'paid' });
  };
  const response = await handleRequest(post(raw, { 'x-gsa-signature': signature }));
  equal(response.status, 200);
  equal((await response.json()).duplicate, true);
}));
