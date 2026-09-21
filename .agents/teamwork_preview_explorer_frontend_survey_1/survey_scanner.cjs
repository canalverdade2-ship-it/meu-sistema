const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const file of fs.readdirSync(dir)) {
    const p = path.join(dir, file);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      results = results.concat(walk(p));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(p);
    }
  }
  return results;
}

const rootDir = process.cwd();
const allSrcFiles = walk(path.resolve('src'));

console.log('=== FULL SRC AUDIT SCAN ===');
console.log('Total TypeScript/TSX files found in src:', allSrcFiles.length);

const issues = [];

allSrcFiles.forEach(file => {
  const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
  const isClientFile = relPath.startsWith('src/components/client/') || 
                       relPath === 'src/pages/ClientPortal.tsx' || 
                       relPath === 'src/pages/ClientLoginPage.tsx';
  
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 1. Corrupted inputMode pattern
    if (/=\s*inputMode/i.test(line)) {
      issues.push({ 
        scope: isClientFile ? 'CLIENT' : 'OTHER',
        file: relPath, 
        line: lineNum, 
        type: 'CORRUPTED_INPUTMODE', 
        snippet: line.trim() 
      });
    }

    // 2. Broken arrow function / assignment in attributes
    if (/onChange\s*=\s*\{[^\}]*=\s*inputMode/i.test(line)) {
      issues.push({ 
        scope: isClientFile ? 'CLIENT' : 'OTHER',
        file: relPath, 
        line: lineNum, 
        type: 'CORRUPTED_ONCHANGE_INPUTMODE', 
        snippet: line.trim() 
      });
    }

    // 3. Broken JSX tag concatenation
    if (/<[a-zA-Z0-9]+[a-zA-Z0-9_-]+=(?:\"|\{)/.test(line)) {
      const match = line.match(/<([a-zA-Z0-9]+)([a-zA-Z0-9_-]+)=/);
      if (match && ['div', 'span', 'button', 'input', 'img', 'p', 'h1', 'h2', 'h3', 'form', 'label', 'a'].includes(match[1])) {
        issues.push({ 
          scope: isClientFile ? 'CLIENT' : 'OTHER',
          file: relPath, 
          line: lineNum, 
          type: 'CONCATENATED_TAG_PROP', 
          snippet: line.trim() 
        });
      }
    }

    // 4. Mojibake encoding error
    if (/(?:Ã§|Ã£|Ã©|Ã³|Ãª|Ã¡|Ãº)/.test(line)) {
      issues.push({ 
        scope: isClientFile ? 'CLIENT' : 'OTHER',
        file: relPath, 
        line: lineNum, 
        type: 'MOJIBAKE_ENCODING', 
        snippet: line.trim() 
      });
    }

    // 5. Suspicious replacement tokens like $1, $2 or undefined
    if (/\$1|\$2|\$3/.test(line) && !line.includes('replace') && !line.includes('regex') && !line.includes('RegExp') && !line.includes('css') && !line.includes('`')) {
      issues.push({ 
        scope: isClientFile ? 'CLIENT' : 'OTHER',
        file: relPath, 
        line: lineNum, 
        type: 'REGEX_REPLACEMENT_ARTIFACT', 
        snippet: line.trim() 
      });
    }
  });

  // Check using TypeScript compiler AST
  const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length > 0) {
    for (const d of sf.parseDiagnostics) {
      const { line, character } = sf.getLineAndCharacterOfPosition(d.start);
      issues.push({
        scope: isClientFile ? 'CLIENT' : 'OTHER',
        file: relPath,
        line: line + 1,
        type: 'TS_PARSE_DIAGNOSTIC',
        snippet: ts.flattenDiagnosticMessageText(d.messageText, '\n')
      });
    }
  }

  // AST traversal to check JSX elements
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const openTag = node.openingElement.tagName.getText(sf);
      const closeTag = node.closingElement.tagName.getText(sf);
      if (openTag !== closeTag) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        issues.push({
          scope: isClientFile ? 'CLIENT' : 'OTHER',
          file: relPath,
          line: line + 1,
          type: 'MISMATCHED_JSX_ELEMENT',
          snippet: `<${openTag}> closed by </${closeTag}>`
        });
      }
    }

    // Check JSX attributes for suspicious expressions
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sf);
      if (node.initializer && ts.isJsxExpression(node.initializer)) {
        const expr = node.initializer.expression;
        if (expr && ts.isBinaryExpression(expr)) {
          // If onChange or other on* event has a binary expression with assignment or comparison >
          if (attrName.startsWith('on') && (expr.operatorToken.kind === ts.SyntaxKind.GreaterThanToken || expr.operatorToken.kind === ts.SyntaxKind.FirstAssignment)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
            issues.push({
              scope: isClientFile ? 'CLIENT' : 'OTHER',
              file: relPath,
              line: line + 1,
              type: 'SUSPICIOUS_HANDLER_BINARY_EXPR',
              snippet: `${attrName}={${expr.getText(sf)}}`
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
});

console.log('=== AUDIT RESULTS SUMMARY ===');
console.log('Total issues found in src:', issues.length);
const clientIssues = issues.filter(i => i.scope === 'CLIENT');
const otherIssues = issues.filter(i => i.scope === 'OTHER');

console.log('--- Client Panel Issues (' + clientIssues.length + ') ---');
clientIssues.forEach(iss => {
  console.log(`[${iss.type}] ${iss.file}:${iss.line}`);
  console.log(`   ${iss.snippet}`);
});

console.log('\n--- Non-Client Issues (' + otherIssues.length + ') ---');
otherIssues.forEach(iss => {
  console.log(`[${iss.type}] ${iss.file}:${iss.line}`);
  console.log(`   ${iss.snippet}`);
});
