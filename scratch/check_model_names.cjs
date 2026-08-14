const { Readable } = require('stream');

const FEED_OFICIAL_URL = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h';

async function checkModelNames() {
  console.log('Downloading CSV sample...');
  const res = await fetch(FEED_OFICIAL_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  // Read first 2MB to parse proper CSV
  const reader = res.body.getReader();
  let buffer = '';
  let bytesRead = 0;
  const maxBytes = 3 * 1024 * 1024; // 3MB

  while (bytesRead < maxBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += new TextDecoder('utf-8').decode(value, { stream: true });
    bytesRead += value.length;
  }
  await reader.cancel();

  console.log('Parsing CSV (' + (bytesRead/1024).toFixed(1) + ' KB)...');

  function parseCSVFull(text, maxRows) {
    const cleanText = text.replace(/^[\uFEFF\xFF\xFE]/, '');
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const ch = cleanText[i];
      const nextCh = cleanText[i + 1];
      if (ch === '"') {
        if (inQuotes && nextCh === '"') { currentField += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
        if (ch === '\r' && nextCh === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
          if (maxRows && rows.length >= maxRows) break;
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
    return rows;
  }

  const rows = parseCSVFull(buffer, 300);
  console.log('Parsed rows:', rows.length);
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  console.log('Clean Headers:', headers);

  const modelNamesIdx = headers.indexOf('model_names');
  const modelIdsIdx = headers.indexOf('model_ids');
  const titleIdx = headers.indexOf('title');
  const itemidIdx = headers.indexOf('itemid');

  console.log({ modelNamesIdx, modelIdsIdx, titleIdx, itemidIdx });

  let foundWithModels = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const itemid = row[itemidIdx];
    const title = row[titleIdx];
    const modelNames = row[modelNamesIdx];
    const modelIds = row[modelIdsIdx];

    if (modelNames && modelNames.length > 0) {
      foundWithModels++;
      console.log(`\n--- PRODUTO COM VARIAÇÃO #${foundWithModels} ---`);
      console.log('ID:', itemid);
      console.log('Título:', title);
      console.log('model_names:', modelNames);
      console.log('model_ids:', modelIds);
      if (foundWithModels >= 5) break;
    }
  }

  if (foundWithModels === 0) {
    console.log('Nenhum produto com model_names preenchido nas primeiras 300 linhas.');
  }
}

checkModelNames().catch(console.error);
