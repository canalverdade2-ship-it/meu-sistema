async function testShopeeApi() {
  const shopid = '323747395';
  const itemid = '9998055754';

  const urls = [
    `https://shopee.com.br/api/v4/item/get?itemid=${itemid}&shopid=${shopid}`,
    `https://shopee.com.br/api/v4/pdp/get_pc?item_id=${itemid}&shop_id=${shopid}`,
    `https://shopee.com.br/api/v2/item/get?itemid=${itemid}&shopid=${shopid}`
  ];

  for (const url of urls) {
    console.log('\nTesting URL:', url);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': `https://shopee.com.br/product/${shopid}/${itemid}`,
          'x-api-source': 'pc',
          'x-shopee-language': 'pt-BR'
        }
      });
      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Response length:', text.length);
      try {
        const json = JSON.parse(text);
        console.log('Keys:', Object.keys(json));
        if (json.data) {
          console.log('data keys:', Object.keys(json.data));
          if (json.data.tier_variations) {
            console.log('tier_variations:', JSON.stringify(json.data.tier_variations, null, 2));
          }
          if (json.data.models) {
            console.log('models count:', json.data.models.length);
            console.log('first 3 models:', JSON.stringify(json.data.models.slice(0, 3), null, 2));
          }
        }
      } catch (e) {
        console.log('Not JSON, preview:', text.substring(0, 200));
      }
    } catch (err) {
      console.error('Fetch error:', err.message);
    }
  }
}

testShopeeApi().catch(console.error);
