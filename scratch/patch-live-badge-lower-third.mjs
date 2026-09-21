import fs from 'node:fs';

const target = process.argv[2];
if (!target) throw new Error('Arquivo alvo não informado.');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('nome administrativo vire também uma tarja genérica')) {
  process.stdout.write('already-patched\n');
  process.exit(0);
}
const guard = `    // Renderizado pelo caminho dedicado do selo no encoder. Impedir que o\n    // nome administrativo vire também uma tarja genérica no rodapé.\n    if (layer.layer_type === "lower_third" && layer.config?.preset === "live_badge") {\n      continue;\n    }\n`;
const needleA = '  for (const layer of layers) {\n    const next = () => `v${++label}`;\n';
const needleB = '  for (const layer of layers) {\n    if (\n';
if (source.includes(needleA)) source = source.replace(needleA, `${needleA}${guard}`);
else if (source.includes(needleB)) source = source.replace(needleB, `  for (const layer of layers) {\n${guard}    if (\n`);
else throw new Error('Ponto de inserção não encontrado.');
fs.writeFileSync(target, source);
process.stdout.write('patched\n');
