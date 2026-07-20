import fs from 'fs';
const file = 'src/components/client/ClientGSAStore.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replaceAll('placeholder="CODIGO"', 'placeholder="CUPOM DESCONTO"');

fs.writeFileSync(file, content);
console.log('Replaced placeholder');
