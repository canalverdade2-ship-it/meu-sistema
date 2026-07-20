const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'OrdensServicoModule.tsx');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}.`);
  source = source.replace(search, replacement);
}

replaceOnce(
  "import { PainelRentabilidade } from './PainelRentabilidade';\n",
  "import { PainelRentabilidade } from './PainelRentabilidade';\nimport { SecureAttachmentButton } from '../ui/SecureAttachmentButton';\n",
  'Importar botão seguro',
);

replaceOnce(
  `                               <a
                                 href={url}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="p-2 rounded-lg bg-white text-amber-600 hover:bg-amber-50 ring-1 ring-inset ring-neutral-200/50 transition-colors"
                                 title="Visualizar"
                               >
                                 <Download className="h-4 w-4" />
                               </a>`,
  `                               <SecureAttachmentButton
                                 reference={url}
                                 fileName={\`Anexo de briefing \${idx + 1}\`}
                                 compact
                                 className="bg-white text-amber-600 hover:bg-amber-50 ring-1 ring-inset ring-neutral-200/50"
                               />`,
  'Link do briefing privado',
);

replaceOnce(
  `                             <a
                               href={doc.url}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="p-2 rounded-lg bg-white text-indigo-600 hover:bg-indigo-50 ring-1 ring-inset ring-neutral-200/50 transition-colors"
                               title="Baixar Documento"
                             >
                               <Download className="h-4 w-4" />
                             </a>`,
  `                             <SecureAttachmentButton
                               reference={doc.url}
                               fileName={doc.nome}
                               mimeType={doc.mime_type}
                               compact
                               className="bg-white text-indigo-600 hover:bg-indigo-50 ring-1 ring-inset ring-neutral-200/50"
                             />`,
  'Link do anexo privado da OS',
);

fs.writeFileSync(file, source, 'utf8');
console.log('OrdensServicoModule atualizado para abertura segura de documentos.');
