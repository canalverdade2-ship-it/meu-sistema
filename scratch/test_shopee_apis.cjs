async function testApis() {
  const endpoints = [
    {
      name: 'Flash Sale Items API v4',
      url: 'https://shopee.com.br/api/v4/flash_sale/flash_sale_get_items?promotionid=485920075895103&categoryid=0&limit=16&with_users=true'
    },
    {
      name: 'Flash Sale Item IDs v4',
      url: 'https://shopee.com.br/api/v4/flash_sale/get_all_itemids?promotionid=485920075895103'
    },
    {
      name: 'Search API v4',
      url: 'https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=fone+bluetooth&limit=10&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2'
    },
    {
      name: 'Shopee Daily Discover / Recommendations',
      url: 'https://shopee.com.br/api/v4/recommend/recommend?bundle=daily_discover_main&limit=10'
    }
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting: ${ep.name} -> ${ep.url}`);
    try {
      const res = await fetch(ep.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://shopee.com.br/',
          'x-api-source': 'rweb',
          'x-shopee-language': 'pt-BR',
          'x-requested-with': 'XMLHttpRequest'
        }
      });
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        console.log('Keys:', Object.keys(json));
        if (json.data) {
          console.log('Data keys:', Object.keys(json.data));
          if (json.data.items) {
            console.log(`Found ${json.data.items.length} items!`);
            const first = json.data.items[0];
            console.log('Sample item:', {
              name: first.name || first.item_basic?.name,
              price: first.price || first.item_basic?.price,
              image: first.image || first.item_basic?.image
            });
          }
        }
      } catch (e) {
        console.log('Non-JSON response (first 200 chars):', text.substring(0, 200));
      }
    } catch (err) {
      console.error('Fetch error:', err.message);
    }
  }
}

testApis();
