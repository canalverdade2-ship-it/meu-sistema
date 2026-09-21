const fs = require('fs');
const file = '/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';
const marker = 'outside-youtube-supersedes-youtube-20260909';
const prior = fs.readFileSync(file, 'utf8');
if (prior.includes(marker)) {
  console.log('Registro já existente.');
} else {
  const now = new Date();
  const backup = `${file}.bak-outside-youtube-${now.toISOString().replace(/[:.]/g,'-')}`;
  fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  const entry = `\n## ${now.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} BRT — Correção da orientação de fontes: fora do YouTube\n\n- Orientação mais recente do usuário: “Pode usar todos os vídeos que você encontrar que não esteja no YouTube”.\n- Para a seleção de fontes do GSA News e GSA Histórias da Bíblia, esta orientação substitui a imediatamente anterior sobre usar vídeos no YouTube. Buscar vídeos fora do YouTube. Preservar a entrada anterior como histórico, não como orientação vigente.\n- A autorização do usuário para a seleção não comprova direitos de terceiros: verificar licença compatível, domínio público ou autorização do titular antes de incorporar cada vídeo. Estar fora do YouTube não comprova liberdade de reutilização.\n- Demais requisitos permanecem: 1080p30, News com no mínimo 90% de vídeos novos sem repetição nem reutilização do acervo existente da VPS, cenas bíblicas narrativas pertinentes a O Filho Pródigo, créditos inferiores à esquerda e remoção do áudio original em favor de áudio GSA TV. Sem Flow para o News; manter vinheta aprovada.\n- Registro de diretriz apenas: não atesta novos downloads, renderizações ou publicação.\n- Identificador: ${marker}\n`;
  fs.appendFileSync(file, entry, 'utf8');
  if (!fs.readFileSync(file,'utf8').endsWith(entry)) throw new Error('Verificação falhou');
  console.log(JSON.stringify({registered:true,file,backup,entry},null,2));
}
