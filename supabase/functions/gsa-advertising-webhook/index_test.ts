import { normalizePaymentEvent } from './index.ts';

Deno.test('aceita evento de pagamento suportado', () => {
  const event = normalizePaymentEvent({ provider: 'manual', event_id: 'evt-1', reference: 'PAY-1', status: 'paid' });
  if (!event || event.status !== 'paid' || event.reference !== 'PAY-1') throw new Error('Evento válido rejeitado');
});

Deno.test('rejeita status desconhecido', () => {
  if (normalizePaymentEvent({ provider: 'manual', event_id: 'evt-1', reference: 'PAY-1', status: 'unknown' })) throw new Error('Evento inválido aceito');
});
