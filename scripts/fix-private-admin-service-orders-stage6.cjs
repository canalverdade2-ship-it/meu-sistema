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
  "import { PainelRentabilidade } from './PainelRentabilidade';\nimport { useFileViewer } from '../../contexts/FileViewerContext';\n",
  'Importar visualizador seguro',
);

replaceOnce(
  `export function OSDetails({ os, onCancel, colaboradorNome }: { os: OS, onCancel: () => void, colaboradorNome?: string }) {
  const [notas, setNotas] = useState<any[]>([]);`,
  `export function OSDetails({ os, onCancel, colaboradorNome }: { os: OS, onCancel: () => void, colaboradorNome?: string }) {
  const { openFile } = useFileViewer();
  const [notas, setNotas] = useState<any[]>([]);`,
  'Inicializar visualizador seguro',
);

replaceOnce(
  'href={url}',
  `href={url.startsWith('gsa-private://') ? '#' : url}
                                 onClick={(event) => {
                                   if (url.startsWith('gsa-private://')) {
                                     event.preventDefault();
                                     void openFile(url, \`Anexo de briefing \${idx + 1}\`);
                                   }
                                 }}`,
  'Interceptar briefing privado',
);

replaceOnce(
  'href={doc.url}',
  `href={doc.url.startsWith('gsa-private://') ? '#' : doc.url}
                               onClick={(event) => {
                                 if (doc.url.startsWith('gsa-private://')) {
                                   event.preventDefault();
                                   void openFile(doc.url, doc.nome);
                                 }
                               }}`,
  'Interceptar anexo privado da OS',
);

fs.writeFileSync(file, source, 'utf8');
console.log('OrdensServicoModule atualizado para abertura segura de documentos.');
