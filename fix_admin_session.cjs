const fs = require('fs');

const files = [
  'EmprestimosModule.tsx', 
  'FinanceiroModule.tsx', 
  'LojaTrocasModule.tsx', 
  'CobrancaModule.tsx', 
  'CreditoModule.tsx', 
  'prestadores/PrestadoresFinanceiro.tsx',
  'IndicacoesModule.tsx',
  'PainelRentabilidade.tsx',
  'ExtratoMasterModule.tsx'
];

files.forEach(f => {
  const p = 'src/components/admin/' + f;
  if(fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    
    const regex = /  const getAdminSessionForRpc = \(\) => \{\s+const session = sessionService\.getCurrentSession\(\);\s+if \(\!session\?\.sessaoId \|\| \!session\?\.sessionToken\) \{\s+throw new Error\('Sessao administrativa expirada\. Faca login novamente\.'\);\s+\}\s+return session;\s+\};\s+/m;
    
    if (regex.test(c)) {
      // Remove it from inside the function
      c = c.replace(regex, '');
      
      const globalFn = `const getAdminSessionForRpc = () => {
  const session = sessionService.getCurrentSession();
  if (!session?.sessaoId || !session?.sessionToken) {
    throw new Error('Sessao administrativa expirada. Faca login novamente.');
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
