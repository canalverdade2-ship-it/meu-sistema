'use strict';
const http = require('http');

const SERVICE_ROLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODYwNjMzNzcsImV4cCI6MjEwMTQyMzM3N30.AuVtgQf7nnOrXKoElM_y9pVGW12xledsLpZGg0qOjME';

function supabasePost(path, body, callback) {
  const cleanPath = path.replace(/^\/rest\/v1/, '');
  const payload = JSON.stringify(body);
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: cleanPath,
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_JWT,
      'Authorization': 'Bearer ' + SERVICE_ROLE_JWT,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log('Insert fatura response [' + res.statusCode + ']:', data);
      callback(null, JSON.parse(data));
    });
  });
  req.write(payload);
  req.end();
}

const faturaData = {
  codigo_fatura: 'FAT-TEST-' + Date.now(),
  cliente_id: '262b0425-2e4b-49b7-9765-db1510e2a664',
  valor_total: 14.64,
  valor_pago: 0,
  status: 'pendente',
  data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  data_emissao: new Date().toISOString()
};

supabasePost('/rest/v1/faturas', faturaData, (err, res) => {
  console.log('✅ Fatura inserida com sucesso, ID:', res && res[0] ? res[0].id : res);
});
