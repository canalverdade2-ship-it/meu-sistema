const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const INFINITEPAY_HANDLE = 'getsemani-gsa';
const INFINITEPAY_API_URL = 'https://api.checkout.infinitepay.io/links';

async function testInfinitePayCheckout() {
  const payload = {
    handle: INFINITEPAY_HANDLE,
    items: [{
      quantity: 1,
      price: 100, // R$ 1,00 em centavos
      description: 'Teste GSA PIX',
    }],
    order_nsu: `TEST-${Date.now()}`,
  };

  console.log('Enviando payload para InfinitePay:', JSON.stringify(payload, null, 2));

  const resp = await fetch(INFINITEPAY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  console.log('Status:', resp.status);
  console.log('Response headers:', Object.fromEntries(resp.headers.entries()));
  
  try {
    const data = JSON.parse(text);
    console.log('Response JSON:', JSON.stringify(data, null, 2));
  } catch(e) {
    console.log('Response TEXT:', text);
  }
}

testInfinitePayCheckout().catch(console.error);
