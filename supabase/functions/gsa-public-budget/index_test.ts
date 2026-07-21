import { handleRequest, normalizePayload } from './index.ts';

const DEVELOPMENT_ORIGINS = 'http://localhost:3000,http://10.0.2.189:3000';

function assertEquals(actual: unknown, expected: unknown, message = 'Valores diferentes') {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

Deno.test('normaliza todos os tipos públicos, incluindo integração', () => {
  const payload = normalizePayload({
    nome: 'Empresa de Teste',
    email: 'CONTATO@EXAMPLE.COM',
    telefone: '(11) 99999-9999',
    tipo: 'integracao',
    solicitacao: 'Precisamos integrar o sistema comercial ao atendimento existente.',
    website: '',
    started_at: new Date(Date.now() - 5_000).toISOString(),
    metadata: { utm_source: 'campanha' },
  });

  assertEquals(payload?.email, 'contato@example.com');
  assertEquals(payload?.telefone, '11999999999');
  assertEquals(payload?.tipo, 'integracao');
});

Deno.test('rejeita payload inválido antes de acessar o banco', () => {
  assertEquals(normalizePayload({
    nome: 'A',
    email: 'invalido',
    telefone: '1',
    tipo: 'desconhecido',
    solicitacao: 'curta',
    started_at: '',
  }), null);
});

Deno.test('valida CORS permitido e bloqueado de forma sequencial', async () => {
  const previousOrigins = Deno.env.get('ALLOWED_ORIGINS');
  try {
    Deno.env.set('ALLOWED_ORIGINS', DEVELOPMENT_ORIGINS);

    const blocked = await handleRequest(new Request('https://example.test', {
      method: 'OPTIONS',
      headers: { origin: 'https://attacker.example' },
    }));
    assertEquals(blocked.status, 403, 'Origem externa deveria ser bloqueada');

    const allowed = await handleRequest(new Request('https://example.test', {
      method: 'OPTIONS',
      headers: { origin: 'http://10.0.2.189:3000' },
    }));
    assertEquals(allowed.status, 204, 'Origem de desenvolvimento deveria ser aceita');
    assertEquals(allowed.headers.get('access-control-allow-origin'), 'http://10.0.2.189:3000');
  } finally {
    if (previousOrigins === undefined) Deno.env.delete('ALLOWED_ORIGINS');
    else Deno.env.set('ALLOWED_ORIGINS', previousOrigins);
  }
});
