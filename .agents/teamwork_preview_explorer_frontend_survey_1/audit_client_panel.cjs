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
const clientDir = path.resolve('src/components/client');
const clientFiles = walk(clientDir);

// Add client pages as well
const clientPages = [
  path.resolve('src/pages/ClientPortal.tsx'),
  path.resolve('src/pages/ClientLoginPage.tsx'),
];
const allTargetFiles = [...clientFiles, ...clientPages];

console.log('Target files to audit:', allTargetFiles.length);

const results = {
  encodingCorruptions: [],
  jsxSyntaxErrors: [],
  classVsClassName: [],
  forVsHtmlFor: [],
  duplicateProps: [],
  conditionalHooks: [],
  brokenHandlers: [],
  missingImports: [],
  brokenTags: []
};

// Also check available exports in the project for import validation
const fileExists = (filePath) => {
  if (fs.existsSync(filePath)) return true;
  if (fs.existsSync(filePath + '.ts')) return true;
  if (fs.existsSync(filePath + '.tsx')) return true;
  if (fs.existsSync(filePath + '/index.ts')) return true;
  if (fs.existsSync(filePath + '/index.tsx')) return true;
  return false;
};

allTargetFiles.forEach(filePath => {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // 1. Encoding corruption (\uFFFD)
  if (content.includes('\uFFFD')) {
    const count = (content.match(/\uFFFD/g) || []).length;
    results.encodingCorruptions.push({
      file: relPath,
      count,
      lines: lines.map((l, idx) => l.includes('\uFFFD') ? { line: idx + 1, text: l.trim().substring(0, 100) } : null).filter(Boolean)
    });
  }

  // 2. Line by line regex checks:
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // class= instead of className=
    // Match <tag ... class="..." but not className or classList or classification
    const classMatch = line.match(/<[a-zA-Z0-9_-]+[^>]*\s+class\s*=\s*["'{]/);
    if (classMatch && !line.includes('className') && !line.includes('//') && !line.includes('/*')) {
      results.classVsClassName.push({ file: relPath, line: lineNum, text: line.trim() });
    }

    // for= instead of htmlFor=
    const forMatch = line.match(/<label[^>]*\s+for\s*=\s*["'{]/);
    if (forMatch && !line.includes('htmlFor') && !line.includes('//')) {
      results.forVsHtmlFor.push({ file: relPath, line: lineNum, text: line.trim() });
    }

    // Broken tags like <divclassName, <spanclassName, </div className
    if (/<\/[a-zA-Z0-9]+\s+[a-zA-Z]/.test(line)) {
      results.brokenTags.push({ file: relPath, line: lineNum, type: 'ATTRIBUTES_IN_CLOSING_TAG', text: line.trim() });
    }

    // Stray angle brackets e.g. >> or <<
    if (/>\s*>/.test(line) && !line.includes('=>') && !line.includes('>>') && !line.includes('>>>') && !/<[A-Z][a-zA-Z0-9_<>,\s]+>>/.test(line)) {
      // ignore typescript generic closing >>
      if (!/Array<|Record<|Promise<|Map<|Set<|ComponentProps<|React\./.test(line)) {
        // let's check if inside JSX
      }
    }
  });

  // 3. TypeScript AST parsing
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  if (sf.parseDiagnostics && sf.parseDiagnostics.length > 0) {
    for (const d of sf.parseDiagnostics) {
      const { line, character } = sf.getLineAndCharacterOfPosition(d.start);
      results.jsxSyntaxErrors.push({
        file: relPath,
        line: line + 1,
        char: character + 1,
        message: ts.flattenDiagnosticMessageText(d.messageText, '\n')
      });
    }
  }

  // 4. AST Traversal for Hook Rules, Duplicate Props, and Handlers
  function inspectNode(node, context = {}) {
    // Check JSX attributes for duplicates and handlers
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const seenProps = new Set();
      for (const prop of node.attributes.properties) {
        if (ts.isJsxAttribute(prop)) {
          const name = prop.name.getText(sf);
          if (seenProps.has(name)) {
            const { line } = sf.getLineAndCharacterOfPosition(prop.getStart());
            results.duplicateProps.push({
              file: relPath,
              line: line + 1,
              tag: node.tagName.getText(sf),
              prop: name
            });
          }
          seenProps.add(name);

          // Check handler expressions
          if (name.startsWith('on') && prop.initializer && ts.isJsxExpression(prop.initializer)) {
            const expr = prop.initializer.expression;
            if (expr) {
              // If it's a binary assignment
              if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.FirstAssignment) {
                const { line } = sf.getLineAndCharacterOfPosition(prop.getStart());
                results.brokenHandlers.push({
                  file: relPath,
                  line: line + 1,
                  type: 'ASSIGNMENT_IN_HANDLER',
                  text: prop.getText(sf)
                });
              }
              // If it's a binary comparison with > or <
              if (ts.isBinaryExpression(expr) && (expr.operatorToken.kind === ts.SyntaxKind.GreaterThanToken || expr.operatorToken.kind === ts.SyntaxKind.LessThanToken)) {
                const { line } = sf.getLineAndCharacterOfPosition(prop.getStart());
                results.brokenHandlers.push({
                  file: relPath,
                  line: line + 1,
                  type: 'COMPARISON_IN_HANDLER',
                  text: prop.getText(sf)
                });
              }
            }
          }
        }
      }
    }

    // Check hook calls inside conditionals or loops
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText(sf);
      if (/^use[A-Z]/.test(callText)) {
        if (context.inIf || context.inLoop || context.inConditional) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          results.conditionalHooks.push({
            file: relPath,
            line: line + 1,
            hook: callText,
            reason: context.inIf ? 'inside if statement' : context.inLoop ? 'inside loop' : 'inside conditional ternary'
          });
        }
      }
    }

    // Update context for children
    let newContext = { ...context };
    if (ts.isIfStatement(node)) {
      newContext.inIf = true;
    }
    if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
      newContext.inLoop = true;
    }
    if (ts.isConditionalExpression(node)) {
      newContext.inConditional = true;
    }

    ts.forEachChild(node, (child) => inspectNode(child, newContext));
  }

  inspectNode(sf);

  // 5. Check imports
  sf.statements.forEach(stmt => {
    if (ts.isImportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const importPath = stmt.moduleSpecifier.text;
      if (importPath.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filePath), importPath);
        if (!fileExists(resolved)) {
          const { line } = sf.getLineAndCharacterOfPosition(stmt.getStart());
          results.missingImports.push({
            file: relPath,
            line: line + 1,
            importPath,
            resolved
          });
        }
      }
    }
  });
});

