import fs from 'fs';
const file = 'src/components/public/GSAEnterpriseHome.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('Conhe\uFFFDa nosso cat\uFFFDlogo de servi\uFFFDos exclusivos', 'Conheça nosso catálogo de serviços exclusivos');
content = content.replace('Cria\uFFFD\uFFFDo de Sites e Sistemas', 'Criação de Sites e Sistemas');
content = content.replace('automacoes.', 'automações.');
content = content.replace('\uFFFD {new Date().getFullYear()} GSA Enterprise Hub', '© {new Date().getFullYear()} GSA Enterprise Hub');

fs.writeFileSync(file, content);
console.log('Fixed characters successfully');
