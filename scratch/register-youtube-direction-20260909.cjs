const fs = require('fs');
const file = '/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';
const marker = 'youtube-source-user-direction-20260909-news-bible';
const prior = fs.readFileSync(file, 'utf8');
if (prior.includes(marker)) {
  console.log('Registro já existente; nenhuma duplicação.');
} else {
  const now = new Date();
  const backup = `${file}.bak-youtube-${now.toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  const entry = `\n## ${now.toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'})} BRT — Diretriz sobre vídeos do YouTube para News e Histórias da Bíblia\n\n- Pedido do usuário: terminar o GSA News e o GSA Histórias da Bíblia.\n- Autorização expressa recebida: “Pode usar todos os vídeos que você encontrar que esteja no YouTube”. Em seguida: “Registrar no changelog da vps”.\n- O YouTube passa a ser uma fonte de pesquisa autorizada pelo usuário para ambos os programas. Esta declaração registra a vontade do usuário, mas não comprova licença nem autorização dos titulares de cada vídeo. Antes da incorporação, verificar licença compatível, domínio público ou autorização do titular; créditos e remoção do áudio não substituem essa verificação.\n- Permanecem as exigências do News: pelo menos 90% de vídeo, clipes novos sem repetição e sem reutilizar vídeos já existentes na VPS; narração pelas vozes oficiais sobre as notícias, sem apresentadores animados e sem usar Flow.\n- Histórias da Bíblia: episódio O Filho Pródigo com diversidade de cenas narrativas coerentes com a história, sem substituir a narrativa por imagens estáticas ou clipes genéricos. O pedido anterior de introdução por Salomão permanece registrado; a dispensa de apresentadores animados foi expressa para as notícias.\n- Manter 1080p30, áudio externo removido e somente narração/trilhas/sons GSA TV; créditos de fonte no canto inferior esquerdo; identificação do programa/episódio no canto superior esquerdo durante o conteúdo; tag AO VIVO desligada. Preservar vinheta atual aprovada e a sequência de intervalo já solicitada.\n- Esta entrada não atesta download, licença aprovada, render concluído ou publicação dos novos masters. Não houve alteração na transmissão por este registro.\n- Identificador: ${marker}\n`;
  fs.appendFileSync(file, entry, 'utf8');
  const verified = fs.readFileSync(file, 'utf8');
  if (!verified.endsWith(entry)) throw new Error('Falha na verificação do registro');
  console.log(JSON.stringify({registered:true, file, backup, entry}, null, 2));
}
