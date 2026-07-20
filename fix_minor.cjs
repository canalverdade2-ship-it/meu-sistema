const fs = require('fs');

// DemandasDetalhesModal - CheckCircle
let f1 = 'src/components/admin/demandas/DemandasDetalhesModal.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
if (!c1.includes('CheckCircle')) {
  c1 = c1.replace(/import\s*\{\s*X/, 'import { X, CheckCircle');
  fs.writeFileSync(f1, c1);
}

// DemandasKanban / DemandasTabela - highlightedId
let f2 = 'src/components/admin/demandas/DemandasKanban.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(/highlightedId\s*===/g, 'false ===');
fs.writeFileSync(f2, c2);

let f3 = 'src/components/admin/demandas/DemandasTabela.tsx';
let c3 = fs.readFileSync(f3, 'utf8');
c3 = c3.replace(/highlightedId\s*===/g, 'false ===');
fs.writeFileSync(f3, c3);

console.log('Fixed imports and missing vars');
