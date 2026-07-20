const fs = require('fs');

const files = [
  'FinanceiroModule.tsx', 
  'CobrancaModule.tsx'
];

files.forEach(f => {
  const p = 'src/components/admin/' + f;
  if(fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    
    // Use a more permissive regex that allows for accents or different spacing
    const regex = /  const getAdminSessionForRpc = \(\) => \{\s+const session = sessionService\.getCurrentSession\(\);\s+if \(\!session\?\.sessaoId \|\| \!session\?\.sessionToken\) \{\s+throw new Error\([^)]+\);\s+\}\s+return session;\s+\};\s+/m;
    
    if (regex.test(c)) {
      // Remove it from inside the function
      c = c.replace(regex, '');
      
      const globalFn = `const getAdminSessionForRpc = () => {
  const session = sessionService.getCurrentSession();
  if (!session?.sessaoId || !session?.sessionToken) {
    throw new Error('Sessão administrativa expirada. Faça login novamente.');
  }
  return session;
};

`;
      const exportIndex = c.indexOf('export function ');
      if (exportIndex !== -1) {
        c = c.substring(0, exportIndex) + globalFn + c.substring(exportIndex);
        fs.writeFileSync(p, c);
        console.log(f + ': fixed');
      } else {
         console.log(f + ': no export function found');
      }
    } else {
      console.log(f + ': function not found inside');
    }
  }
});
