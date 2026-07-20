const fs = require('fs');
const file = 'src/components/client/ClientOrcamentos.tsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

// 1) Delete lines 106 to 147 inclusive
// In 0-indexed, this is indices 105 to 146.
lines.splice(105, 147 - 106 + 1);

// Because we deleted 42 lines (147-106+1), the old line 217 is now 217 - 42 = 175.
// Old line 290 is now 290 - 42 = 248.
// We need to delete old lines 217 to 290 inclusive.
// So we delete from index 174, count = 290 - 217 + 1 = 74.
lines.splice(174, 74);

fs.writeFileSync(file, lines.join('\n'));
console.log('Fixed duplications.');
