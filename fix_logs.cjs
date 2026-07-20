const fs = require('fs');
const files = [
  'src/components/admin/prestadores/PrestadoresDemandas.tsx',
  'src/components/admin/OrdensServicoModule.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace logAction object versions that have wrong fields
  content = content.replace(/logService\.logAction\(\{\s*acao:\s*(.*?),\s*modulo:\s*(.*?),\s*detalhes:\s*(.*?),\s*tipo_usuario:\s*(.*?),\s*usuario_id:\s*(.*?),\s*usuario_nome:\s*(.*?)\s*\}\)/gs, (match, p1, p2, p3, p4, p5, p6) => {
    return `logService.logAction({
      acao: ${p1},
      detalhes: JSON.stringify(${p3}),
      ator_tipo: ${p4},
      ator_id: ${p5} === null ? undefined : ${p5},
      ator_nome: ${p6}
    })`;
  });

  // Replace logAction multiline args versions
  content = content.replace(/logService\.logAction\(\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*(.*?)\s*\)/gs, (match, p1, p2, p3, p4, p5, p6) => {
    // p1 = acao, p2 = modulo, p3 = detalhes, p4 = ator_tipo, p5 = ator_id, p6 = ator_nome
    return `logService.logAction({
      acao: ${p1},
      detalhes: typeof ${p3} === 'string' ? ${p3} : JSON.stringify(${p3}),
      ator_tipo: ${p4},
      ator_id: ${p5} === null ? undefined : ${p5},
      ator_nome: ${p6}
    })`;
  });
  
  fs.writeFileSync(file, content);
});
