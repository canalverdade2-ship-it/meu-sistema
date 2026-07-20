import { assertEquals } from 'jsr:@std/assert@1';
import { handleRequest, normalizePayload } from './index.ts';

function withAllowedOrigins(value: string, callback: () => Promise<void>) {
  const previousOrigins = Deno.env.get('ALLOWED_ORIGINS');
  const previousOrigin = Deno.env.get('ALLOWED_ORIGIN');

  Deno.env.set('ALLOWED_ORIGINS', value);
  Deno.env.delete('ALLOWED_ORIGIN');

  return callback().finally(() => {
    if (previousOrigins === undefined) Deno.env.delete('ALLOWED_ORIGINS');
    else Deno.env.set('ALLOWED_ORIGINS', previousOrigins);

    if (previousOrigin === undefined) Deno.env.delete('ALLOWED_ORIGIN');
    else Deno.env.set('ALLOWED_ORIGIN', previousOrigin);
  });
}

Deno.test('normaliza somente documentos, PINs e tipos válidos', () => {
  assertEquals(
    normalizePayload('login_pin', {
      documento: '123.456.789-00',
      pin: '1234',
      tipo: 'cliente',
    }),
    { documento: '12345678900', pin: '1234', tipo: 'cliente' },
  );

  assertEquals(normalizePayload('login_pin', {
    documento: '123',
    pin: '12',
    tipo: 'cliente',
  }), null);
});

Deno.test('rejeita origem não autorizada antes de acessar o banco', async () => {
  await withAllowedOrigins('https://app.gsa.example', async () => {
    const response = await handleRequest(new Request('https://gateway.example', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    }));

    assertEquals(response.status, 403);
    assertEquals(await response.json(), { error: 'origin_not_allowed' });
    assertEquals(response.headers.get('access-control-allow-origin'), null);
  });
});

Deno.test('autoriza preflight somente para origem configurada', async () => {
  await withAllowedOrigins('https://app.gsa.example, https://admin.gsa.example', async () => {
    const response = await handleRequest(new Request('https://gateway.example', {
      method: 'OPTIONS',
      headers: { origin: 'https://app.gsa.example' },
    }));

    assertEquals(response.status, 204);
    assertEquals(response.headers.get('access-control-allow-origin'), 'https://app.gsa.example');
    assertEquals(response.headers.get('vary'), 'Origin');
  });
});