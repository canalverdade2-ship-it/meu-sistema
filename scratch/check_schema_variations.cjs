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

async function checkSchema() {
  console.log('Checking all tables and columns...');
  // Query 1 product with all fields
  const prods = await fetchFromSupabase('/rest/v1/produtos?limit=1&select=*');
  if (prods && prods[0]) {
    console.log('Columns in `produtos` table:');
    console.log(Object.keys(prods[0]));
  }

  // Check if there is a `produto_variacoes` or `produtos_variacoes` or `variacoes` table
  const testTables = ['produto_variacoes', 'produtos_variacoes', 'variacoes', 'produto_opcoes', 'produto_grade', 'produto_fornecedor_config'];
  for (const t of testTables) {
    const r = await fetchFromSupabase(`/rest/v1/${t}?limit=1&select=*`);
    console.log(`Table ${t}:`, Array.isArray(r) ? `EXISTS (${r.length} rows)` : r.message || 'Error');
    if (Array.isArray(r) && r[0]) {
      console.log(`  Columns of ${t}:`, Object.keys(r[0]));
    }
  }
}

checkSchema().catch(console.error);
