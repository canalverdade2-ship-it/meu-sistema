const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'admin', 'OrdensServicoModule.tsx');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}.`);
  source = source.replace(search, replacement);
}

function replaceRegexOnce(pattern, replacement, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = source.match(new RegExp(pattern.source, flags));
  if (!matches || matches.length !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${matches?.length || 0}.`);
  source = source.replace(pattern, replacement);
}

replaceOnce(
  "import { PainelRentabilidade } from './PainelRentabilidade';\n",
  "import { PainelRentabilidade } from './PainelRentabilidade';\nimport { SecureAttachmentButton } from '../ui/SecureAttachmentButton';\n",
  'Importar botão seguro',
);

replaceRegexOnce(
  /\{d\.arquivos_briefing\.map\(\(url: string, index: number\) => \(\s*<a[\s\S]*?href=\{url\}[\s\S]*?<Download[\s\S]*?Arquivo \{index \+ 1\}[\s\S]*?<\/a>\s*\)\)\}/,
  `{d.arquivos_briefing.map((url: string, index: number) => (
                              <SecureAttachmentButton
                                key={index}
                                reference={url}
                                fileName={\`Arquivo de briefing \${index + 1}\`}
                                className="bg-white text-indigo-700 hover:bg-indigo-100 ring-1 ring-indigo-200"
                              />
                            ))}`,
  'Briefings privados',
);

replaceRegexOnce(
  /\{os\.anexos_os\.map\(\(doc: any, index: number\) => \(\s*<a[\s\S]*?href=\{doc\.url\}[\s\S]*?<FileText[\s\S]*?\{doc\.nome\}[\s\S]*?<Download[\s\S]*?<\/a>\s*\)\)\}/,
  `{os.anexos_os.map((doc: any, index: number) => (
                    <SecureAttachmentButton
                      key={index}
                      reference={doc.url}
                      fileName={doc.nome}
                      mimeType={doc.mime_type}
                      className="bg-white text-indigo-700 hover:bg-indigo-100 ring-1 ring-indigo-200"
                    />
                  ))}`,
  'Anexos privados da OS',
);

fs.writeFileSync(file, source, 'utf8');
console.log('OrdensServicoModule atualizado para abertura segura de documentos.');
