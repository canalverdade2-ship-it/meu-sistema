const https = require('https');

async function testShopee() {
  const url = 'https://shopee.com.br/flash_sale?promotionId=485920075895103';
  console.log('Testing Shopee URL:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML Length:', html.length);
    const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    console.log('Total scripts found:', scripts.length);
    for (let i = 0; i < scripts.length; i++) {
      const content = scripts[i][1];
      if (content.includes('items') || content.includes('price') || content.includes('products') || content.includes('window.')) {
        console.log(`Script ${i} snippet (${content.length} chars):`, content.substring(0, 200));
      }
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}

testShopee();
