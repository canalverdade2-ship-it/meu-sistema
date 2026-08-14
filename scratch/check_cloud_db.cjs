const https = require('https');

const SUPABASE_HOST = 'ocgajvagxagutfvgxwsy.supabase.co';
const SERVICE_ROLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODYwNjMzNzcsImV4cCI6MjEwMTQyMzM3N30.AuVtgQf7nnOrXKoElM_y9pVGW12xledsLpZGg0qOjME';

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_HOST,
      path: path,
      method: 'GET',
      headers: {
        'apikey': SERVICE_ROLE_JWT,
        'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkProductInDB() {
  console.log('Querying produtos table for Redinha de Coque or 9998055754 from cloud Supabase...');
  const res = await supabaseGet('/rest/v1/produtos?or=(nome.ilike.*Redinha%20de%20Coque*,codigo_produto.ilike.*9998055754*)&select=*');
  console.log('Found in DB count:', res ? res.length : 0);

  if (res && res.length > 0) {
    console.log('\nColumns of first matching product:');
    console.log(Object.keys(res[0]));
    console.log('\nProduct details:', JSON.stringify(res[0], null, 2));

    // Check if there is a config in produto_fornecedor_config
    const pId = res[0].id;
    const forn = await supabaseGet(`/rest/v1/produto_fornecedor_config?produto_id=eq.${pId}&select=*`);
    console.log('\nFornecedor config:', forn);
  } else {
    console.log('Product not found with exact name. Let us search similar:');
    const sample = await supabaseGet('/rest/v1/produtos?limit=2&select=*');
    console.log('Sample product columns:', sample && sample[0] ? Object.keys(sample[0]) : sample);
  }
}

checkProductInDB().catch(console.error);
