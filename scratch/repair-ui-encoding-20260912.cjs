const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const backup = path.join(root, 'scratch', 'encoding-backup-20260912');
const replacements = new Map([
  ['An�ncios', 'Anúncios'], ['Transa��es', 'Transações'], ['T�tulo', 'Título'],
  ['Descri��o', 'Descrição'], ['descri��o', 'descrição'], ['Pre�o', 'Preço'],
  ['an�ncio', 'anúncio'], ['An�ncio', 'Anúncio'], ['�rea', 'Área'],
  ['C�mbio', 'Câmbio'], ['Combust�vel', 'Combustível'], ['Condi��o', 'Condição'],
  ['N�o', 'Não'], ['n�o', 'não'], ['m�dias', 'mídias'], ['poss�vel', 'possível'],
  ['Modera��o', 'Moderação'], ['modera��o', 'moderação'], ['Gest�o', 'Gestão'],
  ['An�lise', 'Análise'], ['hist�rico', 'histórico'], ['conte�do', 'conteúdo'],
  ['Transa��o', 'Transação'], ['Comiss�o', 'Comissão'], ['P�gina', 'Página'],
  ['Localiza��o', 'Localização'], ['Espec�ficos', 'Específicos'], [' � ', ' · '],
]);
const emojis = ['🏪', '📦', '🚚', '🔒', '🔴', '🔄', '💰', '🎉', '👉', '🎟️', '💬', '💸', '📁'];
const decoder = new TextDecoder('windows-1252');
const emojiReplacements = emojis.flatMap(emoji => [
  [decoder.decode(Buffer.from(emoji, 'utf8')), emoji],
  [Buffer.from(emoji, 'utf8').toString('latin1'), emoji],
]);
const changed = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'tests') walk(file); continue; }
    if (!/\.(tsx?|css)$/.test(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    let after = before;
    if (path.relative(root, file).replaceAll('\\', '/') === 'src/components/admin/ClassifiedsModule.tsx') {
      for (const [from, to] of replacements) after = after.split(from).join(to);
    }
    for (const [from, to] of emojiReplacements) after = after.split(from).join(to);
    if (after === before) continue;
    const relative = path.relative(root, file);
    const target = path.join(backup, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, before, { flag: 'wx' });
    fs.writeFileSync(file, after, 'utf8');
    changed.push(relative);
  }
}
walk(path.join(root, 'src'));
console.log(JSON.stringify({ backup, changed }, null, 2));
