const readline = require('readline');
const { Readable } = require('stream');

const FEED_OFICIAL_URL = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h';

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
  console.log(`Iniciando streaming do Feed Oficial Shopee BR (198 MB - ~100.000 produtos)...`);
  const res = await fetch(FEED_OFICIAL_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  const nodeStream = Readable.fromWeb(res.body);
  const rl = readline.createInterface({
    input: nodeStream,
    crlfDelay: Infinity
  });

  let isHeader = true;
  let idxCat1 = -1;
  let idxCat2 = -1;
  let idxCatId1 = -1;
  let totalLines = 0;
  const categories = {};

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) {
      const headers = parseCSVLine(line).map(h => h.trim());
      idxCat1 = headers.indexOf('global_category1');
      idxCat2 = headers.indexOf('global_category2');
      idxCatId1 = headers.indexOf('global_catid1');
      isHeader = false;
      continue;
    }

    totalLines++;
    const row = parseCSVLine(line);
    const cat = (idxCat1 !== -1 && row[idxCat1] ? row[idxCat1].trim() : '') || 'Sem Categoria';
    const catId = (idxCatId1 !== -1 && row[idxCatId1] ? row[idxCatId1].trim() : '');

    if (!categories[cat]) {
      categories[cat] = { name: cat, id: catId, count: 0 };
    }
    categories[cat].count++;
    if (!categories[cat].id && catId) categories[cat].id = catId;

    if (totalLines % 20000 === 0) {
      console.log(`Processados ${totalLines.toLocaleString('pt-BR')} produtos...`);
    }
  }

  console.log(`\n✅ Concluído! Total de produtos processados: ${totalLines.toLocaleString('pt-BR')}`);
  console.log(`Total de Categorias Encontradas no Catálogo de 100k+: ${Object.keys(categories).length}\n`);

  const sorted = Object.values(categories).sort((a, b) => b.count - a.count);
  const report = sorted.map((c, i) => ({
    pos: i + 1,
    name: c.name,
    id: c.id,
    count: c.count,
    pct: ((c.count / totalLines) * 100).toFixed(2) + '%'
  }));

  console.table(report);
}

run().catch(console.error);
