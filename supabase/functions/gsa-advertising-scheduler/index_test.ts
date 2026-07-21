import { handleRequest } from './index.ts';

Deno.test('agendador aceita somente POST', async () => {
  const response = await handleRequest(new Request('http://localhost', { method: 'GET' }));
  if (response.status !== 405) throw new Error(`Esperado 405, recebido ${response.status}`);
});
