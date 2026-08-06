// Comparar os dois feeds da Shopee — primeiros 200 produtos de cada
const FEED1 = {
  nome: 'Shopee Oficial BR - 2022',
  url: 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h'
};
const FEED2 = {
  nome: 'Shopee Brasil - 2022',
  url: 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcFMjz35zY_7hscVJ_4QLIFiIR3DQ9hsrLcX6rgIVVFkb'
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function analisarFeed(feed, amostras = 300) {
  console.log(`\n📦 Analisando: ${feed.nome}`);
  const res = await fetch(feed.url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' }
  });
  if (!res.ok) { console.log('Erro:', res.status); return; }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '', headers = null, count = 0;
  
  const categorias = {};
  const precos = [];
  const ratings = [];
  const descontos = [];
  const lojas = new Set();

  while (count < amostras) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (count >= amostras) break;
      if (!line.trim()) continue;
      if (!headers) { headers = parseCSVLine(line); continue; }

      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim(); });

      const title = row.title || '';
      const salePrice = parseFloat(row.sale_price || '0');
      const itemId = row.itemid || '';
      if (!title || salePrice <= 0 || isNaN(salePrice)) continue;
      if (itemId && !/^\d+$/.test(itemId)) continue;

      count++;
      precos.push(salePrice);
      const rating = parseFloat(row.item_rating || '0');
      if (rating > 0) ratings.push(rating);
      const disc = parseInt(row.discount_percentage || '0');
      if (disc > 0) descontos.push(disc);
      const cat1 = row.global_category1 || 'Sem categoria';
      categorias[cat1] = (categorias[cat1] || 0) + 1;
      if (row.shop_name) lojas.add(row.shop_name);
    }
  }
  await reader.cancel();

  // Estatísticas
  const precoMedio = precos.length ? (precos.reduce((a,b)=>a+b,0)/precos.length).toFixed(2) : 0;
  const precoMin = precos.length ? Math.min(...precos).toFixed(2) : 0;
  const precoMax = precos.length ? Math.max(...precos).toFixed(2) : 0;
  const ratingMedio = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(2) : 0;
  const descontoMedio = descontos.length ? (descontos.reduce((a,b)=>a+b,0)/descontos.length).toFixed(0) : 0;

  console.log(`  ✅ Produtos analisados: ${count}`);
  console.log(`  💰 Preço: mín R$${precoMin} | médio R$${precoMedio} | máx R$${precoMax}`);
  console.log(`  ⭐ Avaliação média: ${ratingMedio}`);
  console.log(`  🏷️  Desconto médio: ${descontoMedio}%`);
  console.log(`  🏪 Lojas únicas: ${lojas.size}`);
  console.log(`  📂 Top categorias:`);
  Object.entries(categorias)
    .sort((a,b) => b[1]-a[1])
    .slice(0,10)
    .forEach(([cat, qtd]) => console.log(`     ${cat}: ${qtd} produtos`));
  
  return { precoMedio, ratingMedio, descontoMedio, categorias, count };
}

async function main() {
  const r1 = await analisarFeed(FEED1, 300);
  const r2 = await analisarFeed(FEED2, 300);
  
  console.log('\n\n📊 COMPARAÇÃO FINAL:');
  console.log('─────────────────────────────────────────');
  console.log(`                   | Oficial BR  | Brasil`);
  console.log(`Preço médio        | R$ ${r1?.precoMedio}  | R$ ${r2?.precoMedio}`);
  console.log(`Avaliação média    | ${r1?.ratingMedio}⭐     | ${r2?.ratingMedio}⭐`);
  console.log(`Desconto médio     | ${r1?.descontoMedio}%          | ${r2?.descontoMedio}%`);
  console.log('─────────────────────────────────────────');
}

main().catch(console.error);
