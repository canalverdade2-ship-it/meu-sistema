const fs = require('fs');
const target = '/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';
const source = '/home/opc/changelog-consolidado-20260909.md';
const marker = 'gsa-biblia-tags-stability-rebuild-20260909-v1';
const old = fs.readFileSync(target, 'utf8');
if (!old.includes(marker)) {
  fs.copyFileSync(target, target + '.before-consolidation-20260909-' + Date.now());
  fs.appendFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
}
const saved = fs.readFileSync(target, 'utf8');
if (!saved.includes(marker) || !saved.includes('REJEITADA editorialmente')) throw new Error('Registro incompleto');
console.log('CONFIRMADO: consolidação e rejeição editorial registradas.');
console.log(target);
