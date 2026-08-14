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

async function checkShopee() {
  console.log('Fetching feed headers...');
  const res = await fetch(FEED_OFICIAL_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const nodeStream = Readable.fromWeb(res.body);
  const rl = readline.createInterface({
    input: nodeStream,
    crlfDelay: Infinity
  });

  let headers = null;
  let linesRead = 0;
  let targetProduct = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCSVLine(line).map(h => h.trim());
      console.log('Headers (' + headers.length + '):', headers);
      continue;
    }

    linesRead++;
    const row = parseCSVLine(line);
    const rowObj = {};
    headers.forEach((h, i) => { rowObj[h] = row[i]; });

    // Check for target item id or keyword
    const itemid = rowObj.itemid || rowObj.item_id || '';
    const title = (rowObj.title || '').toLowerCase();

    if (itemid === '9998055754' || title.includes('redinha de coque')) {
      console.log('\n🎯 FOUND PRODUCT IN CSV:');
      console.log(JSON.stringify(rowObj, null, 2));
      targetProduct = rowObj;
      break;
    }

    if (linesRead >= 5000) {
      console.log('Checked 5000 lines, showing sample row:');
      console.log(JSON.stringify(rowObj, null, 2));
      break;
    }
  }

  rl.close();
}

checkShopee().catch(console.error);
