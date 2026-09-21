const { Readable } = require('stream');
const readline = require('readline');

const FEED_OFICIAL_URL = process.argv[3] || 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h';
const TARGET_ITEM = process.argv[2] || '9998055754';

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

async function findShopeeItem() {
  console.log(`Downloading and streaming CSV feed to locate item ${TARGET_ITEM}...`);
  const res = await fetch(FEED_OFICIAL_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  // Create stream parser
  const nodeStream = Readable.fromWeb(res.body);
  const rl = readline.createInterface({
    input: nodeStream,
    crlfDelay: Infinity
  });

  let headers = null;
  let lines = 0;
  let found = false;
  let pending = '';

  for await (const physicalLine of rl) {
    pending = pending ? `${pending}\n${physicalLine}` : physicalLine;
    const quoteCount = (pending.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) continue;
    const line = pending;
    pending = '';
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCSVLine(line).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
      continue;
    }
    lines++;
    if (line.includes(TARGET_ITEM)) {
      const row = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      console.log('🎯 ENCONTRADO NO CSV:');
      console.log(JSON.stringify(obj, null, 2));
      found = true;
      break;
    }
    if (lines % 20000 === 0) {
      console.log(`Lidas ${lines} linhas...`);
    }
  }

  if (!found) {
    console.log('Não encontrado no feed oficial. Checadas', lines, 'linhas.');
  }
  rl.close();
}

findShopeeItem().catch(console.error);
