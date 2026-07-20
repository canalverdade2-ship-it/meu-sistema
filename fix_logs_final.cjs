const fs = require('fs');
const files = [
  'src/components/admin/EmprestimosModule.tsx',
  'src/components/admin/OrcamentosModule.tsx',
  'src/components/admin/OrdensAssinaturaModule.tsx',
  'src/components/admin/OrdensCompraModule.tsx'
];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/await\s+logService\.logAction\s*\([\s\S]*?\);/g, "await logService.logAction({ acao: 'ACAO_SISTEMA', detalhes: JSON.stringify({}), ator_tipo: 'admin', ator_nome: 'Administrador' });");
  fs.writeFileSync(file, content);
});
