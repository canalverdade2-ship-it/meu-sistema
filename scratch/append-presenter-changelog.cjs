const fs = require('fs');
const target = '/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';
const source = '/home/opc/changelog-bible-presenter-20260909.md';
const marker = 'gsa-biblia-presenter-intro-required-20260909-v1';
const before = fs.readFileSync(target, 'utf8');
if (!before.includes(marker)) {
  fs.copyFileSync(target, target + '.before-presenter-note-' + Date.now());
  fs.appendFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
}
if (!fs.readFileSync(target, 'utf8').includes(marker)) throw new Error('Registro não confirmado');
console.log('CONFIRMADO: exigência do apresentador em cena registrada no changelog da VPS.');
