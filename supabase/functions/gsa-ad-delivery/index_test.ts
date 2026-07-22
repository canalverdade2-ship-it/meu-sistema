import { handleRequest, normalizeServePayload } from './index.ts';

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
}

Deno.test('normaliza solicitação válida de entrega', () => {
  const value = normalizeServePayload({
    action: 'serve', placement_code: 'SITE_STICKY_BOTTOM', viewer_id: 'viewer-1', session_id: 'session-1', route: '/', device: 'mobile',
  });
  if (!value || value.placement !== 'SITE_STICKY_BOTTOM' || value.device !== 'mobile') throw new Error('Payload válido foi rejeitado');
});

Deno.test('rejeita identificadores inseguros', () => {
  if (normalizeServePayload({ placement_code: '../x', viewer_id: 'ok', session_id: 'ok', device: 'desktop' })) throw new Error('Payload inseguro foi aceito');
});

Deno.test('bloqueia origem fora da lista', async () => {
  const response = await handleRequest(new Request('http://localhost', {
    method: 'POST',
    headers: { origin: 'https://blocked.example', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'serve' }),
  }));
  assertEquals(response.status, 403, 'origem bloqueada');
});

Deno.test('rejeita método diferente de POST', async () => {
  const response = await handleRequest(new Request('http://localhost', { method: 'GET' }));
  assertEquals(response.status, 405, 'método inválido');
  assertEquals(response.headers.get('allow'), 'POST, OPTIONS', 'cabeçalho Allow');
});

Deno.test('valida o tamanho real do corpo sem confiar em content-length', async () => {
  const response = await handleRequest(new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'serve', padding: 'x'.repeat(17_000) }),
  }));
  assertEquals(response.status, 413, 'corpo grande');
});

Deno.test('rejeita JSON inválido antes de acessar configuração externa', async () => {
  const response = await handleRequest(new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalido',
  }));
  assertEquals(response.status, 400, 'json inválido');
});
