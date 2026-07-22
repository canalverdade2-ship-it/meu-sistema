import { handleRequest } from './index.ts';

Deno.test('bloqueia origem não autorizada', async () => {
  const response = await handleRequest(new Request('http://localhost', {
    method: 'POST',
    headers: { origin: 'https://blocked.example', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'invite', request_id: '00000000-0000-0000-0000-000000000001' }),
  }));
  if (response.status !== 403) throw new Error(`Esperado 403, recebido ${response.status}`);
});

Deno.test('exige autenticação administrativa', async () => {
  const response = await handleRequest(new Request('http://localhost', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'invite', request_id: '00000000-0000-0000-0000-000000000001' }),
  }));
  if (response.status !== 401) throw new Error(`Esperado 401, recebido ${response.status}`);
});

Deno.test('rejeita identificador de solicitação malformado antes de acessar serviços externos', async () => {
  const response = await handleRequest(new Request('http://localhost', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      authorization: 'Bearer teste',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action: 'invite', request_id: '../solicitacao' }),
  }));
  if (response.status !== 400) throw new Error(`Esperado 400, recebido ${response.status}`);
});
