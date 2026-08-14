const http = require('http');

const SERVICE_ROLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODYwNjMzNzcsImV4cCI6MjEwMTQyMzM3N30.AuVtgQf7nnOrXKoElM_y9pVGW12xledsLpZGg0qOjME';

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: path.replace(/^\/rest\/v1/, ''),
      method: 'GET',
      headers: {
        'apikey': SERVICE_ROLE_JWT,
        'Authorization': `Bearer ${SERVICE_ROLE_JWT}`,
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(options, (res) => {
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
  console.log('Querying produtos table for Redinha de Coque or 9998055754...');
  const res = await supabaseGet('/rest/v1/produtos?or=(nome.ilike.*Redinha%20de%20Coque*,codigo_produto.ilike.*9998055754*)&select=*');
  console.log('Found in DB:', res);

  // Check columns of produtos table
  if (res && res.length > 0) {
    console.log('\nColumns of first matching product:');
    console.log(Object.keys(res[0]));
    console.log('\nProduct details:', res[0]);
  } else {
    console.log('Product not found with that filter. Let us list some products to see columns:');
    const sample = await supabaseGet('/rest/v1/produtos?limit=1&select=*');
    console.log(sample);
  }
}

checkProductInDB().catch(console.error);
