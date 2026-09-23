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
}

Deno.test('gsa-ads-public rejects forbidden CORS preflight origins', async () => {
  const response = await handleRequest(new Request('https://edge.test/gsa-ads-public', {
    method: 'OPTIONS',
    headers: { origin: 'https://evil.example' },
  }));
  assert(response.status === 403, `expected 403, got ${response.status}`);
  assert(response.headers.get('access-control-allow-origin') !== '*', 'forbidden origin must not receive wildcard CORS');
  const body = await responseJson(response);
  assert(body.error === 'origin_not_allowed', 'expected origin_not_allowed');
});

Deno.test('gsa-ads-public accepts allowed CORS preflight', async () => {
  const response = await handleRequest(new Request('https://edge.test/gsa-ads-public', {
    method: 'OPTIONS',
    headers: { origin: 'https://grupo-gsa.com.br' },
  }));
  assert(response.status === 204, `expected 204, got ${response.status}`);
  assert(response.headers.get('access-control-allow-origin') === 'https://grupo-gsa.com.br', 'allowed origin must be echoed');
});

Deno.test('gsa-ads-public rejects JSON that is not an object', async () => {
  configureRuntimeEnv();
  const response = await handleRequest(new Request('https://edge.test/gsa-ads-public', {
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

Deno.test('gsa-ads-public bounds streamed request bodies', async () => {
  configureRuntimeEnv();
  const oversized = JSON.stringify({ payload: 'x'.repeat(33_000) });
  const request = new Request('https://edge.test/gsa-ads-public', {
    method: 'POST',
    headers: {
      origin: 'https://grupo-gsa.com.br',
      'content-type': 'application/json',
    },
    body: oversized,
  });
  request.headers.delete('content-length');
  const response = await handleRequest(request);
  assert(response.status === 413, `expected 413, got ${response.status}`);
  const body = await responseJson(response);
  assert(body.error === 'payload_too_large', 'expected payload_too_large');
});
