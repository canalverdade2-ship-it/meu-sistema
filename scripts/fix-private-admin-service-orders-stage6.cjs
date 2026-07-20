const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'OrdensServicoModule.tsx');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}.`);
  source = source.replace(search, replacement);
}

function replaceSection(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`${label}: marcadores nao encontrados.`);
  }
  source = source.slice(0, start) + replacement + source.slice(end + endMarker.length);
}

replaceOnce(
  "import { PainelRentabilidade } from './PainelRentabilidade';\n",
  "import { PainelRentabilidade } from './PainelRentabilidade';\nimport { SecureAttachmentButton } from '../ui/SecureAttachmentButton';\n",
  'Importar botão seguro',
);

replaceSection(
  '                           {d.arquivos_briefing.map((url: string, idx: number) => (',
  '                           ))}',
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

replaceSection(
  '                         {os.anexos_os.map((doc: any, idx: number) => (',
  '                         ))}',
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
