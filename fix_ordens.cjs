const fs = require('fs');

function fixFile(file, blocks) {
  let lines = fs.readFileSync(file, 'utf8').split('\n');
  
  // Apply from bottom to top so line numbers don't shift!
  blocks.sort((a, b) => b.start - a.start).forEach(block => {
    lines.splice(block.start - 1, block.end - block.start + 1, ...block.replacement.split('\n'));
  });

  fs.writeFileSync(file, lines.join('\n'));
}

const ordensBlocks = [
  {
    start: 193, end: 201,
    replacement: `      await logService.logAction({
        acao: 'CANCELAR_OS',
        detalhes: JSON.stringify({ os_id: osToCancel, codigo: os?.codigo_os, motivo: cancelReason }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 387, end: 395,
    replacement: `        await logService.logAction({
          acao: 'ADICIONAR_NOTA_OS',
          detalhes: JSON.stringify({ os_id: os.id, codigo: os.codigo_os, nota: novaNota }),
          ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
          ator_nome: colaboradorNome || 'Administrador'
        });`
  },
  {
    start: 414, end: 422,
    replacement: `      await logService.logAction({
        acao: 'EXCLUIR_NOTA_OS',
        detalhes: JSON.stringify({ os_id: os.id, codigo: os.codigo_os, nota_id: id }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 469, end: 477,
    replacement: `      await logService.logAction({
        acao: 'SOLICITAR_DOCS_OS',
        detalhes: JSON.stringify({ os_id: os.id, codigo: os.codigo_os, documentos: finalDocs }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  }
];

fixFile('src/components/admin/OrdensServicoModule.tsx', ordensBlocks);
console.log('Fixed OrdensServicoModule.tsx');
