const fs = require('fs');
const files = [
  'src/components/client/StoreHub.tsx',
  'src/components/client/ClientGSAStore.tsx',
  'src/components/client/ClientProdutos.tsx'
];
const terms = ['troca', 'exchange', 'devolver', 'devolucao'];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (terms.some(t => l.toLowerCase().includes(t))) {
        console.log(`[${f}:${i+1}] ${l.trim()}`);
      }
    });
  }
});
