const fs = require('fs');
const file = 'src/components/admin/ProtectionAdminModule.tsx';
let s = fs.readFileSync(file, 'utf8');
const replacements = new Map([
  ['GSA Sa�de', 'GSA Saúde'], ['Contrata��es', 'Contratações'], ['contrata��es', 'contratações'],
  ['Ap�lices', 'Apólices'], ['Vis�o geral', 'Visão geral'], ['Cota��es', 'Cotações'], ['cota��o', 'cotação'],
  ['Comiss�es', 'Comissões'], ['Comiss�o', 'Comissão'], ['Assist�ncias', 'Assistências'],
  ['Solicita��es', 'Solicitações'], ['cat�logo', 'catálogo'], ['N�o', 'Não'], ['poss�vel', 'possível'],
  ['descri��o', 'descrição'], ['P�gina', 'Página'], ['p�gina', 'página'], ['Observa��es', 'Observações'],
  ['T�tulo', 'Título'], ['Pr�mio', 'Prêmio'], [' � ', ' · '],
]);
for (const [from, to] of replacements) s = s.split(from).join(to);
fs.writeFileSync(file, s, 'utf8');
const leftovers = s.split(/\r?\n/).map((line, i) => [i + 1, line]).filter(([, line]) => line.includes('�'));
console.log(JSON.stringify({ repaired: leftovers.length === 0, leftovers }, null, 2));
if (leftovers.length) process.exitCode = 2;
