const https = require('https');

const SUPABASE_URL = 'https://api.147-15-43-141.nip.io';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';

async function fetchFromSupabase(path) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

async function check() {
  console.log('Fetching products matching Redinha...');
  const prods = await fetchFromSupabase('/rest/v1/produtos?or=(nome.ilike.*Redinha*,codigo_produto.ilike.*9998055754*)&select=*');
  console.log('Result count:', prods?.length);
  if (prods && prods.length > 0) {
    console.log('Found product:');
    console.log(JSON.stringify(prods[0], null, 2));

    // Check fornecedor config
    const forn = await fetchFromSupabase(`/rest/v1/produto_fornecedor_config?produto_id=eq.${prods[0].id}&select=*`);
    console.log('Fornecedor config:', forn);
  } else {
    console.log('Not found by exact name, fetching 1 product to inspect schema:');
    const sample = await fetchFromSupabase('/rest/v1/produtos?limit=1&select=*');
    console.log(sample);
  }
}

check().catch(console.error);
