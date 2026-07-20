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
  `                           {d.arquivos_briefing.map((url: string, idx: number) => (
                             <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 ring-1 ring-inset ring-neutral-200/50">
                               <div className="flex items-center gap-2 truncate pr-2">
                                 <FileText className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                 <span className="text-xs font-bold text-neutral-700 truncate">Anexo {idx + 1}</span>
                               </div>
                               <a
                                 href={url}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="p-2 rounded-lg bg-white text-amber-600 hover:bg-amber-50 ring-1 ring-inset ring-neutral-200/50 transition-colors"
                                 title="Visualizar"
                               >
                                 <Download className="h-4 w-4" />
                               </a>
                             </div>
                           ))}`,
  `                           {d.arquivos_briefing.map((url: string, idx: number) => (
                             <SecureAttachmentButton
                               key={idx}
                               reference={url}
                               fileName={\`Anexo de briefing \${idx + 1}\`}
                               className="bg-neutral-50 text-amber-700 hover:bg-amber-50 ring-1 ring-inset ring-neutral-200/50"
                             />
                           ))}`,
  'Briefings privados',
);

replaceOnce(
  `                         {os.anexos_os.map((doc: any, idx: number) => (
                           <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 ring-1 ring-inset ring-neutral-200/50">
                             <div className="flex items-center gap-2 truncate pr-2">
                               <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                               <span className="text-xs font-bold text-neutral-700 truncate">{doc.nome}</span>
                             </div>
                             <a
                               href={doc.url}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="p-2 rounded-lg bg-white text-indigo-600 hover:bg-indigo-50 ring-1 ring-inset ring-neutral-200/50 transition-colors"
                               title="Baixar Documento"
                             >
                               <Download className="h-4 w-4" />
                             </a>
                           </div>
                         ))}`,
  `                         {os.anexos_os.map((doc: any, idx: number) => (
                           <SecureAttachmentButton
                             key={idx}
                             reference={doc.url}
                             fileName={doc.nome}
                             mimeType={doc.mime_type}
                             className="bg-neutral-50 text-indigo-700 hover:bg-indigo-50 ring-1 ring-inset ring-neutral-200/50"
                           />
                         ))}`,
  'Anexos privados da OS',
);

fs.writeFileSync(file, source, 'utf8');
console.log('OrdensServicoModule atualizado para abertura segura de documentos.');
