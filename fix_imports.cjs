const fs = require('fs');
['src/components/admin/FiscalModule.tsx', 'src/components/admin/IndicacoesModule.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('import React')) {
    content = "import React from 'react';\n" + content;
    fs.writeFileSync(file, content);
  }
});
