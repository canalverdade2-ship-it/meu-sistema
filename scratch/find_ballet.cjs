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

async function findProduct() {
  const prods = await fetchFromSupabase('/rest/v1/produtos?or=(nome.ilike.*Ballet*,nome.ilike.*Coque*)&select=*');
  console.log('Found:', prods?.length);
  for (const p of (prods || [])) {
    console.log(`- ID: ${p.id} | Código: ${p.codigo_produto} | Nome: ${p.nome} | Preço: ${p.valor}`);
    const forn = await fetchFromSupabase(`/rest/v1/produto_fornecedor_config?produto_id=eq.${p.id}&select=*`);
    console.log(`  Fornecedor URL:`, forn?.[0]?.url_produto);
  }
}

findProduct().catch(console.error);
