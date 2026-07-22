import { handleRequest, isValidCnpj, isValidCpf, normalizePayload } from './index.ts';

function assertEquals(actual: unknown, expected: unknown, message = 'Valores diferentes') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

Deno.test('normaliza solicitação válida de anúncio', () => {
  const payload = normalizePayload({
    company_name: 'Empresa Exemplo',
    document: '04.252.011/0001-10',
    company_size: 'pequena',
    segment: 'Comércio',
    contact_name: 'Maria Silva',
    contact_email: 'CONTATO@EXAMPLE.COM',
    contact_phone: '(11) 99999-9999',
    website: 'https://example.com',
    objective: 'Divulgar promoção',
    desired_formats: ['responsive_banner', 'sponsored_card'],
    desired_pages: ['HOME_BANNER_TOP'],
    devices: ['desktop', 'mobile'],
    intended_budget: 1500,
    started_at: new Date(Date.now() - 5000).toISOString(),
  });

  assertEquals(payload?.document, '04252011000110');
  assertEquals(payload?.contact_email, 'contato@example.com');
  assertEquals(payload?.contact_phone, '11999999999');
});

Deno.test('valida os dígitos verificadores de CPF e CNPJ', () => {
  assertEquals(isValidCpf('529.982.247-25'), true);
  assertEquals(isValidCpf('529.982.247-24'), false);
  assertEquals(isValidCnpj('04.252.011/0001-10'), true);
  assertEquals(isValidCnpj('04.252.011/0001-11'), false);
});

Deno.test('rejeita valores fora dos catálogos públicos', () => {
  const payload = normalizePayload({
    company_name: 'Empresa Exemplo',
    document: '04.252.011/0001-10',
    company_size: 'pequena',
    segment: 'Comércio',
    contact_name: 'Maria Silva',
    contact_email: 'contato@example.com',
    contact_phone: '11999999999',
    objective: 'Divulgar promoção',
    desired_formats: ['formato_inventado'],
    desired_pages: ['POSICAO_INVENTADA'],
    devices: ['geladeira'],
    intended_budget: 1500,
    started_at: new Date(Date.now() - 5000).toISOString(),
  });
  assertEquals(payload, null);
});

Deno.test('rejeita website inseguro e formulário rápido demais', () => {
  const payload = normalizePayload({
    company_name: 'Empresa Exemplo',
    document: '12345678000190',
    company_size: 'pequena',
    segment: 'Comércio',
    contact_name: 'Maria Silva',
    contact_email: 'contato@example.com',
    contact_phone: '11999999999',
    website: 'http://example.com',
    objective: 'Divulgar promoção',
    desired_formats: ['responsive_banner'],
    desired_pages: ['HOME_BANNER_TOP'],
    devices: ['desktop'],
    intended_budget: 1500,
    started_at: new Date().toISOString(),
  });

  assertEquals(payload, null);
});

Deno.test('aplica CORS às origens permitidas e bloqueia origem externa', async () => {
  const previous = Deno.env.get('ALLOWED_ORIGINS');
  try {
    Deno.env.set('ALLOWED_ORIGINS', 'http://10.0.2.189:3000,http://localhost:3000');

    const blocked = await handleRequest(new Request('https://example.test', {
      method: 'OPTIONS',
      headers: { origin: 'https://attacker.example' },
    }));
    assertEquals(blocked.status, 403);

    const allowed = await handleRequest(new Request('https://example.test', {
      method: 'OPTIONS',
      headers: { origin: 'http://10.0.2.189:3000' },
    }));
    assertEquals(allowed.status, 204);
    assertEquals(allowed.headers.get('access-control-allow-origin'), 'http://10.0.2.189:3000');
  } finally {
    if (previous === undefined) Deno.env.delete('ALLOWED_ORIGINS');
    else Deno.env.set('ALLOWED_ORIGINS', previous);
  }
});

Deno.test('limita o corpo mesmo sem confiar apenas em content-length', async () => {
  const previous = Deno.env.get('ALLOWED_ORIGINS');
  try {
    Deno.env.set('ALLOWED_ORIGINS', 'http://localhost:3000');
    const response = await handleRequest(new Request('https://example.test', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'x'.repeat(33_000) }),
    }));
    assertEquals(response.status, 413);
  } finally {
    if (previous === undefined) Deno.env.delete('ALLOWED_ORIGINS');
    else Deno.env.set('ALLOWED_ORIGINS', previous);
  }
});
