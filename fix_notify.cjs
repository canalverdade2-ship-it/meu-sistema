const fs = require('fs');
let c = fs.readFileSync('src/components/admin/EmprestimosModule.tsx', 'utf8');
c = c.replace(/notifyClient\(([^,]+),\s*([^,]+),\s*([^,]+),\s*'(financeiro|emprestimos)'\)/g, "notifyClient($1, $2, $3, '$4', 'sistema')");
fs.writeFileSync('src/components/admin/EmprestimosModule.tsx', c);
