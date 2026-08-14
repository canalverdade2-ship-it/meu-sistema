const fs = require('fs');

const FEED_OFICIAL_URL = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h';

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && currentRow.some(f => f.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

async function run() {
  console.log(`Baixando Feed Oficial BR...`);
  const res = await fetch(FEED_OFICIAL_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log('Status:', res.status);
  console.log('Headers:', res.headers.get('content-disposition'), res.headers.get('content-length'));
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer);
  const rows = parseCSV(text);
  console.log('Total de linhas:', rows.length - 1);
  const headers = rows[0].map(h => h.trim());
  const idxCat1 = headers.indexOf('global_category1');
  const cat1Map = {};
  for (let i = 1; i < rows.length; i++) {
    const cat = rows[i][idxCat1] || 'Sem Categoria';
    cat1Map[cat] = (cat1Map[cat] || 0) + 1;
  }
  console.log('Categorias no Feed Oficial BR:');
  console.table(Object.entries(cat1Map).map(([cat, count]) => ({ Categoria: cat, Produtos: count })));
}

run().catch(console.error);
