import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleRequest, normalizePayload } from './index.ts';

const DEVELOPMENT_ORIGINS = 'http://localhost:3000,http://10.0.2.189:3000';

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

Deno.test('bloqueia origem não autorizada', async () => {
  Deno.env.set('ALLOWED_ORIGINS', DEVELOPMENT_ORIGINS);
  const response = await handleRequest(new Request('https://example.test', {
    method: 'OPTIONS',
    headers: { origin: 'https://attacker.example' },
  }));
  assertEquals(response.status, 403);
});

Deno.test('aceita preflight da origem de desenvolvimento configurada', async () => {
  Deno.env.set('ALLOWED_ORIGINS', DEVELOPMENT_ORIGINS);
  const response = await handleRequest(new Request('https://example.test', {
    method: 'OPTIONS',
    headers: { origin: 'http://10.0.2.189:3000' },
  }));
  assertEquals(response.status, 204);
  assertEquals(response.headers.get('access-control-allow-origin'), 'http://10.0.2.189:3000');
});
