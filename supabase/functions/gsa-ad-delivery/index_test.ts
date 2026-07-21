import { handleRequest, normalizeServePayload } from './index.ts';

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
  if (response.status !== 403) throw new Error(`Esperado 403, recebido ${response.status}`);
});
