const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const clientDir = path.resolve('src/components/client');
const clientPortal = path.resolve('src/pages/ClientPortal.tsx');

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const allClientFiles = getAllFiles(clientDir).concat([clientPortal]);

console.log('Auditing component prop signatures across', allClientFiles.length, 'files...');

// Identify exported components and their required prop names
const componentSpecs = new Map();

for (const file of allClientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  ts.forEachChild(source, node => {
    // Find interface Props / type Props
    let propsInterface = null;
    if (ts.isInterfaceDeclaration(node) && (node.name.text.endsWith('Props') || node.name.text === 'Props')) {
      const requiredProps = [];
      const optionalProps = [];
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
          if (member.questionToken) {
            optionalProps.push(member.name.text);
          } else {
            requiredProps.push(member.name.text);
          }
        }
      }
      // Store
      componentSpecs.set(node.name.text, { file, requiredProps, optionalProps });
    }
  });
}

console.log('Discovered', componentSpecs.size, 'component prop interfaces');

// Now let's check invocations for matching components
const missingPropsReport = [];

for (const file of allClientFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function checkJsx(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag)) {
        const componentName = tag.text;
        const expectedPropsName = componentName + 'Props';
        const spec = componentSpecs.get(expectedPropsName) || componentSpecs.get(componentName);
        if (spec && spec.requiredProps.length > 0) {
          // Collect provided prop names
          const providedProps = new Set();
          for (const attr of node.attributes.properties) {
            if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name)) {
              providedProps.add(attr.name.text);
            } else if (ts.isJsxSpreadAttribute(attr)) {
              // Spread attribute covers props dynamically
              providedProps.add('*spread*');
            }
          }
          if (!providedProps.has('*spread*')) {
            const missing = spec.requiredProps.filter(p => !providedProps.has(p));
            if (missing.length > 0) {
              const pos = source.getLineAndCharacterOfPosition(node.getStart());
              missingPropsReport.push({
                invokingFile: path.relative('.', file),
                line: pos.line + 1,
                component: componentName,
                missingProps: missing
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, checkJsx);
  }

  checkJsx(source);
}

console.log('Missing required props report:', missingPropsReport.length);
if (missingPropsReport.length > 0) {
  console.dir(missingPropsReport, { depth: 4 });
  process.exit(1);
} else {
  console.log('>>> All JSX component invocations provide required props! <<<');
  process.exit(0);
}
