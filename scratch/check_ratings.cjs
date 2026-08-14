const FEED_URL = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcFMjz35zY_7hscVJ_4QLIFiIR3DQ9hsrLcX6rgIVVFkb';

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

async function run() {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer);
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const idxRating = headers.indexOf('item_rating');
  const idxTitle = headers.indexOf('title');
  const idxPrice = headers.indexOf('sale_price');
  const idxDiscount = headers.indexOf('discount_percentage');

  console.log('--- Coluna de Avaliação no Feed Shopee ---');
  console.log('Existe coluna item_rating?', idxRating !== -1 ? 'SIM (coluna ' + idxRating + ')' : 'NAO');

  let withRating = 0;
  let withoutRating = 0;
  const ratingDist = {};
  const sampleProducts = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    const ratingStr = cols[idxRating]?.trim();
    const title = cols[idxTitle]?.trim();
    const price = cols[idxPrice]?.trim();
    const discount = cols[idxDiscount]?.trim();

    if (ratingStr && !isNaN(parseFloat(ratingStr))) {
      withRating++;
      const val = parseFloat(ratingStr).toFixed(2);
      ratingDist[val] = (ratingDist[val] || 0) + 1;
      if (sampleProducts.length < 5) {
        sampleProducts.push({
          title: title ? title.slice(0, 45) + '...' : 'Sem título',
          rating: ratingStr + ' estrelas',
          preco: 'R$ ' + price,
          desconto: discount + '%'
        });
      }
    } else {
      withoutRating++;
    }
  }

  console.log('\nTotal de produtos analisados:', withRating + withoutRating);
  console.log('Produtos COM nota de estrelas:', withRating);
  console.log('Produtos SEM nota:', withoutRating);
  console.log('\nExemplos reais extraídos diretamente do catálogo:');
  console.table(sampleProducts);

  console.log('\nDistribuição das notas de estrelas mais frequentes:');
  const topRatings = Object.entries(ratingDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nota, qtd]) => ({ 'Nota (Estrelas)': nota + ' ⭐', 'Qtd Produtos': qtd }));
  console.table(topRatings);
}

run().catch(console.error);
