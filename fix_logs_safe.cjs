const fs = require('fs');

function fixLogs(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let newLines = [];
  let i = 0;
  let changes = 0;
  
  while (i < lines.length) {
    if (lines[i].includes('await logService.logAction(') && !lines[i].includes('{')) {
      let j = i;
      let block = '';
      while (j < lines.length && !lines[j].includes(');')) {
        block += lines[j] + '\n';
        j++;
      }
      block += lines[j];
      
      const regex = /logService\.logAction\(\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?)\s*\);/s;
      const match = block.match(regex);
      
      if (match) {
        let p1 = match[1];
        let p2 = match[2];
        let p3 = match[3];
        let p4 = match[4];
        let p5 = match[5];
        let p6 = match[6];
        
        let detalhesObj = p3.startsWith('{') ? p3 : `{ detalhe: ${p3} }`;
        
        let replacement = lines[i].split('await')[0] + `await logService.logAction({
          acao: ${p1},
          detalhes: typeof ${p3} === 'string' ? ${p3} : JSON.stringify(${p3}),
          ator_tipo: ${p4},
          ator_id: ${p5} === null ? undefined : ${p5},
          ator_nome: ${p6}
        });`;
        
        newLines.push(...replacement.split('\n'));
        changes++;
        i = j + 1;
        continue;
      }
    }
    
    newLines.push(lines[i]);
    i++;
  }
  
  if (changes > 0) {
    fs.writeFileSync(file, newLines.join('\n'));
    console.log(`Fixed ${changes} in ${file}`);
  }
}

const files = [
  'src/components/admin/EmprestimosModule.tsx',
  'src/components/admin/OrcamentosModule.tsx',
  'src/components/admin/OrdensAssinaturaModule.tsx',
  'src/components/admin/OrdensCompraModule.tsx'
];

files.forEach(fixLogs);
