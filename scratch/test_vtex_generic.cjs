const testUrls = [
  'https://www.atacadao.com.br/mercearia/chocolates?category-1=mercearia&category-2=chocolates&category-3=barra-de-chocolate&brand=nestle&facets=category-1%2Ccategory-2%2Ccategory-3%2Cbrand&sort=score_desc&page=0',
  'https://www.atacadao.com.br/bebidas/cervejas'
];

async function extractVtex(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    const host = parsedUrl.hostname;
    const path = parsedUrl.pathname;
    
    // Construct VTEX catalog search endpoint
    const vtexApi = `https://${host}/api/catalog_system/pub/products/search${path}${parsedUrl.search}`;
    console.log(`\nAttempting VTEX API fetch: ${vtexApi}`);

    const res = await fetch(vtexApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    console.log('Status:', res.status);
    if (res.status === 200 || res.status === 206) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`SUCCESS! Extracted ${data.length} products via VTEX API:`);
        const extracted = data.map(item => {
          const sku = item.items?.[0];
          const seller = sku?.sellers?.[0];
          const offer = seller?.commertialOffer;
          const price = offer?.Price || offer?.ListPrice || 0;
          const image = sku?.images?.[0]?.imageUrl || '';
          return {
            nome: item.productName || item.productTitle,
            preco: price,
            imagem_url: image
          };
        });
        console.log('Sample extracted items:', extracted.slice(0, 3));
        return extracted;
      }
    }
  } catch(e) {
    console.error('VTEX fetch error:', e.message);
  }
  return [];
}

async function run() {
  for (const u of testUrls) {
    await extractVtex(u);
  }
}

run();
