const fs = require('fs');

function fixFile(file, blocks) {
  let lines = fs.readFileSync(file, 'utf8').split('\n');
  
  // Apply from bottom to top so line numbers don't shift!
  blocks.sort((a, b) => b.start - a.start).forEach(block => {
    lines.splice(block.start - 1, block.end - block.start + 1, ...block.replacement.split('\n'));
  });

  fs.writeFileSync(file, lines.join('\n'));
}

const prestadoresBlocks = [
  {
    start: 391, end: 400,
    replacement: `      await logService.logAction({
        acao: 'CRIAR_DEMANDA_PRESTADOR',
        detalhes: JSON.stringify({ demanda_id: demanda.id, titulo: novaDemandaTitulo, os_id: novaDemandaOsId || null }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 489, end: 496,
    replacement: `      await logService.logAction({
        acao: isGestaoInterna ? 'DIRECIONAR_DEMANDA_GESTAO_INTERNA' : 'DIRECIONAR_DEMANDA_PRESTADOR',
        detalhes: JSON.stringify({ demanda_id: selectedDemanda.id, titulo: selectedDemanda.titulo, prestador: destNome }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 547, end: 554,
    replacement: `      await logService.logAction({
        acao: 'ENVIAR_CONTRAPROPOSTA_DEMANDA',
        detalhes: JSON.stringify({ demanda_id: selectedDemanda.id, valor: parseFloat(counterValue), motivo: counterReason }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 610, end: 616,
    replacement: `      await logService.logAction({
        acao: 'ACEITAR_CONTRAPROPOSTA_DEMANDA',
        detalhes: JSON.stringify({ demanda_id: demanda.id, valor_final: demanda.valor_proposto_prestador }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 752, end: 759,
    replacement: `      await logService.logAction({
        acao: 'FINALIZAR_DEMANDA_PRESTADOR',
        detalhes: JSON.stringify({ demanda_id: demanda.id, os_id: demanda.os_id, prestador_id: demanda.prestador_id }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 883, end: 890,
    replacement: `      await logService.logAction({
        acao: 'ENTREGAR_DEMANDA_MANUAL',
        detalhes: JSON.stringify({ demanda_id: selectedDemanda.id, os_id: selectedDemanda.os_id, link: manualLinkResultado || null }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 978, end: 985,
    replacement: `      await logService.logAction({
        acao: 'TRANSFERIR_DEMANDA_PRESTADOR',
        detalhes: JSON.stringify({ demanda_id: selectedDemanda.id, novo_alvo: transferTarget, motivo: transferReason }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 1048, end: 1055,
    replacement: `      await logService.logAction({
        acao: 'CANCELAR_DEMANDA_PRESTADOR',
        detalhes: JSON.stringify({ demanda_id: demanda.id, os_id: demanda.os_id }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 1128, end: 1135,
    replacement: `      await logService.logAction({
        acao: 'CANCELAR_DEMANDA_PRESTADOR_MOTIVO',
        detalhes: JSON.stringify({ demanda_id: selectedDemanda.id, os_id: selectedDemanda.os_id, motivo: cancelReason }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 1187, end: 1196,
    replacement: `      await logService.logAction({
        acao: 'EXCLUIR_DEMANDA_PRESTADOR_CASCADE',
        detalhes: JSON.stringify({ demanda_id: demanda.id, os_id: demanda.os_id }),
        ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
        ator_nome: colaboradorNome || 'Administrador'
      });`
  },
  {
    start: 2359, end: 2368,
    replacement: `              await logService.logAction({
                acao: 'SOLICITAR_AJUSTE_DEMANDA',
                detalhes: JSON.stringify({ motivo: ajusteDescricao, prazo: ajustePrazo }),
                ator_tipo: colaboradorNome ? 'colaborador' : 'admin',
                ator_nome: colaboradorNome || 'Administrador'
              });`
  }
];

fixFile('src/components/admin/prestadores/PrestadoresDemandas.tsx', prestadoresBlocks);
console.log('Fixed PrestadoresDemandas.tsx');
