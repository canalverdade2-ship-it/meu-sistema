const https = require('https');
const readline = require('readline');

const TARGET_URL = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h';

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

function testStream(url, maxItems) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return testStream(res.headers.location, maxItems).then(resolve).catch(reject);
      }
      
      const rl = readline.createInterface({
        input: res,
        crlfDelay: Infinity
      });

      let header = null;
      const items = [];

      rl.on('line', (line) => {
        if (!line.trim()) return;
        if (!header) {
          header = parseCSVLine(line.replace(/^\uFEFF/, ''));
          return;
        }

        const vals = parseCSVLine(line);
        const obj = {};
        header.forEach((h, idx) => {
          obj[h] = vals[idx] || '';
        });

        items.push({
          itemid: obj.itemid,
          title: obj.title,
          price: obj.sale_price || obj.price,
          image: obj.image_link
        });

        if (items.length >= maxItems) {
          rl.close();
          res.destroy();
          resolve(items);
        }
      });

      rl.on('close', () => {
        resolve(items);
      });

      res.on('error', (err) => {
        // Ignorar se foi abortado propositalmente
        if (items.length >= maxItems) {
          resolve(items);
        } else {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

testStream(TARGET_URL, 5)
  .then((items) => {
    console.log(`Sucesso! Lidos ${items.length} itens:`);
    console.log(JSON.stringify(items, null, 2));
  })
  .catch((err) => {
    console.error("Erro:", err);
  });