console.log('=== AUDIT RESULTS ===');
console.log('1. Encoding Corruptions (\\uFFFD):', results.encodingCorruptions.length);
results.encodingCorruptions.forEach(e => {
  console.log(`   - ${e.file}: ${e.count} occurrences`);
  console.log(`     Sample lines: ${e.lines.slice(0, 3).map(l => 'L' + l.line + ': ' + l.text).join(' | ')}`);
});

console.log('2. JSX Parse Errors:', results.jsxSyntaxErrors.length);
results.jsxSyntaxErrors.forEach(e => console.log(`   - ${e.file}:${e.line}:${e.char} - ${e.message}`));

console.log('3. Broken Handlers:', results.brokenHandlers.length);
results.brokenHandlers.forEach(e => console.log(`   - ${e.file}:${e.line} [${e.type}]: ${e.text}`));

console.log('4. Conditional Hooks:', results.conditionalHooks.length);
results.conditionalHooks.forEach(e => console.log(`   - ${e.file}:${e.line} ${e.hook} (${e.reason})`));

console.log('5. Duplicate Props:', results.duplicateProps.length);
results.duplicateProps.forEach(e => console.log(`   - ${e.file}:${e.line} <${e.tag}> prop '${e.prop}'`));

console.log('6. Broken Tags:', results.brokenTags.length);
results.brokenTags.forEach(e => console.log(`   - ${e.file}:${e.line} [${e.type}]: ${e.text}`));

console.log('7. Missing Relative Imports:', results.missingImports.length);
results.missingImports.forEach(e => console.log(`   - ${e.file}:${e.line} import '${e.importPath}' -> NOT FOUND`));

console.log('8. class= instead of className=:', results.classVsClassName.length);
results.classVsClassName.forEach(e => console.log(`   - ${e.file}:${e.line}: ${e.text}`));

console.log('9. for= instead of htmlFor=:', results.forVsHtmlFor.length);
results.forVsHtmlFor.forEach(e => console.log(`   - ${e.file}:${e.line}: ${e.text}`));
