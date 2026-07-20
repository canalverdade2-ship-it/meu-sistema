const fs = require('fs');
const path = require('path');

const filesToScan = [
  'src/components/client/StoreHub.tsx',
  'src/components/client/ClientGSAStore.tsx'
];

const results = {};

function scanFile(filePath) {
  const fullPath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  
  const matches = [];
  const searchTerms = ['carrinho', 'pedido', 'cart', 'finaliz', 'checkout', 'comprar', 'pagamento', 'payment', 'fatura'];
  
  lines.forEach((line, i) => {
    // Only capture lines that look like function declarations or important state
    if (line.match(/(const|function).*(=|\().*=>|async function/)) {
      if (searchTerms.some(term => line.toLowerCase().includes(term))) {
        matches.push({ line: i + 1, text: line.trim() });
      }
    }
  });
  
  results[filePath] = matches;
}

filesToScan.forEach(scanFile);

fs.writeFileSync('audit_shopping_flow_results.json', JSON.stringify(results, null, 2));
console.log('Done scanning.');
