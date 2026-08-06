const url = 'https://www.atacadao.com.br/mercearia/chocolates?category-1=mercearia&category-2=chocolates&category-3=barra-de-chocolate&brand=nestle&facets=category-1%2Ccategory-2%2Ccategory-3%2Cbrand&sort=score_desc&page=0';

async function testAtacadao() {
  console.log('Testing Atacadão URL:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML Length:', html.length);

    // 1. Test VTEX __STATE__ or __RUNTIME__
    const stateMatch = html.match(/__STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i) || html.match(/window\.__STATE__\s*=\s*({[\s\S]*?});/i);
    if (stateMatch) {
      console.log('Found __STATE__ script! Length:', stateMatch[1].length);
      try {
        const stateObj = JSON.parse(stateMatch[1]);
        console.log('__STATE__ keys:', Object.keys(stateObj).slice(0, 10));
        // Search for products in __STATE__
        const productKeys = Object.keys(stateObj).filter(k => k.includes('Product:') || k.includes('Item:') || stateObj[k].productName || stateObj[k].items);
        console.log('Product keys count in state:', productKeys.length);
        if (productKeys.length > 0) {
          console.log('Sample product from state:', stateObj[productKeys[0]]);
        }
      } catch (e) {
        console.log('JSON parse error on __STATE__:', e.message);
      }
    } else {
      console.log('__STATE__ script not found');
    }

    // 2. Check JSON-LD
    const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    console.log('JSON-LD scripts count:', jsonLdMatches.length);
    for (let i = 0; i < jsonLdMatches.length; i++) {
      try {
        const parsed = JSON.parse(jsonLdMatches[i][1].trim());
        console.log(`JSON-LD ${i} type:`, parsed['@type'] || (Array.isArray(parsed) ? 'Array' : 'Object'));
        if (parsed['@type'] === 'ItemList' || parsed.itemListElement) {
          console.log('Found ItemList JSON-LD!');
          console.log('Elements count:', parsed.itemListElement?.length);
          if (parsed.itemListElement?.[0]) {
            console.log('Sample ItemList item:', parsed.itemListElement[0]);
          }
        }
      } catch (e) {}
    }

    // 3. Test VTEX Catalog API for Atacadão
    console.log('\nTesting VTEX Search API for Atacadão...');
    const vtexApiUrl = 'https://www.atacadao.com.br/api/catalog_system/pub/products/search/mercearia/chocolates';
    const apiRes = await fetch(vtexApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    });
    console.log('VTEX API Status:', apiRes.status);
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      console.log('VTEX API Items count:', apiData.length);
      if (apiData.length > 0) {
        console.log('Sample VTEX API product:', {
          productName: apiData[0].productName,
          brand: apiData[0].brand,
          items: apiData[0].items?.[0]?.sellers?.[0]?.commertialOffer?.Price
        });
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

testAtacadao();
