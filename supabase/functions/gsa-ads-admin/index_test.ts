import { handleRequest } from './index.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function responseJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function configureRuntimeEnv() {
  Deno.env.set('SUPABASE_URL', 'https://example.invalid');
  Deno.env.set('SUPABASE_ANON_KEY', 'anon-test-key');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
  Deno.env.set('ADVERTISING_WEBHOOK_SECRET', 'webhook-test-secret');
}

Deno.test('gsa-ads-admin rejects forbidden CORS preflight origins', async () => {
  const response = await handleRequest(new Request('https://edge.test/gsa-ads-admin', {
    method: 'OPTIONS',
    headers: { origin: 'https://evil.example' },
  }));
  assert(response.status === 403, `expected 403, got ${response.status}`);
  const body = await responseJson(response);
  assert(body.error === 'origin_not_allowed', 'expected origin_not_allowed');
});

Deno.test('gsa-ads-admin rejects JSON that is not an object', async () => {
  configureRuntimeEnv();
  const response = await handleRequest(new Request('https://edge.test/gsa-ads-admin', {
    method: 'POST',
    headers: {
      origin: 'https://grupo-gsa.com.br',
      'content-type': 'application/json',
    },
    body: '[]',
  }));
  assert(response.status === 400, `expected 400, got ${response.status}`);
  const body = await responseJson(response);
  assert(body.error === 'invalid_json', 'expected invalid_json');
});

Deno.test('gsa-ads-admin bounds webhook bodies without Content-Length', async () => {
  configureRuntimeEnv();
  const request = new Request('https://edge.test/gsa-ads-admin', {
    method: 'POST',
    headers: {
      'x-gsa-signature': 'sha256=00',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ payload: 'x'.repeat(129_000) }),
  });
  request.headers.delete('content-length');
  const response = await handleRequest(request);
  assert(response.status === 413, `expected 413, got ${response.status}`);
  const body = await responseJson(response);
  assert(body.error === 'payload_too_large', 'expected payload_too_large');
});
