const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'ClientesModule.tsx');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: esperado 1 trecho, encontrado ${count}.`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
  "import { callAdminRpc } from '../../lib/adminRpc';\n",
  "import { callAdminRpc } from '../../lib/adminRpc';\nimport { removePrivateDocument } from '../../lib/privateStorage';\n",
  'Importar limpeza privada',
);

replaceOnce(
  `        for (const url of urls) {\n          try {\n            if (!url.startsWith('http')) {\n              await supabase.storage.from(bucket).remove([url]);\n              continue;\n            }`,
  `        for (const url of urls) {\n          try {\n            if (typeof url !== 'string' || !url.trim()) continue;\n            if (url.startsWith('gsa-private://')) {\n              await removePrivateDocument(url);\n              continue;\n            }\n            if (!url.startsWith('http')) {\n              await supabase.storage.from(bucket).remove([url]);\n              continue;\n            }`,
  'Remover anexos privados ao excluir cliente',
);

fs.writeFileSync(file, source, 'utf8');
console.log('ClientesModule atualizado para limpar documentos privados.');
