async function testVtexFields() {
  const url = 'https://www.atacadao.com.br/api/catalog_system/pub/products/search/mercearia/chocolates';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      console.log('description:', item.description?.substring(0, 100));
      console.log('metaTagDescription:', item.metaTagDescription);
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}

testVtexFields();
