import { handleRequest } from './index.ts';

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
}

Deno.test('agendador aceita somente POST', async () => {
  const response = await handleRequest(new Request('http://localhost', { method: 'GET' }));
  assertEquals(response.status, 405, 'método inválido');
});

Deno.test('agendador falha fechado quando os secrets não estão configurados', async () => {
  const previousCron = Deno.env.get('ADVERTISING_CRON_SECRET');
  const previousUrl = Deno.env.get('SUPABASE_URL');
  const previousServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  Deno.env.delete('ADVERTISING_CRON_SECRET');
  Deno.env.delete('SUPABASE_URL');
  Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');

  try {
    const response = await handleRequest(new Request('http://localhost', { method: 'POST' }));
    assertEquals(response.status, 503, 'configuração ausente');
  } finally {
    if (previousCron) Deno.env.set('ADVERTISING_CRON_SECRET', previousCron);
    if (previousUrl) Deno.env.set('SUPABASE_URL', previousUrl);
    if (previousServiceRole) Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', previousServiceRole);
  }
});
